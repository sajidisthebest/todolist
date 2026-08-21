/**
 * Master Application Controller
 */
class TaskFlowApp {
  constructor() {
    this.currentEditingTaskId = null;
    this.draggedTaskId = null;
    this.modalSubtasks = [];
    this.modalTags = [];

    this.themes = ['dark', 'midnight', 'cyber', 'light'];
  }

  init() {
    this.applyTheme(window.taskStore.settings.theme || 'dark');
    this.applySidebarState();
    this.updateHeaderUserChip();
    this.bindGlobalEvents();
    this.initCategoryFilters();
    this.initPomodoro();
    this.initGreetingClock();
    if (window.onboarding) {
      window.onboarding.init();
    }
    this.render();
  }

  toggleSidebar() {
    if (window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      if (sidebar) {
        sidebar.classList.toggle('open');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
      }
    } else {
      const isCollapsed = !document.body.classList.contains('sidebar-collapsed');
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);
      window.taskStore.settings.sidebarCollapsed = isCollapsed;
      window.taskStore.saveSettings();
      if (window.soundEngine) window.soundEngine.playClick();
      this.showToast(isCollapsed ? 'Sidebar collapsed (Ctrl+\\)' : 'Sidebar expanded', 'info');
    }
  }

  applySidebarState() {
    // 1. Desktop sidebar collapsed state
    if (window.taskStore.settings.sidebarCollapsed && window.innerWidth > 768) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }

    // 2. Collapsed sections state
    const collapsed = window.taskStore.settings.collapsedSections || {};
    const sectionMap = {
      'smart-views': 'sidebar-section-smart-views',
      'workspaces': 'sidebar-section-workspaces',
      'tags': 'sidebar-tags-section',
      'tools': 'sidebar-section-tools'
    };

    Object.keys(sectionMap).forEach(key => {
      const el = document.getElementById(sectionMap[key]);
      if (el) {
        el.classList.toggle('collapsed', !!collapsed[key]);
      }
    });
  }

  toggleSidebarSection(sectionKey) {
    const sectionMap = {
      'smart-views': 'sidebar-section-smart-views',
      'workspaces': 'sidebar-section-workspaces',
      'tags': 'sidebar-tags-section',
      'tools': 'sidebar-section-tools'
    };

    const elId = sectionMap[sectionKey];
    const el = document.getElementById(elId);
    if (!el) return;

    el.classList.toggle('collapsed');
    const isCollapsed = el.classList.contains('collapsed');

    if (!window.taskStore.settings.collapsedSections) {
      window.taskStore.settings.collapsedSections = {};
    }
    window.taskStore.settings.collapsedSections[sectionKey] = isCollapsed;
    window.taskStore.saveSettings();

    if (window.soundEngine) window.soundEngine.playPop();
  }

  initGreetingClock() {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const clockEl = document.getElementById('live-time-clock');
      const greetingEl = document.getElementById('greeting-text');

      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      if (greetingEl) {
        if (hours < 12) greetingEl.textContent = 'Good morning';
        else if (hours < 18) greetingEl.textContent = 'Good afternoon';
        else greetingEl.textContent = 'Good evening';
      }
    };

    updateTime();
    setInterval(updateTime, 1000);
  }

  bindGlobalEvents() {
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.value = window.taskStore.settings.searchQuery || '';
      searchInput.addEventListener('input', (e) => {
        window.taskStore.settings.searchQuery = e.target.value;
        this.render();
      });
    }

    // Quick Add Bar (press Enter to quickly add task)
    const quickAddInput = document.getElementById('quick-add-input');
    const quickAddBtn = document.getElementById('quick-add-btn');
    if (quickAddInput) {
      quickAddInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleQuickAdd();
        }
      });
    }
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', () => this.handleQuickAdd());
    }

    // Quick Filters (Sidebar tabs)
    document.querySelectorAll('.filter-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = e.currentTarget.dataset.filter;
        this.selectFilter(filter);
      });
    });

    // View Switcher Buttons (List, Kanban, Calendar, Analytics)
    document.querySelectorAll('.view-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.switchView(view);
      });
    });

    // Priority Filter Select
    const priorityFilter = document.getElementById('priority-filter-select');
    if (priorityFilter) {
      priorityFilter.addEventListener('change', (e) => {
        window.taskStore.settings.activePriority = e.target.value;
        window.taskStore.saveSettings();
        this.render();
      });
    }

    // Group By Select
    const groupBySelect = document.getElementById('groupby-select');
    if (groupBySelect) {
      groupBySelect.value = window.taskStore.settings.groupBy || 'none';
      groupBySelect.addEventListener('change', (e) => {
        this.setGroupBy(e.target.value);
      });
    }

    // Tag Filter Select
    const tagFilterSelect = document.getElementById('tag-filter-select');
    if (tagFilterSelect) {
      tagFilterSelect.addEventListener('change', (e) => {
        this.filterByTag(e.target.value);
      });
    }

    // Sort By Select
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        window.taskStore.settings.sortBy = e.target.value;
        window.taskStore.saveSettings();
        this.render();
      });
    }

    // Theme Switcher Button
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.cycleTheme());
    }

    // Sound Toggle Button
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const enabled = window.soundEngine.toggleSound();
        soundBtn.classList.toggle('muted', !enabled);
        this.showToast(enabled ? '🔊 Sound effects enabled' : '🔇 Sound effects muted', 'info');
      });
    }

    // Keyboard Shortcuts (Customizable)
    window.addEventListener('keydown', (e) => {
      // If currently recording a shortcut in the customizer modal, let that handler process it
      if (this.recordingShortcutActionId) {
        this.handleShortcutRecordKey(e);
        return;
      }

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
          this.closeAllModals();
        }
        return;
      }

      // Global toggle sidebar shortcut (Ctrl+\, Cmd+\, Ctrl+B, or [)
      if (((e.ctrlKey || e.metaKey) && (e.key === '\\' || e.key === 'b')) || e.key === '[') {
        e.preventDefault();
        this.toggleSidebar();
        return;
      }

      const sc = window.taskStore.settings.shortcuts || {};
      const key = e.key.toLowerCase();

      // Check configured shortcuts
      if (key === (sc['toggle-sidebar'] || '\\')) {
        e.preventDefault();
        this.toggleSidebar();
      } else if (key === (sc['focus-mode'] || 'f')) {
        e.preventDefault();
        window.pomodoro.promptFocusMode();
      } else if (key === (sc['new-task'] || 'n')) {
        e.preventDefault();
        this.openTaskModal();
      } else if (key === (sc['search'] || '/')) {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      } else if (key === (sc['toggle-pomo'] || 'p')) {
        e.preventDefault();
        window.pomodoro.toggleDrawer();
      } else if (key === (sc['view-list'] || '1')) {
        this.switchView('list');
      } else if (key === (sc['view-kanban'] || '2')) {
        this.switchView('kanban');
      } else if (key === (sc['view-calendar'] || '3')) {
        this.switchView('calendar');
      } else if (key === (sc['view-analytics'] || '4')) {
        this.switchView('analytics');
      } else if (key === (sc['cycle-theme'] || 't')) {
        this.cycleTheme();
      } else if (key === (sc['shortcuts-modal'] || '?')) {
        this.openShortcutsModal();
      } else if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Mobile Sidebar Toggle & Close
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    const closeSidebarMobile = () => {
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    };

    if (mobileMenuBtn && sidebar) {
      mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
      });
    }

    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener('click', closeSidebarMobile);
    }

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', closeSidebarMobile);
    }

    // Auto-close sidebar on mobile when filter/category clicked
    document.querySelectorAll('.filter-nav-btn, .category-nav-item').forEach(el => {
      el.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          closeSidebarMobile();
        }
      });
    });

    // Close Modals when clicking on backdrop
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeAllModals();
        }
      });
    });

    // Command Palette Trigger (Ctrl+K or Cmd+K)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggleCommandPalette();
      }
    });

    // Command Palette Arrow Navigation
    const paletteInput = document.getElementById('palette-input');
    if (paletteInput) {
      paletteInput.addEventListener('keydown', (e) => {
        this.handlePaletteKeyNav(e);
      });
    }

    // Close Context Menu on outside click
    window.addEventListener('click', () => {
      this.closeContextMenu();
    });
  }

  initPomodoro() {
    if (window.pomodoro) {
      window.pomodoro.init();
    }
  }

  initCategoryFilters() {
    const list = document.getElementById('categories-list');
    if (!list) return;

    let html = `
      <li class="category-nav-item ${window.taskStore.settings.activeCategory === 'all' ? 'active' : ''}" data-cat="all" onclick="window.app.selectCategory('all')">
        <span class="cat-dot" style="background: var(--accent-gradient)"></span>
        <span class="cat-name">All Workspaces</span>
        <span class="cat-count">${window.taskStore.tasks.length}</span>
      </li>
    `;

    window.taskStore.categories.forEach(c => {
      const count = window.taskStore.tasks.filter(t => t.category === c.id).length;
      const isActive = window.taskStore.settings.activeCategory === c.id ? 'active' : '';
      html += `
        <li class="category-nav-item ${isActive}" data-cat="${c.id}" onclick="window.app.selectCategory('${c.id}')">
          <span class="cat-dot" style="background: ${c.color}"></span>
          <span class="cat-name">${this.escapeHtml(c.name)}</span>
          <span class="cat-count">${count}</span>
          <button class="btn-delete-cat" onclick="event.stopPropagation(); window.app.deleteCategory('${c.id}', '${this.escapeHtml(c.name)}')" title="Delete project">&times;</button>
        </li>
      `;
    });

    list.innerHTML = html;
  }

  initTagControls() {
    const tags = window.taskStore.getAllTags();
    const activeTag = window.taskStore.settings.activeTag || 'all';

    // 1. Update Select Dropdown
    const select = document.getElementById('tag-filter-select');
    if (select) {
      let optionsHtml = '<option value="all">🏷️ All Tags</option>';
      tags.forEach(t => {
        optionsHtml += `<option value="${this.escapeHtml(t.name)}" ${activeTag === t.name ? 'selected' : ''}>#${this.escapeHtml(t.name)} (${t.count})</option>`;
      });
      select.innerHTML = optionsHtml;
      select.value = activeTag;
    }

    // 2. Update Group By Dropdown
    const groupBySelect = document.getElementById('groupby-select');
    if (groupBySelect) {
      groupBySelect.value = window.taskStore.settings.groupBy || 'none';
    }

    // 3. Update Sidebar Tags List
    const sidebarTagsList = document.getElementById('sidebar-tags-list');
    const clearBtn = document.getElementById('btn-clear-tag');
    if (clearBtn) {
      clearBtn.style.display = activeTag !== 'all' ? 'inline-block' : 'none';
    }

    if (sidebarTagsList) {
      if (tags.length === 0) {
        sidebarTagsList.innerHTML = `<span class="sidebar-empty-tags">No tags added yet</span>`;
      } else {
        sidebarTagsList.innerHTML = tags.map(t => {
          const isActive = activeTag.toLowerCase() === t.name.toLowerCase();
          return `
            <div class="sidebar-tag-chip ${isActive ? 'active' : ''}" onclick="window.app.filterByTag('${this.escapeHtml(t.name)}')" title="Filter by #${this.escapeHtml(t.name)}">
              <span class="tag-chip-name">#${this.escapeHtml(t.name)}</span>
              <span class="sidebar-tag-count">${t.count}</span>
              <button type="button" class="btn-delete-tag" onclick="event.stopPropagation(); window.app.handleDeleteTag('${this.escapeHtml(t.name)}')" title="Delete tag #${this.escapeHtml(t.name)}">&times;</button>
            </div>
          `;
        }).join('');
      }
    }
  }

  handleDeleteTag(tagName) {
    if (!tagName) return;
    if (confirm(`Are you sure you want to delete tag "#${tagName}"? It will be removed from all tasks.`)) {
      const count = window.taskStore.deleteTag(tagName);
      if (window.soundEngine) window.soundEngine.playDelete();
      this.initTagControls();
      this.render();
      this.showToast(`🗑️ Tag #${tagName} deleted from ${count} task(s)`, 'info');
    }
  }

  filterByTag(tagName) {
    if (tagName === window.taskStore.settings.activeTag && tagName !== 'all') {
      window.taskStore.settings.activeTag = 'all';
    } else {
      window.taskStore.settings.activeTag = tagName;
    }
    window.taskStore.saveSettings();

    if (window.soundEngine) window.soundEngine.playPop();
    if (window.taskStore.settings.activeTag !== 'all') {
      this.showToast(`🏷️ Filtered by tag: #${window.taskStore.settings.activeTag}`, 'info');
    } else {
      this.showToast('🏷️ Showing all tags', 'info');
    }

    if (window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }

    this.render();
  }

  clearAllFilters() {
    window.taskStore.settings.searchQuery = '';
    window.taskStore.settings.activeFilter = 'all';
    window.taskStore.settings.activeCategory = 'all';
    window.taskStore.settings.activePriority = 'all';
    window.taskStore.settings.activeTag = 'all';
    window.taskStore.saveSettings();

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    const prioritySelect = document.getElementById('priority-filter-select');
    if (prioritySelect) prioritySelect.value = 'all';

    const tagSelect = document.getElementById('tag-filter-select');
    if (tagSelect) tagSelect.value = 'all';

    document.querySelectorAll('.filter-nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === 'all');
    });

    if (window.soundEngine) window.soundEngine.playPop();
    this.showToast('✨ All filters cleared!', 'info');
    this.render();
  }

  setGroupBy(groupByMode) {
    window.taskStore.settings.groupBy = groupByMode;
    window.taskStore.saveSettings();

    const groupBySelect = document.getElementById('groupby-select');
    if (groupBySelect) groupBySelect.value = groupByMode;

    if (window.soundEngine) window.soundEngine.playClick();
    if (groupByMode !== 'none') {
      this.showToast(`🔀 Grouping by ${groupByMode.toUpperCase()}`, 'info');
      if (window.taskStore.settings.activeView !== 'list') {
        this.switchView('list');
      }
    } else {
      this.showToast('Group view reset', 'info');
    }

    this.render();
  }

  toggleGroupVisibility(groupId) {
    const list = document.getElementById(`group-tasks-${groupId}`);
    const icon = document.getElementById(`group-icon-${groupId}`);
    if (list) {
      list.classList.toggle('hidden');
      if (icon) icon.classList.toggle('expanded');
    }
  }

  deleteCategory(catId, catName) {
    const taskCount = window.taskStore.tasks.filter(t => t.category === catId).length;
    let msg = `Are you sure you want to delete the project "${catName}"?`;
    if (taskCount > 0) {
      msg += `\n(${taskCount} tasks in this project will be moved to General)`;
    }

    if (confirm(msg)) {
      window.taskStore.deleteCategory(catId);
      if (window.taskStore.settings.activeCategory === catId) {
        window.taskStore.settings.activeCategory = 'all';
        window.taskStore.saveSettings();
      }
      if (window.soundEngine) window.soundEngine.playDelete();
      this.showToast(`Project "${catName}" deleted!`, 'info');
      this.initCategoryFilters();
      this.render();
    }
  }

  selectCategory(catId) {
    window.taskStore.settings.activeCategory = catId;
    window.taskStore.saveSettings();
    this.initCategoryFilters();
    this.render();

    if (window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
  }

  selectFilter(filterName) {
    window.taskStore.settings.activeFilter = filterName;
    window.taskStore.saveSettings();

    document.querySelectorAll('.filter-nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === filterName);
    });

    if (window.taskStore.settings.activeView !== 'list' && window.taskStore.settings.activeView !== 'kanban') {
      this.switchView('list');
    } else {
      this.render();
    }

    if (window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
  }

  switchView(viewName) {
    window.taskStore.settings.activeView = viewName;
    window.taskStore.saveSettings();

    // Desktop Tabs
    document.querySelectorAll('.view-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewName);
    });

    // Mobile Bottom Nav Tabs
    document.querySelectorAll('.bottom-nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.bottomView === viewName);
    });

    // Panels
    document.querySelectorAll('.view-panel').forEach(p => {
      p.classList.toggle('active', p.id === `view-${viewName}`);
    });

    if (window.soundEngine) window.soundEngine.playClick();
    this.render();
  }

  render() {
    const filteredTasks = window.taskStore.getFilteredTasks();
    const activeView = window.taskStore.settings.activeView || 'list';

    // Update counters on UI
    this.updateHeaderStats();
    this.updateSmartViewCounters();

    if (activeView === 'list') {
      window.viewRenderer.renderListView(
        filteredTasks,
        window.taskStore.categories,
        document.getElementById('list-tasks-container')
      );
    } else if (activeView === 'kanban') {
      window.viewRenderer.renderKanbanView(
        filteredTasks,
        window.taskStore.categories,
        document.getElementById('kanban-tasks-container')
      );
    } else if (activeView === 'calendar') {
      window.viewRenderer.renderCalendarView(
        window.taskStore.tasks,
        document.getElementById('calendar-container')
      );
    } else if (activeView === 'analytics') {
      const stats = window.taskStore.getStats();
      window.viewRenderer.renderAnalyticsView(
        stats,
        document.getElementById('analytics-container')
      );
    }

    this.initCategoryFilters();
    this.initTagControls();
  }

  updateSmartViewCounters() {
    const tasks = window.taskStore.tasks || [];
    const todayStr = window.taskStore.getTodayDateString();
    const weekInfo = window.taskStore.getCurrentWeekSatToFriRange();

    const countAll = tasks.length;
    const countToday = tasks.filter(t => t.dueDate === todayStr && t.status !== 'completed').length;
    const countWeek = tasks.filter(t => t.dueDate && t.dueDate >= weekInfo.startDate && t.dueDate <= weekInfo.endDate && t.status !== 'completed').length;
    const countUpcoming = tasks.filter(t => t.dueDate && t.dueDate > todayStr && t.status !== 'completed').length;
    const countOverdue = tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'completed').length;
    const countStarred = tasks.filter(t => !!t.isPinned).length;
    const countCompleted = tasks.filter(t => t.status === 'completed').length;

    const setBadge = (id, count) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = count;
        el.style.display = count > 0 ? 'inline-flex' : 'none';
      }
    };

    setBadge('count-all', countAll);
    setBadge('count-today', countToday);
    setBadge('count-week', countWeek);
    setBadge('count-upcoming', countUpcoming);
    setBadge('count-overdue', countOverdue);
    setBadge('count-starred', countStarred);
    setBadge('count-completed', countCompleted);
  }

  updateHeaderStats() {
    const stats = window.taskStore.getStats();
    const streakBadge = document.getElementById('header-streak-badge');
    if (streakBadge) {
      streakBadge.innerHTML = `🔥 <span>${stats.streak.current} day streak</span>`;
    }

    const completedRatio = document.getElementById('header-completion-ratio');
    if (completedRatio) {
      completedRatio.textContent = `${stats.completed}/${stats.total} done (${stats.completionRate}%)`;
    }
  }

  handlePaletteKeyNav(e) {
    const items = document.querySelectorAll('.palette-item');
    if (!items.length) return;

    let currentIdx = -1;
    items.forEach((item, idx) => {
      if (item.classList.contains('selected')) currentIdx = idx;
    });

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (currentIdx + 1) % items.length;
      items.forEach(i => i.classList.remove('selected'));
      items[nextIdx].classList.add('selected');
      items[nextIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (currentIdx - 1 + items.length) % items.length;
      items.forEach(i => i.classList.remove('selected'));
      items[prevIdx].classList.add('selected');
      items[prevIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = document.querySelector('.palette-item.selected') || items[0];
      if (selected) selected.click();
    }
  }

  // --- SMART NATURAL LANGUAGE PARSER FOR QUICK ADD ---
  parseSmartInput(text) {
    let title = text;
    let priority = 'medium';
    let dueDate = window.taskStore.getTodayDateString();
    let category = window.taskStore.settings.activeCategory !== 'all' ? window.taskStore.settings.activeCategory : 'work';
    let tags = [];

    // Parse Priority: !urgent, !high, !med, !low
    if (/!urgent/i.test(title)) {
      priority = 'urgent';
      title = title.replace(/!urgent/ig, '');
    } else if (/!high/i.test(title)) {
      priority = 'high';
      title = title.replace(/!high/ig, '');
    } else if (/!low/i.test(title)) {
      priority = 'low';
      title = title.replace(/!low/ig, '');
    }

    // Parse Dates: @today, @tomorrow
    if (/@tomorrow/i.test(title)) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      dueDate = d.toISOString().split('T')[0];
      title = title.replace(/@tomorrow/ig, '');
    } else if (/@today/i.test(title)) {
      dueDate = window.taskStore.getTodayDateString();
      title = title.replace(/@today/ig, '');
    }

    // Parse Tags: #tag
    const foundTags = title.match(/#([a-zA-Z0-9_-]+)/g);
    if (foundTags) {
      tags = foundTags.map(t => t.slice(1));
      title = title.replace(/#[a-zA-Z0-9_-]+/g, '');
    }

    return {
      title: title.trim(),
      priority,
      dueDate,
      category,
      tags
    };
  }

  handleQuickAdd() {
    const input = document.getElementById('quick-add-input');
    if (!input || !input.value.trim()) return;

    const parsed = this.parseSmartInput(input.value.trim());
    if (!parsed.title) return;

    const task = window.taskStore.createTask(parsed);

    input.value = '';
    if (window.soundEngine) window.soundEngine.playPop();
    this.showToast(`Task created! (${parsed.priority.toUpperCase()})`, 'success');
    this.render();
  }

  handleInlineSubtaskAdd(taskId, inputEl) {
    if (!inputEl || !inputEl.value.trim()) return;
    window.taskStore.addSubtask(taskId, inputEl.value.trim());
    inputEl.value = '';
    if (window.soundEngine) window.soundEngine.playPop();
    this.render();
  }

  // --- CUSTOM RIGHT CLICK CONTEXT MENU ---
  handleTaskContextMenu(e, taskId) {
    e.preventDefault();
    this.contextTaskId = taskId;
    const menu = document.getElementById('custom-context-menu');
    if (!menu) return;

    const task = window.taskStore.getTask(taskId);
    if (!task) return;

    // Position menu within viewport bounds
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 260);

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add('active');

    // Update pin label
    const pinText = document.getElementById('ctx-pin-text');
    if (pinText) {
      pinText.textContent = task.isPinned ? 'Unpin Task' : 'Pin to Top';
    }
  }

  closeContextMenu() {
    const menu = document.getElementById('custom-context-menu');
    if (menu) menu.classList.remove('active');
    this.contextTaskId = null;
  }

  executeContextAction(action) {
    const taskId = this.contextTaskId;
    if (!taskId) return;

    switch (action) {
      case 'edit':
        this.openTaskModal(taskId);
        break;
      case 'gcal':
        if (window.gcal) window.gcal.openGoogleCalendarForTask(taskId);
        break;
      case 'pin':
        this.togglePin(taskId);
        break;
      case 'focus':
        this.startFocusForTask(taskId);
        break;
      case 'duplicate':
        window.taskStore.duplicateTask(taskId);
        if (window.soundEngine) window.soundEngine.playPop();
        this.showToast('Task duplicated!', 'success');
        this.render();
        break;
      case 'urgent':
        window.taskStore.updateTask(taskId, { priority: 'urgent' });
        this.showToast('Marked as Urgent', 'info');
        this.render();
        break;
      case 'delete':
        this.deleteTask(taskId);
        break;
    }

    this.closeContextMenu();
  }

  addCurrentModalTaskToGoogleCalendar() {
    const title = document.getElementById('modal-task-title').value.trim() || 'New Task';
    const description = document.getElementById('modal-task-desc').value.trim();
    const dueDate = document.getElementById('modal-task-duedate').value || window.taskStore.getTodayDateString();
    const dueTime = document.getElementById('modal-task-duetime').value || '';
    const priority = document.getElementById('modal-task-priority').value || 'medium';
    const poms = parseInt(document.getElementById('modal-task-poms').value, 10) || 1;

    const tempTask = {
      title,
      description,
      dueDate,
      dueTime,
      priority,
      pomodorosEstimated: poms,
      subtasks: this.modalSubtasks || []
    };

    if (window.gcal) {
      const url = window.gcal.generateGoogleCalendarUrl(tempTask);
      window.open(url, '_blank', 'noopener,noreferrer');
      this.showToast('Opening Google Calendar...', 'info');
    }
  }

  // --- COMMAND PALETTE (CMD+K / CTRL+K) ---
  toggleCommandPalette() {
    const palette = document.getElementById('command-palette');
    if (!palette) return;

    const isOpen = palette.classList.toggle('active');
    if (isOpen) {
      const input = document.getElementById('palette-input');
      if (input) {
        input.value = '';
        input.focus();
      }
      this.filterPaletteCommands('');
    }
  }

  closeCommandPalette() {
    const palette = document.getElementById('command-palette');
    if (palette) palette.classList.remove('active');
  }

  filterPaletteCommands(query) {
    const container = document.getElementById('palette-results');
    if (!container) return;

    const q = query.toLowerCase().trim();
    const sc = window.taskStore.settings.shortcuts || {};

    const commands = [
      { id: 'focus-mode', label: 'Launch Single-Task Focus Mode', icon: '🎯', shortcut: (sc['focus-mode'] || 'f').toUpperCase(), action: () => window.pomodoro.promptFocusMode() },
      { id: 'new-task', label: 'Create New Task', icon: '⚡', shortcut: (sc['new-task'] || 'n').toUpperCase(), action: () => this.openTaskModal() },
      { id: 'filter-week', label: 'View This Week (Sat – Fri)', icon: '📅', shortcut: '', action: () => this.selectFilter('week') },
      { id: 'shortcuts-modal', label: 'Configure Keyboard Shortcuts', icon: '⌨️', shortcut: (sc['shortcuts-modal'] || '?').toUpperCase(), action: () => this.openShortcutsModal() },
      { id: 'gcal-hub', label: 'Google Calendar Sync Hub', icon: '📅', shortcut: '', action: () => window.gcal.openModal() },
      { id: 'view-list', label: 'Switch to List View', icon: '📋', shortcut: (sc['view-list'] || '1').toUpperCase(), action: () => this.switchView('list') },
      { id: 'view-kanban', label: 'Switch to Kanban Board', icon: '📌', shortcut: (sc['view-kanban'] || '2').toUpperCase(), action: () => this.switchView('kanban') },
      { id: 'view-calendar', label: 'Switch to Calendar View', icon: '📅', shortcut: (sc['view-calendar'] || '3').toUpperCase(), action: () => this.switchView('calendar') },
      { id: 'view-analytics', label: 'Switch to Analytics', icon: '📊', shortcut: (sc['view-analytics'] || '4').toUpperCase(), action: () => this.switchView('analytics') },
      { id: 'export-ics', label: 'Export Schedule (.ICS / Google Calendar)', icon: '📅', shortcut: '', action: () => window.gcal.exportICS() },
      { id: 'toggle-pomo', label: 'Toggle Focus Timer Drawer', icon: '⏱️', shortcut: (sc['toggle-pomo'] || 'p').toUpperCase(), action: () => window.pomodoro.toggleDrawer() },
      { id: 'cycle-theme', label: 'Cycle Theme Mode', icon: '🌙', shortcut: (sc['cycle-theme'] || 't').toUpperCase(), action: () => this.cycleTheme() },
      { id: 'backup-json', label: 'Backup All Data (JSON)', icon: '💾', shortcut: '', action: () => window.taskStore.exportJSON() },
      { id: 'export-csv', label: 'Export Tasks as CSV', icon: '📑', shortcut: '', action: () => window.taskStore.exportCSV() },
      { id: 'load-demo', label: 'Load Demo Sample Tasks', icon: '🚀', shortcut: '', action: () => this.resetSampleData() }
    ];

    // Filter matching commands & tasks
    const matchingCommands = commands.filter(c => c.label.toLowerCase().includes(q));
    const matchingTasks = window.taskStore.tasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 5);

    let html = '';

    if (matchingCommands.length > 0) {
      html += `<div class="palette-section-title">Commands</div>`;
      matchingCommands.forEach((c, idx) => {
        html += `
          <div class="palette-item ${idx === 0 && !matchingTasks.length ? 'selected' : ''}" onclick="window.app.executePaletteCommand('${c.id}')">
            <span class="palette-item-icon">${c.icon}</span>
            <span class="palette-item-text">${c.label}</span>
            ${c.shortcut ? `<kbd>${c.shortcut}</kbd>` : ''}
          </div>
        `;
      });
    }

    if (matchingTasks.length > 0) {
      html += `<div class="palette-section-title">Tasks</div>`;
      matchingTasks.forEach(t => {
        html += `
          <div class="palette-item" onclick="window.app.closeCommandPalette(); window.app.openTaskModal('${t.id}')">
            <span class="palette-item-icon">📝</span>
            <span class="palette-item-text">${this.escapeHtml(t.title)}</span>
            <span class="badge priority-${t.priority}">${t.priority}</span>
          </div>
        `;
      });
    }

    if (!matchingCommands.length && !matchingTasks.length) {
      html = `<div class="palette-empty">No results found for "${this.escapeHtml(query)}"</div>`;
    }

    container.innerHTML = html;
  }

  executePaletteCommand(commandId) {
    this.closeCommandPalette();
    const map = {
      'shortcuts-modal': () => this.openShortcutsModal(),
      'gcal-hub': () => window.gcal.openModal(),
      'export-ics': () => window.gcal.exportICS(),
      'focus-mode': () => window.pomodoro.promptFocusMode(),
      'new-task': () => this.openTaskModal(),
      'view-list': () => this.switchView('list'),
      'view-kanban': () => this.switchView('kanban'),
      'view-calendar': () => this.switchView('calendar'),
      'view-analytics': () => this.switchView('analytics'),
      'toggle-pomo': () => window.pomodoro.toggleDrawer(),
      'cycle-theme': () => this.cycleTheme(),
      'backup-json': () => window.taskStore.exportJSON(),
      'export-csv': () => window.taskStore.exportCSV(),
      'load-demo': () => this.resetSampleData()
    };

    if (map[commandId]) map[commandId]();
  }

  toggleTask(taskId, event) {
    const result = window.taskStore.toggleTaskComplete(taskId);
    if (!result) return;

    if (result.justCompleted) {
      if (window.soundEngine) window.soundEngine.playComplete();
      if (window.confetti && event) {
        window.confetti.burst(event.clientX || window.innerWidth/2, event.clientY || window.innerHeight/2, 60);
      }
      this.showToast('🎉 Task completed! Keep the momentum going!', 'success');
    } else {
      if (window.soundEngine) window.soundEngine.playPop();
    }

    this.render();
  }

  togglePin(taskId) {
    window.taskStore.togglePinTask(taskId);
    if (window.soundEngine) window.soundEngine.playPop();
    this.render();
  }

  toggleSubtask(taskId, subtaskId) {
    const res = window.taskStore.toggleSubtask(taskId, subtaskId);
    if (window.soundEngine) window.soundEngine.playPop();
    this.render();
  }

  toggleSubtasksExpansion(taskId) {
    const list = document.getElementById(`subtasks-list-${taskId}`);
    const icon = document.getElementById(`subtask-icon-${taskId}`);
    if (list) {
      list.classList.toggle('hidden');
      if (icon) icon.classList.toggle('expanded');
    }
  }

  deleteTask(taskId) {
    const task = window.taskStore.getTask(taskId);
    if (!task) return;

    if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
      window.taskStore.deleteTask(taskId);
      if (window.soundEngine) window.soundEngine.playDelete();
      this.showToast('Task removed', 'info');
      this.render();
    }
  }

  startFocusForTask(taskId) {
    window.pomodoro.openDrawer();
    window.pomodoro.activeTaskId = taskId;
    if (window.pomodoro.dom.taskSelect) {
      window.pomodoro.dom.taskSelect.value = taskId;
    }
    this.showToast('Focus session linked to task', 'info');
  }

  // --- KANBAN DRAG & DROP ---
  handleKanbanDragStart(e, taskId) {
    this.draggedTaskId = taskId;
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target) e.target.classList.add('dragging');
    }, 0);
  }

  handleKanbanDragEnd(e) {
    if (e.target) e.target.classList.remove('dragging');
    document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
  }

  handleKanbanDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const col = e.currentTarget;
    if (col && !col.classList.contains('drag-over')) {
      col.classList.add('drag-over');
    }
  }

  handleKanbanDragLeave(e) {
    const col = e.currentTarget;
    if (col) col.classList.remove('drag-over');
  }

  handleKanbanDrop(e, targetStatus) {
    e.preventDefault();
    const col = e.currentTarget;
    if (col) col.classList.remove('drag-over');

    const taskId = e.dataTransfer.getData('text/plain') || this.draggedTaskId;
    if (!taskId) return;

    this.moveKanbanTask(taskId, targetStatus);
  }

  moveKanbanTask(taskId, targetStatus) {
    const res = window.taskStore.updateTask(taskId, { status: targetStatus });
    if (res) {
      if (targetStatus === 'completed' && res.justCompleted) {
        if (window.soundEngine) window.soundEngine.playComplete();
        if (window.confetti) window.confetti.burst(window.innerWidth/2, window.innerHeight/2, 70);
        this.showToast('🎉 Task completed!', 'success');
      } else {
        if (window.soundEngine) window.soundEngine.playPop();
        this.showToast(`Moved to ${targetStatus.replace('_', ' ').toUpperCase()}`, 'info');
      }
      this.render();
    }
  }

  // --- WEEKLY SAT-FRI KANBAN DRAG & DROP & RESCHEDULING ---
  handleWeeklyDragStart(e, taskId) {
    this.draggedWeeklyTaskId = taskId;
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target) e.target.classList.add('dragging');
    }, 0);
  }

  handleWeeklyDragEnd(e) {
    if (e.target) e.target.classList.remove('dragging');
    document.querySelectorAll('.weekly-kanban-col').forEach(col => col.classList.remove('drag-over'));
  }

  handleWeeklyDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const col = e.currentTarget;
    if (col && !col.classList.contains('drag-over')) {
      col.classList.add('drag-over');
    }
  }

  handleWeeklyDragLeave(e) {
    const col = e.currentTarget;
    if (col) col.classList.remove('drag-over');
  }

  handleWeeklyDrop(e, targetDateStr) {
    e.preventDefault();
    const col = e.currentTarget;
    if (col) col.classList.remove('drag-over');

    const taskId = e.dataTransfer.getData('text/plain') || this.draggedWeeklyTaskId;
    if (!taskId) return;

    this.moveTaskToDate(taskId, targetDateStr);
  }

  moveTaskToDate(taskId, targetDateStr) {
    const res = window.taskStore.updateTask(taskId, { dueDate: targetDateStr });
    if (res) {
      if (window.soundEngine) window.soundEngine.playPop();
      const dayName = new Date(targetDateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      this.showToast(`📅 Rescheduled to ${dayName}`, 'success');
      this.render();
    }
  }

  // --- CALENDAR ACTIONS ---
  calendarPrevMonth() {
    window.viewRenderer.currentCalendarDate.setMonth(window.viewRenderer.currentCalendarDate.getMonth() - 1);
    this.render();
  }

  calendarNextMonth() {
    window.viewRenderer.currentCalendarDate.setMonth(window.viewRenderer.currentCalendarDate.getMonth() + 1);
    this.render();
  }

  calendarToday() {
    window.viewRenderer.currentCalendarDate = new Date();
    this.render();
  }

  handleCalendarDayClick(dateStr) {
    window.viewRenderer.selectedCalendarDate = dateStr;
    this.render();
  }

  // --- MODAL MANAGEMENT ---
  openTaskModal(taskId = null) {
    this.currentEditingTaskId = taskId;
    const modal = document.getElementById('task-modal');
    const title = document.getElementById('modal-title');
    const submitBtnText = document.getElementById('task-modal-submit-text');

    const catSelect = document.getElementById('modal-task-category');
    if (catSelect) {
      catSelect.innerHTML = window.taskStore.categories.map(c => `
        <option value="${c.id}">${this.escapeHtml(c.name)}</option>
      `).join('');
    }

    if (taskId) {
      const task = window.taskStore.getTask(taskId);
      if (!task) return;

      title.textContent = 'Edit Task';
      submitBtnText.textContent = 'Update Task';

      document.getElementById('modal-task-title').value = task.title || '';
      document.getElementById('modal-task-desc').value = task.description || '';
      document.getElementById('modal-task-category').value = task.category || 'work';
      document.getElementById('modal-task-priority').value = task.priority || 'medium';
      document.getElementById('modal-task-status').value = task.status || 'todo';
      document.getElementById('modal-task-duedate').value = task.dueDate || '';
      document.getElementById('modal-task-duetime').value = task.dueTime || '';
      document.getElementById('modal-task-poms').value = task.pomodorosEstimated || 1;
      document.getElementById('modal-task-pinned').checked = !!task.isPinned;

      this.modalSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
      this.modalTags = task.tags ? [...task.tags] : [];
    } else {
      title.textContent = 'Create New Task';
      submitBtnText.textContent = 'Create Task';

      document.getElementById('modal-task-title').value = '';
      document.getElementById('modal-task-desc').value = '';
      document.getElementById('modal-task-category').value = window.taskStore.settings.activeCategory !== 'all' ? window.taskStore.settings.activeCategory : 'work';
      document.getElementById('modal-task-priority').value = 'medium';
      document.getElementById('modal-task-status').value = 'todo';
      document.getElementById('modal-task-duedate').value = window.taskStore.getTodayDateString();
      document.getElementById('modal-task-duetime').value = '';
      document.getElementById('modal-task-poms').value = 1;
      document.getElementById('modal-task-pinned').checked = false;

      this.modalSubtasks = [];
      this.modalTags = [];
    }

    this.renderModalSubtasks();
    this.renderModalTags();

    if (modal) modal.classList.add('active');
    setTimeout(() => {
      document.getElementById('modal-task-title').focus();
    }, 100);
  }

  openTaskModalWithStatus(status) {
    this.openTaskModal();
    const statusSelect = document.getElementById('modal-task-status');
    if (statusSelect) statusSelect.value = status;
  }

  openTaskModalWithDate(dateStr) {
    this.openTaskModal();
    const dateInput = document.getElementById('modal-task-duedate');
    if (dateInput) dateInput.value = dateStr;
  }

  closeTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.remove('active');
    this.currentEditingTaskId = null;
  }

  handleTaskFormSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('modal-task-title').value.trim();
    if (!title) {
      this.showToast('Please enter a task title', 'warning');
      return;
    }

    const taskData = {
      title,
      description: document.getElementById('modal-task-desc').value.trim(),
      category: document.getElementById('modal-task-category').value,
      priority: document.getElementById('modal-task-priority').value,
      status: document.getElementById('modal-task-status').value,
      dueDate: document.getElementById('modal-task-duedate').value,
      dueTime: document.getElementById('modal-task-duetime').value,
      pomodorosEstimated: parseInt(document.getElementById('modal-task-poms').value, 10) || 1,
      isPinned: document.getElementById('modal-task-pinned').checked,
      subtasks: this.modalSubtasks,
      tags: this.modalTags
    };

    if (this.currentEditingTaskId) {
      window.taskStore.updateTask(this.currentEditingTaskId, taskData);
      this.showToast('Task updated successfully!', 'success');
    } else {
      window.taskStore.createTask(taskData);
      this.showToast('New task created!', 'success');
      if (window.soundEngine) window.soundEngine.playPop();
    }

    this.closeTaskModal();
    this.render();
  }

  // Modal Subtasks helper
  addModalSubtask() {
    const input = document.getElementById('modal-subtask-input');
    if (!input || !input.value.trim()) return;

    this.modalSubtasks.push({
      id: 'mst_' + Date.now().toString(36),
      text: input.value.trim(),
      completed: false
    });

    input.value = '';
    this.renderModalSubtasks();
  }

  removeModalSubtask(index) {
    this.modalSubtasks.splice(index, 1);
    this.renderModalSubtasks();
  }

  renderModalSubtasks() {
    const container = document.getElementById('modal-subtasks-list');
    if (!container) return;

    if (this.modalSubtasks.length === 0) {
      container.innerHTML = `<span class="empty-subtasks-note">No subtasks added yet</span>`;
      return;
    }

    container.innerHTML = this.modalSubtasks.map((st, i) => `
      <div class="modal-subtask-row">
        <span>• ${this.escapeHtml(st.text)}</span>
        <button type="button" class="btn-remove-item" onclick="window.app.removeModalSubtask(${i})">&times;</button>
      </div>
    `).join('');
  }

  // Modal Tags helper
  addModalTag(explicitTag) {
    let tagToAdd = explicitTag;
    if (!tagToAdd) {
      const input = document.getElementById('modal-tag-input');
      if (!input || !input.value.trim()) return;
      tagToAdd = input.value.trim();
      input.value = '';
    }

    // Support comma or space separated list
    const parts = tagToAdd.split(/[,\s]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean);
    parts.forEach(p => {
      const clean = p.toLowerCase();
      if (clean && !this.modalTags.includes(clean)) {
        this.modalTags.push(clean);
      }
    });

    this.renderModalTags();
  }

  removeModalTag(tag) {
    this.modalTags = this.modalTags.filter(t => t.toLowerCase() !== tag.toLowerCase());
    this.renderModalTags();
  }

  renderModalTags() {
    const container = document.getElementById('modal-tags-list');
    if (!container) return;

    const commonSuggestions = ['design', 'frontend', 'backend', 'launch', 'marketing', 'urgent', 'finance', 'health'];
    const availableSuggestions = commonSuggestions.filter(s => !this.modalTags.includes(s));

    let html = `
      <div class="modal-active-tags-row">
        ${this.modalTags.map(t => `
          <span class="tag-pill modal-tag-chip">
            #${this.escapeHtml(t)}
            <button type="button" class="btn-remove-modal-tag" onclick="window.app.removeModalTag('${this.escapeHtml(t)}')">&times;</button>
          </span>
        `).join('')}
        ${this.modalTags.length === 0 ? '<span class="empty-subtasks-note">No tags attached</span>' : ''}
      </div>
    `;

    if (availableSuggestions.length > 0) {
      html += `
        <div class="modal-suggested-tags">
          <span class="suggested-tags-lbl">Quick Add:</span>
          ${availableSuggestions.slice(0, 5).map(s => `
            <button type="button" class="btn-suggested-tag" onclick="window.app.addModalTag('${s}')">+ #${s}</button>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
  }

  // Categories Modal
  openCategoryModal() {
    this.renderModalProjectsList();
    const modal = document.getElementById('category-modal');
    if (modal) modal.classList.add('active');
  }

  closeCategoryModal() {
    const modal = document.getElementById('category-modal');
    if (modal) modal.classList.remove('active');
  }

  renderModalProjectsList() {
    const container = document.getElementById('modal-projects-list');
    if (!container) return;

    if (window.taskStore.categories.length === 0) {
      container.innerHTML = `<span class="empty-subtasks-note">No custom projects yet</span>`;
      return;
    }

    container.innerHTML = window.taskStore.categories.map(c => {
      const count = window.taskStore.tasks.filter(t => t.category === c.id).length;
      return `
        <div class="modal-project-row">
          <div class="modal-project-info">
            <span class="cat-dot" style="background: ${c.color}"></span>
            <span class="modal-project-name">${this.escapeHtml(c.name)}</span>
            <span class="cat-count">${count} tasks</span>
          </div>
          <button type="button" class="btn-delete-project-modal" onclick="window.app.deleteCategory('${c.id}', '${this.escapeHtml(c.name)}')" title="Delete this project">&times;</button>
        </div>
      `;
    }).join('');
  }

  handleCategorySubmit(e) {
    e.preventDefault();
    const name = document.getElementById('cat-name-input').value.trim();
    const color = document.getElementById('cat-color-input').value;

    if (!name) {
      this.showToast('Please enter category name', 'warning');
      return;
    }

    window.taskStore.addCategory(name, color);
    document.getElementById('cat-name-input').value = '';
    this.renderModalProjectsList();
    this.initCategoryFilters();
    this.showToast(`Project "${name}" added!`, 'success');
  }

  // Shortcuts Modal & Customization Studio
  openShortcutsModal() {
    this.renderShortcutsCustomizer();
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.classList.add('active');
  }

  closeShortcutsModal() {
    this.recordingShortcutActionId = null;
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.classList.remove('active');
  }

  renderShortcutsCustomizer() {
    const container = document.getElementById('shortcuts-customizer-list');
    if (!container) return;

    const defs = window.taskStore.DEFAULT_SHORTCUTS;
    const currentShortcuts = window.taskStore.settings.shortcuts || {};

    let html = '';
    Object.keys(defs).forEach(actionId => {
      const def = defs[actionId];
      const assignedKey = currentShortcuts[actionId] || def.key;
      const isRecording = this.recordingShortcutActionId === actionId;

      html += `
        <div class="shortcut-customizer-row ${isRecording ? 'is-recording' : ''}">
          <div class="shortcut-meta">
            <span class="shortcut-icon">${def.icon}</span>
            <span class="shortcut-label">${this.escapeHtml(def.label)}</span>
          </div>
          <button type="button" class="btn-key-recorder ${isRecording ? 'recording' : ''}" onclick="window.app.startRecordingShortcut('${actionId}')" title="Click to change shortcut">
            ${isRecording ? '<span class="recording-pulse">● Press any key...</span>' : `<kbd>${this.escapeHtml(assignedKey.toUpperCase())}</kbd>`}
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  startRecordingShortcut(actionId) {
    this.recordingShortcutActionId = actionId;
    this.renderShortcutsCustomizer();
    if (window.soundEngine) window.soundEngine.playPop();
  }

  handleShortcutRecordKey(e) {
    if (!this.recordingShortcutActionId) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      this.recordingShortcutActionId = null;
      this.renderShortcutsCustomizer();
      this.showToast('Key assignment cancelled', 'info');
      return;
    }

    // Ignore modifier standalone presses
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      return;
    }

    const actionId = this.recordingShortcutActionId;
    const newKey = e.key.toLowerCase();
    const actionLabel = window.taskStore.DEFAULT_SHORTCUTS[actionId]?.label || actionId;

    window.taskStore.updateShortcut(actionId, newKey);
    this.recordingShortcutActionId = null;

    if (window.soundEngine) window.soundEngine.playComplete();
    this.showToast(`✨ Shortcut for "${actionLabel}" updated to [${newKey.toUpperCase()}]`, 'success');
    this.renderShortcutsCustomizer();
  }

  resetAllShortcuts() {
    window.taskStore.resetShortcuts();
    this.recordingShortcutActionId = null;
    if (window.soundEngine) window.soundEngine.playPop();
    this.showToast('Keyboard shortcuts restored to defaults', 'info');
    this.renderShortcutsCustomizer();
  }

  closeAllModals() {
    this.closeTaskModal();
    this.closeCategoryModal();
    this.closeShortcutsModal();
    if (window.pomodoro) window.pomodoro.closeDrawer();
  }

  // --- THEME MANAGEMENT ---
  cycleTheme() {
    const current = window.taskStore.settings.theme || 'dark';
    const nextIdx = (this.themes.indexOf(current) + 1) % this.themes.length;
    const nextTheme = this.themes[nextIdx];
    this.applyTheme(nextTheme);
    this.showToast(`Switched to ${nextTheme.toUpperCase()} theme`, 'info');
  }

  applyTheme(themeName) {
    window.taskStore.settings.theme = themeName;
    window.taskStore.saveSettings();
    document.documentElement.setAttribute('data-theme', themeName);

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      const icons = {
        dark: '🌙',
        midnight: '🌌',
        cyber: '⚡',
        light: '☀️'
      };
      themeBtn.querySelector('.theme-icon').textContent = icons[themeName] || '🌙';
    }
  }

  // --- TOAST NOTIFICATIONS ---
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: '✨',
      info: '💡',
      warning: '⚠️',
      danger: '🚨'
    };

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || '💡'}</span>
      <span class="toast-text">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Sample data reset
  resetSampleData() {
    if (confirm('Load demo tasks and categories? (This will populate sample tasks)')) {
      window.taskStore.loadSampleData();
      this.initCategoryFilters();
      this.render();
      this.showToast('Sample tasks loaded!', 'success');
    }
  }

  clearAllData() {
    if (confirm('Are you sure you want to clear all tasks? This action cannot be undone.')) {
      window.taskStore.clearAllTasks();
      this.render();
      this.showToast('All tasks cleared', 'info');
    }
  }

  triggerJSONImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const success = window.taskStore.importJSON(event.target.result);
        if (success) {
          this.initCategoryFilters();
          this.render();
          this.showToast('Data imported successfully!', 'success');
        } else {
          this.showToast('Failed to parse JSON file.', 'warning');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // --- AUTHENTICATION & MULTI-USER METHODS ---
  updateHeaderUserChip() {
    if (!window.authManager) return;
    const user = window.authManager.getCurrentUser();
    const avatarEl = document.getElementById('header-user-avatar');
    const nameEl = document.getElementById('header-user-name');
    const greetingSubtitle = document.getElementById('greeting-subtitle');
    const adminBadgeBtn = document.getElementById('header-admin-btn');

    const isAdmin = window.authManager.isAdmin();
    if (adminBadgeBtn) {
      adminBadgeBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    if (avatarEl) {
      avatarEl.textContent = window.authManager.getUserInitials(user.name);
      avatarEl.style.backgroundColor = user.avatarColor || '#6366f1';
    }

    if (nameEl) {
      nameEl.textContent = user.isGuest ? 'Guest' : user.name.split(' ')[0];
    }

    if (greetingSubtitle) {
      greetingSubtitle.textContent = isAdmin
        ? '🛡️ Master Admin Authority Active • Full control over all users & workspaces.'
        : (user.isGuest 
            ? 'Your offline mission control for peak productivity and deep flow.'
            : `Logged in as ${user.name} • Workspace is private and isolated.`);
    }
  }

  openAuthModal(defaultTab = null) {
    const modal = document.getElementById('auth-modal');
    if (!modal || !window.authManager) return;

    const isLoggedIn = window.authManager.isLoggedIn();
    const profileTabBtn = document.getElementById('tab-btn-profile');
    const signinTabBtn = document.getElementById('tab-btn-signin');
    const signupTabBtn = document.getElementById('tab-btn-signup');

    if (profileTabBtn) {
      profileTabBtn.style.display = isLoggedIn ? 'block' : 'none';
    }

    // Determine default active tab
    const targetTab = defaultTab || (isLoggedIn ? 'profile' : 'signin');
    this.switchAuthTab(targetTab);
    this.renderAvatarColorPicker();

    modal.classList.add('active');
    if (window.soundEngine) window.soundEngine.playPop();
  }

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
  }

  switchAuthTab(tabName) {
    const tabs = ['signin', 'signup', 'profile'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const panel = document.getElementById(`auth-panel-${t}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (panel) panel.classList.toggle('active', t === tabName);
    });

    const titleEl = document.getElementById('auth-modal-title');
    const subtitleEl = document.getElementById('auth-modal-subtitle');

    if (tabName === 'signin') {
      if (titleEl) titleEl.textContent = 'Welcome Back';
      if (subtitleEl) subtitleEl.textContent = 'Sign in to access your private task workspace';
    } else if (tabName === 'signup') {
      if (titleEl) titleEl.textContent = 'Create Free Account';
      if (subtitleEl) subtitleEl.textContent = 'Create a dedicated profile with isolated storage';
    } else if (tabName === 'profile') {
      if (titleEl) titleEl.textContent = 'Account Profile';
      if (subtitleEl) subtitleEl.textContent = 'Manage your session and workspace data';
      this.populateProfileDetails();
    }
  }

  renderAvatarColorPicker() {
    const container = document.getElementById('signup-avatar-picker');
    if (!container || !window.authManager) return;

    const colors = window.authManager.AVATAR_COLORS;
    this.selectedAvatarColor = this.selectedAvatarColor || colors[0];

    container.innerHTML = colors.map((c, idx) => `
      <div class="color-swatch-dot ${c === this.selectedAvatarColor ? 'active' : ''}" 
           style="background: ${c}" 
           onclick="window.app.selectAvatarColor('${c}')"
           title="Color Option ${idx + 1}"></div>
    `).join('');
  }

  selectAvatarColor(color) {
    this.selectedAvatarColor = color;
    this.renderAvatarColorPicker();
  }

  togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  checkPasswordStrength(val) {
    const fill = document.getElementById('signup-strength-fill');
    if (!fill) return;

    if (!val || val.length === 0) {
      fill.style.width = '0%';
      return;
    }

    if (val.length < 6) {
      fill.style.width = '30%';
      fill.style.background = 'var(--color-urgent)';
    } else if (val.length < 10) {
      fill.style.width = '65%';
      fill.style.background = 'var(--color-medium)';
    } else {
      fill.style.width = '100%';
      fill.style.background = 'var(--color-low)';
    }
  }

  handleLoginSubmit() {
    const emailInput = document.getElementById('signin-email');
    const passwordInput = document.getElementById('signin-password');
    if (!emailInput || !passwordInput) return;

    const result = window.authManager.login({
      email: emailInput.value,
      password: passwordInput.value
    });

    if (result.success) {
      this.closeAuthModal();
      this.updateHeaderUserChip();
      if (window.soundEngine) window.soundEngine.playSuccess();
      this.showToast(result.message, 'success');
      emailInput.value = '';
      passwordInput.value = '';

      // If logging in as Master Admin, redirect directly to Admin Panel
      if (result.isAdmin && window.adminDashboard) {
        setTimeout(() => {
          window.adminDashboard.open();
        }, 350);
      }
    } else {
      if (window.soundEngine) window.soundEngine.playMute();
      this.showToast(result.message, 'warning');
    }
  }

  handleSignUpSubmit() {
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const migrateInput = document.getElementById('signup-migrate');

    if (!nameInput || !emailInput || !passwordInput) return;

    const result = window.authManager.signUp({
      name: nameInput.value,
      email: emailInput.value,
      password: passwordInput.value,
      avatarColor: this.selectedAvatarColor,
      migrateGuest: migrateInput ? migrateInput.checked : true
    });

    if (result.success) {
      this.closeAuthModal();
      this.updateHeaderUserChip();
      if (window.confettiCanon) window.confettiCanon.triggerBurst();
      if (window.soundEngine) window.soundEngine.playSuccess();
      this.showToast(result.message, 'success');
      nameInput.value = '';
      emailInput.value = '';
      passwordInput.value = '';
    } else {
      if (window.soundEngine) window.soundEngine.playMute();
      this.showToast(result.message, 'warning');
    }
  }

  handleDemoLogin(demoId) {
    const result = window.authManager.loginDemo(demoId);
    if (result.success) {
      this.closeAuthModal();
      this.updateHeaderUserChip();
      if (window.soundEngine) window.soundEngine.playClick();
      this.showToast(result.message, 'success');
    } else {
      this.showToast(result.message, 'warning');
    }
  }

  populateProfileDetails() {
    if (!window.authManager) return;
    const user = window.authManager.getCurrentUser();
    const avatarLarge = document.getElementById('profile-avatar-large');
    const nameEl = document.getElementById('profile-display-name');
    const emailEl = document.getElementById('profile-display-email');
    const roleEl = document.getElementById('profile-display-role');

    const totalEl = document.getElementById('profile-stat-total');
    const completedEl = document.getElementById('profile-stat-completed');
    const streakEl = document.getElementById('profile-stat-streak');

    if (avatarLarge) {
      avatarLarge.textContent = window.authManager.getUserInitials(user.name);
      avatarLarge.style.backgroundColor = user.avatarColor || '#6366f1';
    }

    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
    if (roleEl) roleEl.textContent = user.role || 'Member';

    if (window.taskStore) {
      const stats = window.taskStore.getAnalyticsData();
      const streak = window.taskStore.getStreakData();
      if (totalEl) totalEl.textContent = stats.total;
      if (completedEl) completedEl.textContent = stats.completed;
      if (streakEl) streakEl.textContent = streak.current;
    }
  }

  handleLogout() {
    const result = window.authManager.logout();
    this.closeAuthModal();
    this.updateHeaderUserChip();
    if (window.soundEngine) window.soundEngine.playClick();
    this.showToast(result.message, 'info');
  }

  handleDeleteAccount() {
    if (confirm('Are you sure you want to delete your account? All tasks in this account will be permanently erased.')) {
      const result = window.authManager.deleteCurrentAccount();
      this.closeAuthModal();
      this.updateHeaderUserChip();
      this.showToast(result.message, 'info');
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TaskFlowApp();
  window.app.init();
});
