#!/usr/bin/env node
/**
 * TaskFlow Pro — Model Context Protocol (MCP) Server (Node.js)
 * Enables AI Agents (Google Spark, Antigravity, Claude Desktop, Cursor, Custom Agents)
 * to inspect, create, update, complete, and orchestrate tasks in TaskFlow Pro.
 *
 * Usage:
 *   # Stdio transport:
 *   node server.js --stdio
 *
 *   # SSE / HTTP transport & Web Sync Server:
 *   node server.js --sse --port 3333
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "taskflow-mcp-server";
const SERVER_VERSION = "1.0.0";

const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = {
      categories: [
        { id: "work", name: "Work & Projects", color: "#6366f1", icon: "briefcase" },
        { id: "personal", name: "Personal Life", color: "#ec4899", icon: "user" },
        { id: "study", name: "Study & Learning", color: "#06b6d4", icon: "book-open" },
        { id: "fitness", name: "Health & Fitness", color: "#10b981", icon: "activity" },
        { id: "creative", name: "Design & Code", color: "#8b5cf6", icon: "feather" },
        { id: "shopping", name: "Errands & Shopping", color: "#f59e0b", icon: "shopping-bag" }
      ],
      tasks: [],
      lastUpdated: new Date().toISOString()
    };
    saveData(defaultData);
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    console.error('[Error reading data.json]:', e);
    return { categories: [], tasks: [], lastUpdated: new Date().toISOString() };
  }
}

function saveData(data) {
  data.lastUpdated = new Date().toISOString();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Error writing data.json]:', e);
  }
}

const TOOLS = [
  {
    name: "taskflow_list_tasks",
    description: "List tasks from TaskFlow Pro with optional filters (status, category, priority, tag, search query, limit).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["all", "todo", "in_progress", "review", "completed"] },
        category: { type: "string" },
        priority: { type: "string", enum: ["all", "urgent", "high", "medium", "low"] },
        tag: { type: "string" },
        query: { type: "string" },
        limit: { type: "integer" }
      }
    }
  },
  {
    name: "taskflow_get_task",
    description: "Retrieve full details of a specific task by its ID or title match.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        titleMatch: { type: "string" }
      }
    }
  },
  {
    name: "taskflow_create_task",
    description: "Create a new task in TaskFlow Pro with title, category, priority, due date, subtasks, and tags.",
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
        status: { type: "string", enum: ["todo", "in_progress", "review", "completed"] },
        dueDate: { type: "string" },
        dueTime: { type: "string" },
        subtasks: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
        pomodorosEstimated: { type: "integer" },
        isPinned: { type: "boolean" }
      }
    }
  },
  {
    name: "taskflow_update_task",
    description: "Update attributes of an existing task (status, title, description, priority, category, dueDate, etc.).",
    inputSchema: {
      type: "object",
      required: ["taskId"],
      properties: {
        taskId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["todo", "in_progress", "review", "completed"] },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
        category: { type: "string" },
        dueDate: { type: "string" },
        dueTime: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        isPinned: { type: "boolean" }
      }
    }
  },
  {
    name: "taskflow_complete_task",
    description: "Quickly mark a task as completed or toggle its completion status.",
    inputSchema: {
      type: "object",
      required: ["taskId"],
      properties: {
        taskId: { type: "string" }
      }
    }
  },
  {
    name: "taskflow_delete_task",
    description: "Delete a task permanently by ID.",
    inputSchema: {
      type: "object",
      required: ["taskId"],
      properties: {
        taskId: { type: "string" }
      }
    }
  },
  {
    name: "taskflow_list_categories",
    description: "List all workspace categories with their colors, icons, and IDs.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "taskflow_create_category",
    description: "Create a new category in TaskFlow Pro.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        color: { type: "string" },
        icon: { type: "string" }
      }
    }
  },
  {
    name: "taskflow_get_analytics",
    description: "Retrieve comprehensive productivity statistics (total tasks, completion rate, overdue tasks, today's schedule, priority breakdown).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "taskflow_quick_add",
    description: "Smart natural-language parser to quickly create a task (e.g. 'Deploy release v2 tomorrow at 3pm #dev !urgent').",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" }
      }
    }
  }
];

function executeTool(toolName, args = {}) {
  const data = loadData();
  const tasks = data.tasks || [];
  const categories = data.categories || [];

  if (toolName === "taskflow_list_tasks") {
    const { status, category, priority, tag, query, limit = 50 } = args;
    const q = (query || "").toLowerCase().trim();

    const filtered = tasks.filter(t => {
      if (status && status !== "all" && t.status !== status) return false;
      if (category && category !== "all" && t.category !== category) return false;
      if (priority && priority !== "all" && t.priority !== priority) return false;
      if (tag && !(t.tags || []).includes(tag)) return false;
      if (q) {
        const title = (t.title || "").toLowerCase();
        const desc = (t.description || "").toLowerCase();
        const subMatch = (t.subtasks || []).some(st => (st.text || "").toLowerCase().includes(q));
        if (!title.includes(q) && !desc.includes(q) && !subMatch) return false;
      }
      return true;
    });

    return { totalMatched: filtered.length, tasks: filtered.slice(0, limit) };
  }

  if (toolName === "taskflow_get_task") {
    const { taskId, titleMatch } = args;
    const q = (titleMatch || "").toLowerCase();
    const task = tasks.find(t => (taskId && t.id === taskId) || (q && (t.title || "").toLowerCase().includes(q)));
    return task ? { task } : { error: "Task not found", taskId };
  }

  if (toolName === "taskflow_create_task") {
    const title = (args.title || "").trim();
    if (!title) return { error: "Title is required" };

    const todayStr = new Date().toISOString().split('T')[0];
    const newTask = {
      id: "task_" + Date.now().toString(36) + "_" + Math.random().toString(36).substr(2, 5),
      title,
      description: (args.description || "").trim(),
      category: args.category || "work",
      priority: args.priority || "medium",
      status: args.status || "todo",
      dueDate: args.dueDate || todayStr,
      dueTime: args.dueTime || "",
      subtasks: (args.subtasks || []).map((st, i) => ({
        id: "st_" + i + "_" + Date.now().toString(36),
        text: typeof st === 'string' ? st : (st.text || ""),
        completed: false
      })),
      tags: Array.isArray(args.tags) ? args.tags : [],
      pomodorosEstimated: Number(args.pomodorosEstimated) || 1,
      pomodorosCompleted: 0,
      createdAt: new Date().toISOString(),
      completedAt: args.status === "completed" ? new Date().toISOString() : null,
      isPinned: !!args.isPinned
    };

    tasks.unshift(newTask);
    data.tasks = tasks;
    saveData(data);
    return { success: true, createdTask: newTask };
  }

  if (toolName === "taskflow_update_task") {
    const { taskId, ...updates } = args;
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return { error: `Task ID '${taskId}' not found` };

    const oldStatus = tasks[idx].status;
    if (updates.status === 'completed' && oldStatus !== 'completed') {
      updates.completedAt = new Date().toISOString();
    } else if (updates.status && updates.status !== 'completed') {
      updates.completedAt = null;
    }

    tasks[idx] = { ...tasks[idx], ...updates };
    data.tasks = tasks;
    saveData(data);
    return { success: true, updatedTask: tasks[idx] };
  }

  if (toolName === "taskflow_complete_task") {
    const { taskId } = args;
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return { error: `Task ID '${taskId}' not found` };

    const isDone = tasks[idx].status === 'completed';
    tasks[idx].status = isDone ? 'todo' : 'completed';
    tasks[idx].completedAt = isDone ? null : new Date().toISOString();
    data.tasks = tasks;
    saveData(data);
    return { success: true, taskId, status: tasks[idx].status, completed: !isDone };
  }

  if (toolName === "taskflow_delete_task") {
    const { taskId } = args;
    const initialLen = tasks.length;
    data.tasks = tasks.filter(t => t.id !== taskId);
    if (data.tasks.length < initialLen) {
      saveData(data);
      return { success: true, deletedTaskId: taskId };
    }
    return { error: `Task ID '${taskId}' not found` };
  }

  if (toolName === "taskflow_list_categories") {
    return { categories };
  }

  if (toolName === "taskflow_create_category") {
    const name = (args.name || "").trim();
    if (!name) return { error: "Category name is required" };
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
    const newCat = {
      id,
      name,
      color: args.color || "#6366f1",
      icon: args.icon || "tag"
    };
    categories.push(newCat);
    data.categories = categories;
    saveData(data);
    return { success: true, category: newCat };
  }

  if (toolName === "taskflow_get_analytics") {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const rate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
    const todayStr = new Date().toISOString().split('T')[0];

    const dueToday = tasks.filter(t => t.dueDate === todayStr && t.status !== "completed").length;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== "completed").length;
    const urgent = tasks.filter(t => t.priority === "urgent" && t.status !== "completed").length;

    const catBreakdown = {};
    tasks.forEach(t => {
      const cat = t.category || "general";
      catBreakdown[cat] = (catBreakdown[cat] || 0) + 1;
    });

    return {
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: total - completed,
      completionRatePercent: rate,
      dueTodayCount: dueToday,
      overdueCount: overdue,
      urgentCount: urgent,
      categoryBreakdown: catBreakdown
    };
  }

  if (toolName === "taskflow_quick_add") {
    const text = (args.text || "").trim();
    let priority = "medium";
    const tags = [];
    const remaining = [];

    text.split(/\s+/).forEach(w => {
      if (w.startsWith("#") && w.length > 1) {
        tags.push(w.slice(1).toLowerCase());
      } else if (w.toLowerCase() === "!urgent" || w.toLowerCase() === "urgent!") {
        priority = "urgent";
      } else if (w.toLowerCase() === "!high" || w.toLowerCase() === "high!") {
        priority = "high";
      } else if (w.toLowerCase() === "!low" || w.toLowerCase() === "low!") {
        priority = "low";
      } else {
        remaining.push(w);
      }
    });

    return executeTool("taskflow_create_task", {
      title: remaining.join(" ") || text,
      priority,
      tags,
      category: "work"
    });
  }

  return { error: `Unknown tool '${toolName}'` };
}

function handleRpcRequest(req) {
  const { id, method, params = {} } = req;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      }
    };
  }

  if (method === "notifications/initialized" || method === "initialized") {
    return null;
  }

  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    const toolName = params.name;
    const args = params.arguments || {};
    const result = executeTool(toolName, args);
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !!result.error
      }
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method '${method}' not found` }
  };
}

function runStdio() {
  process.stderr.write(`[${SERVER_NAME} v${SERVER_VERSION}] Stdio MCP Server running (Node.js)...\n`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  rl.on('line', (line) => {
    line = line.trim();
    if (!line) return;
    try {
      const req = JSON.parse(line);
      const resp = handleRpcRequest(req);
      if (resp) {
        process.stdout.write(JSON.stringify(resp) + "\n");
      }
    } catch (e) {
      process.stderr.write(`[Error processing request]: ${e.message}\n`);
    }
  });
}

function runHttp(port = 3333) {
  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (req.method === "GET") {
      if (pathname === "/api/health" || pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          status: "online",
          server: SERVER_NAME,
          version: SERVER_VERSION,
          protocolVersion: PROTOCOL_VERSION,
          toolsCount: TOOLS.length,
          timestamp: new Date().toISOString()
        }));
      }

      if (pathname === "/api/tasks" || pathname === "/api/sync") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(loadData()));
      }

      if (pathname === "/sse") {
        const sessionId = Math.random().toString(36).substr(2, 9);
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        });

        res.write(`event: endpoint\ndata: /message?sessionId=${sessionId}\n\n`);
        const interval = setInterval(() => {
          res.write(`: ping\n\n`);
        }, 15000);

        req.on('close', () => clearInterval(interval));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Endpoint not found" }));
    }

    if (req.method === "POST") {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body || '{}'); } catch (e) {}

        if (pathname === "/mcp" || pathname === "/message" || pathname === "/") {
          const resp = handleRpcRequest(payload);
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify(resp || {}));
        }

        if (pathname === "/api/sync") {
          const currentData = loadData();
          if (payload.tasks) currentData.tasks = payload.tasks;
          if (payload.categories) currentData.categories = payload.categories;
          saveData(currentData);
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ success: true, syncedTasks: currentData.tasks.length }));
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Endpoint not found" }));
      });
    }
  });

  server.listen(port, () => {
    console.log(`================================================================`);
    console.log(` TaskFlow Pro — MCP & AI Integration Server (Node.js)`);
    console.log(` Version: ${SERVER_VERSION} | Protocol: ${PROTOCOL_VERSION}`);
    console.log(`================================================================`);
    console.log(` • SSE Endpoint (Google Spark / Claude): http://localhost:${port}/sse`);
    console.log(` • JSON-RPC Endpoint:                   http://localhost:${port}/mcp`);
    console.log(` • Web App Sync Endpoint:               http://localhost:${port}/api/sync`);
    console.log(` • Health Check:                        http://localhost:${port}/api/health`);
    console.log(`================================================================`);
    console.log(`Server is actively listening on port ${port} (Ctrl+C to stop)...`);
  });
}

const args = process.argv.slice(2);
const isSse = args.includes('--sse');
const portIdx = args.indexOf('--port');
const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1], 10) : 3333;

if (isSse) {
  runHttp(port);
} else {
  runStdio();
}
