# TaskFlow Pro — Model Context Protocol (MCP) Integration Guide

TaskFlow Pro provides a full **Model Context Protocol (MCP)** server, allowing AI agents like **Google Spark**, **Google Antigravity**, **Claude Desktop**, and **Cursor** to manage your tasks, categorize items, set priorities, track focus sessions, and summarize productivity metrics.

---

## ⚡ Quick Start

### 1. Launch the MCP Server & Sync Bridge
Double-click `run-mcp-server.bat` (Windows) or run in terminal:

```bash
# Python 3:
py mcp-server/server.py --sse --port 3333

# Or Node.js:
node mcp-server/server.js --sse --port 3333
```

When running, the server exposes:
- **SSE Stream Endpoint (Google Spark / Claude)**: `http://localhost:3333/sse`
- **JSON-RPC Endpoint**: `http://localhost:3333/mcp`
- **Web App Live Sync API**: `http://localhost:3333/api/sync`
- **Health Check**: `http://localhost:3333/api/health`

---

## 🔌 Connecting to AI Apps

### 1. Google Spark / Remote SSE Clients
Configure your client to point to the SSE URL:
```json
{
  "mcpServers": {
    "taskflow": {
      "serverUrl": "http://localhost:3333/sse",
      "transport": "sse"
    }
  }
}
```

### 2. Google Antigravity
The workspace plugin is pre-configured in `.agents/plugins/taskflow/` and `.agents/mcp_config.json`:
```json
{
  "mcpServers": {
    "taskflow": {
      "command": "py",
      "args": ["-3", "mcp-server/server.py", "--stdio"],
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

### 3. Claude Desktop (`claude_desktop_config.json`)
Add the following to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):
```json
{
  "mcpServers": {
    "taskflow-pro": {
      "command": "py",
      "args": ["e:\\Antigravity\\To do list\\mcp-server\\server.py", "--stdio"]
    }
  }
}
```

### 4. Cursor / VS Code (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "taskflow": {
      "command": "py",
      "args": ["-3", "mcp-server/server.py", "--stdio"]
    }
  }
}
```

---

## 🛠️ Available MCP Tools (10)

| Tool Name | Type | Description |
| :--- | :--- | :--- |
| `taskflow_list_tasks` | Read | Fetch tasks with filters (`status`, `category`, `priority`, `tag`, `query`, `limit`) |
| `taskflow_get_task` | Read | Fetch single task details by `taskId` or `titleMatch` |
| `taskflow_create_task` | Write | Create a task with title, description, category, priority, due date, subtasks, tags |
| `taskflow_quick_add` | NLP/Write | Natural language parsing (e.g. `Deliver prototype tomorrow at 3pm #design !urgent`) |
| `taskflow_update_task` | Write | Edit task title, status, priority, category, or due date |
| `taskflow_complete_task` | Write | Mark task as completed or toggle completion status |
| `taskflow_delete_task` | Delete | Permanently delete task by ID |
| `taskflow_get_analytics` | Read | Calculate completion velocity, overdue counts, and category breakdowns |
| `taskflow_list_categories` | Read | List all workspaces/categories with colors and icons |
| `taskflow_create_category` | Write | Add a new workspace category |

---

## 💻 Web App MCP Studio & Playground

Open TaskFlow Pro in your browser and click the **🤖 MCP & AI** button in the header or sidebar:
1. **Connect Tab**: One-click copy configuration snippets for all major AI clients.
2. **Live Sync Tab**: Push local tasks to MCP storage or pull MCP updates into the browser.
3. **Tool Playground**: Test any MCP tool with real-time JSON-RPC 2.0 execution and latency counter.
4. **Tools Directory**: Interactive schema explorer and documentation.
