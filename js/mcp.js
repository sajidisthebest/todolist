/**
 * TaskFlow Pro — MCP (Model Context Protocol) Bridge & AI Integration Manager
 * Manages bi-directional sync, client connection cards, schema inspector, and interactive tool playground.
 */

class MCPBridge {
  constructor() {
    this.serverUrl = 'http://localhost:3333';
    this.isConnected = false;
    this.autoSyncEnabled = false;
    this.autoSyncTimer = null;
    this.lastSyncTime = null;

    this.init();
  }

  init() {
    // Check server status periodically
    this.checkHealth();
    setInterval(() => this.checkHealth(), 10000);
  }

  async checkHealth() {
    try {
      const res = await fetch(`${this.serverUrl}/api/health`, { method: 'GET', signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        this.isConnected = true;
        this.updateStatusBadge(true, data);
        return true;
      }
    } catch (e) {
      this.isConnected = false;
      this.updateStatusBadge(false);
      return false;
    }
  }

  updateStatusBadge(online, data = null) {
    const badge = document.getElementById('mcp-status-indicator');
    const label = document.getElementById('mcp-status-label');
    const headerBtn = document.getElementById('header-mcp-btn');

    if (badge) {
      badge.className = `mcp-status-dot ${online ? 'online' : 'offline'}`;
    }
    if (label) {
      label.textContent = online ? `Connected (Port 3333 • ${data ? data.toolsCount : 10} Tools Active)` : 'Offline (Click "Run Server" to start)';
    }
    if (headerBtn) {
      const dot = headerBtn.querySelector('.header-mcp-dot');
      if (dot) dot.className = `header-mcp-dot ${online ? 'online' : 'offline'}`;
    }
  }

  openModal() {
    const modal = document.getElementById('mcp-modal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      this.checkHealth();
      this.renderPlaygroundSchema();
    }
  }

  closeModal() {
    const modal = document.getElementById('mcp-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // -------------------------------------------------------------------------
  // Bi-directional Sync
  // -------------------------------------------------------------------------
  async pushToMCP() {
    if (!window.taskStore) return;
    try {
      const payload = {
        tasks: window.taskStore.tasks || [],
        categories: window.taskStore.categories || []
      };

      const res = await fetch(`${this.serverUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        this.lastSyncTime = new Date();
        this.updateSyncTimeUI();
        if (window.app) window.app.showToast(`Pushed ${data.syncedTasks || payload.tasks.length} tasks to MCP Server! 🚀`, 'success');
      } else {
        throw new Error('Server returned error status');
      }
    } catch (e) {
      if (window.app) window.app.showToast('MCP Server offline. Start it with run-mcp-server.bat', 'error');
    }
  }

  async pullFromMCP() {
    if (!window.taskStore) return;
    try {
      const res = await fetch(`${this.serverUrl}/api/tasks`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tasks)) {
          window.taskStore.tasks = data.tasks;
        }
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          window.taskStore.categories = data.categories;
        }
        window.taskStore.saveTasks();
        window.taskStore.saveCategories();

        if (window.app) {
          window.app.render();
          window.app.showToast(`Synced ${window.taskStore.tasks.length} tasks from MCP Server! ✨`, 'success');
        }
        this.lastSyncTime = new Date();
        this.updateSyncTimeUI();
      }
    } catch (e) {
      if (window.app) window.app.showToast('Could not reach MCP Server on port 3333.', 'error');
    }
  }

  toggleAutoSync() {
    this.autoSyncEnabled = !this.autoSyncEnabled;
    const btn = document.getElementById('mcp-autosync-toggle-btn');
    if (btn) {
      btn.classList.toggle('active', this.autoSyncEnabled);
      btn.innerHTML = this.autoSyncEnabled ? '<span>🔄 Auto-Sync: <b>ON</b></span>' : '<span>🔄 Auto-Sync: <b>OFF</b></span>';
    }

    if (this.autoSyncEnabled) {
      this.autoSyncTimer = setInterval(() => {
        if (this.isConnected) this.pushToMCP();
      }, 15000);
      if (window.app) window.app.showToast('Real-time Auto-Sync enabled (every 15s)', 'info');
    } else {
      if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);
      if (window.app) window.app.showToast('Auto-Sync disabled', 'info');
    }
  }

  updateSyncTimeUI() {
    const el = document.getElementById('mcp-last-sync-label');
    if (el && this.lastSyncTime) {
      el.textContent = `Last sync: ${this.lastSyncTime.toLocaleTimeString()}`;
    }
  }

  // -------------------------------------------------------------------------
  // Interactive MCP Tool Playground Simulator
  // -------------------------------------------------------------------------
  renderPlaygroundSchema() {
    const select = document.getElementById('mcp-playground-tool-select');
    if (!select) return;

    const sampleArgs = {
      'taskflow_list_tasks': '{\n  "status": "all",\n  "limit": 10\n}',
      'taskflow_get_task': '{\n  "titleMatch": "MCP"\n}',
      'taskflow_create_task': '{\n  "title": "Build AI feature with Google Spark",\n  "category": "work",\n  "priority": "urgent",\n  "tags": ["spark", "ai", "mcp"],\n  "subtasks": ["Define prompt templates", "Test MCP tools"]\n}',
      'taskflow_quick_add': '{\n  "text": "Review architecture deck tomorrow 3pm #roadmap !urgent"\n}',
      'taskflow_complete_task': '{\n  "taskId": "task_mcp_welcome"\n}',
      'taskflow_get_analytics': '{}',
      'taskflow_list_categories': '{}',
      'taskflow_create_category': '{\n  "name": "AI & Automation",\n  "color": "#ec4899",\n  "icon": "cpu"\n}'
    };

    const currentTool = select.value || 'taskflow_list_tasks';
    const inputArea = document.getElementById('mcp-playground-args');
    if (inputArea && !inputArea.value) {
      inputArea.value = sampleArgs[currentTool] || '{}';
    }
  }

  onPlaygroundToolChange() {
    const select = document.getElementById('mcp-playground-tool-select');
    const inputArea = document.getElementById('mcp-playground-args');
    if (!select || !inputArea) return;

    const sampleArgs = {
      'taskflow_list_tasks': '{\n  "status": "all",\n  "limit": 10\n}',
      'taskflow_get_task': '{\n  "titleMatch": "MCP"\n}',
      'taskflow_create_task': '{\n  "title": "Build AI feature with Google Spark",\n  "category": "work",\n  "priority": "urgent",\n  "tags": ["spark", "ai", "mcp"],\n  "subtasks": ["Define prompt templates", "Test MCP tools"]\n}',
      'taskflow_quick_add': '{\n  "text": "Review architecture deck tomorrow 3pm #roadmap !urgent"\n}',
      'taskflow_complete_task': '{\n  "taskId": "task_mcp_welcome"\n}',
      'taskflow_get_analytics': '{}',
      'taskflow_list_categories': '{}',
      'taskflow_create_category': '{\n  "name": "AI & Automation",\n  "color": "#ec4899",\n  "icon": "cpu"\n}'
    };

    inputArea.value = sampleArgs[select.value] || '{}';
  }

  async executePlaygroundCall() {
    const select = document.getElementById('mcp-playground-tool-select');
    const inputArea = document.getElementById('mcp-playground-args');
    const outputArea = document.getElementById('mcp-playground-response');
    const latencyLabel = document.getElementById('mcp-playground-latency');

    if (!select || !inputArea || !outputArea) return;

    const toolName = select.value;
    let args = {};
    try {
      args = JSON.parse(inputArea.value.trim() || '{}');
    } catch (err) {
      outputArea.textContent = `[JSON Parse Error]: ${err.message}`;
      return;
    }

    const rpcPayload = {
      jsonrpc: "2.0",
      id: "req_" + Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };

    outputArea.textContent = '⏳ Executing MCP tool call...';
    const startTime = performance.now();

    try {
      const res = await fetch(`${this.serverUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcPayload)
      });

      const elapsed = Math.round(performance.now() - startTime);
      if (latencyLabel) latencyLabel.textContent = `${elapsed}ms`;

      if (res.ok) {
        const responseJson = await res.json();
        outputArea.textContent = JSON.stringify(responseJson, null, 2);
        // If task was created/modified, auto-pull into UI
        if (['taskflow_create_task', 'taskflow_complete_task', 'taskflow_update_task', 'taskflow_quick_add'].includes(toolName)) {
          setTimeout(() => this.pullFromMCP(), 300);
        }
      } else {
        outputArea.textContent = `[HTTP Error ${res.status}]: ${res.statusText}`;
      }
    } catch (e) {
      const elapsed = Math.round(performance.now() - startTime);
      if (latencyLabel) latencyLabel.textContent = `${elapsed}ms (Offline)`;
      outputArea.textContent = `[Connection Refused]: MCP server on ${this.serverUrl} is not running.\nStart it with "run-mcp-server.bat" or "py mcp-server/server.py --sse" to test live tool execution.`;
    }
  }

  // -------------------------------------------------------------------------
  // Config Snippet Exporters
  // -------------------------------------------------------------------------
  copyConfig(type) {
    let snippet = '';

    if (type === 'google-spark') {
      snippet = JSON.stringify({
        "mcpServers": {
          "taskflow": {
            "serverUrl": "http://localhost:3333/sse",
            "transport": "sse",
            "description": "TaskFlow Pro live task management integration"
          }
        }
      }, null, 2);
    } else if (type === 'antigravity') {
      snippet = JSON.stringify({
        "mcpServers": {
          "taskflow": {
            "command": "py",
            "args": ["-3", "mcp-server/server.py", "--stdio"],
            "env": { "PYTHONUNBUFFERED": "1" }
          }
        }
      }, null, 2);
    } else if (type === 'claude') {
      snippet = JSON.stringify({
        "mcpServers": {
          "taskflow-pro": {
            "command": "py",
            "args": ["e:\\Antigravity\\To do list\\mcp-server\\server.py", "--stdio"]
          }
        }
      }, null, 2);
    } else if (type === 'cursor') {
      snippet = JSON.stringify({
        "mcpServers": {
          "taskflow": {
            "command": "py",
            "args": ["-3", "mcp-server/server.py", "--stdio"]
          }
        }
      }, null, 2);
    }

    navigator.clipboard.writeText(snippet).then(() => {
      if (window.app) window.app.showToast(`Copied ${type.toUpperCase()} configuration to clipboard! 📋`, 'success');
    }).catch(() => {
      prompt('Copy this configuration JSON:', snippet);
    });
  }
}

// Global instance
window.mcpBridge = new MCPBridge();
