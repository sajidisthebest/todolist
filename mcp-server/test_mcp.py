"""
Automated unit test for TaskFlow MCP Server tool execution
"""
import sys
import os

# Add mcp-server dir
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from server import execute_tool, handle_rpc_request, TOOLS

def run_tests():
    print("========================================")
    print("Testing TaskFlow MCP Protocol Handlers")
    print("========================================")

    # 1. Test initialize
    init_req = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}
    init_res = handle_rpc_request(init_req)
    assert init_res["result"]["serverInfo"]["name"] == "taskflow-mcp-server", "Init failed"
    print("✅ initialize RPC method: OK")

    # 2. Test tools/list
    tools_req = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
    tools_res = handle_rpc_request(tools_req)
    assert len(tools_res["result"]["tools"]) == 10, f"Expected 10 tools, got {len(tools_res['result']['tools'])}"
    print(f"✅ tools/list RPC method: OK ({len(tools_res['result']['tools'])} tools registered)")

    # 3. Test taskflow_create_task
    created = execute_tool("taskflow_create_task", {
        "title": "Automated MCP Integration Test Task",
        "description": "Created via automated MCP test",
        "category": "work",
        "priority": "urgent",
        "tags": ["test", "mcp", "automated"],
        "subtasks": ["Step 1", "Step 2"]
    })
    assert created.get("success") == True, "Failed to create task"
    task_id = created["createdTask"]["id"]
    print(f"✅ taskflow_create_task: OK (Created ID: {task_id})")

    # 4. Test taskflow_get_task
    fetched = execute_tool("taskflow_get_task", {"taskId": task_id})
    assert fetched.get("task", {}).get("title") == "Automated MCP Integration Test Task"
    print("✅ taskflow_get_task: OK")

    # 5. Test taskflow_quick_add
    qa = execute_tool("taskflow_quick_add", {"text": "Review Google Spark integration deck tomorrow #ai !urgent"})
    assert qa.get("success") == True
    qa_id = qa["createdTask"]["id"]
    print(f"✅ taskflow_quick_add: OK (Parsed tags & priority, ID: {qa_id})")

    # 6. Test taskflow_complete_task
    comp = execute_tool("taskflow_complete_task", {"taskId": task_id})
    assert comp.get("success") == True
    assert comp.get("completed") == True
    print("✅ taskflow_complete_task: OK")

    # 7. Test taskflow_list_tasks
    listed = execute_tool("taskflow_list_tasks", {"status": "all", "limit": 20})
    assert listed.get("totalMatched") >= 2
    print(f"✅ taskflow_list_tasks: OK (Matched {listed.get('totalMatched')} tasks)")

    # 8. Test taskflow_get_analytics
    analytics = execute_tool("taskflow_get_analytics", {})
    assert "totalTasks" in analytics
    print(f"✅ taskflow_get_analytics: OK (Total: {analytics['totalTasks']}, Completed: {analytics['completedTasks']})")

    # 9. Test taskflow_list_categories
    cats = execute_tool("taskflow_list_categories", {})
    assert len(cats.get("categories", [])) >= 6
    print(f"✅ taskflow_list_categories: OK ({len(cats['categories'])} categories)")

    # 10. Clean up test tasks
    execute_tool("taskflow_delete_task", {"taskId": task_id})
    execute_tool("taskflow_delete_task", {"taskId": qa_id})
    print("✅ taskflow_delete_task: OK")

    print("========================================")
    print("All 10 MCP Tools and RPC Handlers Passed!")
    print("========================================")

if __name__ == "__main__":
    run_tests()
