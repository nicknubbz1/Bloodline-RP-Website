(function () {
  const requiredDashboardVersion = window.BLOODLINE_ADMIN_DASHBOARD_REQUIRED_VERSION || "";
  const currentScript = document.currentScript;
  const currentScriptSrc = currentScript
    ? String(currentScript.getAttribute("src") || currentScript.src || "")
    : "";

  if (
    requiredDashboardVersion
    && currentScriptSrc
    && currentScriptSrc.includes("admin-dashboard.js")
    && !currentScriptSrc.includes(requiredDashboardVersion)
  ) {
    return;
  }

  if (window.BLOODLINE_ADMIN_DASHBOARD_LOADED) {
    return;
  }
  window.BLOODLINE_ADMIN_DASHBOARD_LOADED = true;

  const apiBaseUrl = window.BLOODLINE_API_BASE_URL || "http://localhost:3000/api";
  const adminSessionUrl = window.BLOODLINE_ADMIN_SESSION_URL || `${apiBaseUrl}/admin/session`;
  const adminLoginUrl = window.BLOODLINE_ADMIN_LOGIN_URL || `${apiBaseUrl}/admin/login`;
  const adminLogoutUrl = window.BLOODLINE_ADMIN_LOGOUT_URL || `${apiBaseUrl}/admin/logout`;
  const localAdminUsersKey = "bloodline-local-admin-users";
  const localAdminSessionKey = "bloodline-local-admin-session";
  const localAdminSessionTempKey = "bloodline-local-admin-session-temp";
  const adminAuthStorageKey = "bloodline-admin-auth";
  const localAdminSettingsKey = "bloodline-local-admin-settings";
  const localSubscriptionsKey = "bloodline-local-subscriptions";
  const localApplicationAvailabilityKey = "bloodline-application-form-availability";
  const applicationForms = Array.isArray(window.BLOODLINE_APPLICATION_FORMS) ? window.BLOODLINE_APPLICATION_FORMS : [];

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
  const adminApplicationAvailabilityList = document.getElementById("adminApplicationAvailabilityList");
  const currentSubscriptionsList = document.getElementById("currentSubscriptionsList");
  const endedSubscriptionsList = document.getElementById("endedSubscriptionsList");
  const subscriptionGiftForm = document.getElementById("subscriptionGiftForm");
  const subscriptionGiftSearch = document.getElementById("subscriptionGiftSearch");
  const subscriptionGiftSearchList = document.getElementById("subscriptionGiftSearchList");
  const subscriptionGiftTier = document.getElementById("subscriptionGiftTier");
  const subscriptionGiftDuration = document.getElementById("subscriptionGiftDuration");
  const subscriptionGiftSubmitBtn = document.getElementById("subscriptionGiftSubmitBtn");
  const subscriptionGiftMessage = document.getElementById("subscriptionGiftMessage");

  const state = {
    admin: null,
    users: [],
    applications: [],
    applicationAvailability: {},
    subscriptions: { current: [], ended: [] },
    giftCandidates: [],
    settings: { maintenanceMode: false },
    source: "active",
    localMode: false,
    initialTabSet: false,
  };

  let adminDialogModal = null;

  function ensureAdminDialogModal() {
    if (adminDialogModal) {
      return adminDialogModal;
    }

    adminDialogModal = document.createElement("div");
    adminDialogModal.className = "login-modal admin-dialog-modal";
    adminDialogModal.setAttribute("aria-hidden", "true");
    adminDialogModal.innerHTML = `
      <div class="login-modal-card admin-dialog-card" role="dialog" aria-modal="true" aria-labelledby="adminDialogTitle">
        <button class="modal-close" type="button" data-dialog-close aria-label="Close dialog">X</button>
        <h2 id="adminDialogTitle">Notice</h2>
        <p class="steam-login-copy" data-dialog-message></p>
        <div class="admin-dialog-input-wrap" data-dialog-input-wrap hidden>
          <input data-dialog-input type="text" class="admin-dialog-input" />
          <p class="admin-dialog-error" data-dialog-error hidden></p>
        </div>
        <div class="admin-dialog-actions" data-dialog-actions>
          <button class="btn btn-ghost" type="button" data-dialog-cancel>Cancel</button>
          <button class="connect-action" type="button" data-dialog-confirm>Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(adminDialogModal);

    return adminDialogModal;
  }

  function closeAdminDialogModal() {
    if (!adminDialogModal) {
      return;
    }
    adminDialogModal.classList.remove("is-open");
    adminDialogModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function openAdminDialog(options) {
    const settings = options || {};
    const modal = ensureAdminDialogModal();
    const titleEl = modal.querySelector("#adminDialogTitle");
    const messageEl = modal.querySelector("[data-dialog-message]");
    const closeBtn = modal.querySelector("[data-dialog-close]");
    const cancelBtn = modal.querySelector("[data-dialog-cancel]");
    const confirmBtn = modal.querySelector("[data-dialog-confirm]");
    const inputWrap = modal.querySelector("[data-dialog-input-wrap]");
    const inputEl = modal.querySelector("[data-dialog-input]");
    const errorEl = modal.querySelector("[data-dialog-error]");

    if (!titleEl || !messageEl || !closeBtn || !cancelBtn || !confirmBtn || !inputWrap || !inputEl || !errorEl) {
      return Promise.resolve(null);
    }

    titleEl.textContent = settings.title || "Notice";
    messageEl.textContent = settings.message || "";
    confirmBtn.textContent = settings.confirmText || "OK";
    cancelBtn.textContent = settings.cancelText || "Cancel";

    const isPrompt = settings.type === "prompt";
    const isConfirm = settings.type === "confirm";
    const inputType = settings.inputType === "password" ? "password" : "text";

    inputWrap.hidden = !isPrompt;
    cancelBtn.hidden = !isPrompt && !isConfirm;
    inputEl.type = inputType;
    inputEl.value = settings.initialValue || "";
    inputEl.placeholder = settings.placeholder || "";
    inputEl.removeAttribute("aria-invalid");

    const setPromptError = function (message) {
      if (!isPrompt) {
        return;
      }
      const text = String(message || "").trim();
      errorEl.textContent = text;
      errorEl.hidden = !text;
      if (text) {
        inputEl.setAttribute("aria-invalid", "true");
      } else {
        inputEl.removeAttribute("aria-invalid");
      }
    };

    setPromptError(settings.errorText || "");

    const onInputChange = function () {
      setPromptError("");
    };

    if (isPrompt) {
      inputEl.addEventListener("input", onInputChange);
    }

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    if (isPrompt) {
      inputEl.focus();
      inputEl.select();
    } else {
      confirmBtn.focus();
    }

    return new Promise(function (resolve) {
      const onKeyDown = function (event) {
        if (event.key === "Enter" && isPrompt && event.target === inputEl) {
          event.preventDefault();
          confirmBtn.click();
        }
      };

      const cleanup = function () {
        closeBtn.removeEventListener("click", onClose);
        cancelBtn.removeEventListener("click", onCancel);
        confirmBtn.removeEventListener("click", onConfirm);
        inputEl.removeEventListener("input", onInputChange);
        document.removeEventListener("keydown", onKeyDown);
        closeAdminDialogModal();
      };

      const onClose = function () {
        cleanup();
        if (isPrompt) {
          resolve(null);
          return;
        }
        if (isConfirm) {
          resolve(false);
          return;
        }
        resolve(true);
      };

      const onCancel = function () {
        cleanup();
        if (isPrompt) {
          resolve(null);
          return;
        }
        resolve(false);
      };

      const onConfirm = async function () {
        if (isPrompt) {
          const value = String(inputEl.value || "");
          if (settings.requireNonEmpty && !value.trim()) {
            setPromptError(settings.requiredMessage || "This field is required.");
            inputEl.focus();
            return;
          }

          if (typeof settings.validatePrompt === "function") {
            let validationResult = true;
            try {
              validationResult = await settings.validatePrompt(value);
            } catch {
              validationResult = "Could not validate input.";
            }

            if (validationResult !== true) {
              setPromptError(
                typeof validationResult === "string" && validationResult
                  ? validationResult
                  : "Invalid value.",
              );
              inputEl.focus();
              inputEl.select();
              return;
            }
          }

          cleanup();
          resolve(value);
          return;
        }

        cleanup();
        resolve(true);
      };

      closeBtn.addEventListener("click", onClose);
      cancelBtn.addEventListener("click", onCancel);
      confirmBtn.addEventListener("click", onConfirm);
      document.addEventListener("keydown", onKeyDown);
    });
  }

  async function showAlert(message, title) {
    await openAdminDialog({
      type: "alert",
      title: title || "Notice",
      message,
      confirmText: "OK",
    });
  }

  async function showConfirm(message, title, confirmText) {
    const accepted = await openAdminDialog({
      type: "confirm",
      title: title || "Confirm",
      message,
      confirmText: confirmText || "Confirm",
      cancelText: "Cancel",
    });
    return Boolean(accepted);
  }

  async function showPrompt(message, options) {
    const promptOptions = options || {};
    return openAdminDialog({
      type: "prompt",
      title: promptOptions.title || "Input",
      message,
      confirmText: promptOptions.confirmText || "Save",
      cancelText: promptOptions.cancelText || "Cancel",
      inputLabel: promptOptions.inputLabel || "Value",
      inputType: promptOptions.inputType || "text",
      initialValue: promptOptions.initialValue || "",
      placeholder: promptOptions.placeholder || "",
      requireNonEmpty: Boolean(promptOptions.requireNonEmpty),
      requiredMessage: promptOptions.requiredMessage || "",
      errorText: promptOptions.errorText || "",
      validatePrompt: typeof promptOptions.validatePrompt === "function" ? promptOptions.validatePrompt : null,
    });
  }

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
        applicationAvailability: true,
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

  function resolveCachedAdminFromAuthState() {
    const authState = readStoredJson(localStorage, adminAuthStorageKey, null);
    const cachedAdmin = authState && typeof authState === "object" ? authState.admin : null;
    if (!cachedAdmin || typeof cachedAdmin !== "object") {
      return null;
    }

    if (!cachedAdmin.id || !cachedAdmin.username) {
      return null;
    }

    return {
      id: cachedAdmin.id,
      username: cachedAdmin.username,
      isMainAdmin: Boolean(cachedAdmin.isMainAdmin),
      permissions: normalizePermissions(cachedAdmin.permissions),
    };
  }

  function updateLocalAdminUser(userId, applyChanges) {
    const users = ensureLocalAdminUsers();
    const index = users.findIndex((entry) => entry.id === userId);
    if (index < 0) {
      return null;
    }

    const current = users[index];
    const next = applyChanges(current);
    if (!next) {
      return null;
    }

    users[index] = next;
    writeStoredJson(localStorage, localAdminUsersKey, users);
    return next;
  }

  function normalizePermissions(raw) {
    const entry = raw || {};
    return {
      applications: Boolean(entry.applications),
      applicationAvailability: Boolean(entry.applicationAvailability),
      websiteMaintenance: Boolean(entry.websiteMaintenance),
      subscriptions: Boolean(entry.subscriptions || entry.giftSubscriptions),
      permissions: Boolean(entry.permissions),
    };
  }

  function readLocalSubscriptionsStore() {
    const store = readStoredJson(localStorage, localSubscriptionsKey, { current: [], ended: [] });
    return {
      current: Array.isArray(store.current) ? store.current : [],
      ended: Array.isArray(store.ended) ? store.ended : [],
    };
  }

  function writeLocalSubscriptionsStore(nextStore) {
    writeStoredJson(localStorage, localSubscriptionsKey, {
      current: Array.isArray(nextStore.current) ? nextStore.current : [],
      ended: Array.isArray(nextStore.ended) ? nextStore.ended : [],
    });
  }

  function readLocalApplicationAvailability() {
    return readStoredJson(localStorage, localApplicationAvailabilityKey, {});
  }

  function writeLocalApplicationAvailability(nextValue) {
    writeStoredJson(localStorage, localApplicationAvailabilityKey, nextValue || {});
  }

  function normalizeApplicationAvailability(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const normalized = {};

    applicationForms.forEach(function (form) {
      const key = String(form?.key || "").trim();
      if (!key) {
        return;
      }
      const current = source[key];
      normalized[key] = current === undefined ? true : Boolean(current);
    });

    return normalized;
  }

  function isApplicationFormOpen(formKey) {
    if (!formKey) {
      return true;
    }
    if (state.applicationAvailability[formKey] === undefined) {
      return true;
    }
    return Boolean(state.applicationAvailability[formKey]);
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

  function canAccessTab(tabKey) {
    if (!state.admin) {
      return false;
    }

    if (state.admin.isMainAdmin) {
      return true;
    }

    if (tabKey === "permissions") {
      return Boolean(state.admin.permissions?.permissions);
    }

    if (tabKey === "applications") {
      return Boolean(state.admin.permissions?.applications);
    }

    if (tabKey === "application-access") {
      return Boolean(state.admin.permissions?.applicationAvailability);
    }

    if (tabKey === "subscriptions") {
      return Boolean(state.admin.permissions?.subscriptions);
    }

    return false;
  }

  function renderAdminAccessControls() {
    const maintenanceSection = document.querySelector(".admin-maintenance-toggle");
    const canManageMaintenance = hasPermission("websiteMaintenance");

    if (maintenanceSection) {
      const shouldShowMaintenance = Boolean(state.admin) && (state.admin.isMainAdmin || canManageMaintenance);
      maintenanceSection.style.display = shouldShowMaintenance ? "" : "none";
    }

    tabs.forEach((tab) => {
      const tabKey = tab.getAttribute("data-admin-tab");
      const shouldShow = canAccessTab(tabKey);
      tab.style.display = shouldShow ? "" : "none";
    });

    panels.forEach((panel) => {
      const panelKey = panel.getAttribute("data-admin-panel");
      const shouldShow = canAccessTab(panelKey);
      panel.style.display = shouldShow ? "" : "none";
    });

    if (!state.initialTabSet) {
      const preferredTabKey = ["application-access", "applications", "permissions", "subscriptions"].find(function (tabKey) {
        return canAccessTab(tabKey);
      }) || null;
      setActiveTab(preferredTabKey);
      state.initialTabSet = true;
      return;
    }

    const activeTabKey = tabs.find(function (tab) {
      return tab.classList.contains("active");
    })?.getAttribute("data-admin-tab") || null;

    if (activeTabKey && canAccessTab(activeTabKey)) {
      setActiveTab(activeTabKey);
      return;
    }

    const firstVisibleTab = tabs.find((tab) => canAccessTab(tab.getAttribute("data-admin-tab")));
    setActiveTab(firstVisibleTab ? firstVisibleTab.getAttribute("data-admin-tab") : null);
  }

  function setActiveTab(tabKey) {
    const resolvedTabKey = tabKey && canAccessTab(tabKey)
      ? tabKey
      : tabs.find((tab) => canAccessTab(tab.getAttribute("data-admin-tab")))?.getAttribute("data-admin-tab") || null;

    tabs.forEach((tab) => {
      const isActive = tab.getAttribute("data-admin-tab") === resolvedTabKey;
      tab.classList.toggle("active", isActive);
    });
    panels.forEach((panel) => {
      const isActive = panel.getAttribute("data-admin-panel") === resolvedTabKey;
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

  function durationLabel(value) {
    const map = {
      lifetime: "Lifetime",
      "1m": "1 Month",
      "3m": "3 Months",
      "6m": "6 Months",
      "12m": "12 Months",
    };
    return map[value] || "Custom";
  }

  function calculateRenewalDate(duration) {
    if (duration === "lifetime") {
      return null;
    }

    const monthsMap = {
      "1m": 1,
      "3m": 3,
      "6m": 6,
      "12m": 12,
    };
    const months = monthsMap[duration] || 0;
    if (!months) {
      return null;
    }

    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toISOString();
  }

  function setSubscriptionGiftMessage(message, kind) {
    if (!subscriptionGiftMessage) {
      return;
    }
    subscriptionGiftMessage.textContent = message || "";
    subscriptionGiftMessage.classList.remove("error", "success");
    if (kind) {
      subscriptionGiftMessage.classList.add(kind);
    }
  }

  function formatSteamIdentity(raw) {
    const steamId = String(raw?.steamId || "").trim();
    const steamName = String(raw?.steamName || "").trim();

    if (steamName && steamId) {
      return `${steamName} (${steamId})`;
    }

    return steamName || steamId || "Unknown Steam User";
  }

  function buildGiftCandidates() {
    const map = new Map();

    const pushCandidate = function (raw) {
      if (!raw) {
        return;
      }

      const steamId = String(raw.steamId || "").trim();
      const steamName = String(raw.steamName || "").trim();
      const discordId = String(raw.discordId || "").trim();
      const discordName = String(raw.discordName || "").trim();
      const fallbackName = String(raw.name || raw.displayName || "").trim();
      const displayName = steamName || steamId || discordName || fallbackName;

      if (!displayName && !steamId && !discordId) {
        return;
      }

      const key = `${steamId.toLowerCase()}|${discordId.toLowerCase()}|${displayName.toLowerCase()}`;
      if (map.has(key)) {
        return;
      }

      map.set(key, {
        steamId,
        steamName,
        discordId,
        discordName,
        displayName,
      });
    };

    state.applications.forEach(function (application) {
      pushCandidate(application?.applicant || null);
    });

    const subscriptions = [
      ...(Array.isArray(state.subscriptions.current) ? state.subscriptions.current : []),
      ...(Array.isArray(state.subscriptions.ended) ? state.subscriptions.ended : []),
    ];
    subscriptions.forEach(function (entry) {
      pushCandidate(entry);
    });

    return Array.from(map.values()).sort(function (a, b) {
      return a.displayName.localeCompare(b.displayName);
    });
  }

  function findGiftCandidate(query) {
    const normalized = String(query || "").trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return state.giftCandidates.find(function (candidate) {
      const fields = [
        candidate.displayName,
        candidate.steamId,
        candidate.steamName,
        candidate.discordId,
        candidate.discordName,
      ];
      return fields.some(function (field) {
        return String(field || "").toLowerCase() === normalized;
      });
    }) || null;
  }

  function renderGiftSearchOptions() {
    if (!subscriptionGiftSearchList) {
      return;
    }

    state.giftCandidates = buildGiftCandidates();
    subscriptionGiftSearchList.innerHTML = state.giftCandidates.map(function (candidate) {
      const labels = [];
      if (candidate.steamId) {
        labels.push(`Steam: ${candidate.steamId}`);
      }
      if (candidate.discordId) {
        labels.push(`Discord: ${candidate.discordId}`);
      }
      const suffix = labels.length ? ` (${labels.join(" | ")})` : "";
      const value = candidate.displayName || candidate.steamId || candidate.discordId;
      return `<option value="${value}">${value}${suffix}</option>`;
    }).join("");
  }

  async function requestJson(url, options) {
    const requestOptions = options || {};
    const timeoutMs = Number.isFinite(requestOptions.timeoutMs)
      ? Math.max(800, Number(requestOptions.timeoutMs))
      : 8000;
    const { timeoutMs: _timeoutMs, ...fetchOptions } = requestOptions;
    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    let response;
    try {
      response = await fetch(url, {
        credentials: "include",
        ...fetchOptions,
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("Request timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

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
      sessionMetaEl.textContent = "No staff session.";
      if (changeUsernameBtn) {
        changeUsernameBtn.style.display = "none";
      }
      renderAdminAccessControls();
      return;
    }

    sessionMetaEl.textContent = `Logged in as ${state.admin.username}`;

    if (changeUsernameBtn) {
      const isMainAdmin = Boolean(state.admin.isMainAdmin);
      changeUsernameBtn.style.display = isMainAdmin ? "" : "none";
      changeUsernameBtn.disabled = !isMainAdmin;
      changeUsernameBtn.title = isMainAdmin ? "Change main admin username" : "";
    }

    renderAdminAccessControls();
  }

  function renderUsers() {
    if (!adminUsersList) {
      return;
    }

    if (!hasPermission("permissions")) {
      adminUsersList.innerHTML = '<p class="admin-empty">You do not have staff permissions access.</p>';
      return;
    }

    if (!state.users.length) {
      adminUsersList.innerHTML = '<p class="admin-empty">No staff logins found.</p>';
      return;
    }

    adminUsersList.innerHTML = state.users.map(function (user) {
      const perms = normalizePermissions(user.permissions);
      const isSelfManagedProfile = Boolean(state.admin && user.id === state.admin.id && !user.isMainAdmin);
      return `
        <article class="admin-user-card${isSelfManagedProfile ? " admin-user-card-readonly" : ""}" data-user-id="${user.id}">
          <div class="admin-user-head">
            <h3>${user.username}${user.isMainAdmin ? " (Main)" : ""}</h3>
            <p>Profile access controls</p>
          </div>
          ${user.isMainAdmin ? '<p class="admin-user-main-note">Main admin has all permissions enabled.</p>' : `
          <ul class="admin-user-permission-list">
            <li><label class="admin-user-permission-item"><input data-action="set-permission" data-permission="applications" type="checkbox" ${perms.applications ? "checked" : ""} ${isSelfManagedProfile ? "disabled" : ""} /><span>Applications</span></label></li>
            <li><label class="admin-user-permission-item"><input data-action="set-permission" data-permission="applicationAvailability" type="checkbox" ${perms.applicationAvailability ? "checked" : ""} ${isSelfManagedProfile ? "disabled" : ""} /><span>Toggle Apps</span></label></li>
            <li><label class="admin-user-permission-item"><input data-action="set-permission" data-permission="websiteMaintenance" type="checkbox" ${perms.websiteMaintenance ? "checked" : ""} ${isSelfManagedProfile ? "disabled" : ""} /><span>Maintenance</span></label></li>
            <li><label class="admin-user-permission-item"><input data-action="set-permission" data-permission="subscriptions" type="checkbox" ${perms.subscriptions ? "checked" : ""} ${isSelfManagedProfile ? "disabled" : ""} /><span>Subscriptions</span></label></li>
            <li><label class="admin-user-permission-item"><input data-action="set-permission" data-permission="permissions" type="checkbox" ${perms.permissions ? "checked" : ""} ${isSelfManagedProfile ? "disabled" : ""} /><span>Permissions</span></label></li>
          </ul>`}
          ${isSelfManagedProfile ? '<p class="admin-empty">You can view your own permissions but cannot edit them.</p>' : ""}
          <div class="admin-user-actions">
            ${user.isMainAdmin ? "" : `<button class="btn btn-ghost" data-action="set-password" type="button" ${isSelfManagedProfile ? "disabled" : ""}>Reset Password</button>`}
            ${user.isMainAdmin ? "" : `<button class="btn btn-danger" data-action="delete" type="button" ${isSelfManagedProfile ? "disabled" : ""}>Delete Profile</button>`}
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
          <p><strong>Applicant:</strong> ${formatSteamIdentity(app.applicant)}</p>
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

  function renderApplicationAvailability() {
    if (!adminApplicationAvailabilityList) {
      return;
    }

    if (!hasPermission("applicationAvailability")) {
      adminApplicationAvailabilityList.innerHTML = '<p class="admin-empty">You do not have Toggle Apps permission.</p>';
      return;
    }

    adminApplicationAvailabilityList.innerHTML = applicationForms.length
      ? applicationForms.map(function (form) {
        const isOpen = isApplicationFormOpen(form.key);
        const statusClass = isOpen ? "app-form-status-open" : "app-form-status-closed";
        return `
          <article class="admin-application-card admin-availability-item" data-form-key="${form.key}">
            <div>
              <h4>${form.title || form.key}</h4>
              <p>${form.description || "Application visibility control."}</p>
            </div>
            <div class="admin-inline-controls">
              <span class="app-form-status-badge ${statusClass}">${isOpen ? "Open" : "Closed"}</span>
              <button class="btn ${isOpen ? "btn-danger" : "btn-ghost app-open-action-btn"}" data-action="toggle-form-open" type="button">${isOpen ? "Close" : "Open"}</button>
            </div>
          </article>
        `;
      }).join("")
      : '<p class="admin-empty">No application forms are configured.</p>';
  }

  function renderSubscriptions() {
    if (!currentSubscriptionsList || !endedSubscriptionsList) {
      return;
    }

    const canViewSubscriptions = hasPermission("subscriptions");
    const canGiftSubscriptions = hasPermission("subscriptions");

    if (!canViewSubscriptions && !canGiftSubscriptions) {
      currentSubscriptionsList.innerHTML = '<p class="admin-empty">You do not have subscriptions access.</p>';
      endedSubscriptionsList.innerHTML = '<p class="admin-empty">You do not have subscriptions access.</p>';
      if (subscriptionGiftForm) {
        subscriptionGiftForm.style.display = "none";
      }
      return;
    }

    if (subscriptionGiftForm) {
      subscriptionGiftForm.style.display = canGiftSubscriptions ? "grid" : "none";
    }
    if (subscriptionGiftSearch) {
      subscriptionGiftSearch.disabled = !canGiftSubscriptions;
    }
    if (subscriptionGiftTier) {
      subscriptionGiftTier.disabled = !canGiftSubscriptions;
    }
    if (subscriptionGiftDuration) {
      subscriptionGiftDuration.disabled = !canGiftSubscriptions;
    }
    if (subscriptionGiftSubmitBtn) {
      subscriptionGiftSubmitBtn.disabled = !canGiftSubscriptions;
    }

    renderGiftSearchOptions();

    if (!canViewSubscriptions) {
      currentSubscriptionsList.innerHTML = '<p class="admin-empty">You do not have subscriptions view permission.</p>';
      endedSubscriptionsList.innerHTML = '<p class="admin-empty">You do not have subscriptions view permission.</p>';
      return;
    }

    const current = Array.isArray(state.subscriptions.current) ? state.subscriptions.current : [];
    const ended = Array.isArray(state.subscriptions.ended) ? state.subscriptions.ended : [];

    currentSubscriptionsList.innerHTML = current.length
      ? current.map(function (entry) {
        return `<article class="admin-subscription-card"><h3>${formatSteamIdentity(entry)}</h3><p>Tier: ${entry.tier || "Unknown"}</p><p>Steam ID: ${entry.steamId || "Not set"}</p><p>Steam Username: ${entry.steamName || "Not set"}</p><p>Duration: ${entry.lifetime ? "Lifetime" : durationLabel(entry.duration)}</p><p>Renews: ${entry.lifetime ? "Lifetime" : formatDate(entry.renewsAt)}</p><p>Amount: ${entry.amount || "Not set"}</p></article>`;
      }).join("")
      : '<p class="admin-empty">No current subscriptions.</p>';

    endedSubscriptionsList.innerHTML = ended.length
      ? ended.map(function (entry) {
        return `<article class="admin-subscription-card"><h3>${formatSteamIdentity(entry)}</h3><p>Tier: ${entry.tier || "Unknown"}</p><p>Steam ID: ${entry.steamId || "Not set"}</p><p>Steam Username: ${entry.steamName || "Not set"}</p><p>Ended: ${formatDate(entry.endedAt)}</p><p>Amount: ${entry.amount || "Not set"}</p></article>`;
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
    const sessionAdmin = resolveLocalAdminFromSession();
    const cachedAdmin = resolveCachedAdminFromAuthState();
    const optimisticAdmin = sessionAdmin || cachedAdmin;

    if (optimisticAdmin) {
      state.admin = optimisticAdmin;
      state.localMode = Boolean(sessionAdmin);
      renderAdminMeta();
    }

    try {
      const payload = await requestJson(adminSessionUrl, { timeoutMs: 1200 });
      state.admin = payload.admin || null;
      state.localMode = false;
      renderAdminMeta();
      return;
    } catch {
      if (!sessionAdmin) {
        throw new Error("Admin session not found.");
      }
    }
  }

  async function loadSessionWithRetry(attempts) {
    const maxAttempts = Number.isFinite(attempts) ? Math.max(1, attempts) : 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await loadSession();
        return true;
      } catch {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => {
              setTimeout(resolve, 80 * attempt);
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

    if (adminUsersList && !adminUsersList.children.length) {
      adminUsersList.innerHTML = '<p class="admin-empty">Loading staff profiles...</p>';
    }

    const payload = await requestJson(`${apiBaseUrl}/admin/users`, { timeoutMs: 1800 });
    state.users = Array.isArray(payload.users) ? payload.users : [];
    renderUsers();
  }

  async function loadApplications() {
    if (!hasPermission("applications") && !hasPermission("applicationAvailability")) {
      state.applications = [];
      state.applicationAvailability = normalizeApplicationAvailability(readLocalApplicationAvailability());
      renderApplications();
      renderApplicationAvailability();
      return;
    }

    state.applicationAvailability = normalizeApplicationAvailability(readLocalApplicationAvailability());

    if (state.localMode) {
      state.applications = [];
      renderApplications();
      renderApplicationAvailability();
      return;
    }

    if (!hasPermission("applications")) {
      state.applications = [];
      renderApplications();
      renderApplicationAvailability();
      return;
    }

    const search = applicationSearchEl ? String(applicationSearchEl.value || "").trim() : "";
    const params = new URLSearchParams({
      source: state.source,
      search,
    });

    if (adminApplicationsList && !adminApplicationsList.children.length) {
      adminApplicationsList.innerHTML = '<p class="admin-empty">Loading applications...</p>';
    }

    const payload = await requestJson(`${apiBaseUrl}/admin/applications?${params.toString()}`, { timeoutMs: 1800 });
    state.applications = Array.isArray(payload.applications) ? payload.applications : [];
    renderApplications();
    renderApplicationAvailability();
  }

  async function loadSubscriptions() {
    if (!hasPermission("subscriptions")) {
      state.subscriptions = { current: [], ended: [] };
      renderSubscriptions();
      return;
    }

    if (state.localMode) {
      state.subscriptions = readLocalSubscriptionsStore();
      renderSubscriptions();
      return;
    }

    if (!hasPermission("subscriptions")) {
      state.subscriptions = { current: [], ended: [] };
      renderSubscriptions();
      return;
    }

    if (currentSubscriptionsList && !currentSubscriptionsList.children.length) {
      currentSubscriptionsList.innerHTML = '<p class="admin-empty">Loading subscriptions...</p>';
    }
    if (endedSubscriptionsList && !endedSubscriptionsList.children.length) {
      endedSubscriptionsList.innerHTML = '<p class="admin-empty">Loading subscriptions...</p>';
    }

    const payload = await requestJson(`${apiBaseUrl}/admin/subscriptions`, { timeoutMs: 1800 });
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

    const payload = await requestJson(`${apiBaseUrl}/admin/settings`, { timeoutMs: 1800 });
    state.settings = payload.settings || { maintenanceMode: false };
    writeStoredJson(localStorage, localAdminSettingsKey, {
      maintenanceMode: Boolean(state.settings?.maintenanceMode),
      updatedAt: state.settings?.updatedAt || new Date().toISOString(),
      updatedBy: state.settings?.updatedBy || state.admin?.username || "remote",
    });
    renderMaintenance();
  }

  async function boot() {
    state.applicationAvailability = normalizeApplicationAvailability(readLocalApplicationAvailability());
    renderApplicationAvailability();

    const cachedSettings = readStoredJson(localStorage, localAdminSettingsKey, { maintenanceMode: false });
    state.settings = {
      maintenanceMode: Boolean(cachedSettings?.maintenanceMode),
    };
    renderMaintenance();

    const hasSession = await loadSessionWithRetry(2);
    if (!hasSession) {
      if (sessionMetaEl) {
        sessionMetaEl.textContent = "Admin session not found. Log in again to continue.";
      }

      if (typeof window.openAdminLoginModal === "function") {
        window.openAdminLoginModal();
      }

      return;
    }

    loadSettings().catch(function () {
      renderMaintenance();
    });

    loadUsers().catch(function () {
      renderUsers();
    });

    loadApplications().catch(function () {
      renderApplications();
      renderApplicationAvailability();
    });

    loadSubscriptions().catch(function () {
      renderSubscriptions();
    });
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
      if (state.localMode) {
        const localUsers = ensureLocalAdminUsers();
        const current = localUsers.find((entry) => entry.id === state.admin?.id);
        if (!current) {
          await showAlert("Staff login required.", "Session");
          return;
        }

        const currentPasswordLocal = await showPrompt("Enter your current password.", {
          title: "Change Password",
          inputType: "password",
          confirmText: "Next",
          requireNonEmpty: true,
          validatePrompt: function (value) {
            if (String(current.password || "") !== String(value)) {
              return "Incorrect password.";
            }
            return true;
          },
        });
        if (!currentPasswordLocal) {
          return;
        }

        const newPasswordLocal = await showPrompt("Enter your new password.", {
          title: "Change Password",
          inputType: "password",
          confirmText: "Update",
        });
        if (!newPasswordLocal) {
          return;
        }

        updateLocalAdminUser(current.id, function (entry) {
          return {
            ...entry,
            password: String(newPasswordLocal),
          };
        });
        await showAlert("Password changed.", "Success");
        return;
      }

      const currentPassword = await showPrompt("Enter your current password.", {
        title: "Change Password",
        inputType: "password",
        confirmText: "Next",
        requireNonEmpty: true,
        validatePrompt: async function (value) {
          try {
            await requestJson(`${apiBaseUrl}/admin/verify-current-password`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentPassword: value }),
            });
            return true;
          } catch (error) {
            const message = String(error?.message || "");
            if (message.toLowerCase().includes("current password is incorrect")) {
              return "Incorrect password.";
            }
            return message || "Could not verify current password.";
          }
        },
      });
      if (!currentPassword) {
        return;
      }

      const newPassword = await showPrompt("Enter your new password.", {
        title: "Change Password",
        inputType: "password",
        confirmText: "Update",
      });
      if (!newPassword) {
        return;
      }

      try {
        await requestJson(`${apiBaseUrl}/admin/change-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        await showAlert("Password changed.", "Success");
      } catch (error) {
        await showAlert(error.message || "Could not change password.", "Error");
      }
    });
  }

  if (changeUsernameBtn) {
    changeUsernameBtn.addEventListener("click", async function () {
      if (!state.admin || !state.admin.isMainAdmin) {
        await showAlert("Only the main admin can change username.", "Access Denied");
        return;
      }

      const username = await showPrompt("Enter a new username for the main admin.", {
        title: "Change Username",
        inputLabel: "Username",
        confirmText: "Update",
      });
      if (!username) {
        return;
      }

      if (state.localMode) {
        const nextUsername = String(username).trim();
        if (!nextUsername) {
          await showAlert("Username is required.", "Change Username");
          return;
        }

        const localUsers = ensureLocalAdminUsers();
        const alreadyUsed = localUsers.some(function (entry) {
          return entry.id !== state.admin.id && String(entry.username || "").toLowerCase() === nextUsername.toLowerCase();
        });
        if (alreadyUsed) {
          await showAlert("Username already exists.", "Change Username");
          return;
        }

        updateLocalAdminUser(state.admin.id, function (entry) {
          return {
            ...entry,
            username: nextUsername,
          };
        });

        state.admin = {
          ...state.admin,
          username: nextUsername,
        };
        renderAdminMeta();
        await loadUsers();
        await showAlert("Username changed.", "Success");
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
        await showAlert("Username changed.", "Success");
      } catch (error) {
        await showAlert(error.message || "Could not change username.", "Error");
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
        writeStoredJson(localStorage, localAdminSettingsKey, {
          maintenanceMode: Boolean(maintenanceToggle.checked),
          updatedAt: new Date().toISOString(),
          updatedBy: state.admin?.username || "remote",
        });
        await loadSettings();
      } catch (error) {
        await showAlert(error.message || "Could not update maintenance mode.", "Error");
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
          applicationAvailability: formData.get("applicationAvailability") === "on",
          websiteMaintenance: formData.get("websiteMaintenance") === "on",
          subscriptions: formData.get("subscriptions") === "on",
          permissions: formData.get("permissions") === "on",
        },
      };

      if (state.localMode) {
        if (!payload.username || !payload.password) {
          await showAlert("Username and password are required.", "Create Login");
          return;
        }

        const localUsers = ensureLocalAdminUsers();
        const duplicate = localUsers.some(function (entry) {
          return String(entry.username || "").toLowerCase() === payload.username.toLowerCase();
        });
        if (duplicate) {
          await showAlert("Username already exists.", "Create Login");
          return;
        }

        localUsers.push({
          id: `local-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          username: payload.username,
          password: payload.password,
          isMainAdmin: false,
          permissions: normalizePermissions(payload.permissions),
        });
        writeStoredJson(localStorage, localAdminUsersKey, localUsers);
        createAdminUserForm.reset();
        await loadUsers();
        return;
      }

      try {
        await requestJson(`${apiBaseUrl}/admin/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        createAdminUserForm.reset();
        await loadUsers();
      } catch (error) {
        await showAlert(error.message || "Could not create staff login.", "Error");
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

      if (state.admin && target.id === state.admin.id && !target.isMainAdmin) {
        await showAlert("You can view your own permissions but cannot edit your profile from this panel.", "Access Denied");
        return;
      }

      const action = button.getAttribute("data-action");

      if (state.localMode) {
        if (action === "delete") {
          if (!(await showConfirm("Delete this staff profile?", "Delete Profile", "Delete"))) {
            return;
          }

          if (target.isMainAdmin) {
            await showAlert("Main admin profile cannot be deleted.", "Delete Profile");
            return;
          }

          const localUsers = ensureLocalAdminUsers().filter(function (entry) {
            return entry.id !== userId;
          });
          writeStoredJson(localStorage, localAdminUsersKey, localUsers);
          await loadUsers();
          return;
        }

        if (action === "set-password") {
          const newPassword = await showPrompt("Enter a new password for this profile.", {
            title: "Reset Password",
            inputLabel: "New Password",
            inputType: "password",
            confirmText: "Reset",
          });
          if (!newPassword) {
            return;
          }

          updateLocalAdminUser(userId, function (entry) {
            return {
              ...entry,
              password: String(newPassword),
            };
          });
          await loadUsers();
          return;
        }
      }

      if (action === "delete") {
        if (!(await showConfirm("Delete this staff profile?", "Delete Profile", "Delete"))) {
          return;
        }
        await requestJson(`${apiBaseUrl}/admin/users/${encodeURIComponent(userId)}`, {
          method: "DELETE",
        }).catch(function (error) {
          showAlert(error.message || "Could not delete staff profile.", "Error");
        });
        await loadUsers();
        return;
      }

      if (action === "set-password") {
        const newPassword = await showPrompt("Enter a new password for this profile.", {
          title: "Reset Password",
          inputLabel: "New Password",
          inputType: "password",
          confirmText: "Reset",
        });
        if (!newPassword) {
          return;
        }
        await requestJson(`${apiBaseUrl}/admin/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword }),
        }).catch(function (error) {
          showAlert(error.message || "Could not reset password.", "Error");
        });
        await loadUsers();
        return;
      }
    });

    adminUsersList.addEventListener("change", async function (event) {
      const checkbox = event.target.closest('input[data-action="set-permission"]');
      const card = event.target.closest("[data-user-id]");
      if (!checkbox || !card) {
        return;
      }

      const userId = card.getAttribute("data-user-id");
      const target = state.users.find(function (entry) {
        return entry.id === userId;
      });
      if (!target || target.isMainAdmin) {
        checkbox.checked = true;
        return;
      }

      if (state.admin && target.id === state.admin.id) {
        const permissions = normalizePermissions(target.permissions);
        checkbox.checked = Boolean(permissions[checkbox.getAttribute("data-permission")]);
        await showAlert("You can view your own permissions but cannot edit them.", "Access Denied");
        return;
      }

      const permissionKey = checkbox.getAttribute("data-permission");
      if (!["applications", "applicationAvailability", "websiteMaintenance", "subscriptions", "permissions"].includes(permissionKey)) {
        return;
      }

      const permissions = normalizePermissions(target.permissions);
      permissions[permissionKey] = Boolean(checkbox.checked);

      if (state.localMode) {
        updateLocalAdminUser(userId, function (entry) {
          return {
            ...entry,
            permissions,
          };
        });
        await loadUsers();
        return;
      }

      await requestJson(`${apiBaseUrl}/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      }).catch(function (error) {
        showAlert(error.message || "Could not update permissions.", "Error");
      });
      await loadUsers();
    });
  }

  if (subscriptionGiftForm) {
    subscriptionGiftForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!hasPermission("subscriptions")) {
        await showAlert("You do not have Subscriptions permission.", "Access Denied");
        return;
      }

      const query = String(subscriptionGiftSearch?.value || "").trim();
      const tier = String(subscriptionGiftTier?.value || "").trim();
      const duration = String(subscriptionGiftDuration?.value || "").trim();

      if (!query || !tier || !duration) {
        setSubscriptionGiftMessage("Steam/Discord, tier, and duration are required.", "error");
        return;
      }

      const candidate = findGiftCandidate(query);
      const recipientName = candidate?.steamName || candidate?.steamId || candidate?.displayName || query;
      const payload = {
        recipientQuery: query,
        steamId: candidate?.steamId || "",
        steamName: candidate?.steamName || recipientName,
        discordId: candidate?.discordId || "",
        discordName: candidate?.discordName || recipientName,
        tier,
        duration,
      };

      try {
        if (state.localMode) {
          const localStore = readLocalSubscriptionsStore();
          const entry = {
            id: `local-gift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: payload.steamName || payload.discordName || recipientName,
            steamId: payload.steamId,
            steamName: payload.steamName,
            discordId: payload.discordId,
            discordName: payload.discordName,
            tier,
            duration,
            lifetime: duration === "lifetime",
            renewsAt: calculateRenewalDate(duration),
            amount: "Gifted",
            giftedBy: state.admin?.username || "staff",
            giftedAt: new Date().toISOString(),
          };

          localStore.current.unshift(entry);
          writeLocalSubscriptionsStore(localStore);
          state.subscriptions = localStore;
          setSubscriptionGiftMessage(`Gifted ${tier} to ${entry.name}.`, "success");
          subscriptionGiftForm.reset();
          await loadSubscriptions();
          return;
        }

        await requestJson(`${apiBaseUrl}/admin/subscriptions/gift`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSubscriptionGiftMessage(`Gifted ${tier} to ${recipientName}.`, "success");
        subscriptionGiftForm.reset();
        await loadSubscriptions();
      } catch (error) {
        setSubscriptionGiftMessage(error.message || "Could not gift subscription.", "error");
      }
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

  if (adminApplicationAvailabilityList) {
    adminApplicationAvailabilityList.addEventListener("click", async function (event) {
      const button = event.target.closest("button[data-action='toggle-form-open']");
      const availabilityCard = event.target.closest("[data-form-key]");
      if (!button || !availabilityCard) {
        return;
      }

      if (!hasPermission("applicationAvailability")) {
        await showAlert("You do not have Toggle Apps permission.", "Access Denied");
        return;
      }

      const formKey = availabilityCard.getAttribute("data-form-key") || "";
      if (!formKey) {
        return;
      }

      const nextMap = {
        ...state.applicationAvailability,
        [formKey]: !isApplicationFormOpen(formKey),
      };
      writeLocalApplicationAvailability(nextMap);
      state.applicationAvailability = normalizeApplicationAvailability(nextMap);
      renderApplicationAvailability();
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

      if (!hasPermission("applications")) {
        await showAlert("You do not have Applications moderation permission.", "Access Denied");
        return;
      }

      try {
        if (action === "accept" || action === "deny") {
          await requestJson(`${apiBaseUrl}/admin/applications/${encodeURIComponent(appId)}/decision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: action === "accept" ? "accepted" : "denied", note: "" }),
          });
        } else if (action === "reply") {
          const message = await showPrompt("Enter your reply message.", {
            title: "Reply To Application",
            inputLabel: "Reply Message",
            confirmText: "Send",
          });
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
          if (!(await showConfirm("Delete this archived application permanently?", "Delete Application", "Delete"))) {
            return;
          }
          await requestJson(`${apiBaseUrl}/admin/applications/${encodeURIComponent(appId)}`, {
            method: "DELETE",
          });
        }

        await loadApplications();
      } catch (error) {
        await showAlert(error.message || "Could not update application.", "Error");
      }
    });
  }

  boot();
})();
