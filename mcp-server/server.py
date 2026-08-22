#!/usr/bin/env python3
"""
TaskFlow Pro — Model Context Protocol (MCP) Server
Enables AI Agents (Google Spark, Antigravity, Claude Desktop, Cursor, Custom Agents)
to inspect, create, update, complete, and orchestrate tasks in TaskFlow Pro.

Usage:
  # Stdio transport (default for AI IDEs & CLI assistants):
  python server.py --stdio

  # SSE / HTTP transport & Web Sync Server (for Google Spark & web sync):
  python server.py --sse --port 3333
"""

import sys
import os
import json
import uuid
import time
import argparse
from datetime import datetime, date
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading

# Ensure UTF-8 stream encoding across Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "taskflow-mcp-server"
SERVER_VERSION = "1.0.0"

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DATA_DIR, "data.json")

# ---------------------------------------------------------------------------
# Database Helper
# ---------------------------------------------------------------------------
def load_data():
    if not os.path.exists(DATA_FILE):
        default_data = {
            "categories": [
                {"id": "work", "name": "Work & Projects", "color": "#6366f1", "icon": "briefcase"},
                {"id": "personal", "name": "Personal Life", "color": "#ec4899", "icon": "user"},
                {"id": "study", "name": "Study & Learning", "color": "#06b6d4", "icon": "book-open"},
                {"id": "fitness", "name": "Health & Fitness", "color": "#10b981", "icon": "activity"},
                {"id": "creative", "name": "Design & Code", "color": "#8b5cf6", "icon": "feather"},
                {"id": "shopping", "name": "Errands & Shopping", "color": "#f59e0b", "icon": "shopping-bag"}
            ],
            "tasks": [],
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        }
        save_data(default_data)
        return default_data
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        sys.stderr.write(f"[Error loading data]: {e}\n")
        return {"categories": [], "tasks": [], "lastUpdated": datetime.utcnow().isoformat() + "Z"}

def save_data(data):
    data["lastUpdated"] = datetime.utcnow().isoformat() + "Z"
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        sys.stderr.write(f"[Error saving data]: {e}\n")

# ---------------------------------------------------------------------------
# Tool Definitions (MCP Schema)
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "name": "taskflow_list_tasks",
        "description": "List tasks from TaskFlow Pro with optional filters (status, category, priority, tag, search query, limit).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["all", "todo", "in_progress", "review", "completed"],
                    "description": "Filter tasks by status"
                },
                "category": {
                    "type": "string",
                    "description": "Filter tasks by category ID (e.g. 'work', 'personal', 'study', 'fitness', 'creative', 'shopping')"
                },
                "priority": {
                    "type": "string",
                    "enum": ["all", "urgent", "high", "medium", "low"],
                    "description": "Filter tasks by priority"
                },
                "tag": {
                    "type": "string",
                    "description": "Filter tasks containing this specific tag"
                },
                "query": {
                    "type": "string",
                    "description": "Search keyword matching title, description, or subtasks"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of tasks to return (default 50)"
                }
            }
        }
    },
    {
        "name": "taskflow_get_task",
        "description": "Retrieve full details of a specific task by its ID or title match.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "taskId": {
                    "type": "string",
                    "description": "Unique task ID (e.g. 'task_123456')"
                },
                "titleMatch": {
                    "type": "string",
                    "description": "Task title keyword if taskId is unknown"
                }
            }
        }
    },
    {
        "name": "taskflow_create_task",
        "description": "Create a new task in TaskFlow Pro with title, category, priority, due date, subtasks, and tags.",
        "inputSchema": {
            "type": "object",
            "required": ["title"],
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Title of the task"
                },
                "description": {
                    "type": "string",
                    "description": "Detailed description or notes for the task"
                },
                "category": {
                    "type": "string",
                    "description": "Category ID (e.g. 'work', 'personal', 'study', 'fitness', 'creative', 'shopping'). Defaults to 'work'."
                },
                "priority": {
                    "type": "string",
                    "enum": ["urgent", "high", "medium", "low"],
                    "description": "Task priority level. Defaults to 'medium'."
                },
                "status": {
                    "type": "string",
                    "enum": ["todo", "in_progress", "review", "completed"],
                    "description": "Initial task status. Defaults to 'todo'."
                },
                "dueDate": {
                    "type": "string",
                    "description": "Due date in YYYY-MM-DD format (e.g. '2026-08-23'). Defaults to today."
                },
                "dueTime": {
                    "type": "string",
                    "description": "Due time in HH:MM 24-hr format (e.g. '14:30')"
                },
                "subtasks": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of subtask title strings"
                },
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of tags (e.g. ['roadmap', 'frontend'])"
                },
                "pomodorosEstimated": {
                    "type": "integer",
                    "description": "Estimated focus pomodoro sessions (default 1)"
                },
                "isPinned": {
                    "type": "boolean",
                    "description": "Pin task to top of list"
                }
            }
        }
    },
    {
        "name": "taskflow_update_task",
        "description": "Update attributes of an existing task (status, title, description, priority, category, dueDate, etc.).",
        "inputSchema": {
            "type": "object",
            "required": ["taskId"],
            "properties": {
                "taskId": {
                    "type": "string",
                    "description": "The unique ID of the task to update"
                },
                "title": {"type": "string"},
                "description": {"type": "string"},
                "status": {
                    "type": "string",
                    "enum": ["todo", "in_progress", "review", "completed"]
                },
                "priority": {
                    "type": "string",
                    "enum": ["urgent", "high", "medium", "low"]
                },
                "category": {"type": "string"},
                "dueDate": {"type": "string"},
                "dueTime": {"type": "string"},
                "tags": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "isPinned": {"type": "boolean"}
            }
        }
    },
    {
        "name": "taskflow_complete_task",
        "description": "Quickly mark a task as completed or toggle its completion status.",
        "inputSchema": {
            "type": "object",
            "required": ["taskId"],
            "properties": {
                "taskId": {
                    "type": "string",
                    "description": "The unique ID of the task to mark completed"
                }
            }
        }
    },
    {
        "name": "taskflow_delete_task",
        "description": "Delete a task permanently by ID.",
        "inputSchema": {
            "type": "object",
            "required": ["taskId"],
            "properties": {
                "taskId": {
                    "type": "string",
                    "description": "The unique ID of the task to delete"
                }
            }
        }
    },
    {
        "name": "taskflow_list_categories",
        "description": "List all workspace categories with their colors, icons, and IDs.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "taskflow_create_category",
        "description": "Create a new category in TaskFlow Pro.",
        "inputSchema": {
            "type": "object",
            "required": ["name"],
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Display name of the category"
                },
                "color": {
                    "type": "string",
                    "description": "Hex color code (e.g. '#6366f1')"
                },
                "icon": {
                    "type": "string",
                    "description": "Icon identifier (e.g. 'briefcase', 'star', 'code', 'book')"
                }
            }
        }
    },
    {
        "name": "taskflow_get_analytics",
        "description": "Retrieve comprehensive productivity statistics (total tasks, completion rate, overdue tasks, today's schedule, priority breakdown).",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "taskflow_quick_add",
        "description": "Smart natural-language parser to quickly create a task (e.g. 'Deploy release v2 tomorrow at 3pm #dev !urgent').",
        "inputSchema": {
            "type": "object",
            "required": ["text"],
            "properties": {
                "text": {
                    "type": "string",
                    "description": "Natural language task string with optional tags (#tag), priority (!urgent, !high), or due dates"
                }
            }
        }
    }
]

# ---------------------------------------------------------------------------
# Tool Execution Logic
# ---------------------------------------------------------------------------
def execute_tool(tool_name, arguments):
    data = load_data()
    tasks = data.get("tasks", [])
    categories = data.get("categories", [])

    if tool_name == "taskflow_list_tasks":
        status = arguments.get("status")
        category = arguments.get("category")
        priority = arguments.get("priority")
        tag = arguments.get("tag")
        query = arguments.get("query", "").lower().strip()
        limit = arguments.get("limit", 50)

        filtered = []
        for t in tasks:
            if status and status != "all" and t.get("status") != status:
                continue
            if category and category != "all" and t.get("category") != category:
                continue
            if priority and priority != "all" and t.get("priority") != priority:
                continue
            if tag and tag not in t.get("tags", []):
                continue
            if query:
                title = t.get("title", "").lower()
                desc = t.get("description", "").lower()
                sub_matches = any(query in st.get("text", "").lower() for st in t.get("subtasks", []))
                if query not in title and query not in desc and not sub_matches:
                    continue
            filtered.append(t)

        return {
            "totalMatched": len(filtered),
            "tasks": filtered[:limit]
        }

    elif tool_name == "taskflow_get_task":
        task_id = arguments.get("taskId")
        title_match = arguments.get("titleMatch", "").lower()

        for t in tasks:
            if task_id and t.get("id") == task_id:
                return {"task": t}
            if title_match and title_match in t.get("title", "").lower():
                return {"task": t}

        return {"error": "Task not found", "taskId": task_id}

    elif tool_name == "taskflow_create_task":
        title = arguments.get("title", "").strip()
        if not title:
            return {"error": "Title is required"}

        today_str = date.today().isoformat()
        new_task = {
            "id": f"task_{int(time.time()*1000)}_{uuid.uuid4().hex[:5]}",
            "title": title,
            "description": arguments.get("description", "").strip(),
            "category": arguments.get("category", "work"),
            "priority": arguments.get("priority", "medium"),
            "status": arguments.get("status", "todo"),
            "dueDate": arguments.get("dueDate") or today_str,
            "dueTime": arguments.get("dueTime", ""),
            "subtasks": [
                {"id": f"st_{i}_{uuid.uuid4().hex[:4]}", "text": st, "completed": False}
                for i, st in enumerate(arguments.get("subtasks", []))
            ],
            "tags": arguments.get("tags", []),
            "pomodorosEstimated": int(arguments.get("pomodorosEstimated", 1)),
            "pomodorosCompleted": 0,
            "createdAt": datetime.utcnow().isoformat() + "Z",
            "completedAt": datetime.utcnow().isoformat() + "Z" if arguments.get("status") == "completed" else None,
            "isPinned": bool(arguments.get("isPinned", False))
        }

        tasks.insert(0, new_task)
        data["tasks"] = tasks
        save_data(data)
        return {"success": True, "createdTask": new_task}

    elif tool_name == "taskflow_update_task":
        task_id = arguments.get("taskId")
        for i, t in enumerate(tasks):
            if t.get("id") == task_id:
                for k, v in arguments.items():
                    if k != "taskId" and v is not None:
                        t[k] = v
                if arguments.get("status") == "completed" and not t.get("completedAt"):
                    t["completedAt"] = datetime.utcnow().isoformat() + "Z"
                elif arguments.get("status") and arguments.get("status") != "completed":
                    t["completedAt"] = None

                tasks[i] = t
                data["tasks"] = tasks
                save_data(data)
                return {"success": True, "updatedTask": t}

        return {"error": f"Task ID '{task_id}' not found"}

    elif tool_name == "taskflow_complete_task":
        task_id = arguments.get("taskId")
        for i, t in enumerate(tasks):
            if t.get("id") == task_id:
                is_completed = t.get("status") == "completed"
                t["status"] = "todo" if is_completed else "completed"
                t["completedAt"] = None if is_completed else (datetime.utcnow().isoformat() + "Z")
                tasks[i] = t
                data["tasks"] = tasks
                save_data(data)
                return {
                    "success": True,
                    "taskId": task_id,
                    "status": t["status"],
                    "completed": not is_completed
                }
        return {"error": f"Task ID '{task_id}' not found"}

    elif tool_name == "taskflow_delete_task":
        task_id = arguments.get("taskId")
        new_tasks = [t for t in tasks if t.get("id") != task_id]
        if len(new_tasks) < len(tasks):
            data["tasks"] = new_tasks
            save_data(data)
            return {"success": True, "deletedTaskId": task_id}
        return {"error": f"Task ID '{task_id}' not found"}

    elif tool_name == "taskflow_list_categories":
        return {"categories": categories}

    elif tool_name == "taskflow_create_category":
        name = arguments.get("name", "").strip()
        if not name:
            return {"error": "Category name is required"}
        cat_id = name.lower().replace(" ", "-") + "-" + uuid.uuid4().hex[:4]
        new_cat = {
            "id": cat_id,
            "name": name,
            "color": arguments.get("color", "#6366f1"),
            "icon": arguments.get("icon", "tag")
        }
        categories.append(new_cat)
        data["categories"] = categories
        save_data(data)
        return {"success": True, "category": new_cat}

    elif tool_name == "taskflow_get_analytics":
        total = len(tasks)
        completed = sum(1 for t in tasks if t.get("status") == "completed")
        rate = round((completed / total * 100), 1) if total > 0 else 0
        today_str = date.today().isoformat()

        today_count = sum(1 for t in tasks if t.get("dueDate") == today_str and t.get("status") != "completed")
        overdue_count = sum(1 for t in tasks if t.get("dueDate") and t.get("dueDate") < today_str and t.get("status") != "completed")
        urgent_count = sum(1 for t in tasks if t.get("priority") == "urgent" and t.get("status") != "completed")

        by_category = {}
        for t in tasks:
            cat = t.get("category", "general")
            by_category[cat] = by_category.get(cat, 0) + 1

        return {
            "totalTasks": total,
            "completedTasks": completed,
            "pendingTasks": total - completed,
            "completionRatePercent": rate,
            "dueTodayCount": today_count,
            "overdueCount": overdue_count,
            "urgentCount": urgent_count,
            "categoryBreakdown": by_category
        }

    elif tool_name == "taskflow_quick_add":
        text = arguments.get("text", "").strip()
        priority = "medium"
        tags = []
        clean_text = text

        # Parse tags #tag
        words = clean_text.split()
        remaining_words = []
        for w in words:
            if w.startswith("#") and len(w) > 1:
                tags.append(w[1:].lower())
            elif w.lower() in ["!urgent", "urgent!"]:
                priority = "urgent"
            elif w.lower() in ["!high", "high!"]:
                priority = "high"
            elif w.lower() in ["!low", "low!"]:
                priority = "low"
            else:
                remaining_words.append(w)

        title = " ".join(remaining_words) or text
        return execute_tool("taskflow_create_task", {
            "title": title,
            "priority": priority,
            "tags": tags,
            "category": "work"
        })

    else:
        return {"error": f"Unknown tool '{tool_name}'"}

# ---------------------------------------------------------------------------
# MCP Protocol Request Handler
# ---------------------------------------------------------------------------
def handle_rpc_request(req):
    req_id = req.get("id")
    method = req.get("method")
    params = req.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {
                    "tools": {
                        "listChanged": False
                    }
                },
                "serverInfo": {
                    "name": SERVER_NAME,
                    "version": SERVER_VERSION
                }
            }
        }

    elif method == "notifications/initialized" or method == "initialized":
        return None

    elif method == "ping":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {}
        }

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": TOOLS
            }
        }

    elif method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        result = execute_tool(tool_name, arguments)
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result, indent=2, ensure_ascii=False)
                    }
                ],
                "isError": "error" in result
            }
        }

    else:
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {
                "code": -32601,
                "message": f"Method '{method}' not found"
            }
        }

# ---------------------------------------------------------------------------
# Stdio Server Mode
# ---------------------------------------------------------------------------
def run_stdio():
    sys.stderr.write(f"[{SERVER_NAME} v{SERVER_VERSION}] Stdio MCP Server running. Awaiting JSON-RPC requests...\n")
    sys.stderr.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            resp = handle_rpc_request(req)
            if resp is not None:
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"[Error processing request]: {e}\n")
            sys.stderr.flush()

# ---------------------------------------------------------------------------
# HTTP / SSE / REST Server Mode
# ---------------------------------------------------------------------------
class MCPHttpHandler(BaseHTTPRequestHandler):
    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-session-id")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health" or path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            status = {
                "status": "online",
                "server": SERVER_NAME,
                "version": SERVER_VERSION,
                "protocolVersion": PROTOCOL_VERSION,
                "toolsCount": len(TOOLS),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            self.wfile.write(json.dumps(status).encode("utf-8"))

        elif path == "/api/tasks" or path == "/api/sync":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            data = load_data()
            self.wfile.write(json.dumps(data).encode("utf-8"))

        elif path == "/sse":
            # SSE stream endpoint for MCP clients like Google Spark / Claude SSE
            session_id = str(uuid.uuid4())
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self._send_cors()
            self.end_headers()

            # Emit endpoint event per MCP SSE spec
            endpoint_msg = f"event: endpoint\ndata: /message?sessionId={session_id}\n\n"
            self.wfile.write(endpoint_msg.encode("utf-8"))
            self.wfile.flush()

            try:
                while True:
                    time.sleep(15)
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
            except Exception:
                pass

        else:
            self.send_response(404)
            self._send_cors()
            self.end_headers()
            self.wfile.write(b'{"error": "Endpoint not found"}')

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"

        try:
            payload = json.loads(body)
        except Exception:
            payload = {}

        if path == "/mcp" or path == "/message" or path == "/":
            # Standard JSON-RPC MCP endpoint
            resp = handle_rpc_request(payload)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps(resp or {}).encode("utf-8"))

        elif path == "/api/sync":
            # Bulk sync from web client localStorage
            incoming_tasks = payload.get("tasks", [])
            incoming_cats = payload.get("categories", [])
            current_data = load_data()

            # Merge or overwrite with latest client data
            if incoming_tasks:
                current_data["tasks"] = incoming_tasks
            if incoming_cats:
                current_data["categories"] = incoming_cats

            save_data(current_data)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "syncedTasks": len(current_data["tasks"])}).encode("utf-8"))

        else:
            self.send_response(404)
            self._send_cors()
            self.end_headers()
            self.wfile.write(b'{"error": "Endpoint not found"}')

    def log_message(self, format, *args):
        # Keep stdout clean unless debugging
        pass

def run_http_sse(port=3333):
    server = HTTPServer(("0.0.0.0", port), MCPHttpHandler)
    print(f"================================================================")
    print(f" TaskFlow Pro — MCP & AI Integration Server")
    print(f" Version: {SERVER_VERSION} | Protocol: {PROTOCOL_VERSION}")
    print(f"================================================================")
    print(f" • SSE Endpoint (Google Spark / Claude): http://localhost:{port}/sse")
    print(f" • JSON-RPC Endpoint:                   http://localhost:{port}/mcp")
    print(f" • Web App Sync Endpoint:               http://localhost:{port}/api/sync")
    print(f" • Health Check:                        http://localhost:{port}/api/health")
    print(f"================================================================")
    print(f"Server is actively listening on port {port} (Ctrl+C to stop)...")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping MCP Server...")
        server.server_close()

# ---------------------------------------------------------------------------
# Main Entry Point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TaskFlow Pro MCP Server")
    parser.add_argument("--stdio", action="store_true", help="Run in Stdio transport mode (default)")
    parser.add_argument("--sse", action="store_true", help="Run HTTP/SSE transport server")
    parser.add_argument("--port", type=int, default=3333, help="Port for HTTP/SSE server (default 3333)")

    args = parser.parse_args()

    if args.sse:
        run_http_sse(args.port)
    else:
        # Default to stdio mode
        run_stdio()
