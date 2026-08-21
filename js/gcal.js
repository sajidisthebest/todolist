/**
 * Google Calendar Integration Module for TaskFlow Pro
 */
class GoogleCalendarSync {
  constructor() {
    this.STORAGE_KEY = 'taskflow_gcal_settings';
    this.settings = {
      autoSync: false,
      clientId: '',
      apiKey: '',
      calendarId: 'primary',
      lastSync: null
    };

    this.tokenClient = null;
    this.accessToken = null;
    this.isAuthorized = false;

    this.loadSettings();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load Google Calendar settings:', e);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save Google Calendar settings:', e);
    }
  }

  // =========================================================================
  // 1. INSTANT 1-CLICK WEB URL SYNC (Zero API Keys Needed)
  // =========================================================================
  generateGoogleCalendarUrl(task) {
    if (!task) return '';

    const title = encodeURIComponent(task.title || 'New Task');
    let detailsText = task.description || '';
    if (task.subtasks && task.subtasks.length > 0) {
      detailsText += '\n\nChecklist:\n' + task.subtasks.map(s => `[${s.completed ? 'x' : ' '}] ${s.text}`).join('\n');
    }
    if (task.priority) {
      detailsText += `\n\nPriority: ${task.priority.toUpperCase()}`;
    }
    const details = encodeURIComponent(detailsText);

    // Format Dates for Google Calendar URL
    // Format: YYYYMMDDTHHMMSSZ or YYYYMMDD for all-day
    const dueDate = task.dueDate || window.taskStore.getTodayDateString();
    const dateClean = dueDate.replace(/-/g, '');

    let datesParam = '';
    if (task.dueTime) {
      const timeClean = task.dueTime.replace(/:/g, '') + '00';
      const startDateTime = `${dateClean}T${timeClean}`;
      
      // Default duration: 1 hour (or based on estimated pomodoros: 25 min * poms)
      const poms = task.pomodorosEstimated || 1;
      const durationMins = poms * 25;
      
      const [year, month, day] = dueDate.split('-').map(Number);
      const [hours, mins] = task.dueTime.split(':').map(Number);
      const endDateObj = new Date(year, month - 1, day, hours, mins + durationMins);
      
      const endYear = endDateObj.getFullYear();
      const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
      const endDay = String(endDateObj.getDate()).padStart(2, '0');
      const endHour = String(endDateObj.getHours()).padStart(2, '0');
      const endMin = String(endDateObj.getMinutes()).padStart(2, '0');
      const endDateTime = `${endYear}${endMonth}${endDay}T${endHour}${endMin}00`;

      datesParam = `${startDateTime}/${endDateTime}`;
    } else {
      // All day event
      const [year, month, day] = dueDate.split('-').map(Number);
      const nextDay = new Date(year, month - 1, day + 1);
      const nextDayStr = `${nextDay.getFullYear()}${String(nextDay.getMonth() + 1).padStart(2, '0')}${String(nextDay.getDate()).padStart(2, '0')}`;
      datesParam = `${dateClean}/${nextDayStr}`;
    }

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${datesParam}`;
  }

  openGoogleCalendarForTask(taskId) {
    const task = window.taskStore.getTask(taskId);
    if (!task) return;

    const url = this.generateGoogleCalendarUrl(task);
    window.open(url, '_blank', 'noopener,noreferrer');

    if (window.soundEngine) window.soundEngine.playPop();
    if (window.app) window.app.showToast('Opening in Google Calendar...', 'info');
  }

  // =========================================================================
  // 2. EXPORT AS STANDARD .ICS (Google, Apple, Outlook compatible)
  // =========================================================================
  exportICS() {
    const tasks = window.taskStore.tasks.filter(t => t.dueDate && t.status !== 'completed');
    if (tasks.length === 0) {
      if (window.app) window.app.showToast('No upcoming scheduled tasks to export', 'warning');
      return;
    }

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TaskFlow Pro//Task Management Suite//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    tasks.forEach(t => {
      const dateClean = t.dueDate.replace(/-/g, '');
      const uid = `${t.id}@taskflow.app`;
      const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      
      let dtstart = '';
      let dtend = '';

      if (t.dueTime) {
        const timeClean = t.dueTime.replace(/:/g, '') + '00';
        dtstart = `DTSTART:${dateClean}T${timeClean}`;
        
        const [year, month, day] = t.dueDate.split('-').map(Number);
        const [hours, mins] = t.dueTime.split(':').map(Number);
        const poms = t.pomodorosEstimated || 1;
        const endDateObj = new Date(year, month - 1, day, hours, mins + (poms * 25));
        
        const endYear = endDateObj.getFullYear();
        const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
        const endDay = String(endDateObj.getDate()).padStart(2, '0');
        const endHour = String(endDateObj.getHours()).padStart(2, '0');
        const endMin = String(endDateObj.getMinutes()).padStart(2, '0');
        dtend = `DTEND:${endYear}${endMonth}${endDay}T${endHour}${endMin}00`;
      } else {
        dtstart = `DTSTART;VALUE=DATE:${dateClean}`;
        const [year, month, day] = t.dueDate.split('-').map(Number);
        const nextDay = new Date(year, month - 1, day + 1);
        const nextDayStr = `${nextDay.getFullYear()}${String(nextDay.getMonth() + 1).padStart(2, '0')}${String(nextDay.getDate()).padStart(2, '0')}`;
        dtend = `DTEND;VALUE=DATE:${nextDayStr}`;
      }

      const summary = (t.title || 'Task').replace(/[,;\\]/g, '\\$&');
      let desc = (t.description || '').replace(/[,;\\]/g, '\\$&');
      if (t.subtasks && t.subtasks.length) {
        desc += '\\nChecklist:\\n' + t.subtasks.map(s => `[${s.completed ? 'X' : ' '}] ${s.text}`).join('\\n');
      }

      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        dtstart,
        dtend,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${desc}`,
        `PRIORITY:${t.priority === 'urgent' ? 1 : t.priority === 'high' ? 3 : 5}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TaskFlow_Schedule_${window.taskStore.getTodayDateString()}.ics`;
    a.click();
    URL.revokeObjectURL(url);

    if (window.app) window.app.showToast('📅 iCal file downloaded! Ready to import into Google Calendar.', 'success');
  }

  // =========================================================================
  // 3. GOOGLE CALENDAR MODAL UI CONTROLS
  // =========================================================================
  openModal() {
    this.renderUpcomingTasksList();
    const modal = document.getElementById('gcal-modal');
    if (modal) {
      modal.classList.add('active');
    }
  }

  closeModal() {
    const modal = document.getElementById('gcal-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.gcal-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });
    document.querySelectorAll('.gcal-tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === `gcal-tab-${tabName}`);
    });
  }

  renderUpcomingTasksList() {
    const container = document.getElementById('gcal-upcoming-tasks');
    if (!container || !window.taskStore) return;

    const scheduled = window.taskStore.tasks.filter(t => t.dueDate && t.status !== 'completed');

    if (scheduled.length === 0) {
      container.innerHTML = `
        <div class="gcal-empty-state">
          <span>📅 No scheduled tasks found</span>
          <p>Assign due dates to tasks to sync them with Google Calendar.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = scheduled.map(t => `
      <div class="gcal-task-item">
        <div class="gcal-task-meta">
          <span class="gcal-task-title">${this.escapeHtml(t.title)}</span>
          <div class="gcal-task-tags">
            <span class="badge priority-${t.priority}">${t.priority.toUpperCase()}</span>
            <span class="date-badge">📅 ${t.dueDate} ${t.dueTime ? '🕒 ' + t.dueTime : ''}</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm btn-gcal-sync" onclick="window.gcal.openGoogleCalendarForTask('${t.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          <span>Add to Google Calendar</span>
        </button>
      </div>
    `).join('');
  }

  saveApiCredentials(e) {
    e.preventDefault();
    const clientId = document.getElementById('gcal-client-id').value.trim();
    const apiKey = document.getElementById('gcal-api-key').value.trim();
    const autoSync = document.getElementById('gcal-autosync-toggle').checked;

    this.settings.clientId = clientId;
    this.settings.apiKey = apiKey;
    this.settings.autoSync = autoSync;
    this.saveSettings();

    if (window.app) window.app.showToast('Google Calendar settings saved!', 'success');
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}

window.gcal = new GoogleCalendarSync();
