---
name: taskflow
description: >-
  Manage and organize tasks, todo lists, focus items, and productivity statistics in TaskFlow Pro via the TaskFlow MCP Server.
---

# TaskFlow Pro MCP Skill

This skill guides the AI assistant in interacting with **TaskFlow Pro** using the Model Context Protocol (MCP) tools.

## Available MCP Tools

Tool Name | Purpose | Key Arguments
:--- | :--- | :---
`taskflow_list_tasks` | Fetch tasks matching filters | `status`, `category`, `priority`, `tag`, `query`, `limit`
`taskflow_get_task` | Inspect task details & subtasks | `taskId` or `titleMatch`
`taskflow_create_task` | Create new task with metadata | `title`, `category`, `priority`, `dueDate`, `subtasks`, `tags`
`taskflow_update_task` | Edit title, priority, status, or notes | `taskId`, `status`, `priority`, `dueDate`, `description`
`taskflow_complete_task` | Toggle completion status | `taskId`
`taskflow_delete_task` | Permanently remove a task | `taskId`
`taskflow_list_categories` | Get category names & colors | None
`taskflow_create_category` | Add a workspace category | `name`, `color`, `icon`
`taskflow_get_analytics` | Check velocity, completion rate, overdue | None
`taskflow_quick_add` | Natural-language fast task creation | `text` (e.g. `Fix auth bug tomorrow #dev !urgent`)

## Best Practices

1. **Before adding tasks**: Query `taskflow_list_tasks` with a `query` or `category` to prevent duplicate tasks.
2. **Prioritization**: Use `urgent` for blocking deadlines, `high` for major deliverables, `medium` for regular tasks, and `low` for backlog items.
3. **Subtasks**: When breaking down complex workflows, provide subtask lists in `taskflow_create_task` or `taskflow_update_task`.
4. **Summary & Reporting**: Use `taskflow_get_analytics` to provide users with a daily productivity recap and upcoming deadline briefings.
