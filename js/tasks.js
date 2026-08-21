/**
 * Task Data Store and State Management
 */
class TaskStore {
  constructor() {
    this.userId = (typeof window !== 'undefined' && window.authManager) ? window.authManager.getCurrentUser().id : 'guest';
    this.updateStorageKeys();

    this.tasks = [];
    this.categories = [];
    this.DEFAULT_SHORTCUTS = {
      'focus-mode': { key: 'f', label: 'Single-Task Focus Mode', icon: '🎯' },
      'new-task': { key: 'n', label: 'Create New Task', icon: '⚡' },
      'search': { key: '/', label: 'Focus Search Bar', icon: '🔍' },
      'toggle-sidebar': { key: '\\', label: 'Toggle Sidebar', icon: '◧' },
      'toggle-pomo': { key: 'p', label: 'Toggle Focus Timer Studio', icon: '⏱️' },
      'view-list': { key: '1', label: 'Switch to List View', icon: '📋' },
      'view-kanban': { key: '2', label: 'Switch to Kanban Board', icon: '📌' },
      'view-calendar': { key: '3', label: 'Switch to Calendar View', icon: '📅' },
      'view-analytics': { key: '4', label: 'Switch to Analytics View', icon: '📊' },
      'cycle-theme': { key: 't', label: 'Cycle Theme Mode', icon: '🌙' },
      'command-palette': { key: 'k', label: 'Command Palette (Ctrl/Cmd+)', icon: '✨' },
      'shortcuts-modal': { key: '?', label: 'Open Keyboard Shortcuts', icon: '⌨️' }
    };

    this.settings = {
      theme: 'dark',
      soundEnabled: true,
      confettiEnabled: true,
      activeView: 'list', // 'list', 'kanban', 'calendar', 'analytics'
      activeFilter: 'all',
      activeCategory: 'all',
      activePriority: 'all',
      activeTag: 'all',
      groupBy: 'none', // 'none', 'tag', 'priority', 'category', 'dueDate', 'status'
      sidebarCollapsed: false,
      collapsedSections: {},
      searchQuery: '',
      sortBy: 'dueDate-asc',
      shortcuts: { ...this.getFlatDefaultShortcuts() }
    };

    this.init();
  }

  updateStorageKeys() {
    const suffix = this.userId && this.userId !== 'guest' ? `_${this.userId}` : '_v2';
    this.STORAGE_KEY = `taskflow_tasks${suffix}`;
    this.CATEGORIES_KEY = `taskflow_categories${suffix}`;
    this.SETTINGS_KEY = `taskflow_settings${suffix}`;
    this.STREAK_KEY = `taskflow_streak${suffix}`;
  }

  switchUser(newUserId) {
    this.userId = newUserId || 'guest';
    this.updateStorageKeys();
    this.init();
    if (typeof window !== 'undefined' && window.app) {
      window.app.applyTheme(this.settings.theme || 'dark');
      window.app.applySidebarState();
      window.app.initCategoryFilters();
      window.app.render();
      window.app.updateHeaderUserChip();
    }
  }

  getFlatDefaultShortcuts() {
    const flat = {};
    Object.keys(this.DEFAULT_SHORTCUTS).forEach(k => {
      flat[k] = this.DEFAULT_SHORTCUTS[k].key;
    });
    return flat;
  }

  init() {
    this.loadSettings();
    this.loadCategories();
    this.loadTasks();

    if (this.tasks.length === 0 && this.userId === 'guest') {
      this.loadSampleData();
    }
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(this.SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...this.settings, ...parsed };
        this.settings.shortcuts = { ...this.getFlatDefaultShortcuts(), ...(parsed.shortcuts || {}) };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  updateShortcut(actionId, newKey) {
    if (!this.settings.shortcuts) {
      this.settings.shortcuts = { ...this.getFlatDefaultShortcuts() };
    }
    this.settings.shortcuts[actionId] = newKey.toLowerCase();
    this.saveSettings();
  }

  resetShortcuts() {
    this.settings.shortcuts = { ...this.getFlatDefaultShortcuts() };
    this.saveSettings();
  }

  saveSettings() {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  loadCategories() {
    try {
      const saved = localStorage.getItem(this.CATEGORIES_KEY);
      if (saved) {
        this.categories = JSON.parse(saved);
      } else {
        this.categories = [
          { id: 'work', name: 'Work & Projects', color: '#6366f1', icon: 'briefcase' },
          { id: 'personal', name: 'Personal Life', color: '#ec4899', icon: 'user' },
          { id: 'study', name: 'Study & Learning', color: '#06b6d4', icon: 'book-open' },
          { id: 'fitness', name: 'Health & Fitness', color: '#10b981', icon: 'activity' },
          { id: 'creative', name: 'Design & Code', color: '#8b5cf6', icon: 'feather' },
          { id: 'shopping', name: 'Errands & Shopping', color: '#f59e0b', icon: 'shopping-bag' }
        ];
        this.saveCategories();
      }
    } catch (e) {
      console.warn('Failed to load categories:', e);
    }
  }

  saveCategories() {
    try {
      localStorage.setItem(this.CATEGORIES_KEY, JSON.stringify(this.categories));
    } catch (e) {
      console.warn('Failed to save categories:', e);
    }
  }

  addCategory(name, color = '#6366f1', icon = 'tag') {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
    const newCat = { id, name, color, icon };
    this.categories.push(newCat);
    this.saveCategories();
    return newCat;
  }

  deleteCategory(catId) {
    this.categories = this.categories.filter(c => c.id !== catId);
    if (this.categories.length === 0) {
      this.categories = [{ id: 'general', name: 'General', color: '#6366f1', icon: 'tag' }];
    }
    const fallbackCatId = this.categories[0].id;
    this.tasks.forEach(t => {
      if (t.category === catId) t.category = fallbackCatId;
    });
    this.saveCategories();
    this.saveTasks();
  }

  loadTasks() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        this.tasks = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load tasks:', e);
      this.tasks = [];
    }
  }

  saveTasks() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tasks));
      this.updateStreak();
    } catch (e) {
      console.warn('Failed to save tasks:', e);
    }
  }

  createTask({
    title,
    description = '',
    category = 'personal',
    priority = 'medium',
    status = 'todo',
    dueDate = '',
    dueTime = '',
    subtasks = [],
    tags = [],
    pomodorosEstimated = 1,
    isPinned = false
  }) {
    const newTask = {
      id: 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
      title: title.trim(),
      description: description.trim(),
      category,
      priority, // 'urgent', 'high', 'medium', 'low'
      status, // 'todo', 'in_progress', 'review', 'completed'
      dueDate: dueDate || this.getTodayDateString(),
      dueTime: dueTime || '',
      subtasks: subtasks.map((st, i) => ({
        id: 'st_' + i + '_' + Date.now().toString(36),
        text: typeof st === 'string' ? st : st.text,
        completed: typeof st === 'object' ? !!st.completed : false
      })),
      tags: Array.isArray(tags) ? tags : [],
      pomodorosEstimated: Number(pomodorosEstimated) || 1,
      pomodorosCompleted: 0,
      createdAt: new Date().toISOString(),
      completedAt: status === 'completed' ? new Date().toISOString() : null,
      isPinned: !!isPinned
    };

    this.tasks.unshift(newTask);
    this.saveTasks();
    return newTask;
  }

  updateTask(id, updates) {
    const idx = this.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const oldStatus = this.tasks[idx].status;
    const isNowCompleted = updates.status === 'completed' && oldStatus !== 'completed';

    if (updates.status === 'completed' && !this.tasks[idx].completedAt) {
      updates.completedAt = new Date().toISOString();
    } else if (updates.status && updates.status !== 'completed') {
      updates.completedAt = null;
    }

    this.tasks[idx] = {
      ...this.tasks[idx],
      ...updates
    };

    this.saveTasks();
    return { task: this.tasks[idx], justCompleted: isNowCompleted };
  }

  duplicateTask(id) {
    const task = this.getTask(id);
    if (!task) return null;

    const duplicated = {
      ...JSON.parse(JSON.stringify(task)),
      id: 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
      title: `${task.title} (Copy)`,
      createdAt: new Date().toISOString(),
      completedAt: null,
      status: 'todo'
    };

    this.tasks.unshift(duplicated);
    this.saveTasks();
    return duplicated;
  }

  batchUpdate(taskIds, updates) {
    let count = 0;
    this.tasks.forEach(t => {
      if (taskIds.includes(t.id)) {
        Object.assign(t, updates);
        if (updates.status === 'completed' && !t.completedAt) {
          t.completedAt = new Date().toISOString();
        } else if (updates.status && updates.status !== 'completed') {
          t.completedAt = null;
        }
        count++;
      }
    });
    this.saveTasks();
    return count;
  }

  batchDelete(taskIds) {
    this.tasks = this.tasks.filter(t => !taskIds.includes(t.id));
    this.saveTasks();
  }

  deleteTask(id) {
    const idx = this.tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;
    const removed = this.tasks.splice(idx, 1);
    this.saveTasks();
    return removed[0];
  }

  toggleTaskComplete(id) {
    const task = this.getTask(id);
    if (!task) return null;

    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    return this.updateTask(id, {
      status: newStatus,
      completedAt: newStatus === 'completed' ? new Date().toISOString() : null
    });
  }

  togglePinTask(id) {
    const task = this.getTask(id);
    if (!task) return null;
    return this.updateTask(id, { isPinned: !task.isPinned });
  }

  toggleSubtask(taskId, subtaskId) {
    const task = this.getTask(taskId);
    if (!task) return null;

    const subtasks = task.subtasks.map(st => {
      if (st.id === subtaskId) {
        return { ...st, completed: !st.completed };
      }
      return st;
    });

    // If all subtasks completed, option to check if task can be updated
    const allDone = subtasks.length > 0 && subtasks.every(st => st.completed);

    return this.updateTask(taskId, { subtasks });
  }

  addSubtask(taskId, text) {
    const task = this.getTask(taskId);
    if (!task || !text.trim()) return null;

    const subtasks = [
      ...task.subtasks,
      {
        id: 'st_' + task.subtasks.length + '_' + Date.now().toString(36),
        text: text.trim(),
        completed: false
      }
    ];

    return this.updateTask(taskId, { subtasks });
  }

  deleteSubtask(taskId, subtaskId) {
    const task = this.getTask(taskId);
    if (!task) return null;

    const subtasks = task.subtasks.filter(st => st.id !== subtaskId);
    return this.updateTask(taskId, { subtasks });
  }

  incrementPomodoro(taskId) {
    const task = this.getTask(taskId);
    if (!task) return null;

    return this.updateTask(taskId, {
      pomodorosCompleted: (task.pomodorosCompleted || 0) + 1
    });
  }

  getTask(id) {
    return this.tasks.find(t => t.id === id) || null;
  }

  getAllTags() {
    const tagMap = {};
    this.tasks.forEach(t => {
      if (Array.isArray(t.tags)) {
        t.tags.forEach(rawTag => {
          const tag = rawTag ? rawTag.trim().toLowerCase() : '';
          if (tag) {
            tagMap[tag] = (tagMap[tag] || 0) + 1;
          }
        });
      }
    });

    return Object.keys(tagMap).sort().map(tag => ({
      name: tag,
      count: tagMap[tag]
    }));
  }

  getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getCurrentWeekSatToFriRange(baseDate = new Date()) {
    const d = new Date(baseDate);
    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    // Days since last Saturday:
    // Sat (6) -> 0
    // Sun (0) -> 1
    // Mon (1) -> 2
    // Tue (2) -> 3
    // Wed (3) -> 4
    // Thu (4) -> 5
    // Fri (5) -> 6
    const diffToSat = (dayOfWeek + 1) % 7;
    
    const satDate = new Date(d);
    satDate.setDate(d.getDate() - diffToSat);
    
    const friDate = new Date(satDate);
    friDate.setDate(satDate.getDate() + 6);
    
    const formatDate = (dateObj) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const days = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(satDate);
      cur.setDate(satDate.getDate() + i);
      days.push({
        dateStr: formatDate(cur),
        dayName: cur.toLocaleDateString('en-US', { weekday: 'long' }),
        shortDay: cur.toLocaleDateString('en-US', { weekday: 'short' }),
        formatted: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: formatDate(cur) === this.getTodayDateString()
      });
    }

    return {
      startDate: formatDate(satDate),
      endDate: formatDate(friDate),
      displayRange: `${satDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${friDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      days
    };
  }

  getFilteredTasks() {
    const today = this.getTodayDateString();
    let result = [...this.tasks];

    // Filter by Search Query
    if (this.settings.searchQuery.trim()) {
      const q = this.settings.searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q))) ||
        (t.subtasks && t.subtasks.some(st => st.text.toLowerCase().includes(q)))
      );
    }

    // Filter by Category
    if (this.settings.activeCategory !== 'all') {
      result = result.filter(t => t.category === this.settings.activeCategory);
    }

    // Filter by Priority
    if (this.settings.activePriority !== 'all') {
      result = result.filter(t => t.priority === this.settings.activePriority);
    }

    // Filter by Active Tag
    if (this.settings.activeTag && this.settings.activeTag !== 'all') {
      const tagLower = this.settings.activeTag.toLowerCase();
      result = result.filter(t => t.tags && t.tags.some(tag => tag.toLowerCase() === tagLower));
    }

    // Filter by Quick Filter Tab
    switch (this.settings.activeFilter) {
      case 'today':
        result = result.filter(t => t.dueDate === today);
        break;
      case 'week':
        const weekInfo = this.getCurrentWeekSatToFriRange();
        result = result.filter(t => t.dueDate && t.dueDate >= weekInfo.startDate && t.dueDate <= weekInfo.endDate);
        break;
      case 'upcoming':
        result = result.filter(t => t.dueDate > today && t.status !== 'completed');
        break;
      case 'overdue':
        result = result.filter(t => t.dueDate < today && t.status !== 'completed');
        break;
      case 'completed':
        result = result.filter(t => t.status === 'completed');
        break;
      case 'pending':
        result = result.filter(t => t.status !== 'completed');
        break;
      case 'starred':
        result = result.filter(t => t.isPinned);
        break;
      case 'all':
      default:
        break;
    }

    // Sorting
    const priorityWeights = { urgent: 4, high: 3, medium: 2, low: 1 };

    result.sort((a, b) => {
      // Pinned tasks first
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      switch (this.settings.sortBy) {
        case 'dueDate-asc':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate) || (a.dueTime || '').localeCompare(b.dueTime || '');
        case 'dueDate-desc':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return b.dueDate.localeCompare(a.dueDate);
        case 'priority-desc':
          return (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
        case 'priority-asc':
          return (priorityWeights[a.priority] || 0) - (priorityWeights[b.priority] || 0);
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'created-desc':
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    return result;
  }

  // Analytics & Stats
  getStats() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.status === 'completed').length;
    const pending = total - completed;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

    const today = this.getTodayDateString();
    const overdue = this.tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'completed').length;
    const dueToday = this.tasks.filter(t => t.dueDate === today && t.status !== 'completed').length;
    const completedToday = this.tasks.filter(t => {
      if (!t.completedAt) return false;
      return t.completedAt.startsWith(today);
    }).length;

    // Total Pomodoro focus time
    const totalPoms = this.tasks.reduce((sum, t) => sum + (t.pomodorosCompleted || 0), 0);
    const focusMinutes = totalPoms * 25;

    // Category breakdown
    const categoryStats = {};
    this.categories.forEach(c => {
      const catTasks = this.tasks.filter(t => t.category === c.id);
      categoryStats[c.id] = {
        name: c.name,
        color: c.color,
        icon: c.icon,
        total: catTasks.length,
        completed: catTasks.filter(t => t.status === 'completed').length
      };
    });

    // Priority breakdown
    const priorityStats = {
      urgent: this.tasks.filter(t => t.priority === 'urgent').length,
      high: this.tasks.filter(t => t.priority === 'high').length,
      medium: this.tasks.filter(t => t.priority === 'medium').length,
      low: this.tasks.filter(t => t.priority === 'low').length
    };

    // Past 7 days activity
    const past7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      
      const createdCount = this.tasks.filter(t => t.createdAt && t.createdAt.startsWith(dateStr)).length;
      const completedCount = this.tasks.filter(t => t.completedAt && t.completedAt.startsWith(dateStr)).length;

      past7Days.push({
        date: dateStr,
        day: dayName,
        created: createdCount,
        completed: completedCount
      });
    }

    return {
      total,
      completed,
      pending,
      completionRate,
      overdue,
      dueToday,
      completedToday,
      totalPoms,
      focusMinutes,
      categoryStats,
      priorityStats,
      past7Days,
      streak: this.getStreak()
    };
  }

  // Streak Tracking
  updateStreak() {
    const today = this.getTodayDateString();
    let streakData = { current: 0, lastDate: '', best: 0 };

    try {
      const saved = localStorage.getItem(this.STREAK_KEY);
      if (saved) streakData = JSON.parse(saved);
    } catch (e) {}

    const completedToday = this.tasks.some(t => t.completedAt && t.completedAt.startsWith(today));

    if (completedToday) {
      if (streakData.lastDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];

        if (streakData.lastDate === yStr) {
          streakData.current += 1;
        } else if (streakData.lastDate !== today) {
          streakData.current = 1;
        }

        streakData.lastDate = today;
        if (streakData.current > (streakData.best || 0)) {
          streakData.best = streakData.current;
        }

        localStorage.setItem(this.STREAK_KEY, JSON.stringify(streakData));
      }
    }
  }

  getStreak() {
    try {
      const saved = localStorage.getItem(this.STREAK_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { current: 1, best: 3, lastDate: this.getTodayDateString() };
  }

  // Export / Import
  exportJSON() {
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      tasks: this.tasks,
      categories: this.categories,
      settings: this.settings
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TaskFlow_Backup_${this.getTodayDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportCSV() {
    const headers = ['ID', 'Title', 'Description', 'Category', 'Priority', 'Status', 'Due Date', 'Due Time', 'Subtasks Total', 'Subtasks Completed', 'Estimated Poms', 'Completed Poms', 'Created At'];
    const rows = this.tasks.map(t => [
      `"${t.id}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${t.category}"`,
      `"${t.priority}"`,
      `"${t.status}"`,
      `"${t.dueDate || ''}"`,
      `"${t.dueTime || ''}"`,
      t.subtasks ? t.subtasks.length : 0,
      t.subtasks ? t.subtasks.filter(s => s.completed).length : 0,
      t.pomodorosEstimated || 1,
      t.pomodorosCompleted || 0,
      `"${t.createdAt || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TaskFlow_Tasks_${this.getTodayDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.tasks)) {
        this.tasks = parsed.tasks;
        if (Array.isArray(parsed.categories)) {
          this.categories = parsed.categories;
        }
        this.saveTasks();
        this.saveCategories();
        return true;
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
    return false;
  }

  loadSampleData() {
    const today = this.getTodayDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 3);
    const dayAfterStr = dayAfter.toISOString().split('T')[0];

    this.tasks = [
      {
        id: 'task_demo_1',
        title: '🚀 Launch Next-Gen Product Landing Page',
        description: 'Complete final responsiveness audit, review dark mode contrast, and connect analytics endpoints.',
        category: 'work',
        priority: 'urgent',
        status: 'in_progress',
        dueDate: today,
        dueTime: '17:00',
        subtasks: [
          { id: 'st_1', text: 'Audit mobile navigation drawer', completed: true },
          { id: 'st_2', text: 'Test Stripe checkout integration', completed: true },
          { id: 'st_3', text: 'Verify Web Vitals score (>95 on Lighthouse)', completed: false },
          { id: 'st_4', text: 'Deploy to Vercel production', completed: false }
        ],
        tags: ['Frontend', 'Vercel', 'Sprint-9'],
        pomodorosEstimated: 4,
        pomodorosCompleted: 2,
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        completedAt: null,
        isPinned: true
      },
      {
        id: 'task_demo_2',
        title: '🎨 Design UI Glassmorphism Component Library',
        description: 'Draft Figma tokens for backdrop-filters, subtle borders, glowing active states, and custom sliders.',
        category: 'creative',
        priority: 'high',
        status: 'todo',
        dueDate: tomorrowStr,
        dueTime: '14:30',
        subtasks: [
          { id: 'st_5', text: 'Create dynamic color palette variations', completed: true },
          { id: 'st_6', text: 'Build responsive modal dialog components', completed: false },
          { id: 'st_7', text: 'Publish interactive prototype link', completed: false }
        ],
        tags: ['Design', 'Figma', 'Glassmorphism'],
        pomodorosEstimated: 3,
        pomodorosCompleted: 1,
        createdAt: new Date().toISOString(),
        completedAt: null,
        isPinned: true
      },
      {
        id: 'task_demo_3',
        title: '⚡ Deep Work: Master Web Audio API & Canvas Physics',
        description: 'Study custom oscillator synthesis, frequency modulation, and particle gravity simulation.',
        category: 'study',
        priority: 'medium',
        status: 'review',
        dueDate: dayAfterStr,
        dueTime: '19:00',
        subtasks: [
          { id: 'st_8', text: 'Read MDN Web Audio API specs', completed: true },
          { id: 'st_9', text: 'Build interactive audio visualizer prototype', completed: true }
        ],
        tags: ['JavaScript', 'Canvas', 'WebAudio'],
        pomodorosEstimated: 2,
        pomodorosCompleted: 2,
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
        completedAt: null,
        isPinned: false
      },
      {
        id: 'task_demo_4',
        title: '🏃 5km High-Intensity Evening Run & Hydration',
        description: 'Target pace under 5:15/km, track cadence with smartwatch, and complete post-run recovery stretch.',
        category: 'fitness',
        priority: 'medium',
        status: 'completed',
        dueDate: today,
        dueTime: '18:30',
        subtasks: [
          { id: 'st_10', text: 'Dynamic warm-up stretches (5 min)', completed: true },
          { id: 'st_11', text: '5k trail run at zone 4 heart rate', completed: true },
          { id: 'st_12', text: 'Electrolyte drink & foam roller session', completed: true }
        ],
        tags: ['Health', 'Cardio', 'Streak'],
        pomodorosEstimated: 1,
        pomodorosCompleted: 1,
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        completedAt: new Date().toISOString(),
        isPinned: false
      },
      {
        id: 'task_demo_5',
        title: '🛒 Weekly Fresh Organic Grocery Restock',
        description: 'Pick up Greek yogurt, blueberries, avocados, dark roast coffee beans, and almond milk.',
        category: 'shopping',
        priority: 'low',
        status: 'todo',
        dueDate: tomorrowStr,
        dueTime: '11:00',
        subtasks: [
          { id: 'st_13', text: 'Check pantry essentials inventory', completed: true },
          { id: 'st_14', text: 'Visit Whole Foods farmer market', completed: false }
        ],
        tags: ['Lifestyle', 'Pantry'],
        pomodorosEstimated: 1,
        pomodorosCompleted: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
        isPinned: false
      },
      {
        id: 'task_demo_6',
        title: '📊 Review Q3 Financial Portfolio & Rebalance',
        description: 'Analyze dividend distributions, index fund allocations, and emergency fund yield.',
        category: 'personal',
        priority: 'high',
        status: 'todo',
        dueDate: yesterdayStr,
        dueTime: '16:00',
        subtasks: [
          { id: 'st_15', text: 'Download monthly brokerage statements', completed: true },
          { id: 'st_16', text: 'Rebalance equity ETF target weightings', completed: false }
        ],
        tags: ['Finance', 'Investments'],
        pomodorosEstimated: 2,
        pomodorosCompleted: 0,
        createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
        completedAt: null,
        isPinned: false
      }
    ];

    this.saveTasks();
  }

  clearAllTasks() {
    this.tasks = [];
    this.saveTasks();
  }
}

window.taskStore = new TaskStore();
