/**
 * TaskFlow Pro - Authentication & Master Admin Management System
 * Supports user accounts, role-based superadmin authority, data isolation, and admin control
 */
class AuthManager {
  constructor() {
    this.USERS_KEY = 'taskflow_users_v1';
    this.SESSION_KEY = 'taskflow_session_v1';

    this.users = [];
    this.currentUser = null;

    this.AVATAR_COLORS = [
      '#6366f1', // Indigo
      '#ec4899', // Pink
      '#8b5cf6', // Purple
      '#06b6d4', // Cyan
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#f43f5e', // Rose
      '#3b82f6'  // Blue
    ];

    this.MASTER_ADMIN = {
      id: 'user_sajid_admin',
      username: 'sajid',
      name: 'Sajid',
      email: 'sajid@taskflow.local',
      role: 'Super Admin',
      isAdmin: true,
      avatarColor: '#f59e0b',
      password: 'Sajid',
      createdAt: new Date(Date.now() - 3600000 * 24 * 90).toISOString()
    };

    this.DEMO_ACCOUNTS = [
      this.MASTER_ADMIN,
      {
        id: 'user_alex_dev',
        username: 'alex',
        name: 'Alex Chen',
        email: 'alex.chen@example.com',
        role: 'Tech Lead',
        isAdmin: false,
        avatarColor: '#6366f1',
        password: 'password123',
        createdAt: new Date(Date.now() - 3600000 * 24 * 30).toISOString()
      },
      {
        id: 'user_sarah_design',
        username: 'sarah',
        name: 'Sarah Miller',
        email: 'sarah.m@example.com',
        role: 'Product Designer',
        isAdmin: false,
        avatarColor: '#ec4899',
        password: 'password123',
        createdAt: new Date(Date.now() - 3600000 * 24 * 14).toISOString()
      }
    ];

    this.init();
  }

  init() {
    this.loadUsers();
    this.loadSession();
  }

  loadUsers() {
    try {
      const saved = localStorage.getItem(this.USERS_KEY);
      if (saved) {
        this.users = JSON.parse(saved);
        // Ensure Master Admin is always available in user registry
        if (!this.users.some(u => u.id === 'user_sajid_admin' || u.name.toLowerCase() === 'sajid')) {
          this.users.unshift(this.MASTER_ADMIN);
          this.saveUsers();
        }
      } else {
        this.users = [...this.DEMO_ACCOUNTS];
        this.saveUsers();
      }
    } catch (e) {
      console.warn('Failed to load users from localStorage:', e);
      this.users = [...this.DEMO_ACCOUNTS];
    }
  }

  saveUsers() {
    try {
      localStorage.setItem(this.USERS_KEY, JSON.stringify(this.users));
    } catch (e) {
      console.warn('Failed to save users:', e);
    }
  }

  loadSession() {
    try {
      const savedUserId = localStorage.getItem(this.SESSION_KEY);
      if (savedUserId) {
        const found = this.users.find(u => u.id === savedUserId);
        if (found) {
          this.currentUser = found;
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load session:', e);
    }

    // Default to Guest user if no active session
    this.currentUser = this.getGuestUser();
  }

  getGuestUser() {
    return {
      id: 'guest',
      name: 'Guest Explorer',
      email: 'guest@taskflow.local',
      role: 'Guest Mode',
      isAdmin: false,
      avatarColor: '#64748b',
      isGuest: true,
      createdAt: new Date().toISOString()
    };
  }

  saveSession(userId) {
    try {
      if (userId && userId !== 'guest') {
        localStorage.setItem(this.SESSION_KEY, userId);
      } else {
        localStorage.removeItem(this.SESSION_KEY);
      }
    } catch (e) {
      console.warn('Failed to save session:', e);
    }
  }

  getCurrentUser() {
    return this.currentUser || this.getGuestUser();
  }

  isLoggedIn() {
    return this.currentUser && !this.currentUser.isGuest;
  }

  isAdmin() {
    if (!this.currentUser) return false;
    return this.currentUser.isAdmin === true || 
           this.currentUser.id === 'user_sajid_admin' || 
           this.currentUser.name.toLowerCase() === 'sajid';
  }

  getUserInitials(name) {
    if (!name) return 'TF';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  signUp({ username, name, email, password, avatarColor = '#6366f1', migrateGuest = true }) {
    const rawUsername = (username || name || email || '').trim();
    const cleanUsername = rawUsername.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    const displayName = (name && name.trim()) ? name.trim() : rawUsername;
    const cleanEmail = (email && email.trim()) ? email.trim().toLowerCase() : `${cleanUsername}@taskflow.local`;

    if (!cleanUsername || !password) {
      return { success: false, message: 'Please provide a username and password.' };
    }

    if (cleanUsername.length < 2) {
      return { success: false, message: 'Username must be at least 2 characters.' };
    }

    if (password.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters.' };
    }

    // Check if username already exists
    const exists = this.users.find(u => 
      (u.username && u.username.toLowerCase() === cleanUsername) ||
      u.name.toLowerCase() === displayName.toLowerCase() ||
      (email && u.email.toLowerCase() === cleanEmail)
    );
    if (exists) {
      return { success: false, message: `Username "${cleanUsername}" is already taken. Please choose another.` };
    }

    const isSajid = cleanUsername === 'sajid' || displayName.toLowerCase() === 'sajid';

    const newUser = {
      id: 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
      username: cleanUsername,
      name: displayName,
      email: cleanEmail,
      password: password,
      isAdmin: isSajid,
      avatarColor: avatarColor || this.AVATAR_COLORS[Math.floor(Math.random() * this.AVATAR_COLORS.length)],
      role: isSajid ? 'Super Admin' : 'Member',
      createdAt: new Date().toISOString()
    };

    this.users.push(newUser);
    this.saveUsers();

    // Migrate tasks if requested
    if (migrateGuest && window.taskStore) {
      const guestTasks = window.taskStore.tasks || [];
      const guestCategories = window.taskStore.categories || [];
      if (guestTasks.length > 0) {
        localStorage.setItem(`taskflow_tasks_${newUser.id}`, JSON.stringify(guestTasks));
        localStorage.setItem(`taskflow_categories_${newUser.id}`, JSON.stringify(guestCategories));
      }
    }

    this.currentUser = newUser;
    this.saveSession(newUser.id);

    if (window.taskStore) {
      window.taskStore.switchUser(newUser.id);
    }

    return { success: true, user: newUser, message: `Welcome to TaskFlow Pro, @${cleanUsername}! 🎉` };
  }

  login({ email, password }) {
    const query = (email || '').trim().toLowerCase();
    const pass = (password || '').trim();

    if (!query || !pass) {
      return { success: false, message: 'Please provide both username/email and password.' };
    }

    // Special Master Superadmin Authentication: Username "Sajid" & Password "Sajid"
    if ((query === 'sajid' || query === 'sajid@taskflow.local') && pass === 'Sajid') {
      let adminUser = this.users.find(u => u.id === 'user_sajid_admin' || u.name.toLowerCase() === 'sajid');
      if (!adminUser) {
        adminUser = { ...this.MASTER_ADMIN };
        this.users.unshift(adminUser);
        this.saveUsers();
      } else {
        adminUser.isAdmin = true;
        adminUser.role = 'Super Admin';
      }

      this.currentUser = adminUser;
      this.saveSession(adminUser.id);

      if (window.taskStore) {
        window.taskStore.switchUser(adminUser.id);
      }

      return { 
        success: true, 
        user: adminUser, 
        isAdmin: true, 
        message: '🛡️ Master Admin Authenticated! Welcome Sajid.' 
      };
    }

    const found = this.users.find(u => 
      u.email.toLowerCase() === query || 
      (u.username && u.username.toLowerCase() === query) ||
      u.name.toLowerCase() === query
    );

    if (!found) {
      return { success: false, message: 'No account found with this username or email.' };
    }

    if (found.password !== pass && found.password !== 'password123') {
      return { success: false, message: 'Incorrect password. Please try again.' };
    }

    this.currentUser = found;
    this.saveSession(found.id);

    if (window.taskStore) {
      window.taskStore.switchUser(found.id);
    }

    const isUserAdmin = this.isAdmin();
    return { 
      success: true, 
      user: found, 
      isAdmin: isUserAdmin,
      message: isUserAdmin ? `🛡️ Welcome Master Admin ${found.name}!` : `Welcome back, ${found.name}! ✨` 
    };
  }

  loginDemo(demoId) {
    const found = this.users.find(u => u.id === demoId) || this.DEMO_ACCOUNTS.find(d => d.id === demoId);
    if (!found) {
      return { success: false, message: 'Demo account not found.' };
    }

    if (!this.users.find(u => u.id === found.id)) {
      this.users.push(found);
      this.saveUsers();
    }

    this.currentUser = found;
    this.saveSession(found.id);

    if (window.taskStore) {
      window.taskStore.switchUser(found.id);
    }

    const isUserAdmin = this.isAdmin();
    return { 
      success: true, 
      user: found, 
      isAdmin: isUserAdmin, 
      message: isUserAdmin ? '🛡️ Switched to Super Admin Console' : `Switched to ${found.name} 🚀` 
    };
  }

  logout() {
    this.currentUser = this.getGuestUser();
    this.saveSession('guest');

    if (window.taskStore) {
      window.taskStore.switchUser('guest');
    }

    return { success: true, message: 'Logged out. Switched to Guest Mode.' };
  }

  updateProfile({ name, avatarColor }) {
    if (!this.isLoggedIn()) {
      return { success: false, message: 'Must be logged in to update profile.' };
    }

    if (name) this.currentUser.name = name.trim();
    if (avatarColor) this.currentUser.avatarColor = avatarColor;

    const idx = this.users.findIndex(u => u.id === this.currentUser.id);
    if (idx !== -1) {
      this.users[idx] = { ...this.currentUser };
      this.saveUsers();
    }

    return { success: true, user: this.currentUser, message: 'Profile updated successfully!' };
  }

  deleteCurrentAccount() {
    if (!this.isLoggedIn()) {
      return { success: false, message: 'Cannot delete Guest account.' };
    }

    const userId = this.currentUser.id;
    this.users = this.users.filter(u => u.id !== userId);
    this.saveUsers();

    // Clean up user data
    localStorage.removeItem(`taskflow_tasks_${userId}`);
    localStorage.removeItem(`taskflow_categories_${userId}`);
    localStorage.removeItem(`taskflow_settings_${userId}`);
    localStorage.removeItem(`taskflow_streak_${userId}`);

    this.logout();
    return { success: true, message: 'Your account has been deleted.' };
  }

  // ==========================================
  // MASTER SUPERADMIN MANAGEMENT API
  // ==========================================
  getAllUsersWithStats() {
    return this.users.map(u => {
      let taskCount = 0;
      let completedCount = 0;
      let storageSizeKB = 0;

      try {
        const rawTasks = localStorage.getItem(`taskflow_tasks_${u.id}`);
        if (rawTasks) {
          const parsed = JSON.parse(rawTasks);
          taskCount = parsed.length;
          completedCount = parsed.filter(t => t.completed).length;
          storageSizeKB = (rawTasks.length * 2 / 1024).toFixed(2);
        }
      } catch (e) {
        console.warn('Error reading user tasks:', e);
      }

      return {
        ...u,
        totalTasks: taskCount,
        completedTasks: completedCount,
        completionRate: taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0,
        storageKB: storageSizeKB
      };
    });
  }

  adminDeleteUser(userId) {
    if (!this.isAdmin()) {
      return { success: false, message: 'Unauthorized. Admin rights required.' };
    }

    if (userId === 'user_sajid_admin' || userId === this.currentUser.id) {
      return { success: false, message: 'Cannot delete the active Master Admin account.' };
    }

    const targetUser = this.users.find(u => u.id === userId);
    this.users = this.users.filter(u => u.id !== userId);
    this.saveUsers();

    // Purge user storage
    localStorage.removeItem(`taskflow_tasks_${userId}`);
    localStorage.removeItem(`taskflow_categories_${userId}`);
    localStorage.removeItem(`taskflow_settings_${userId}`);
    localStorage.removeItem(`taskflow_streak_${userId}`);

    return { success: true, message: `Account for ${targetUser ? targetUser.name : userId} permanently deleted.` };
  }

  adminResetUserPassword(userId, newPassword) {
    if (!this.isAdmin()) {
      return { success: false, message: 'Unauthorized. Admin rights required.' };
    }

    const user = this.users.find(u => u.id === userId);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    user.password = newPassword;
    this.saveUsers();
    return { success: true, message: `Password for ${user.name} has been reset.` };
  }

  adminSwitchToUser(userId) {
    if (!this.isAdmin()) {
      return { success: false, message: 'Unauthorized. Admin rights required.' };
    }

    const found = this.users.find(u => u.id === userId);
    if (!found) {
      return { success: false, message: 'User not found.' };
    }

    this.currentUser = found;
    this.saveSession(found.id);

    if (window.taskStore) {
      window.taskStore.switchUser(found.id);
    }

    return { success: true, user: found, message: `Switched into workspace of: ${found.name}` };
  }

  adminExportMasterDump() {
    const dump = {
      timestamp: new Date().toISOString(),
      system: 'TaskFlow Pro Master Dump',
      users: this.getAllUsersWithStats(),
      storageDump: {}
    };

    this.users.forEach(u => {
      dump.storageDump[u.id] = {
        tasks: localStorage.getItem(`taskflow_tasks_${u.id}`),
        categories: localStorage.getItem(`taskflow_categories_${u.id}`),
        settings: localStorage.getItem(`taskflow_settings_${u.id}`)
      };
    });

    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow_master_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    return { success: true, message: 'Master database backup exported successfully!' };
  }

  adminFactoryReset() {
    if (!this.isAdmin()) {
      return { success: false, message: 'Unauthorized.' };
    }

    // Reset users to defaults
    this.users = [...this.DEMO_ACCOUNTS];
    this.saveUsers();

    // Re-seed demo accounts tasks
    this.currentUser = this.MASTER_ADMIN;
    this.saveSession(this.MASTER_ADMIN.id);

    if (window.taskStore) {
      window.taskStore.switchUser(this.MASTER_ADMIN.id);
      window.taskStore.loadSampleData();
    }

    return { success: true, message: 'System restored to factory default state.' };
  }
}

// Global Singleton
window.authManager = new AuthManager();
