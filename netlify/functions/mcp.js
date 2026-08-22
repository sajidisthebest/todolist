/**
 * TaskFlow Pro — Serverless Model Context Protocol (MCP) API Endpoint
 * Deployed automatically on Netlify & Vercel
 * 
 * Accessible at:
 *   https://sajidxtodo.netlify.app/api/mcp
 *   https://sajidxtodo.netlify.app/api/sse
 *   https://sajidxtodo.netlify.app/.netlify/functions/mcp
 */

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "taskflow-mcp-cloud";
const SERVER_VERSION = "1.0.0";

// In-memory persistent state during lambda lifecycle
let inMemoryStore = {
  categories: [
    { id: "work", name: "Work & Projects", color: "#6366f1", icon: "briefcase" },
    { id: "personal", name: "Personal Life", color: "#ec4899", icon: "user" },
    { id: "study", name: "Study & Learning", color: "#06b6d4", icon: "book-open" },
    { id: "fitness", name: "Health & Fitness", color: "#10b981", icon: "activity" },
    { id: "creative", name: "Design & Code", color: "#8b5cf6", icon: "feather" },
    { id: "shopping", name: "Errands & Shopping", color: "#f59e0b", icon: "shopping-bag" }
  ],
  tasks: [
    {
      id: "task_cloud_welcome",
      title: "✨ Connected to Google Spark & Cloud AI via Netlify MCP",
      description: "TaskFlow Pro Serverless MCP is live on Netlify! Cloud agents can inspect, create, update, and manage your tasks 24/7.",
      category: "work",
      priority: "urgent",
      status: "in_progress",
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: "12:00",
      subtasks: [
        { id: "st_1", text: "Deploy Serverless MCP to Netlify", completed: true },
        { id: "st_2", text: "Connect Google Spark with Cloud HTTPS endpoint", completed: true },
        { id: "st_3", text: "Automate daily task management with AI", completed: false }
      ],
      tags: ["mcp", "google-spark", "cloud", "netlify"],
      pomodorosEstimated: 2,
      pomodorosCompleted: 1,
      createdAt: new Date().toISOString(),
      completedAt: null,
      isPinned: true
    }
  ],
  lastUpdated: new Date().toISOString()
};

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
    name: "taskflow_quick_add",
    description: "Smart natural-language parser to quickly create a task (e.g. 'Deploy update tomorrow at 3pm #dev !urgent').",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" }
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
    name: "taskflow_get_analytics",
    description: "Retrieve comprehensive productivity statistics (total tasks, completion rate, overdue tasks, today's schedule, priority breakdown).",
    inputSchema: { type: "object", properties: {} }
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
  }
];

function executeTool(toolName, args = {}) {
  const tasks = inMemoryStore.tasks;
  const categories = inMemoryStore.categories;

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
    inMemoryStore.lastUpdated = new Date().toISOString();
    return { success: true, createdTask: newTask };
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
    inMemoryStore.lastUpdated = new Date().toISOString();
    return { success: true, updatedTask: tasks[idx] };
  }

  if (toolName === "taskflow_complete_task") {
    const { taskId } = args;
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return { error: `Task ID '${taskId}' not found` };

    const isDone = tasks[idx].status === 'completed';
    tasks[idx].status = isDone ? 'todo' : 'completed';
    tasks[idx].completedAt = isDone ? null : new Date().toISOString();
    inMemoryStore.lastUpdated = new Date().toISOString();
    return { success: true, taskId, status: tasks[idx].status, completed: !isDone };
  }

  if (toolName === "taskflow_delete_task") {
    const { taskId } = args;
    const initialLen = tasks.length;
    inMemoryStore.tasks = tasks.filter(t => t.id !== taskId);
    if (inMemoryStore.tasks.length < initialLen) {
      inMemoryStore.lastUpdated = new Date().toISOString();
      return { success: true, deletedTaskId: taskId };
    }
    return { error: `Task ID '${taskId}' not found` };
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
    inMemoryStore.lastUpdated = new Date().toISOString();
    return { success: true, category: newCat };
  }

  return { error: `Unknown tool '${toolName}'` };
}

function handleRpc(req) {
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

  if (method === "notifications/initialized" || method === "initialized" || method === "ping") {
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

// Netlify & Vercel serverless function handler
exports.handler = async function (event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-session-id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const query = event.queryStringParameters || {};

  // GET requests
  if (event.httpMethod === "GET") {
    if (query.action === "health" || query.action === "status" || event.path.endsWith("/health")) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: "online",
          server: SERVER_NAME,
          version: SERVER_VERSION,
          deployment: "Netlify Serverless Cloud",
          protocolVersion: PROTOCOL_VERSION,
          toolsCount: TOOLS.length,
          timestamp: new Date().toISOString()
        })
      };
    }

    if (query.action === "sync" || query.action === "tasks" || event.path.endsWith("/sync") || event.path.endsWith("/tasks")) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(inMemoryStore)
      };
    }

    // Default GET return protocol info & tools list for easy inspection
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        server: SERVER_NAME,
        status: "online",
        protocolVersion: PROTOCOL_VERSION,
        endpoints: {
          jsonrpc_post: event.rawUrl || "https://sajidxtodo.netlify.app/api/mcp",
          health: "https://sajidxtodo.netlify.app/api/mcp?action=health",
          sync: "https://sajidxtodo.netlify.app/api/mcp?action=sync"
        },
        tools: TOOLS
      }, null, 2)
    };
  }

  // POST requests (JSON-RPC 2.0 or Client Sync)
  if (event.httpMethod === "POST") {
    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (e) {
      payload = {};
    }

    // Handle client task sync
    if (query.action === "sync" || payload.syncType === "bulk") {
      if (Array.isArray(payload.tasks)) inMemoryStore.tasks = payload.tasks;
      if (Array.isArray(payload.categories)) inMemoryStore.categories = payload.categories;
      inMemoryStore.lastUpdated = new Date().toISOString();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, syncedTasks: inMemoryStore.tasks.length })
      };
    }

    // Handle JSON-RPC MCP
    const response = handleRpc(payload);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response || {})
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: "Method Not Allowed" })
  };
};
