/**
 * TaskFlow Pro - Interactive Onboarding Setup Wizard
 * Guides new users through persona selection, aesthetic setup, and feature discovery
 */
class OnboardingWizard {
  constructor() {
    this.STORAGE_KEY = 'taskflow_onboarded_v2';
    this.currentStep = 1;
    this.totalSteps = 4;

    this.selectedPersona = 'dev';
    this.selectedTheme = 'dark';
    this.selectedView = 'list';

    this.PERSONA_PRESETS = {
      dev: {
        id: 'dev',
        title: '💻 Software Engineer',
        desc: 'Sprint backlogs, bug tracking, CI/CD deployments & code reviews',
        category: { id: 'dev_work', name: 'Software & Dev', color: '#6366f1' },
        tags: ['bug', 'frontend', 'backend', 'review', 'api'],
        tasks: [
          {
            title: '🚀 Review PR #142: Refactor authentication & state store',
            description: 'Verify edge cases for session storage and user account switching.',
            category: 'creative',
            priority: 'urgent',
            tags: ['review', 'frontend'],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            isPinned: true,
            subtasks: [
              { id: 'st1', title: 'Check localStorage key isolation', completed: true },
              { id: 'st2', title: 'Test user session restore on page load', completed: false }
            ]
          },
          {
            title: '⚡ Implement dark mode contrast optimizations',
            description: 'Audit subtle hairline borders and interactive hover states.',
            category: 'creative',
            priority: 'high',
            tags: ['frontend'],
            dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
            isPinned: false,
            subtasks: []
          },
          {
            title: '🧪 Run automated end-to-end user flow test suite',
            description: 'Ensure focus mode timer and keyboard shortcuts execute cleanly.',
            category: 'creative',
            priority: 'medium',
            tags: ['bug', 'api'],
            dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
            isPinned: false,
            subtasks: []
          }
        ]
      },
      design: {
        id: 'design',
        title: '🎨 Product & UI/UX Designer',
        desc: 'Figma component libraries, wireframing, user research & prototyping',
        category: { id: 'design_work', name: 'Design & UX', color: '#ec4899' },
        tags: ['figma', 'design-system', 'prototype', 'research'],
        tasks: [
          {
            title: '🎨 Finalize Design Tokens & Typography Scale in Figma',
            description: 'Audit primary color ramps, modal corner radiuses, and glassmorphism styling.',
            category: 'creative',
            priority: 'urgent',
            tags: ['figma', 'design-system'],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            isPinned: true,
            subtasks: [
              { id: 'st1', title: 'Sync variable tokens to Figma library', completed: true },
              { id: 'st2', title: 'Export SVG icon pack', completed: false }
            ]
          },
          {
            title: '✨ Create interactive prototype for mobile navigation menu',
            description: 'Test bottom sheet transitions and thumb-zone reachability.',
            category: 'creative',
            priority: 'high',
            tags: ['prototype'],
            dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
            isPinned: false,
            subtasks: []
          }
        ]
      },
      study: {
        id: 'study',
        title: '🎓 Student & Academic',
        desc: 'Lecture notes, assignments, research papers & exam preparation',
        category: { id: 'study_work', name: 'Study & Learning', color: '#06b6d4' },
        tags: ['exam', 'reading', 'assignment', 'notes'],
        tasks: [
          {
            title: '📚 Complete Chapter 4 & 5 deep reading and flashcard deck',
            description: 'Summarize key theorems and practice 5 algorithmic problems.',
            category: 'study',
            priority: 'urgent',
            tags: ['reading', 'notes'],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            isPinned: true,
            subtasks: [
              { id: 'st1', title: 'Review lecture slides and diagrams', completed: true },
              { id: 'st2', title: 'Draft summary notes in Notion', completed: false }
            ]
          },
          {
            title: '🎯 50-minute Pomodoro deep study sprint',
            description: 'Use Single-Task Focus Mode to work without social media distractions.',
            category: 'study',
            priority: 'high',
            tags: ['exam'],
            dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
            isPinned: false,
            subtasks: []
          }
        ]
      },
      general: {
        id: 'general',
        title: '🚀 Solopreneur & Flow Master',
        desc: 'Daily priorities, habit building, deep work blocks & goal tracking',
        category: { id: 'general_work', name: 'Personal & Growth', color: '#10b981' },
        tags: ['habits', 'finance', 'health', 'goals'],
        tasks: [
          {
            title: '⚡ Plan weekly high-impact goals (Saturday to Friday)',
            description: 'Identify top 3 non-negotiable milestones for the week.',
            category: 'personal',
            priority: 'urgent',
            tags: ['goals'],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            isPinned: true,
            subtasks: [
              { id: 'st1', title: 'Review last week streak and accomplishments', completed: true },
              { id: 'st2', title: 'Block focus sprint times on calendar', completed: false }
            ]
          },
          {
            title: '🧘 Complete 30-minute afternoon workout & hydration check',
            description: 'Cardio interval sprint and stretch session.',
            category: 'health',
            priority: 'medium',
            tags: ['health', 'habits'],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            isPinned: false,
            subtasks: []
          }
        ]
      }
    };
  }

  init() {
    // Check if first-time user
    const hasSeen = localStorage.getItem(this.STORAGE_KEY);
    if (!hasSeen) {
      setTimeout(() => {
        this.open();
      }, 700);
    }
  }

  open() {
    const modal = document.getElementById('onboarding-modal');
    if (!modal) return;

    this.currentStep = 1;
    this.renderStep();
    modal.classList.add('active');
    if (window.soundEngine) window.soundEngine.playPop();
  }

  close() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.classList.remove('active');
    localStorage.setItem(this.STORAGE_KEY, 'true');
  }

  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.renderStep();
      if (window.soundEngine) window.soundEngine.playClick();
    } else {
      this.completeOnboarding();
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.renderStep();
      if (window.soundEngine) window.soundEngine.playClick();
    }
  }

  selectPersona(personaId) {
    this.selectedPersona = personaId;
    this.renderStep();
  }

  selectTheme(themeId) {
    this.selectedTheme = themeId;
    if (window.app) window.app.applyTheme(themeId);
    this.renderStep();
  }

  selectView(viewId) {
    this.selectedView = viewId;
    this.renderStep();
  }

  renderStep() {
    // 1. Update step indicators
    for (let i = 1; i <= this.totalSteps; i++) {
      const dot = document.getElementById(`onboard-step-dot-${i}`);
      const panel = document.getElementById(`onboard-step-panel-${i}`);
      if (dot) {
        dot.classList.toggle('active', i === this.currentStep);
        dot.classList.toggle('completed', i < this.currentStep);
      }
      if (panel) {
        panel.classList.toggle('active', i === this.currentStep);
      }
    }

    // 2. Update Back / Next button text
    const prevBtn = document.getElementById('onboard-prev-btn');
    const nextBtn = document.getElementById('onboard-next-btn');

    if (prevBtn) {
      prevBtn.style.visibility = this.currentStep === 1 ? 'hidden' : 'visible';
    }

    if (nextBtn) {
      if (this.currentStep === this.totalSteps) {
        nextBtn.innerHTML = '<span>🚀 Launch My Workspace</span>';
        nextBtn.className = 'btn btn-primary btn-onboard-finish';
      } else {
        nextBtn.innerHTML = '<span>Continue →</span>';
        nextBtn.className = 'btn btn-primary';
      }
    }

    // 3. Highlight selected options
    document.querySelectorAll('.persona-option-card').forEach(card => {
      const id = card.dataset.persona;
      card.classList.toggle('active', id === this.selectedPersona);
    });

    document.querySelectorAll('.theme-option-card').forEach(card => {
      const id = card.dataset.theme;
      card.classList.toggle('active', id === this.selectedTheme);
    });

    document.querySelectorAll('.view-option-card').forEach(card => {
      const id = card.dataset.view;
      card.classList.toggle('active', id === this.selectedView);
    });
  }

  completeOnboarding() {
    // 1. Apply selected preferences
    if (window.taskStore) {
      window.taskStore.settings.theme = this.selectedTheme;
      window.taskStore.settings.activeView = this.selectedView === 'week' ? 'list' : this.selectedView;
      if (this.selectedView === 'week') {
        window.taskStore.settings.activeFilter = 'week';
      }
      window.taskStore.saveSettings();

      // Seed curated tasks for chosen persona if user is in guest or fresh account
      const preset = this.PERSONA_PRESETS[this.selectedPersona];
      if (preset && window.taskStore.tasks.length <= 6) {
        const timestamp = Date.now();
        const formattedTasks = preset.tasks.map((t, idx) => ({
          ...t,
          id: `task_onboard_${timestamp}_${idx}`,
          createdAt: new Date().toISOString(),
          completed: false
        }));

        // Merge or replace initial tasks
        window.taskStore.tasks = [...formattedTasks, ...window.taskStore.tasks];
        window.taskStore.saveTasks();
      }
    }

    // 2. Refresh UI
    if (window.app) {
      window.app.applyTheme(this.selectedTheme);
      if (this.selectedView === 'week') {
        window.app.selectFilter('week');
      } else {
        window.app.switchView(this.selectedView);
      }
      window.app.render();
    }

    // 3. Celebration effects
    if (window.confettiCanon) window.confettiCanon.triggerBurst();
    if (window.soundEngine) window.soundEngine.playSuccess();

    this.close();
    if (window.app) {
      window.app.showToast('✨ Welcome aboard! Your workspace is ready.', 'success');
    }
  }
}

// Global Singleton
window.onboarding = new OnboardingWizard();
