/**
 * View Renderers: List View, Kanban Board, Calendar, and Analytics Dashboard
 */
class ViewRenderer {
  constructor() {
    this.currentCalendarDate = new Date();
    this.selectedCalendarDate = null;
  }

  // --- 1. LIST VIEW RENDERING ---
  renderListView(tasks, categories, container) {
    if (!container) return;

    // Check if Weekly View (Sat - Fri) is active
    if (window.taskStore.settings.activeFilter === 'week') {
      this.renderWeeklyBreakdownView(tasks, categories, container);
      return;
    }

    if (tasks.length === 0) {
      this.renderEmptyState(container);
      return;
    }

    // Check if custom Group By is active
    const groupBy = window.taskStore.settings.groupBy || 'none';
    if (groupBy !== 'none') {
      this.renderGroupedListView(tasks, categories, container, groupBy);
      return;
    }

    const pinnedTasks = tasks.filter(t => t.isPinned);
    const regularTasks = tasks.filter(t => !t.isPinned);

    let html = '';

    if (pinnedTasks.length > 0) {
      html += `
        <div class="task-group pinned-group">
          <div class="group-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
            <span>Pinned Tasks (${pinnedTasks.length})</span>
          </div>
          <div class="tasks-list">
            ${pinnedTasks.map(t => this.createTaskCardHtml(t, categories)).join('')}
          </div>
        </div>
      `;
    }

    if (regularTasks.length > 0) {
      html += `
        <div class="task-group">
          ${pinnedTasks.length > 0 ? `<div class="group-header"><span>All Tasks (${regularTasks.length})</span></div>` : ''}
          <div class="tasks-list">
            ${regularTasks.map(t => this.createTaskCardHtml(t, categories)).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  // --- GROUPED LIST VIEW (BY TAG, PRIORITY, CATEGORY, DATE, STATUS) ---
  renderGroupedListView(tasks, categories, container, groupBy) {
    let groups = [];
    const today = window.taskStore.getTodayDateString();

    if (groupBy === 'tag') {
      const allTags = [];
      tasks.forEach(t => {
        if (Array.isArray(t.tags) && t.tags.length > 0) {
          t.tags.forEach(tag => {
            const clean = tag.trim().toLowerCase();
            if (clean && !allTags.includes(clean)) allTags.push(clean);
          });
        }
      });
      allTags.sort();

      allTags.forEach(tag => {
        const matching = tasks.filter(t => t.tags && t.tags.some(tg => tg.toLowerCase() === tag));
        groups.push({
          id: `tag-${tag}`,
          title: `#${tag}`,
          icon: '🏷️',
          badge: `${matching.length}`,
          tasks: matching
        });
      });

      const untagged = tasks.filter(t => !t.tags || t.tags.length === 0);
      if (untagged.length > 0) {
        groups.push({
          id: 'tag-untagged',
          title: 'Untagged Tasks',
          icon: '🔖',
          badge: `${untagged.length}`,
          tasks: untagged
        });
      }
    } else if (groupBy === 'priority') {
      const prioDefs = [
        { id: 'urgent', title: 'Urgent Priority', icon: '🔴', color: '#f43f5e' },
        { id: 'high', title: 'High Priority', icon: '🟠', color: '#f59e0b' },
        { id: 'medium', title: 'Medium Priority', icon: '🔵', color: '#3b82f6' },
        { id: 'low', title: 'Low Priority', icon: '🟢', color: '#10b981' }
      ];

      prioDefs.forEach(p => {
        const matching = tasks.filter(t => t.priority === p.id);
        groups.push({
          id: `prio-${p.id}`,
          title: p.title,
          icon: p.icon,
          badge: `${matching.length}`,
          tasks: matching
        });
      });
    } else if (groupBy === 'category') {
      categories.forEach(cat => {
        const matching = tasks.filter(t => t.category === cat.id);
        groups.push({
          id: `cat-${cat.id}`,
          title: cat.name,
          icon: '📁',
          dotColor: cat.color,
          badge: `${matching.length}`,
          tasks: matching
        });
      });
    } else if (groupBy === 'dueDate') {
      const overdue = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'completed');
      const dueToday = tasks.filter(t => t.dueDate === today);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const dueTomorrow = tasks.filter(t => t.dueDate === tomorrowStr);
      
      const later = tasks.filter(t => t.dueDate && t.dueDate > tomorrowStr);
      const noDate = tasks.filter(t => !t.dueDate);

      if (overdue.length > 0) groups.push({ id: 'date-overdue', title: 'Overdue', icon: '⚠️', badge: `${overdue.length}`, tasks: overdue });
      if (dueToday.length > 0) groups.push({ id: 'date-today', title: 'Due Today', icon: '⚡', badge: `${dueToday.length}`, tasks: dueToday });
      if (dueTomorrow.length > 0) groups.push({ id: 'date-tomorrow', title: 'Due Tomorrow', icon: '📅', badge: `${dueTomorrow.length}`, tasks: dueTomorrow });
      if (later.length > 0) groups.push({ id: 'date-later', title: 'Upcoming / Later', icon: '🗓️', badge: `${later.length}`, tasks: later });
      if (noDate.length > 0) groups.push({ id: 'date-nodate', title: 'No Due Date', icon: '📌', badge: `${noDate.length}`, tasks: noDate });
    } else if (groupBy === 'status') {
      const statusDefs = [
        { id: 'todo', title: 'To Do', icon: '📝' },
        { id: 'in_progress', title: 'In Progress', icon: '⚡' },
        { id: 'review', title: 'In Review', icon: '👀' },
        { id: 'completed', title: 'Completed', icon: '🎉' }
      ];

      statusDefs.forEach(st => {
        const matching = tasks.filter(t => t.status === st.id);
        groups.push({
          id: `status-${st.id}`,
          title: st.title,
          icon: st.icon,
          badge: `${matching.length}`,
          tasks: matching
        });
      });
    }

    let html = `
      <div class="grouped-views-wrapper">
        <div class="group-mode-banner">
          <span>🔀 Grouped by <strong>${groupBy.toUpperCase()}</strong> (${tasks.length} total tasks)</span>
          <button class="btn btn-secondary btn-sm" onclick="window.app.setGroupBy('none')">✕ Clear Grouping</button>
        </div>
    `;

    groups.forEach(g => {
      html += `
        <div class="task-group custom-grouped-section" id="group-${g.id}">
          <div class="group-header custom-group-header">
            <div class="custom-group-title">
              ${g.dotColor ? `<span class="cat-dot" style="background: ${g.dotColor}"></span>` : `<span class="group-icon">${g.icon}</span>`}
              <span>${this.escapeHtml(g.title)}</span>
              <span class="custom-group-badge">${g.badge}</span>
            </div>
            ${g.tasks.length === 0 ? '' : `
              <button class="btn-group-toggle" onclick="window.app.toggleGroupVisibility('${g.id}')" title="Collapse/Expand group">
                <svg id="group-icon-${g.id}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            `}
          </div>

          <div class="tasks-list group-tasks-list" id="group-tasks-${g.id}">
            ${g.tasks.length > 0 ? g.tasks.map(t => this.createTaskCardHtml(t, categories)).join('') : `
              <div class="group-empty-placeholder">No tasks in this group</div>
            `}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  // --- DEDICATED WEEKLY BREAKDOWN VIEW (SATURDAY TO FRIDAY KANBAN BOARD) ---
  renderWeeklyBreakdownView(tasks, categories, container) {
    const weekInfo = window.taskStore.getCurrentWeekSatToFriRange();
    const totalScheduled = tasks.length;
    const completedThisWeek = tasks.filter(t => t.status === 'completed').length;
    const pct = totalScheduled > 0 ? Math.round((completedThisWeek / totalScheduled) * 100) : 0;

    let html = `
      <div class="weekly-kanban-wrapper">
        <!-- Week Header Summary Card -->
        <div class="week-header-card">
          <div class="week-header-info">
            <div class="week-badge-row">
              <span class="week-tag">WEEKLY KANBAN</span>
              <span class="week-date-range">📅 ${weekInfo.displayRange}</span>
            </div>
            <h2>Weekly Kanban Board (Saturday – Friday)</h2>
            <p class="week-header-subtitle">Drag and drop tasks between days to reschedule your Saturday through Friday week.</p>
          </div>

          <div class="week-progress-box">
            <div class="week-progress-stat">
              <span class="week-stat-num">${completedThisWeek}/${totalScheduled}</span>
              <span class="week-stat-lbl">Tasks Done (${pct}%)</span>
            </div>
            <div class="week-progress-track">
              <div class="week-progress-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        </div>

        <!-- 7-Column Saturday to Friday Kanban Board -->
        <div class="weekly-kanban-board">
    `;

    weekInfo.days.forEach((day, dayIndex) => {
      const dayTasks = tasks.filter(t => t.dueDate === day.dateStr);
      const isToday = day.isToday;

      html += `
        <div class="weekly-kanban-col ${isToday ? 'is-today-col' : ''}" 
             data-date="${day.dateStr}"
             ondragover="window.app.handleWeeklyDragOver(event)" 
             ondragleave="window.app.handleWeeklyDragLeave(event)" 
             ondrop="window.app.handleWeeklyDrop(event, '${day.dateStr}')">
          
          <!-- Column Header -->
          <div class="weekly-col-header">
            <div class="weekly-col-top">
              <div class="weekly-col-day-meta">
                <span class="weekly-col-name">${day.dayName}</span>
                <span class="weekly-col-date">${day.formatted}</span>
              </div>
              <span class="weekly-col-count">${dayTasks.length}</span>
            </div>

            ${isToday ? '<div class="today-ribbon">● TODAY</div>' : ''}
          </div>

          <!-- Cards List -->
          <div class="weekly-cards-list" id="weekly-col-${day.dateStr}">
            ${dayTasks.map(t => this.createWeeklyKanbanCardHtml(t, categories, dayIndex, weekInfo.days)).join('')}
            ${dayTasks.length === 0 ? `
              <div class="weekly-empty-drop" onclick="window.app.openTaskModalWithDate('${day.dateStr}')">
                <span>+ Add task for ${day.shortDay}</span>
              </div>
            ` : ''}
          </div>

          <!-- Column Quick Add Button -->
          <button class="weekly-col-add-btn" onclick="window.app.openTaskModalWithDate('${day.dateStr}')" title="Schedule task on ${day.dayName}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Add Task</span>
          </button>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  createWeeklyKanbanCardHtml(task, categories, dayIndex, allDays) {
    const isCompleted = task.status === 'completed';
    const cat = categories.find(c => c.id === task.category) || { name: 'General', color: '#6366f1' };
    const subtasksTotal = task.subtasks ? task.subtasks.length : 0;
    const subtasksDone = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;

    const prevDay = dayIndex > 0 ? allDays[dayIndex - 1] : null;
    const nextDay = dayIndex < allDays.length - 1 ? allDays[dayIndex + 1] : null;

    return `
      <div class="weekly-task-card ${isCompleted ? 'completed' : ''} ${task.isPinned ? 'is-pinned' : ''}" 
           draggable="true" 
           data-task-id="${task.id}" 
           ondragstart="window.app.handleWeeklyDragStart(event, '${task.id}')"
           ondragend="window.app.handleWeeklyDragEnd(event)"
           onclick="window.app.openTaskModal('${task.id}')"
           oncontextmenu="window.app.handleTaskContextMenu(event, '${task.id}')">
        
        <div class="weekly-card-top">
          <button class="weekly-card-check ${isCompleted ? 'checked' : ''}" onclick="event.stopPropagation(); window.app.toggleTask('${task.id}', event)">
            <svg class="check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <span class="badge priority-${task.priority}">${task.priority}</span>
          <span class="cat-dot" style="background: ${cat.color}" title="${cat.name}"></span>
        </div>

        <h4 class="weekly-card-title">${this.escapeHtml(task.title)}</h4>

        ${task.description ? `<p class="weekly-card-desc">${this.escapeHtml(task.description)}</p>` : ''}

        <div class="weekly-card-footer">
          <div class="weekly-card-meta">
            ${task.dueTime ? `<span class="weekly-time-badge">🕒 ${task.dueTime}</span>` : ''}
            ${subtasksTotal > 0 ? `<span class="weekly-subtask-badge">✓ ${subtasksDone}/${subtasksTotal}</span>` : ''}
          </div>

          <!-- Quick Move Arrows (Prev Day / Next Day) -->
          <div class="weekly-card-shift-btns" onclick="event.stopPropagation()">
            ${prevDay ? `<button class="btn-shift-day" onclick="window.app.moveTaskToDate('${task.id}', '${prevDay.dateStr}')" title="Move to ${prevDay.shortDay}">←</button>` : ''}
            ${nextDay ? `<button class="btn-shift-day" onclick="window.app.moveTaskToDate('${task.id}', '${nextDay.dateStr}')" title="Move to ${nextDay.shortDay}">→</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  createTaskCardHtml(task, categories) {
    const isCompleted = task.status === 'completed';
    const cat = categories.find(c => c.id === task.category) || { name: 'General', color: '#6366f1' };
    const today = window.taskStore.getTodayDateString();
    const isOverdue = task.dueDate && task.dueDate < today && !isCompleted;
    const isDueToday = task.dueDate === today && !isCompleted;

    const subtasksTotal = task.subtasks ? task.subtasks.length : 0;
    const subtasksDone = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
    const subtaskPct = subtasksTotal > 0 ? Math.round((subtasksDone / subtasksTotal) * 100) : 0;

    const priorityBadge = `
      <span class="badge priority-${task.priority}">
        <span class="priority-dot"></span>
        ${task.priority.toUpperCase()}
      </span>
    `;

    let dateBadge = '';
    if (task.dueDate) {
      let dateClass = 'date-badge';
      let dateLabel = task.dueDate;
      if (isOverdue) {
        dateClass += ' overdue';
        dateLabel = `⚠️ Overdue (${task.dueDate})`;
      } else if (isDueToday) {
        dateClass += ' today';
        dateLabel = `⚡ Due Today${task.dueTime ? ' at ' + task.dueTime : ''}`;
      }
      dateBadge = `
        <span class="${dateClass}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          ${dateLabel}
        </span>
      `;
    }

    let subtasksHtml = '';
    if (subtasksTotal > 0) {
      subtasksHtml = `
        <div class="task-subtasks-summary" onclick="event.stopPropagation(); window.app.toggleSubtasksExpansion('${task.id}')">
          <div class="subtask-progress-bar">
            <div class="subtask-progress-fill" style="width: ${subtaskPct}%"></div>
          </div>
          <span class="subtask-count">${subtasksDone}/${subtasksTotal} subtasks</span>
          <svg class="subtask-expand-icon" id="subtask-icon-${task.id}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        <div class="task-subtasks-list hidden" id="subtasks-list-${task.id}">
          ${(task.subtasks || []).map(st => `
            <div class="subtask-item ${st.completed ? 'completed' : ''}" onclick="event.stopPropagation(); window.app.toggleSubtask('${task.id}', '${st.id}')">
              <span class="subtask-checkbox ${st.completed ? 'checked' : ''}">
                ${st.completed ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
              </span>
              <span class="subtask-text">${this.escapeHtml(st.text)}</span>
            </div>
          `).join('')}
          <div class="inline-subtask-row" onclick="event.stopPropagation()">
            <input type="text" class="inline-subtask-input" placeholder="+ Add subtask..." onkeydown="if(event.key==='Enter'){window.app.handleInlineSubtaskAdd('${task.id}', this);}">
          </div>
        </div>
      `;
    }

    const tagsHtml = (task.tags && task.tags.length > 0) ? `
      <div class="task-tags">
        ${task.tags.map(t => `<span class="tag-pill" onclick="event.stopPropagation(); window.app.filterByTag('${this.escapeHtml(t)}')" title="Filter by #${this.escapeHtml(t)}">#${this.escapeHtml(t)}</span>`).join('')}
      </div>
    ` : '';

    return `
      <div class="task-card ${isCompleted ? 'completed' : ''} ${task.isPinned ? 'is-pinned' : ''}" 
           data-task-id="${task.id}" 
           onclick="window.app.openTaskModal('${task.id}')"
           oncontextmenu="window.app.handleTaskContextMenu(event, '${task.id}')">
        
        <div class="task-left">
          <button class="task-check-btn ${isCompleted ? 'checked' : ''}" 
                  onclick="event.stopPropagation(); window.app.toggleTask('${task.id}', event)" 
                  title="${isCompleted ? 'Mark as incomplete' : 'Mark as completed'}">
            <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
        </div>

        <div class="task-main">
          <div class="task-header-row">
            <h4 class="task-title">${this.escapeHtml(task.title)}</h4>
          </div>

          ${task.description ? `<p class="task-desc">${this.escapeHtml(task.description)}</p>` : ''}

          ${subtasksHtml}

          <div class="task-meta-row">
            <span class="category-pill" style="--cat-color: ${cat.color}">
              <span class="cat-dot" style="background: ${cat.color}"></span>
              ${this.escapeHtml(cat.name)}
            </span>
            ${priorityBadge}
            ${dateBadge}
            ${task.pomodorosEstimated ? `
              <span class="pomo-count-badge" title="Pomodoros completed/estimated">
                🍅 ${task.pomodorosCompleted || 0}/${task.pomodorosEstimated}
              </span>
            ` : ''}
            ${tagsHtml}
          </div>
        </div>

        <div class="task-actions" onclick="event.stopPropagation()">
          <button class="action-btn pin-btn ${task.isPinned ? 'active' : ''}" 
                  onclick="window.app.togglePin('${task.id}')" 
                  title="${task.isPinned ? 'Unpin task' : 'Pin to top'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${task.isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </button>
          <button class="action-btn pomo-start-btn" 
                  onclick="window.app.startFocusForTask('${task.id}')" 
                  title="Focus on this task with Pomodoro">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </button>
          <button class="action-btn edit-btn" 
                  onclick="window.app.openTaskModal('${task.id}')" 
                  title="Edit task">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
          <button class="action-btn delete-btn" 
                  onclick="window.app.deleteTask('${task.id}')" 
                  title="Delete task">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;
  }

  // --- 2. KANBAN BOARD VIEW RENDERING ---
  renderKanbanView(tasks, categories, container) {
    if (!container) return;

    const columns = [
      { id: 'todo', title: 'To Do', icon: '📝', color: '#6366f1' },
      { id: 'in_progress', title: 'In Progress', icon: '⚡', color: '#f59e0b' },
      { id: 'review', title: 'Review / Testing', icon: '👀', color: '#8b5cf6' },
      { id: 'completed', title: 'Completed', icon: '🎉', color: '#10b981' }
    ];

    let html = `<div class="kanban-board">`;

    columns.forEach(col => {
      const colTasks = tasks.filter(t => t.status === col.id);

      html += `
        <div class="kanban-column" data-status="${col.id}" ondragover="window.app.handleKanbanDragOver(event)" ondragleave="window.app.handleKanbanDragLeave(event)" ondrop="window.app.handleKanbanDrop(event, '${col.id}')">
          <div class="kanban-col-header" style="border-top: 3px solid ${col.color}">
            <div class="col-title-group">
              <span class="col-icon">${col.icon}</span>
              <h3>${col.title}</h3>
            </div>
            <span class="col-count">${colTasks.length}</span>
          </div>

          <div class="kanban-cards-list" id="kanban-col-${col.id}">
            ${colTasks.map(t => this.createKanbanCardHtml(t, categories)).join('')}
            ${colTasks.length === 0 ? `<div class="kanban-empty-drop">Drop tasks here</div>` : ''}
          </div>

          <button class="kanban-add-btn" onclick="window.app.openTaskModalWithStatus('${col.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Task
          </button>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  createKanbanCardHtml(task, categories) {
    const cat = categories.find(c => c.id === task.category) || { name: 'General', color: '#6366f1' };
    const subtasksTotal = task.subtasks ? task.subtasks.length : 0;
    const subtasksDone = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;

    const nextStatusMap = {
      'todo': { next: 'in_progress', label: '→ Start' },
      'in_progress': { next: 'review', label: '→ Review' },
      'review': { next: 'completed', label: '→ Complete' },
      'completed': { next: 'todo', label: '↺ Reopen' }
    };
    const nextInfo = nextStatusMap[task.status] || { next: 'in_progress', label: '→ Move' };

    return `
      <div class="kanban-card" 
           draggable="true" 
           data-task-id="${task.id}" 
           ondragstart="window.app.handleKanbanDragStart(event, '${task.id}')"
           ondragend="window.app.handleKanbanDragEnd(event)"
           onclick="window.app.openTaskModal('${task.id}')"
           oncontextmenu="window.app.handleTaskContextMenu(event, '${task.id}')">
        
        <div class="kanban-card-top">
          <span class="badge priority-${task.priority}">${task.priority}</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="btn-kanban-quick-move" onclick="event.stopPropagation(); window.app.moveKanbanTask('${task.id}', '${nextInfo.next}')" title="Move to next stage">${nextInfo.label}</button>
            <span class="cat-dot" style="background: ${cat.color}" title="${cat.name}"></span>
          </div>
        </div>

        <h4 class="kanban-card-title">${this.escapeHtml(task.title)}</h4>

        ${task.description ? `<p class="kanban-card-desc">${this.escapeHtml(task.description)}</p>` : ''}

        <div class="kanban-card-footer">
          ${task.dueDate ? `
            <span class="kanban-date">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line></svg>
              ${task.dueDate.slice(5)}
            </span>
          ` : '<span></span>'}

          <div class="kanban-footer-right">
            ${subtasksTotal > 0 ? `
              <span class="kanban-subtask-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                ${subtasksDone}/${subtasksTotal}
              </span>
            ` : ''}
            ${task.isPinned ? `<span class="kanban-pin-icon">📌</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // --- 3. CALENDAR VIEW RENDERING ---
  renderCalendarView(tasks, container) {
    if (!container) return;

    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();
    const monthName = this.currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = window.taskStore.getTodayDateString();
    if (!this.selectedCalendarDate) {
      this.selectedCalendarDate = todayStr;
    }

    let html = `
      <div class="calendar-wrapper">
        <div class="calendar-nav">
          <div class="calendar-month-title">
            <h2>${monthName}</h2>
          </div>
          <div class="calendar-controls">
            <button class="btn btn-secondary btn-sm btn-gcal-chip" onclick="window.gcal.openModal()" title="Google Calendar Sync Hub">
              📅 <span class="gcal-btn-label">Google Calendar</span>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.app.calendarPrevMonth()" title="Previous Month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.app.calendarToday()">Today</button>
            <button class="btn btn-secondary btn-sm" onclick="window.app.calendarNextMonth()" title="Next Month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>

        <div class="calendar-grid">
          <div class="calendar-day-header">Sun</div>
          <div class="calendar-day-header">Mon</div>
          <div class="calendar-day-header">Tue</div>
          <div class="calendar-day-header">Wed</div>
          <div class="calendar-day-header">Thu</div>
          <div class="calendar-day-header">Fri</div>
          <div class="calendar-day-header">Sat</div>
    `;

    // Previous month padding days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      html += `<div class="calendar-day other-month"><span class="day-num">${d}</span></div>`;
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dayStr}`;

      const dayTasks = tasks.filter(t => t.dueDate === dateKey);
      const isToday = dateKey === todayStr;
      const isSelected = dateKey === this.selectedCalendarDate;

      html += `
        <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
             data-date="${dateKey}"
             onclick="window.app.handleCalendarDayClick('${dateKey}')">
          <div class="calendar-day-top">
            <span class="day-num">${day}</span>
            ${dayTasks.length > 0 ? `
              <span class="cal-day-count-badge">${dayTasks.length}</span>
            ` : ''}
          </div>
          
          <!-- Mobile Task Dots Indicator -->
          <div class="cal-dots-row">
            ${dayTasks.slice(0, 4).map(t => `<span class="cal-dot-indicator priority-${t.priority}" title="${this.escapeHtml(t.title)}"></span>`).join('')}
          </div>

          <!-- Desktop Chips -->
          <div class="calendar-day-tasks desktop-only">
            ${dayTasks.slice(0, 2).map(t => `
              <div class="cal-task-chip ${t.status === 'completed' ? 'completed' : ''} priority-${t.priority}" 
                   onclick="event.stopPropagation(); window.app.openTaskModal('${t.id}')"
                   title="${this.escapeHtml(t.title)}">
                ${this.escapeHtml(t.title)}
              </div>
            `).join('')}
            ${dayTasks.length > 2 ? `<div class="cal-more-chip">+${dayTasks.length - 2} more</div>` : ''}
          </div>
        </div>
      `;
    }

    // Next month padding days
    const totalCells = firstDay + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      html += `<div class="calendar-day other-month"><span class="day-num">${i}</span></div>`;
    }

    // Selected Day Tasks Inspector Section
    const selectedTasks = tasks.filter(t => t.dueDate === this.selectedCalendarDate);
    const selectedDateDisplay = new Date(this.selectedCalendarDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    html += `
        </div>

        <!-- Selected Date Task Inspector -->
        <div class="calendar-day-inspector">
          <div class="inspector-header">
            <div>
              <h3>📅 ${selectedDateDisplay}</h3>
              <span class="inspector-sub">${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'} scheduled</span>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary btn-sm" onclick="window.gcal.exportICS()" title="Export all scheduled tasks to Google Calendar">
                <span>📅 Export .ICS</span>
              </button>
              <button class="btn btn-primary btn-sm" onclick="window.app.openTaskModalWithDate('${this.selectedCalendarDate}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>Add Task</span>
              </button>
            </div>
          </div>

          <div class="inspector-tasks-list">
            ${selectedTasks.length === 0 ? `
              <div class="inspector-empty">No tasks scheduled for this day. Click "+ Add Task" to schedule one!</div>
            ` : selectedTasks.map(t => `
              <div class="inspector-task-item ${t.status === 'completed' ? 'completed' : ''}" onclick="window.app.openTaskModal('${t.id}')">
                <button class="task-check-btn ${t.status === 'completed' ? 'checked' : ''}" onclick="event.stopPropagation(); window.app.toggleTask('${t.id}', event)">
                  <svg class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <div class="inspector-task-info">
                  <span class="inspector-task-title">${this.escapeHtml(t.title)}</span>
                  <div class="inspector-task-meta">
                    <span class="badge priority-${t.priority}">${t.priority.toUpperCase()}</span>
                    ${t.dueTime ? `<span class="date-badge">🕒 ${t.dueTime}</span>` : ''}
                    ${t.subtasks && t.subtasks.length ? `<span class="date-badge">✓ ${t.subtasks.filter(s=>s.completed).length}/${t.subtasks.length}</span>` : ''}
                  </div>
                </div>
                <button class="btn-gcal-inline" onclick="event.stopPropagation(); window.gcal.openGoogleCalendarForTask('${t.id}')" title="Sync this task to Google Calendar">
                  📅 Sync
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // --- 4. ANALYTICS VIEW RENDERING ---
  renderAnalyticsView(stats, container) {
    if (!container) return;

    const streak = stats.streak;
    const completionRate = stats.completionRate;
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeOffset = circumference - (completionRate / 100) * circumference;

    // Max 7-day task count for scaling bar chart
    const maxBarVal = Math.max(1, ...stats.past7Days.map(d => Math.max(d.created, d.completed)));

    let html = `
      <div class="analytics-dashboard">
        <!-- Top Stats Row -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon-wrapper fire">🔥</div>
            <div class="stat-info">
              <span class="stat-label">Current Streak</span>
              <h3 class="stat-value">${streak.current} Days</h3>
              <span class="stat-sub">Best: ${streak.best} days</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrapper check">✅</div>
            <div class="stat-info">
              <span class="stat-label">Completed Tasks</span>
              <h3 class="stat-value">${stats.completed} <span class="stat-total">/ ${stats.total}</span></h3>
              <span class="stat-sub">${stats.completedToday} completed today</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrapper focus">⏱️</div>
            <div class="stat-info">
              <span class="stat-label">Focus Time Logged</span>
              <h3 class="stat-value">${stats.focusMinutes} min</h3>
              <span class="stat-sub">${stats.totalPoms} Pomodoro sessions</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon-wrapper clock">⚠️</div>
            <div class="stat-info">
              <span class="stat-label">Overdue & Due Today</span>
              <h3 class="stat-value">${stats.overdue} <span class="stat-total">overdue</span></h3>
              <span class="stat-sub">${stats.dueToday} due today</span>
            </div>
          </div>
        </div>

        <!-- Middle Charts Row -->
        <div class="charts-grid">
          <!-- Completion Ring Card -->
          <div class="chart-card">
            <div class="chart-header">
              <h3>Completion Rate</h3>
              <span class="chart-tag">Overall</span>
            </div>
            <div class="donut-chart-wrapper">
              <svg class="donut-svg" width="140" height="140" viewBox="0 0 120 120">
                <circle class="donut-bg" cx="60" cy="60" r="${radius}"></circle>
                <circle class="donut-fg" cx="60" cy="60" r="${radius}" 
                        style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${strokeOffset};"></circle>
              </svg>
              <div class="donut-content">
                <span class="donut-val">${completionRate}%</span>
                <span class="donut-lbl">Done</span>
              </div>
            </div>
            <div class="chart-legend">
              <div class="legend-item"><span class="legend-dot completed"></span> Completed (${stats.completed})</div>
              <div class="legend-item"><span class="legend-dot pending"></span> Pending (${stats.pending})</div>
            </div>
          </div>

          <!-- Weekly Activity Chart -->
          <div class="chart-card wide-card">
            <div class="chart-header">
              <h3>7-Day Productivity Velocity</h3>
              <div class="chart-legend inline">
                <span class="legend-item"><span class="legend-dot completed"></span> Completed</span>
                <span class="legend-item"><span class="legend-dot created"></span> Created</span>
              </div>
            </div>
            <div class="bar-chart-container">
              ${stats.past7Days.map(d => {
                const compHeight = Math.round((d.completed / maxBarVal) * 100);
                const creatHeight = Math.round((d.created / maxBarVal) * 100);
                return `
                  <div class="bar-group">
                    <div class="bars-pair">
                      <div class="bar bar-created" style="height: ${creatHeight || 4}%" title="Created: ${d.created}"></div>
                      <div class="bar bar-completed" style="height: ${compHeight || 4}%" title="Completed: ${d.completed}"></div>
                    </div>
                    <span class="bar-label">${d.day}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Bottom Category & Priority Breakdown -->
        <div class="breakdown-grid">
          <!-- Category Progress -->
          <div class="breakdown-card">
            <div class="chart-header">
              <h3>Category Breakdown</h3>
            </div>
            <div class="category-bars">
              ${Object.values(stats.categoryStats).map(c => {
                const pct = c.total === 0 ? 0 : Math.round((c.completed / c.total) * 100);
                return `
                  <div class="cat-bar-item">
                    <div class="cat-bar-info">
                      <span class="cat-name">
                        <span class="cat-dot" style="background: ${c.color}"></span>
                        ${this.escapeHtml(c.name)}
                      </span>
                      <span class="cat-stats">${c.completed}/${c.total} (${pct}%)</span>
                    </div>
                    <div class="cat-progress-track">
                      <div class="cat-progress-fill" style="width: ${pct}%; background: ${c.color}"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Priority Distribution -->
          <div class="breakdown-card">
            <div class="chart-header">
              <h3>Priority Distribution</h3>
            </div>
            <div class="priority-breakdown-list">
              <div class="prio-row">
                <span class="badge priority-urgent">URGENT</span>
                <div class="prio-track"><div class="prio-fill urgent" style="width: ${stats.total ? (stats.priorityStats.urgent/stats.total)*100 : 0}%"></div></div>
                <span class="prio-count">${stats.priorityStats.urgent}</span>
              </div>
              <div class="prio-row">
                <span class="badge priority-high">HIGH</span>
                <div class="prio-track"><div class="prio-fill high" style="width: ${stats.total ? (stats.priorityStats.high/stats.total)*100 : 0}%"></div></div>
                <span class="prio-count">${stats.priorityStats.high}</span>
              </div>
              <div class="prio-row">
                <span class="badge priority-medium">MEDIUM</span>
                <div class="prio-track"><div class="prio-fill medium" style="width: ${stats.total ? (stats.priorityStats.medium/stats.total)*100 : 0}%"></div></div>
                <span class="prio-count">${stats.priorityStats.medium}</span>
              </div>
              <div class="prio-row">
                <span class="badge priority-low">LOW</span>
                <div class="prio-track"><div class="prio-fill low" style="width: ${stats.total ? (stats.priorityStats.low/stats.total)*100 : 0}%"></div></div>
                <span class="prio-count">${stats.priorityStats.low}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  renderEmptyState(container) {
    const totalStoreTasks = window.taskStore && window.taskStore.tasks ? window.taskStore.tasks.length : 0;
    const settings = window.taskStore ? window.taskStore.settings : {};
    
    const hasActiveFilters = (
      (settings.searchQuery && settings.searchQuery.trim() !== '') ||
      (settings.activeFilter && settings.activeFilter !== 'all') ||
      (settings.activeCategory && settings.activeCategory !== 'all') ||
      (settings.activePriority && settings.activePriority !== 'all') ||
      (settings.activeTag && settings.activeTag !== 'all')
    );

    let title = "All Clear & Flowing ✨";
    let subtitle = "You have completed all your tasks or your workspace is fresh and clean.";
    let actionButtons = `
      <button class="btn btn-primary" onclick="window.app.openTaskModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span>Create New Task</span>
      </button>
      <button class="btn btn-secondary" onclick="window.app.resetSampleData()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
        <span>Load Demo Tasks</span>
      </button>
    `;

    if (hasActiveFilters && totalStoreTasks > 0) {
      title = "No Matching Tasks Found";
      subtitle = "No tasks match your active search, priority, workspace, or tag filter criteria.";
      actionButtons = `
        <button class="btn btn-primary" onclick="window.app.clearAllFilters()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          <span>Clear Active Filters</span>
        </button>
        <button class="btn btn-secondary" onclick="window.app.openTaskModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Create New Task</span>
        </button>
      `;
    }

    container.innerHTML = `
      <div class="empty-state-wrapper">
        <div class="empty-state-card">
          <div class="empty-state-glow"></div>
          <div class="empty-state-icon-container">
            <div class="empty-state-icon">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11l3 3L22 4"></path>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
              </svg>
            </div>
            <span class="empty-state-sparkle">✨</span>
          </div>
          <h3 class="empty-state-title">${title}</h3>
          <p class="empty-state-subtitle">${subtitle}</p>
          <div class="empty-state-actions">
            ${actionButtons}
          </div>
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}

window.viewRenderer = new ViewRenderer();
