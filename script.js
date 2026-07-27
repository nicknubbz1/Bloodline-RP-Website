const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const toggleBtn = document.querySelector(".menu-toggle");
const nav = document.getElementById("navMenu");

if (toggleBtn && nav) {
  toggleBtn.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggleBtn.setAttribute("aria-expanded", "false");
    });
  });
}

const revealEls = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.18,
  }
);

revealEls.forEach((el) => observer.observe(el));

const accountStorageKey = "bloodline-account";
const discordButton = document.getElementById("discordButton");
const accountNameEl = document.getElementById("accountName");
const steamStatusEl = document.getElementById("steamStatus");
const discordStatusEl = document.getElementById("discordStatus");
const discordDisplayEl = document.getElementById("discordDisplay");
const loginTriggers = document.querySelectorAll(".login-trigger");
const steamAuthButtons = document.querySelectorAll('[data-auth-provider="steam"]');
const discordAuthButtons = document.querySelectorAll('[data-auth-provider="discord"]');
const authCallbackMessageEl = document.getElementById("authCallbackMessage");
const steamPopupUrl = window.BLOODLINE_STEAM_AUTH_URL || "http://localhost:3000/auth/steam";
const discordPopupUrl = window.BLOODLINE_DISCORD_AUTH_URL || "http://localhost:3000/auth/discord";
const authSessionUrl = window.BLOODLINE_AUTH_SESSION_URL || "http://localhost:3000/auth/session";
const apiBaseUrl = window.BLOODLINE_API_BASE_URL || "http://localhost:3000/api";
let steamLoginModal = null;

function openAuthPopup(url, popupName) {
  const popupWidth = 520;
  const popupHeight = 760;
  const left = window.screenX + Math.max(0, (window.outerWidth - popupWidth) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - popupHeight) / 2);
  const features = [
    `width=${popupWidth}`,
    `height=${popupHeight}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    "resizable=yes",
    "scrollbars=yes"
  ].join(",");

  const popup = window.open(url, popupName, features);
  if (popup) {
    popup.focus();
  }
}

function openSteamPopup() {
  openAuthPopup(steamPopupUrl, "bloodline-steam-login");
}

function openDiscordPopup() {
  openAuthPopup(discordPopupUrl, "bloodline-discord-login");
}

function ensureSteamLoginModal() {
  if (steamLoginModal) {
    return steamLoginModal;
  }

  steamLoginModal = document.createElement("div");
  steamLoginModal.className = "login-modal";
  steamLoginModal.setAttribute("aria-hidden", "true");
  steamLoginModal.innerHTML = `
    <div class="login-modal-card steam-login-card" role="dialog" aria-modal="true" aria-labelledby="steamLoginTitle">
      <button class="modal-close steam-modal-close" type="button" aria-label="Close login popup">Close</button>
      <div class="steam-login-mark">Bloodline RP</div>
      <h2 id="steamLoginTitle">Welcome Back</h2>
      <p class="steam-login-copy">Sign in with your Steam account to access your dashboard, manage applications, and connect Discord for your Bloodline identity.</p>
      <button class="steam-login-button" type="button">
        <span class="steam-icon" aria-hidden="true">●</span>
        <span>Login With Steam</span>
      </button>
      <p class="steam-login-note">We only use Steam for authentication. We never access your games, inventory, or personal data.</p>
    </div>
  `;

  document.body.appendChild(steamLoginModal);

  steamLoginModal.addEventListener("click", (event) => {
    if (event.target === steamLoginModal) {
      closeSteamLoginModal();
    }
  });

  const closeButton = steamLoginModal.querySelector(".steam-modal-close");
  if (closeButton) {
    closeButton.addEventListener("click", closeSteamLoginModal);
  }

  const steamButton = steamLoginModal.querySelector(".steam-login-button");
  if (steamButton) {
    steamButton.addEventListener("click", () => {
      openSteamPopup();
    });
  }

  return steamLoginModal;
}

function openSteamLoginModal() {
  const modal = ensureSteamLoginModal();
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  const steamButton = modal.querySelector(".steam-login-button");
  if (steamButton) {
    steamButton.focus();
  }
}

function closeSteamLoginModal() {
  if (!steamLoginModal) {
    return;
  }

  steamLoginModal.classList.remove("is-open");
  steamLoginModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function readAccountState() {
  try {
    return JSON.parse(localStorage.getItem(accountStorageKey)) || {};
  } catch {
    return {};
  }
}

function writeAccountState(nextState) {
  localStorage.setItem(accountStorageKey, JSON.stringify(nextState));
}

function mergeAccountState(nextPartialState) {
  const nextState = {
    ...readAccountState(),
    ...nextPartialState,
  };
  writeAccountState(nextState);
  return nextState;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAccountState() {
  const state = readAccountState();
  const steamName = state.steamName || "Awaiting Steam Login";
  const discordName = state.discordName || "Not Connected";
  const hasSteam = Boolean(state.steamName);
  const hasDiscord = Boolean(state.discordName);

  if (discordButton) {
    discordButton.disabled = !hasSteam;
  }

  discordAuthButtons.forEach((button) => {
    button.disabled = !hasSteam;
  });

  if (accountNameEl) {
    accountNameEl.textContent = steamName;
  }

  if (steamStatusEl) {
    steamStatusEl.textContent = hasSteam ? `Steam Connected: ${state.steamName}` : "Steam Pending";
  }

  if (discordStatusEl) {
    discordStatusEl.textContent = hasDiscord ? "Discord Connected" : "Discord Pending";
  }

  if (discordDisplayEl) {
    discordDisplayEl.textContent = discordName;
  }
}

async function syncAccountFromBackend() {
  try {
    const response = await fetch(authSessionUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    if (!payload.account) {
      return;
    }

    mergeAccountState({
      steamId: payload.account.steamId,
      steamName: payload.account.steamName,
      steamAvatar: payload.account.steamAvatar,
      discordId: payload.account.discordId,
      discordName: payload.account.discordName,
      discordUsername: payload.account.discordUsername,
      discordAvatar: payload.account.discordAvatar,
      isStaff: Boolean(payload.account.isStaff),
      staffRoleError: payload.account.staffRoleError || "",
    });
    renderAccountState();
  } catch {
    // Ignore backend sync issues when the auth server is not running.
  }
}

function handleAuthCallbackPage() {
  const currentPage = window.location.pathname.split("/").pop();
  if (currentPage !== "auth-callback.html") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const provider = params.get("provider");
  const status = params.get("status");
  const message = params.get("message");

  if (status === "success") {
    if (provider === "steam") {
      mergeAccountState({
        steamId: params.get("steamId") || "",
        steamName: params.get("steamName") || "Steam User",
        steamAvatar: params.get("steamAvatar") || "",
      });
    }

    if (provider === "discord") {
      mergeAccountState({
        discordId: params.get("discordId") || "",
        discordName: params.get("discordName") || params.get("discordUsername") || "Discord User",
        discordUsername: params.get("discordUsername") || "",
        discordAvatar: params.get("discordAvatar") || "",
        isStaff: params.get("isStaff") === "1",
      });
    }
  }

  if (authCallbackMessageEl) {
    authCallbackMessageEl.textContent = status === "success"
      ? `${provider === "steam" ? "Steam" : "Discord"} connected successfully. This popup will close automatically.`
      : message || "Authentication could not be completed.";
  }

  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type: "bloodline-auth-updated" }, window.location.origin);
    setTimeout(() => {
      window.close();
    }, 1000);
  } else {
    setTimeout(() => {
      window.location.href = "account.html";
    }, 1400);
  }

  return true;
}

loginTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    openSteamLoginModal();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSteamLoginModal();
  }
});

steamAuthButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openSteamPopup();
  });
});

discordAuthButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openDiscordPopup();
  });
});

window.addEventListener("storage", (event) => {
  if (event.key === accountStorageKey) {
    renderAccountState();
  }
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) {
    return;
  }

  if (event.data?.type === "bloodline-auth-updated") {
    syncAccountFromBackend();
    renderAccountState();
  }
});

renderAccountState();

if (!handleAuthCallbackPage()) {
  syncAccountFromBackend();
}

const staffPanelGateEl = document.getElementById("staffPanelGate");
const staffPanelAppEl = document.getElementById("staffPanelApp");
const staffPanelListEl = document.getElementById("staffApplicationList");
const staffPanelTypeFilterEl = document.getElementById("staffTypeFilter");
const staffPanelStatusFilterEl = document.getElementById("staffStatusFilter");
const staffPanelRefreshEl = document.getElementById("staffRefresh");
const staffPanelSearchEl = document.getElementById("staffSearch");
const staffPanelSearchButtonEl = document.getElementById("staffSearchButton");
const staffPanelDetailEl = document.getElementById("staffApplicationDetail");
const staffPanelReplyBoxEl = document.getElementById("staffReplyBox");
const staffPanelSendReplyEl = document.getElementById("staffSendReply");
const staffPanelAcceptEl = document.getElementById("staffAccept");
const staffPanelDenyEl = document.getElementById("staffDeny");
const staffPanelStatusMessageEl = document.getElementById("staffStatusMessage");

let staffApplicationCache = [];
let activeStaffApplicationId = "";

function setStaffPanelStatus(message, isError = false) {
  if (!staffPanelStatusMessageEl) {
    return;
  }

  staffPanelStatusMessageEl.textContent = message;
  staffPanelStatusMessageEl.classList.toggle("error", isError);
}

function getAppTypeLabel(type) {
  const labels = {
    server: "Server Applications",
    "public-safety": "Public Safety",
    "city-hall": "City Hall Applications",
    "business-gang": "Business And Gang Applications",
  };
  return labels[type] || type;
}

function renderStaffApplicationList() {
  if (!staffPanelListEl) {
    return;
  }

  if (!staffApplicationCache.length) {
    staffPanelListEl.innerHTML = '<p class="staff-empty">No applications match the current filters.</p>';
    return;
  }

  staffPanelListEl.innerHTML = staffApplicationCache
    .map((application) => {
      const isActive = application.id === activeStaffApplicationId;
      return `
        <button class="staff-app-item${isActive ? " is-active" : ""}" type="button" data-staff-app-id="${escapeHtml(application.id)}">
          <strong>${escapeHtml(application.title)}</strong>
          <span>${escapeHtml(getAppTypeLabel(application.type))}</span>
          <span class="status-pill">${escapeHtml(application.status)}</span>
        </button>
      `;
    })
    .join("");

  staffPanelListEl.querySelectorAll("[data-staff-app-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeStaffApplicationId = button.getAttribute("data-staff-app-id") || "";
      renderStaffApplicationList();
      renderStaffApplicationDetail();
    });
  });
}

function renderStaffApplicationDetail() {
  if (!staffPanelDetailEl) {
    return;
  }

  const application = staffApplicationCache.find((entry) => entry.id === activeStaffApplicationId);
  if (!application) {
    staffPanelDetailEl.innerHTML = '<p class="staff-empty">Select an application from the list to view details.</p>';
    return;
  }

  const replies = Array.isArray(application.replies) ? application.replies : [];
  const repliesMarkup = replies.length
    ? replies
      .map((reply) => `
        <article class="staff-reply">
          <header>
            <strong>${escapeHtml(reply.authorName || "Staff")}</strong>
            <span>${escapeHtml(new Date(reply.createdAt).toLocaleString())}</span>
          </header>
          <p>${escapeHtml(reply.message || "")}</p>
        </article>
      `)
      .join("")
    : '<p class="staff-empty">No replies yet.</p>';

  const reviewedBy = application.reviewedBy
    ? `<p><strong>Last decision:</strong> ${escapeHtml(application.status)} by ${escapeHtml(application.reviewedBy.name || "Staff")}</p>`
    : "";

  staffPanelDetailEl.innerHTML = `
    <article class="staff-detail-card">
      <header>
        <h3>${escapeHtml(application.title)}</h3>
        <span class="status-pill">${escapeHtml(application.status)}</span>
      </header>
      <p><strong>Category:</strong> ${escapeHtml(getAppTypeLabel(application.type))}</p>
      <p><strong>Applicant:</strong> ${escapeHtml(application.applicant?.steamName || "Unknown")} (${escapeHtml(application.applicant?.discordName || "No Discord")})</p>
      <p><strong>Submitted:</strong> ${escapeHtml(new Date(application.createdAt).toLocaleString())}</p>
      <p class="staff-body">${escapeHtml(application.body || "")}</p>
      ${reviewedBy}
      <section class="staff-replies">
        <h4>Staff Replies</h4>
        ${repliesMarkup}
      </section>
    </article>
  `;
}

async function loadStaffApplications() {
  if (!staffPanelListEl) {
    return;
  }

  const params = new URLSearchParams();
  const selectedType = staffPanelTypeFilterEl?.value || "all";
  const selectedStatus = staffPanelStatusFilterEl?.value || "all";
  const searchQuery = (staffPanelSearchEl?.value || "").trim();

  if (selectedType !== "all") {
    params.set("type", selectedType);
  }
  if (selectedStatus !== "all") {
    params.set("status", selectedStatus);
  }
  if (searchQuery) {
    params.set("search", searchQuery);
  }

  setStaffPanelStatus("Loading applications...");

  try {
    const response = await fetch(`${apiBaseUrl}/staff/applications?${params.toString()}`, {
      credentials: "include",
    });

    const payload = await response.json();
    if (!response.ok) {
      setStaffPanelStatus(payload.error || "Could not load staff applications.", true);
      return;
    }

    staffApplicationCache = Array.isArray(payload.applications) ? payload.applications : [];
    if (!staffApplicationCache.find((entry) => entry.id === activeStaffApplicationId)) {
      activeStaffApplicationId = staffApplicationCache[0]?.id || "";
    }

    renderStaffApplicationList();
    renderStaffApplicationDetail();
    setStaffPanelStatus(`Loaded ${staffApplicationCache.length} application(s).`);
  } catch {
    setStaffPanelStatus("Staff API is unavailable. Start the auth server and try again.", true);
  }
}

async function sendStaffReply() {
  const message = (staffPanelReplyBoxEl?.value || "").trim();
  if (!activeStaffApplicationId) {
    setStaffPanelStatus("Select an application before sending a reply.", true);
    return;
  }

  if (!message) {
    setStaffPanelStatus("Reply message cannot be empty.", true);
    return;
  }

  setStaffPanelStatus("Sending reply...");

  try {
    const response = await fetch(`${apiBaseUrl}/staff/applications/${encodeURIComponent(activeStaffApplicationId)}/replies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ message }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setStaffPanelStatus(payload.error || "Reply could not be sent.", true);
      return;
    }

    if (staffPanelReplyBoxEl) {
      staffPanelReplyBoxEl.value = "";
    }

    setStaffPanelStatus("Reply posted.");
    await loadStaffApplications();
  } catch {
    setStaffPanelStatus("Reply failed. Staff API may be unavailable.", true);
  }
}

async function decideApplication(decision) {
  if (!activeStaffApplicationId) {
    setStaffPanelStatus("Select an application before updating status.", true);
    return;
  }

  const note = (staffPanelReplyBoxEl?.value || "").trim();
  setStaffPanelStatus(`Marking as ${decision}...`);

  try {
    const response = await fetch(`${apiBaseUrl}/staff/applications/${encodeURIComponent(activeStaffApplicationId)}/decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ decision, note }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setStaffPanelStatus(payload.error || "Decision could not be saved.", true);
      return;
    }

    setStaffPanelStatus(`Application marked as ${decision}.`);
    await loadStaffApplications();
  } catch {
    setStaffPanelStatus("Decision request failed. Staff API may be unavailable.", true);
  }
}

async function initStaffPanel() {
  if (!staffPanelGateEl || !staffPanelAppEl) {
    return;
  }

  try {
    const response = await fetch(authSessionUrl, {
      credentials: "include",
    });

    const payload = await response.json();
    const account = payload.account || null;

    if (!account?.steamId || !account?.discordId) {
      staffPanelGateEl.hidden = false;
      staffPanelAppEl.hidden = true;
      setStaffPanelStatus("Link Steam and Discord first to continue.", true);
      return;
    }

    if (!account.isStaff) {
      staffPanelGateEl.hidden = false;
      staffPanelAppEl.hidden = true;
      const reason = account.staffRoleError || "Your Discord account does not currently have the configured staff role.";
      const gateMessage = staffPanelGateEl.querySelector("p");
      if (gateMessage) {
        gateMessage.textContent = reason;
      }
      setStaffPanelStatus(reason, true);
      return;
    }

    staffPanelGateEl.hidden = true;
    staffPanelAppEl.hidden = false;
    await loadStaffApplications();
  } catch {
    staffPanelGateEl.hidden = false;
    staffPanelAppEl.hidden = true;
    setStaffPanelStatus("Could not verify session. Ensure the auth backend is running.", true);
  }

  if (staffPanelTypeFilterEl) {
    staffPanelTypeFilterEl.addEventListener("change", () => {
      loadStaffApplications();
    });
  }

  if (staffPanelStatusFilterEl) {
    staffPanelStatusFilterEl.addEventListener("change", () => {
      loadStaffApplications();
    });
  }

  if (staffPanelRefreshEl) {
    staffPanelRefreshEl.addEventListener("click", () => {
      loadStaffApplications();
    });
  }

  if (staffPanelSearchButtonEl) {
    staffPanelSearchButtonEl.addEventListener("click", () => {
      loadStaffApplications();
    });
  }

  if (staffPanelSearchEl) {
    staffPanelSearchEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadStaffApplications();
      }
    });
  }

  if (staffPanelSendReplyEl) {
    staffPanelSendReplyEl.addEventListener("click", () => {
      sendStaffReply();
    });
  }

  if (staffPanelAcceptEl) {
    staffPanelAcceptEl.addEventListener("click", () => {
      decideApplication("accepted");
    });
  }

  if (staffPanelDenyEl) {
    staffPanelDenyEl.addEventListener("click", () => {
      decideApplication("denied");
    });
  }
}

initStaffPanel();

const appTabButtons = document.querySelectorAll("[data-app-tab]");
const appTabPanels = document.querySelectorAll("[data-app-panel]");

if (appTabButtons.length && appTabPanels.length) {
  appTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-app-tab");

      appTabButtons.forEach((tabButton) => {
        const isActive = tabButton === button;
        tabButton.classList.toggle("is-active", isActive);
        tabButton.setAttribute("aria-selected", String(isActive));
      });

      appTabPanels.forEach((panel) => {
        const isMatch = panel.getAttribute("data-app-panel") === target;
        panel.classList.toggle("is-active", isMatch);
      });
    });
  });
}
