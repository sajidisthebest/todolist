/**
 * TaskFlow Pro - Master Admin Panel Controller
 * Grants Super Admin Sajid full visibility, diagnostics, and authority over users and data
 */
class AdminDashboard {
  constructor() {
    this.modalEl = null;
  }

  open() {
    if (!window.authManager || !window.authManager.isAdmin()) {
      if (window.app) {
        window.app.showToast('🔒 Super Admin access required. Please sign in with admin credentials.', 'warning');
        window.app.openAuthModal('signin');
      }
      return;
    }

    const modal = document.getElementById('admin-modal');
    if (!modal) return;

    this.render();
    modal.classList.add('active');
    if (window.soundEngine) window.soundEngine.playPop();
  }

  close() {
    const modal = document.getElementById('admin-modal');
    if (modal) modal.classList.remove('active');
  }

  render() {
    if (!window.authManager) return;

    const usersWithStats = window.authManager.getAllUsersWithStats();

    // 1. Calculate Aggregate Global Metrics
    const totalUsers = usersWithStats.length;
    const totalTasks = usersWithStats.reduce((acc, u) => acc + (u.totalTasks || 0), 0);
    const totalCompleted = usersWithStats.reduce((acc, u) => acc + (u.completedTasks || 0), 0);
    const globalRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
    
    // Estimate total localStorage usage
    let totalStorageBytes = 0;
    for (let x in localStorage) {
      if (localStorage.hasOwnProperty(x)) {
        totalStorageBytes += (localStorage[x].length * 2);
      }
    }
    const storageKB = (totalStorageBytes / 1024).toFixed(1);

    // 2. Render Metric Cards
    const totalUsersEl = document.getElementById('admin-stat-users');
    const totalTasksEl = document.getElementById('admin-stat-tasks');
    const globalRateEl = document.getElementById('admin-stat-rate');
    const storageEl = document.getElementById('admin-stat-storage');

    if (totalUsersEl) totalUsersEl.textContent = totalUsers;
    if (totalTasksEl) totalTasksEl.textContent = `${totalTasks} (${totalCompleted} done)`;
    if (globalRateEl) globalRateEl.textContent = `${globalRate}%`;
    if (storageEl) storageEl.textContent = `${storageKB} KB`;

    // 3. Render Users Table
    const tableBody = document.getElementById('admin-users-table-body');
    if (tableBody) {
      tableBody.innerHTML = usersWithStats.map(u => {
        const isCurrent = window.authManager.currentUser && window.authManager.currentUser.id === u.id;
        const isMaster = u.id === 'user_sajid_admin' || u.name.toLowerCase() === 'sajid';

        return `
          <tr class="admin-user-row ${isCurrent ? 'current-active-user' : ''}">
            <td>
              <div class="admin-user-cell">
                <span class="user-avatar-badge" style="background: ${u.avatarColor || '#6366f1'}; width: 28px; height: 28px;">
                  ${window.authManager.getUserInitials(u.name)}
                </span>
                <div class="admin-user-info">
                  <span class="admin-user-name">${this.escapeHtml(u.name)} ${isCurrent ? '<span class="active-dot-pill">Active</span>' : ''}</span>
                  <span class="admin-user-email">${this.escapeHtml(u.email)}</span>
                </div>
              </div>
            </td>
            <td>
              <span class="badge ${isMaster ? 'priority-urgent' : 'priority-medium'}">
                ${isMaster ? '🛡️ SUPER ADMIN' : this.escapeHtml(u.role || 'Member')}
              </span>
            </td>
            <td>
              <div class="admin-task-stat">
                <span class="task-stat-num"><strong>${u.totalTasks}</strong> tasks</span>
                <span class="task-stat-sub">(${u.completedTasks} completed • ${u.completionRate}%)</span>
              </div>
            </td>
            <td>
              <span class="admin-date-text">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</span>
            </td>
            <td>
              <div class="admin-actions-group">
                <button type="button" class="btn-admin-action" onclick="window.adminDashboard.switchToUser('${u.id}')" title="Inspect Workspace">
                  👁️ Switch
                </button>
                <button type="button" class="btn-admin-action" onclick="window.adminDashboard.promptResetPassword('${u.id}', '${this.escapeHtml(u.name)}')" title="Reset Password">
                  🔑 Reset
                </button>
                ${!isMaster ? `
                  <button type="button" class="btn-admin-action danger" onclick="window.adminDashboard.deleteUser('${u.id}', '${this.escapeHtml(u.name)}')" title="Delete User">
                    🗑️ Delete
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  switchToUser(userId) {
    const result = window.authManager.adminSwitchToUser(userId);
    if (result.success) {
      this.close();
      if (window.app) {
        window.app.updateHeaderUserChip();
        window.app.render();
        window.app.showToast(result.message, 'success');
      }
    } else {
      if (window.app) window.app.showToast(result.message, 'warning');
    }
  }

  promptResetPassword(userId, userName) {
    const newPass = prompt(`Enter new password for ${userName}:`, 'password123');
    if (newPass && newPass.trim() !== '') {
      const result = window.authManager.adminResetUserPassword(userId, newPass.trim());
      if (result.success) {
        if (window.app) window.app.showToast(result.message, 'success');
        this.render();
      } else {
        if (window.app) window.app.showToast(result.message, 'warning');
      }
    }
  }

  deleteUser(userId, userName) {
    if (confirm(`Are you sure you want to permanently delete user "${userName}" and all their tasks?`)) {
      const result = window.authManager.adminDeleteUser(userId);
      if (result.success) {
        if (window.app) window.app.showToast(result.message, 'info');
        this.render();
      } else {
        if (window.app) window.app.showToast(result.message, 'warning');
      }
    }
  }

  exportMasterBackup() {
    const result = window.authManager.adminExportMasterDump();
    if (result.success && window.app) {
      window.app.showToast(result.message, 'success');
    }
  }

  factoryReset() {
    if (confirm('⚠️ WARNING: This will reset all tasks and users to factory demo defaults. Proceed?')) {
      const result = window.authManager.adminFactoryReset();
      if (result.success) {
        if (window.app) {
          window.app.initCategoryFilters();
          window.app.updateHeaderUserChip();
          window.app.render();
          window.app.showToast(result.message, 'info');
        }
        this.render();
      }
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}

// Global Singleton
window.adminDashboard = new AdminDashboard();
