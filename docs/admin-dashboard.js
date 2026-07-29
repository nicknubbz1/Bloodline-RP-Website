(function () {
  const apiBaseUrl = window.BLOODLINE_API_BASE_URL || "http://localhost:3000/api";
  const adminSessionUrl = window.BLOODLINE_ADMIN_SESSION_URL || `${apiBaseUrl}/admin/session`;
  const adminLoginUrl = window.BLOODLINE_ADMIN_LOGIN_URL || `${apiBaseUrl}/admin/login`;
  const adminLogoutUrl = window.BLOODLINE_ADMIN_LOGOUT_URL || `${apiBaseUrl}/admin/logout`;
  const localAdminUsersKey = "bloodline-local-admin-users";
  const localAdminSessionKey = "bloodline-local-admin-session";
  const localAdminSessionTempKey = "bloodline-local-admin-session-temp";
  const localAdminSettingsKey = "bloodline-local-admin-settings";

  const tabs = Array.from(document.querySelectorAll("[data-admin-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-admin-panel]"));
  const sessionMetaEl = document.getElementById("adminSessionMeta");
  const logoutBtn = document.getElementById("adminLogoutBtn");
  const changeUsernameBtn = document.getElementById("adminChangeUsernameBtn");
  const changePasswordBtn = document.getElementById("adminChangePasswordBtn");
  const maintenanceToggle = document.getElementById("maintenanceEnabled");
  const maintenanceStatusText = document.getElementById("maintenanceStatusText");
  const createAdminUserForm = document.getElementById("createAdminUserForm");
  const adminUsersList = document.getElementById("adminUsersList");
  const applicationSourceEl = document.getElementById("adminApplicationSource");
  const applicationSearchEl = document.getElementById("adminApplicationSearch");
  const applicationRefreshBtn = document.getElementById("adminApplicationRefreshBtn");
  const adminApplicationsList = document.getElementById("adminApplicationsList");
  const currentSubscriptionsList = document.getElementById("currentSubscriptionsList");
  const endedSubscriptionsList = document.getElementById("endedSubscriptionsList");

  const state = {
    admin: null,
    users: [],
    applications: [],
    subscriptions: { current: [], ended: [] },
    settings: { maintenanceMode: false },
    source: "active",
    localMode: false,
  };

  function readStoredJson(storage, key, fallbackValue) {
    try {
      const raw = storage.getItem(key);
      if (!raw) {
        return fallbackValue;
      }
      return JSON.parse(raw);
    } catch {
      return fallbackValue;
    }
  }

  function writeStoredJson(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function ensureLocalAdminUsers() {
    const existing = readStoredJson(localStorage, localAdminUsersKey, null);
    if (Array.isArray(existing) && existing.length > 0) {
      return existing;
    }

    const seed = [{
      id: "local-main-admin",
      username: "1234",
      password: "1234",
      isMainAdmin: true,
      permissions: {
        applications: true,
        websiteMaintenance: true,
        subscriptions: true,
        permissions: true,
      },
    }];

    writeStoredJson(localStorage, localAdminUsersKey, seed);
    return seed;
  }

  function sanitizeLocalAdminUser(user) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      isMainAdmin: Boolean(user.isMainAdmin),
      permissions: normalizePermissions(user.permissions),
    };
  }

  function readLocalAdminSession() {
    const persistent = readStoredJson(localStorage, localAdminSessionKey, null);
    if (persistent?.id) {
      return persistent;
    }

    const temporary = readStoredJson(sessionStorage, localAdminSessionTempKey, null);
    if (temporary?.id) {
      return temporary;
    }

    return null;
  }

  function clearLocalAdminSession() {
    localStorage.removeItem(localAdminSessionKey);
    sessionStorage.removeItem(localAdminSessionTempKey);
  }

  function resolveLocalAdminFromSession() {
    const session = readLocalAdminSession();
    if (!session?.id) {
      return null;
    }

    const users = ensureLocalAdminUsers();
    const target = users.find((entry) => entry.id === session.id);
    if (!target) {
      clearLocalAdminSession();
      return null;
    }

    return sanitizeLocalAdminUser(target);
  }

  function normalizePermissions(raw) {
    const entry = raw || {};
    return {
      applications: Boolean(entry.applications),
      websiteMaintenance: Boolean(entry.websiteMaintenance),
      subscriptions: Boolean(entry.subscriptions),
      permissions: Boolean(entry.permissions),
    };
  }

  function hasPermission(permissionKey) {
    if (!state.admin) {
      return false;
    }
    if (state.admin.isMainAdmin) {
      return true;
    }
    return Boolean(state.admin.permissions && state.admin.permissions[permissionKey]);
  }

  function setActiveTab(tabKey) {
    tabs.forEach((tab) => {
      const isActive = tab.getAttribute("data-admin-tab") === tabKey;
      tab.classList.toggle("active", isActive);
    });
    panels.forEach((panel) => {
      const isActive = panel.getAttribute("data-admin-panel") === tabKey;
      panel.classList.toggle("active", isActive);
    });
  }

  function formatDate(value) {
    if (!value) {
      return "Not set";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "Not set";
    }
    return parsed.toLocaleString();
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      credentials: "include",
      ...(options || {}),
    });
    const payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }

    return payload;
  }

  function renderAdminMeta() {
    if (!sessionMetaEl) {
      return;
    }

    if (!state.admin) {
      sessionMetaEl.textContent = "No admin session.";
      return;
    }

    const perms = normalizePermissions(state.admin.permissions);
    sessionMetaEl.textContent = state.admin.isMainAdmin
      ? `Logged in as ${state.admin.username} (Main Admin)`
      : `Logged in as ${state.admin.username} | Apps: ${perms.applications ? "Yes" : "No"} | Maintenance: ${perms.websiteMaintenance ? "Yes" : "No"} | Subs: ${perms.subscriptions ? "Yes" : "No"} | Permissions: ${perms.permissions ? "Yes" : "No"}`;

    if (changeUsernameBtn) {
      changeUsernameBtn.disabled = !state.admin.isMainAdmin;
      changeUsernameBtn.title = state.admin.isMainAdmin ? "Change main admin username" : "Only the main admin can change username";
    }
  }

  function renderUsers() {
    if (!adminUsersList) {
      return;
    }

    if (!hasPermission("permissions")) {
      adminUsersList.innerHTML = '<p class="admin-empty">You do not have permissions access.</p>';
      return;
    }

    if (!state.users.length) {
      adminUsersList.innerHTML = '<p class="admin-empty">No admin logins found.</p>';
      return;
    }

    adminUsersList.innerHTML = state.users.map(function (user) {
      const perms = normalizePermissions(user.permissions);
      return `
        <article class="admin-user-card" data-user-id="${user.id}">
          <div>
            <h3>${user.username}${user.isMainAdmin ? " (Main)" : ""}</h3>
            <p>Applications: ${perms.applications ? "Yes" : "No"} | Maintenance: ${perms.websiteMaintenance ? "Yes" : "No"} | Subscriptions: ${perms.subscriptions ? "Yes" : "No"} | Permissions: ${perms.permissions ? "Yes" : "No"}</p>
          </div>
          <div class="admin-user-actions">
            ${user.isMainAdmin ? "" : '<button class="btn btn-ghost" data-action="set-password" type="button">Reset Password</button>'}
            ${user.isMainAdmin ? "" : '<button class="btn btn-ghost" data-action="toggle-applications" type="button">Toggle Apps</button>'}
            ${user.isMainAdmin ? "" : '<button class="btn btn-ghost" data-action="toggle-maintenance" type="button">Toggle Maintenance</button>'}
            ${user.isMainAdmin ? "" : '<button class="btn btn-ghost" data-action="toggle-subscriptions" type="button">Toggle Subscriptions</button>'}
            ${user.isMainAdmin ? "" : '<button class="btn btn-ghost" data-action="toggle-permissions" type="button">Toggle Permissions</button>'}
            ${user.isMainAdmin ? "" : '<button class="btn btn-danger" data-action="delete" type="button">Delete Profile</button>'}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderApplications() {
    if (!adminApplicationsList) {
      return;
    }

    if (!hasPermission("applications")) {
      adminApplicationsList.innerHTML = '<p class="admin-empty">You do not have applications access.</p>';
      return;
    }

    if (!state.applications.length) {
      adminApplicationsList.innerHTML = '<p class="admin-empty">No applications found for this view.</p>';
      return;
    }

    adminApplicationsList.innerHTML = state.applications.map(function (app) {
      return `
        <article class="admin-application-card" data-application-id="${app.id}">
          <header>
            <h3>${app.title || "Application"}</h3>
            <span class="admin-badge">${app.status || "pending"}</span>
          </header>
          <p><strong>Type:</strong> ${app.type || "unknown"}</p>
          <p><strong>Applicant:</strong> ${app.applicant?.steamName || "Unknown"} / ${app.applicant?.discordName || "Unknown"}</p>
          <p><strong>Created:</strong> ${formatDate(app.createdAt)}</p>
          <p>${app.body || "No details"}</p>
          <div class="admin-inline-controls">
            <button class="btn btn-ghost" data-action="accept" type="button">Accept</button>
            <button class="btn btn-ghost" data-action="deny" type="button">Deny</button>
            <button class="btn btn-ghost" data-action="reply" type="button">Reply</button>
            ${state.source === "active" ? '<button class="btn btn-ghost" data-action="archive" type="button">Archive</button>' : '<button class="btn btn-danger" data-action="delete" type="button">Delete</button>'}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderSubscriptions() {
    if (!currentSubscriptionsList || !endedSubscriptionsList) {
      return;
    }

    if (!hasPermission("subscriptions")) {
      currentSubscriptionsList.innerHTML = '<p class="admin-empty">You do not have subscriptions access.</p>';
      endedSubscriptionsList.innerHTML = '<p class="admin-empty">You do not have subscriptions access.</p>';
      return;
    }

    const current = Array.isArray(state.subscriptions.current) ? state.subscriptions.current : [];
    const ended = Array.isArray(state.subscriptions.ended) ? state.subscriptions.ended : [];

    currentSubscriptionsList.innerHTML = current.length
      ? current.map(function (entry) {
        return `<article class="admin-subscription-card"><h3>${entry.name || "Unknown"}</h3><p>Tier: ${entry.tier || "Unknown"}</p><p>Renews: ${formatDate(entry.renewsAt)}</p><p>Amount: ${entry.amount || "Not set"}</p></article>`;
      }).join("")
      : '<p class="admin-empty">No current subscriptions.</p>';

    endedSubscriptionsList.innerHTML = ended.length
      ? ended.map(function (entry) {
        return `<article class="admin-subscription-card"><h3>${entry.name || "Unknown"}</h3><p>Tier: ${entry.tier || "Unknown"}</p><p>Ended: ${formatDate(entry.endedAt)}</p><p>Amount: ${entry.amount || "Not set"}</p></article>`;
      }).join("")
      : '<p class="admin-empty">No ended subscriptions.</p>';
  }

  function renderMaintenance() {
    if (!maintenanceToggle || !maintenanceStatusText) {
      return;
    }

    const canManage = hasPermission("websiteMaintenance");
    maintenanceToggle.checked = Boolean(state.settings.maintenanceMode);
    maintenanceToggle.disabled = !canManage;
    maintenanceStatusText.textContent = canManage
      ? (state.settings.maintenanceMode ? "Maintenance mode is ON." : "Maintenance mode is OFF.")
      : "You do not have website maintenance access.";
  }

  async function loadSession() {
    try {
      const payload = await requestJson(adminSessionUrl);
      state.admin = payload.admin || null;
      state.localMode = false;
      renderAdminMeta();
      return;
    } catch {
      const localAdmin = resolveLocalAdminFromSession();
      if (!localAdmin) {
        throw new Error("Admin session not found.");
      }

      state.admin = localAdmin;
      state.localMode = true;
      renderAdminMeta();
    }
  }

  async function loadSessionWithRetry(attempts) {
    const maxAttempts = Number.isFinite(attempts) ? Math.max(1, attempts) : 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await loadSession();
        return true;
      } catch {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => {
            setTimeout(resolve, 220 * attempt);
          });
        }
      }
    }

    return false;
  }

  async function loadUsers() {
    if (!hasPermission("permissions")) {
      state.users = [];
      renderUsers();
      return;
    }

    if (state.localMode) {
      state.users = ensureLocalAdminUsers().map(sanitizeLocalAdminUser).filter(Boolean);
      renderUsers();
      return;
    }

    const payload = await requestJson(`${apiBaseUrl}/admin/users`);
    state.users = Array.isArray(payload.users) ? payload.users : [];
    renderUsers();
  }

  async function loadApplications() {
    if (!hasPermission("applications")) {
      state.applications = [];
      renderApplications();
      return;
    }

    if (state.localMode) {
      state.applications = [];
      renderApplications();
      return;
    }

    const search = applicationSearchEl ? String(applicationSearchEl.value || "").trim() : "";
    const params = new URLSearchParams({
      source: state.source,
      search,
    });

    const payload = await requestJson(`${apiBaseUrl}/admin/applications?${params.toString()}`);
    state.applications = Array.isArray(payload.applications) ? payload.applications : [];
    renderApplications();
  }

  async function loadSubscriptions() {
    if (!hasPermission("subscriptions")) {
      state.subscriptions = { current: [], ended: [] };
      renderSubscriptions();
      return;
    }

    if (state.localMode) {
      state.subscriptions = { current: [], ended: [] };
      renderSubscriptions();
      return;
    }

    const payload = await requestJson(`${apiBaseUrl}/admin/subscriptions`);
    state.subscriptions = {
      current: Array.isArray(payload.current) ? payload.current : [],
      ended: Array.isArray(payload.ended) ? payload.ended : [],
    };
    renderSubscriptions();
  }

  async function loadSettings() {
    if (state.localMode) {
      const localSettings = readStoredJson(localStorage, localAdminSettingsKey, { maintenanceMode: false });
      state.settings = {
        maintenanceMode: Boolean(localSettings?.maintenanceMode),
      };
      renderMaintenance();
      return;
    }

    const payload = await requestJson(`${apiBaseUrl}/admin/settings`);
    state.settings = payload.settings || { maintenanceMode: false };
    renderMaintenance();
  }

  async function boot() {
    const hasSession = await loadSessionWithRetry(3);
    if (!hasSession) {
      if (sessionMetaEl) {
        sessionMetaEl.textContent = "Admin session not found. Log in again to continue.";
      }

      if (typeof window.openAdminLoginModal === "function") {
        window.openAdminLoginModal();
      }

      return;
    }

    await Promise.all([
      loadSettings(),
      loadUsers().catch(function () {
        renderUsers();
      }),
      loadApplications().catch(function () {
        renderApplications();
      }),
      loadSubscriptions().catch(function () {
        renderSubscriptions();
      }),
    ]);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      setActiveTab(tab.getAttribute("data-admin-tab"));
    });
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      if (state.localMode) {
        clearLocalAdminSession();
      } else {
        await requestJson(adminLogoutUrl, { method: "POST" }).catch(function () {
          return null;
        });
      }
      window.location.href = "index.html";
    });
  }

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", async function () {
      const currentPassword = window.prompt("Enter current password:");
      if (!currentPassword) {
        return;
      }
      const newPassword = window.prompt("Enter new password:");
      if (!newPassword) {
        return;
      }

      try {
        await requestJson(`${apiBaseUrl}/admin/change-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        window.alert("Password changed.");
      } catch (error) {
        window.alert(error.message || "Could not change password.");
      }
    });
  }

  if (changeUsernameBtn) {
    changeUsernameBtn.addEventListener("click", async function () {
      if (!state.admin || !state.admin.isMainAdmin) {
        window.alert("Only the main admin can change username.");
        return;
      }

      const username = window.prompt("Enter new username for main admin:");
      if (!username) {
        return;
      }

      try {
        const payload = await requestJson(`${apiBaseUrl}/admin/change-username`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        state.admin = payload.admin || state.admin;
        renderAdminMeta();
        window.alert("Username changed.");
      } catch (error) {
        window.alert(error.message || "Could not change username.");
      }
    });
  }

  if (maintenanceToggle) {
    maintenanceToggle.addEventListener("change", async function () {
      try {
        if (state.localMode) {
          writeStoredJson(localStorage, localAdminSettingsKey, { maintenanceMode: Boolean(maintenanceToggle.checked) });
          await loadSettings();
          return;
        }

        await requestJson(`${apiBaseUrl}/admin/settings/maintenance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: maintenanceToggle.checked }),
        });
        await loadSettings();
      } catch (error) {
        window.alert(error.message || "Could not update maintenance mode.");
        maintenanceToggle.checked = !maintenanceToggle.checked;
      }
    });
  }

  if (createAdminUserForm) {
    createAdminUserForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!hasPermission("permissions")) {
        return;
      }

      const formData = new FormData(createAdminUserForm);
      const payload = {
        username: String(formData.get("username") || "").trim(),
        password: String(formData.get("password") || "").trim(),
        permissions: {
          applications: formData.get("applications") === "on",
          websiteMaintenance: formData.get("websiteMaintenance") === "on",
          subscriptions: formData.get("subscriptions") === "on",
          permissions: formData.get("permissions") === "on",
        },
      };

      try {
        await requestJson(`${apiBaseUrl}/admin/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        createAdminUserForm.reset();
        await loadUsers();
      } catch (error) {
        window.alert(error.message || "Could not create admin login.");
      }
    });
  }

  if (adminUsersList) {
    adminUsersList.addEventListener("click", async function (event) {
      const button = event.target.closest("button[data-action]");
      const card = event.target.closest("[data-user-id]");
      if (!button || !card) {
        return;
      }

      const userId = card.getAttribute("data-user-id");
      const target = state.users.find(function (entry) {
        return entry.id === userId;
      });
      if (!target) {
        return;
      }

      const action = button.getAttribute("data-action");

      if (action === "delete") {
        if (!window.confirm("Delete this admin profile?")) {
          return;
        }
        await requestJson(`${apiBaseUrl}/admin/users/${encodeURIComponent(userId)}`, {
          method: "DELETE",
        }).catch(function (error) {
          window.alert(error.message || "Could not delete admin profile.");
        });
        await loadUsers();
        return;
      }

      if (action === "set-password") {
        const newPassword = window.prompt("Enter a new password for this profile:");
        if (!newPassword) {
          return;
        }
        await requestJson(`${apiBaseUrl}/admin/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword }),
        }).catch(function (error) {
          window.alert(error.message || "Could not reset password.");
        });
        await loadUsers();
        return;
      }

      const permissions = normalizePermissions(target.permissions);
      if (action === "toggle-applications") {
        permissions.applications = !permissions.applications;
      } else if (action === "toggle-maintenance") {
        permissions.websiteMaintenance = !permissions.websiteMaintenance;
      } else if (action === "toggle-subscriptions") {
        permissions.subscriptions = !permissions.subscriptions;
      } else if (action === "toggle-permissions") {
        permissions.permissions = !permissions.permissions;
      }

      await requestJson(`${apiBaseUrl}/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      }).catch(function (error) {
        window.alert(error.message || "Could not update permissions.");
      });
      await loadUsers();
    });
  }

  if (applicationSourceEl) {
    applicationSourceEl.addEventListener("change", async function () {
      state.source = applicationSourceEl.value === "archived" ? "archived" : "active";
      await loadApplications();
    });
  }

  if (applicationRefreshBtn) {
    applicationRefreshBtn.addEventListener("click", loadApplications);
  }

  if (applicationSearchEl) {
    applicationSearchEl.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        loadApplications();
      }
    });
  }

  if (adminApplicationsList) {
    adminApplicationsList.addEventListener("click", async function (event) {
      const button = event.target.closest("button[data-action]");
      const card = event.target.closest("[data-application-id]");
      if (!button || !card) {
        return;
      }

      const appId = card.getAttribute("data-application-id");
      const action = button.getAttribute("data-action");

      try {
        if (action === "accept" || action === "deny") {
          await requestJson(`${apiBaseUrl}/admin/applications/${encodeURIComponent(appId)}/decision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: action === "accept" ? "accepted" : "denied", note: "" }),
          });
        } else if (action === "reply") {
          const message = window.prompt("Reply message:");
          if (!message) {
            return;
          }
          await requestJson(`${apiBaseUrl}/admin/applications/${encodeURIComponent(appId)}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
          });
        } else if (action === "archive") {
          await requestJson(`${apiBaseUrl}/admin/applications/${encodeURIComponent(appId)}/archive`, {
            method: "POST",
          });
        } else if (action === "delete") {
          if (!window.confirm("Delete this archived application permanently?")) {
            return;
          }
          await requestJson(`${apiBaseUrl}/admin/applications/${encodeURIComponent(appId)}`, {
            method: "DELETE",
          });
        }

        await loadApplications();
      } catch (error) {
        window.alert(error.message || "Could not update application.");
      }
    });
  }

  boot();
})();
