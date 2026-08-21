/**
 * Pomodoro Focus Timer & Immersive Single-Task Focus Sanctuary
 */
class PomodoroTimer {
  constructor() {
    this.MODES = {
      work: { name: 'Focus Time', duration: 25 * 60, color: '#6366f1' },
      shortBreak: { name: 'Short Break', duration: 5 * 60, color: '#10b981' },
      longBreak: { name: 'Long Break', duration: 15 * 60, color: '#06b6d4' }
    };

    this.currentMode = 'work';
    this.timeLeft = this.MODES.work.duration;
    this.totalDuration = this.MODES.work.duration;
    this.isRunning = false;
    this.interval = null;
    this.activeTaskId = null;
    this.completedSessions = 0;
    this.ambientSound = 'none'; // 'none', 'rain', 'white'

    this.isZenMode = false;
    this.focusCustomDuration = 25 * 60;

    this.dom = {};
  }

  init() {
    this.cacheDom();
    this.bindEvents();
    this.updateDisplay();
  }

  cacheDom() {
    this.dom.drawer = document.getElementById('pomodoro-drawer');
    this.dom.toggleBtn = document.getElementById('toggle-pomodoro-btn');
    this.dom.closeBtn = document.getElementById('close-pomodoro-btn');
    this.dom.modeBtns = document.querySelectorAll('.pomo-mode-btn');
    this.dom.timeDisplay = document.getElementById('pomo-time-display');
    this.dom.modeLabel = document.getElementById('pomo-mode-label');
    this.dom.progressCircle = document.getElementById('pomo-progress-circle');
    this.dom.startPauseBtn = document.getElementById('pomo-start-pause-btn');
    this.dom.resetBtn = document.getElementById('pomo-reset-btn');
    this.dom.taskSelect = document.getElementById('pomo-task-select');
    this.dom.ambientSelect = document.getElementById('pomo-ambient-select');
    this.dom.sessionDots = document.getElementById('pomo-session-dots');
    this.dom.floatingBadge = document.getElementById('pomo-floating-badge');

    // Focus Mode DOM elements
    this.dom.focusSelectModal = document.getElementById('focus-select-modal');
    this.dom.fullscreenFocus = document.getElementById('fullscreen-focus-mode');
    this.dom.focusTasksPicker = document.getElementById('focus-tasks-picker');
    this.dom.focusFullscreenDigits = document.getElementById('focus-fullscreen-digits');
    this.dom.focusFullscreenRing = document.getElementById('focus-fullscreen-ring');
    this.dom.focusFullscreenStage = document.getElementById('focus-fullscreen-stage');
    this.dom.focusFullscreenPlayBtn = document.getElementById('focus-fullscreen-play-btn');
    this.dom.focusPlayBtnText = document.getElementById('focus-play-btn-text');
    this.dom.focusFullscreenDots = document.getElementById('focus-fullscreen-dots');
    this.dom.focusActiveTaskCard = document.getElementById('focus-active-task-card');
  }

  bindEvents() {
    if (this.dom.toggleBtn) {
      this.dom.toggleBtn.addEventListener('click', () => this.toggleDrawer());
    }
    if (this.dom.closeBtn) {
      this.dom.closeBtn.addEventListener('click', () => this.closeDrawer());
    }

    if (this.dom.modeBtns) {
      this.dom.modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const mode = e.currentTarget.dataset.mode;
          this.setMode(mode);
        });
      });
    }

    if (this.dom.startPauseBtn) {
      this.dom.startPauseBtn.addEventListener('click', () => this.toggleStartPause());
    }

    if (this.dom.resetBtn) {
      this.dom.resetBtn.addEventListener('click', () => this.reset());
    }

    if (this.dom.taskSelect) {
      this.dom.taskSelect.addEventListener('change', (e) => {
        this.activeTaskId = e.target.value || null;
      });
    }

    if (this.dom.ambientSelect) {
      this.dom.ambientSelect.addEventListener('change', (e) => {
        this.setAmbientSound(e.target.value);
      });
    }

    // Spacebar to pause/resume in fullscreen focus mode
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.isFocusModeActive()) {
        if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
          e.preventDefault();
          this.toggleStartPause();
        }
      } else if (e.key === 'Escape' && this.isFocusModeActive()) {
        this.exitFocusMode();
      } else if ((e.key === 'f' || e.key === 'F') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (!this.isFocusModeActive()) {
          e.preventDefault();
          this.promptFocusMode();
        }
      }
    });
  }

  isFocusModeActive() {
    return this.dom.fullscreenFocus && this.dom.fullscreenFocus.classList.contains('active');
  }

  toggleDrawer() {
    if (!this.dom.drawer) return;
    const isOpen = this.dom.drawer.classList.toggle('open');
    if (isOpen) {
      this.populateTaskSelect();
    }
  }

  openDrawer() {
    if (!this.dom.drawer) return;
    this.dom.drawer.classList.add('open');
    this.populateTaskSelect();
  }

  closeDrawer() {
    if (!this.dom.drawer) return;
    this.dom.drawer.classList.remove('open');
  }

  populateTaskSelect() {
    if (!this.dom.taskSelect || !window.taskStore) return;
    const pendingTasks = window.taskStore.tasks.filter(t => t.status !== 'completed');
    
    let html = '<option value="">-- No specific task --</option>';
    pendingTasks.forEach(t => {
      const selected = t.id === this.activeTaskId ? 'selected' : '';
      html += `<option value="${t.id}" ${selected}>${this.escapeHtml(t.title)}</option>`;
    });
    this.dom.taskSelect.innerHTML = html;
  }

  setMode(mode) {
    if (!this.MODES[mode]) return;
    this.pause();
    this.currentMode = mode;
    this.totalDuration = this.MODES[mode].duration;
    this.timeLeft = this.totalDuration;

    if (this.dom.modeBtns) {
      this.dom.modeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
    }

    if (this.dom.modeLabel) {
      this.dom.modeLabel.textContent = this.MODES[mode].name;
    }

    if (this.dom.focusFullscreenStage) {
      this.dom.focusFullscreenStage.textContent = this.MODES[mode].name;
    }

    this.updateDisplay();
  }

  toggleStartPause() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    if (window.soundEngine) {
      window.soundEngine.init();
      window.soundEngine.playClick();
      if (this.ambientSound !== 'none') {
        window.soundEngine.startAmbientNoise(this.ambientSound);
      }
    }

    this.updateButtonStates(true);

    this.interval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.interval);

    if (window.soundEngine) {
      window.soundEngine.stopAmbientNoise();
    }

    this.updateButtonStates(false);
  }

  updateButtonStates(running) {
    if (this.dom.startPauseBtn) {
      this.dom.startPauseBtn.innerHTML = running ? `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        <span>Pause</span>
      ` : `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span>Start</span>
      `;
      this.dom.startPauseBtn.classList.toggle('running', running);
    }

    if (this.dom.focusFullscreenPlayBtn) {
      this.dom.focusFullscreenPlayBtn.innerHTML = running ? `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        <span>Pause Focus</span>
      ` : `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span>Start Focus</span>
      `;
    }
  }

  reset() {
    this.pause();
    this.timeLeft = this.totalDuration;
    this.updateDisplay();
  }

  adjustTimer(seconds) {
    this.timeLeft = Math.max(60, this.timeLeft + seconds);
    this.totalDuration = Math.max(this.totalDuration, this.timeLeft);
    this.updateDisplay();
    if (window.soundEngine) window.soundEngine.playPop();
  }

  tick() {
    this.timeLeft--;
    this.updateDisplay();

    if (this.timeLeft <= 0) {
      this.onComplete();
    }
  }

  onComplete() {
    this.pause();
    
    if (window.soundEngine) {
      window.soundEngine.playTimerAlarm();
    }

    if (window.confetti && this.currentMode === 'work') {
      window.confetti.burst(window.innerWidth / 2, window.innerHeight / 2, 80);
    }

    if (this.currentMode === 'work') {
      this.completedSessions++;
      if (this.activeTaskId && window.taskStore) {
        window.taskStore.incrementPomodoro(this.activeTaskId);
        if (window.app) window.app.render();
      }

      if (window.app) {
        window.app.showToast('🔥 Focus session finished! Great job! Time for a break.', 'success');
      }

      // Auto switch to short break or long break (every 4 sessions)
      if (this.completedSessions % 4 === 0) {
        this.setMode('longBreak');
      } else {
        this.setMode('shortBreak');
      }
    } else {
      if (window.app) {
        window.app.showToast('✨ Break is over! Ready to dive back in?', 'info');
      }
      this.setMode('work');
    }

    this.renderSessionDots();
  }

  setAmbientSound(type) {
    this.ambientSound = type;
    if (window.soundEngine) {
      if (this.isRunning && type !== 'none') {
        window.soundEngine.startAmbientNoise(type);
      } else {
        window.soundEngine.stopAmbientNoise();
      }
    }
  }

  updateDisplay() {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (this.dom.timeDisplay) {
      this.dom.timeDisplay.textContent = timeStr;
    }
    if (this.dom.focusFullscreenDigits) {
      this.dom.focusFullscreenDigits.textContent = timeStr;
    }

    // Update document title
    if (this.isRunning) {
      document.title = `(${timeStr}) ${this.MODES[this.currentMode].name} - TaskFlow`;
    } else {
      document.title = 'TaskFlow Pro - Modern Task Studio';
    }

    // Update SVG Progress Ring
    if (this.dom.progressCircle) {
      const radius = 90;
      const circumference = 2 * Math.PI * radius;
      const fraction = (this.totalDuration - this.timeLeft) / this.totalDuration;
      const offset = circumference - (fraction * circumference);
      this.dom.progressCircle.style.strokeDashoffset = offset;
      this.dom.progressCircle.style.stroke = this.MODES[this.currentMode].color;
    }

    if (this.dom.focusFullscreenRing) {
      const radius = 125;
      const circumference = 2 * Math.PI * radius;
      const fraction = (this.totalDuration - this.timeLeft) / this.totalDuration;
      const offset = circumference - (fraction * circumference);
      this.dom.focusFullscreenRing.style.strokeDashoffset = offset;
      this.dom.focusFullscreenRing.style.stroke = this.MODES[this.currentMode].color;
    }

    // Update Floating Quick Badge
    if (this.dom.floatingBadge) {
      if (this.isRunning && !this.isFocusModeActive()) {
        this.dom.floatingBadge.classList.remove('hidden');
        this.dom.floatingBadge.querySelector('.badge-time').textContent = timeStr;
      } else {
        this.dom.floatingBadge.classList.add('hidden');
      }
    }
  }

  renderSessionDots() {
    const renderDots = (el) => {
      if (!el) return;
      let html = '';
      for (let i = 0; i < 4; i++) {
        const active = i < (this.completedSessions % 4) ? 'completed' : '';
        html += `<span class="session-dot ${active}"></span>`;
      }
      el.innerHTML = html;
    };

    renderDots(this.dom.sessionDots);
    renderDots(this.dom.focusFullscreenDots);
  }

  // =========================================================================
  // SINGLE-TASK FOCUS SANCTUARY (INTERACTIVE MODAL & FULLSCREEN)
  // =========================================================================
  promptFocusMode() {
    this.renderFocusTaskPicker();
    if (this.dom.focusSelectModal) {
      this.dom.focusSelectModal.classList.add('active');
    }
  }

  closeFocusSelectModal() {
    if (this.dom.focusSelectModal) {
      this.dom.focusSelectModal.classList.remove('active');
    }
  }

  renderFocusTaskPicker() {
    const container = document.getElementById('focus-tasks-picker');
    if (!container || !window.taskStore) return;

    const pendingTasks = window.taskStore.tasks.filter(t => t.status !== 'completed');

    if (pendingTasks.length === 0) {
      container.innerHTML = `
        <div class="focus-picker-empty">
          <span>🎉 All tasks are completed!</span>
          <p>Create a task or a quick goal to start a focus session.</p>
        </div>
      `;
      return;
    }

    // Default select activeTaskId or first task
    if (!this.activeTaskId || !pendingTasks.some(t => t.id === this.activeTaskId)) {
      this.activeTaskId = pendingTasks[0].id;
    }

    container.innerHTML = pendingTasks.map(t => {
      const isSelected = t.id === this.activeTaskId;
      const cat = window.taskStore.categories.find(c => c.id === t.category) || { name: 'General', color: '#6366f1' };
      const subtasksCount = t.subtasks ? t.subtasks.length : 0;
      const subtasksDone = t.subtasks ? t.subtasks.filter(s => s.completed).length : 0;

      return `
        <div class="focus-task-option ${isSelected ? 'selected' : ''}" onclick="window.pomodoro.selectFocusTask('${t.id}')">
          <div class="focus-option-radio ${isSelected ? 'checked' : ''}">
            ${isSelected ? '✓' : ''}
          </div>
          <div class="focus-option-info">
            <span class="focus-option-title">${this.escapeHtml(t.title)}</span>
            <div class="focus-option-meta">
              <span class="badge priority-${t.priority}">${t.priority.toUpperCase()}</span>
              <span class="category-pill" style="font-size:0.7rem;"><span class="cat-dot" style="background:${cat.color}"></span> ${this.escapeHtml(cat.name)}</span>
              ${subtasksCount > 0 ? `<span class="date-badge">✓ ${subtasksDone}/${subtasksCount}</span>` : ''}
              ${t.dueDate ? `<span class="date-badge">📅 ${t.dueDate}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  selectFocusTask(taskId) {
    this.activeTaskId = taskId;
    this.renderFocusTaskPicker();
    if (window.soundEngine) window.soundEngine.playPop();
  }

  setFocusPreset(mins, btn) {
    this.focusCustomDuration = mins * 60;
    const customInput = document.getElementById('focus-custom-minutes');
    if (customInput) customInput.value = mins;

    document.querySelectorAll('.duration-pill').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  syncCustomMinutes(val) {
    const mins = Math.max(1, Math.min(180, parseInt(val, 10) || 25));
    this.focusCustomDuration = mins * 60;
    document.querySelectorAll('.duration-pill').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.mins, 10) === mins);
    });
  }

  launchFocusMode() {
    this.closeFocusSelectModal();

    // Set custom Pomodoro duration
    this.MODES.work.duration = this.focusCustomDuration;
    this.setMode('work');

    // Ambient sound from select
    const ambientSelect = document.getElementById('focus-ambient-select');
    if (ambientSelect) {
      this.setAmbientSound(ambientSelect.value);
    }

    // Populate the Chosen Focus Task in the Fullscreen Sanctuary
    this.renderFullscreenTaskCard();

    // Show Fullscreen Focus Mode
    if (this.dom.fullscreenFocus) {
      this.dom.fullscreenFocus.classList.add('active');
    }

    this.renderSessionDots();
    this.start();

    if (window.soundEngine) window.soundEngine.playClick();
    if (window.app) window.app.showToast('🎯 Focus Sanctuary active! Undivided flow.', 'success');
  }

  renderFullscreenTaskCard() {
    const task = window.taskStore.getTask(this.activeTaskId);
    const titleEl = document.getElementById('focus-task-title');
    const descEl = document.getElementById('focus-task-desc');
    const prioEl = document.getElementById('focus-task-prio');
    const catEl = document.getElementById('focus-task-cat');
    const subtasksBox = document.getElementById('focus-subtasks-box');

    if (!task) {
      if (titleEl) titleEl.textContent = '🎯 Deep Flow State Session';
      if (descEl) descEl.textContent = 'Dedicate this time to deep, undisturbed focus.';
      if (subtasksBox) subtasksBox.innerHTML = '';
      return;
    }

    const cat = window.taskStore.categories.find(c => c.id === task.category) || { name: 'General', color: '#6366f1' };

    if (titleEl) titleEl.textContent = task.title;
    if (descEl) {
      descEl.textContent = task.description || 'Focus on completing this single objective with zero distractions.';
    }
    if (prioEl) {
      prioEl.className = `badge priority-${task.priority}`;
      prioEl.textContent = task.priority.toUpperCase();
    }
    if (catEl) {
      catEl.innerHTML = `<span class="cat-dot" style="background:${cat.color}"></span> ${this.escapeHtml(cat.name)}`;
    }

    if (subtasksBox) {
      if (task.subtasks && task.subtasks.length > 0) {
        subtasksBox.innerHTML = `
          <div class="focus-subtasks-title">Checklist</div>
          ${task.subtasks.map(st => `
            <div class="focus-subtask-item ${st.completed ? 'completed' : ''}" onclick="window.pomodoro.toggleFocusSubtask('${task.id}', '${st.id}')">
              <span class="subtask-checkbox ${st.completed ? 'checked' : ''}">
                ${st.completed ? '✓' : ''}
              </span>
              <span>${this.escapeHtml(st.text)}</span>
            </div>
          `).join('')}
        `;
      } else {
        subtasksBox.innerHTML = '';
      }
    }
  }

  toggleFocusSubtask(taskId, subtaskId) {
    window.taskStore.toggleSubtask(taskId, subtaskId);
    this.renderFullscreenTaskCard();
    if (window.soundEngine) window.soundEngine.playPop();
    if (window.app) window.app.render();
  }

  completeActiveFocusTask() {
    if (!this.activeTaskId) return;

    window.taskStore.updateTask(this.activeTaskId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    if (window.soundEngine) window.soundEngine.playComplete();
    if (window.confetti) window.confetti.burst(window.innerWidth / 2, window.innerHeight / 2, 90);
    if (window.app) {
      window.app.showToast('🎉 Focus objective completed! Brilliant work!', 'success');
      window.app.render();
    }

    this.renderFullscreenTaskCard();
  }

  toggleZenMode() {
    this.isZenMode = !this.isZenMode;
    if (this.dom.fullscreenFocus) {
      this.dom.fullscreenFocus.classList.toggle('zen-mode', this.isZenMode);
    }

    const icon = document.getElementById('zen-icon');
    const text = document.getElementById('zen-text');
    if (icon && text) {
      icon.textContent = this.isZenMode ? '🔍' : '👁️';
      text.textContent = this.isZenMode ? 'Full View' : 'Zen View';
    }
  }

  exitFocusMode() {
    if (this.dom.fullscreenFocus) {
      this.dom.fullscreenFocus.classList.remove('active');
    }
    this.pause();
    this.updateDisplay();
    if (window.app) window.app.render();
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}

window.pomodoro = new PomodoroTimer();
