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
const serverStatusUrl = window.BLOODLINE_SERVER_STATUS_URL || "";
const queueJoinUrl = window.BLOODLINE_QUEUE_JOIN_URL || "";
let steamLoginModal = null;
let accountDropdownState = null;

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

function readSubscriptionState() {
  try {
    return JSON.parse(localStorage.getItem("bloodline-subscription")) || {};
  } catch {
    return {};
  }
}

function formatDateValue(dateValue) {
  if (!dateValue) {
    return "Not scheduled";
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return "Not scheduled";
  }

  return parsed.toLocaleDateString();
}

function createAccountDropdown() {
  const headerActions = document.querySelector(".header-actions");
  if (!headerActions) {
    return null;
  }

  const existingDropdown = document.getElementById("headerAccountDropdown");
  if (existingDropdown) {
    return {
      dropdownEl: existingDropdown,
      steamStatusEl: document.getElementById("headerSteamLinkStatus"),
      discordStatusEl: document.getElementById("headerDiscordLinkStatus"),
      appStatusEl: document.getElementById("headerApplicationStatus"),
      subTierEl: document.getElementById("headerSubscriptionTier"),
      subRenewalEl: document.getElementById("headerSubscriptionRenewal"),
      subNextPaymentEl: document.getElementById("headerSubscriptionNextPayment"),
    };
  }

  const wrapper = document.createElement("div");
  wrapper.className = "header-account-menu";
  wrapper.innerHTML = `
    <div class="header-account-dropdown" id="headerAccountDropdown" aria-hidden="true">
      <section class="account-dropdown-block">
        <h4>Account</h4>
        <p>Steam: <span id="headerSteamLinkStatus" class="status-unlinked">Unlinked</span></p>
        <p>Discord: <span id="headerDiscordLinkStatus" class="status-unlinked">Unlinked</span></p>
      </section>
      <section class="account-dropdown-block">
        <h4>Application Status</h4>
        <p id="headerApplicationStatus">Link Steam + Discord to load your applications.</p>
        <div class="account-dropdown-inline-actions">
          <a class="btn btn-ghost" href="applications.html">View Applications</a>
        </div>
      </section>
      <section class="account-dropdown-block">
        <h4>Manage Subscription</h4>
        <p id="headerSubscriptionTier">No current subscription</p>
        <p id="headerSubscriptionRenewal">Auto renew: Not scheduled</p>
        <p id="headerSubscriptionNextPayment">Next payment: Not scheduled</p>
        <div class="account-dropdown-inline-actions">
          <a class="btn btn-primary" href="store.html?manage=upgrade">Upgrade</a>
          <a class="btn btn-ghost" href="store.html?manage=downgrade">Downgrade</a>
          <a class="btn btn-ghost" href="store.html?manage=cancel">Cancel</a>
        </div>
      </section>
    </div>
  `;

  headerActions.appendChild(wrapper);

  const dropdown = wrapper.querySelector("#headerAccountDropdown");
  if (!dropdown) {
    return null;
  }

  document.addEventListener("click", (event) => {
    const clickedTrigger = [...loginTriggers].some((trigger) => trigger.contains(event.target));
    if (!wrapper.contains(event.target) && !clickedTrigger) {
      dropdown.classList.remove("is-open");
      dropdown.setAttribute("aria-hidden", "true");
      loginTriggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
    }
  });

  return {
    dropdownEl: dropdown,
    steamStatusEl: wrapper.querySelector("#headerSteamLinkStatus"),
    discordStatusEl: wrapper.querySelector("#headerDiscordLinkStatus"),
    appStatusEl: wrapper.querySelector("#headerApplicationStatus"),
    subTierEl: wrapper.querySelector("#headerSubscriptionTier"),
    subRenewalEl: wrapper.querySelector("#headerSubscriptionRenewal"),
    subNextPaymentEl: wrapper.querySelector("#headerSubscriptionNextPayment"),
  };
}

async function updateAccountDropdownDetails() {
  if (!accountDropdownState) {
    return;
  }

  const state = readAccountState();
  const hasSteam = Boolean(state.steamId || state.steamName);
  const hasDiscord = Boolean(state.discordId || state.discordName);

  if (accountDropdownState.steamStatusEl) {
    accountDropdownState.steamStatusEl.textContent = hasSteam ? "Linked" : "Unlinked";
    accountDropdownState.steamStatusEl.className = hasSteam ? "status-linked" : "status-unlinked";
  }

  if (accountDropdownState.discordStatusEl) {
    accountDropdownState.discordStatusEl.textContent = hasDiscord ? "Linked" : "Unlinked";
    accountDropdownState.discordStatusEl.className = hasDiscord ? "status-linked" : "status-unlinked";
  }

  const subscription = readSubscriptionState();
  if (accountDropdownState.subTierEl) {
    accountDropdownState.subTierEl.textContent = subscription.tier
      ? `Current tier: ${subscription.tier}`
      : "No current subscription";
  }

  if (accountDropdownState.subRenewalEl) {
    accountDropdownState.subRenewalEl.textContent = `Auto renew: ${formatDateValue(subscription.renewsAt)}`;
  }

  if (accountDropdownState.subNextPaymentEl) {
    accountDropdownState.subNextPaymentEl.textContent = `Next payment: ${formatDateValue(subscription.nextPaymentAt)}`;
  }

  if (!hasSteam || !hasDiscord) {
    if (accountDropdownState.appStatusEl) {
      accountDropdownState.appStatusEl.textContent = "Link Steam + Discord to load your applications.";
    }
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/my-applications`, {
      credentials: "include",
    });

    if (!response.ok) {
      if (accountDropdownState.appStatusEl) {
        accountDropdownState.appStatusEl.textContent = "Could not load application statuses right now.";
      }
      return;
    }

    const payload = await response.json();
    const applications = Array.isArray(payload.applications) ? payload.applications : [];
    const pending = applications.filter((entry) => entry.status === "pending").length;
    const accepted = applications.filter((entry) => entry.status === "accepted").length;
    const denied = applications.filter((entry) => entry.status === "denied").length;

    if (accountDropdownState.appStatusEl) {
      accountDropdownState.appStatusEl.textContent = `Pending: ${pending} | Accepted: ${accepted} | Denied: ${denied}`;
    }
  } catch {
    if (accountDropdownState.appStatusEl) {
      accountDropdownState.appStatusEl.textContent = "Could not load application statuses right now.";
    }
  }
}

function closeAccountDropdown() {
  if (!accountDropdownState?.dropdownEl) {
    return;
  }

  accountDropdownState.dropdownEl.classList.remove("is-open");
  accountDropdownState.dropdownEl.setAttribute("aria-hidden", "true");
  loginTriggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
}

function toggleAccountDropdown() {
  if (!accountDropdownState?.dropdownEl) {
    return;
  }

  const isOpen = accountDropdownState.dropdownEl.classList.toggle("is-open");
  accountDropdownState.dropdownEl.setAttribute("aria-hidden", String(!isOpen));
  loginTriggers.forEach((trigger) => trigger.setAttribute("aria-expanded", String(isOpen)));
}

function initConnectPanel() {
  const connectButton = document.getElementById("connectQueueButton");
  const populationEl = document.getElementById("serverPopulation");
  const queueEl = document.getElementById("serverQueueCount");
  const statusEl = document.getElementById("serverStatusText");

  if (!connectButton || !populationEl || !queueEl || !statusEl) {
    return;
  }

  if (queueJoinUrl) {
    connectButton.setAttribute("href", queueJoinUrl);
    connectButton.removeAttribute("aria-disabled");
  } else {
    connectButton.setAttribute("href", "#");
    connectButton.setAttribute("aria-disabled", "true");
    statusEl.textContent = "Queue URL is not configured yet.";
  }

  if (!serverStatusUrl) {
    populationEl.textContent = "Unavailable";
    queueEl.textContent = "Unavailable";
    return;
  }

  fetch(serverStatusUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error("status-unavailable");
      }
      return response.json();
    })
    .then((payload) => {
      const players = payload.players ?? payload.online ?? payload.population ?? 0;
      const maxPlayers = payload.maxPlayers ?? payload.max ?? payload.capacity ?? "?";
      const queue = payload.queue ?? payload.queued ?? payload.queueCount ?? 0;
      const rawStatus = payload.status ?? payload.serverStatus ?? payload.state ?? payload.online ?? payload.isOnline;
      const isOnline = rawStatus === true || rawStatus === "online" || rawStatus === "running" || rawStatus === "up";

      populationEl.textContent = `${players}/${maxPlayers}`;
      queueEl.textContent = String(queue);
      statusEl.textContent = isOnline ? "Online" : "Offline";
    })
    .catch(() => {
      populationEl.textContent = "Unavailable";
      queueEl.textContent = "Unavailable";
      statusEl.textContent = "Offline";
    });
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
    });
    renderAccountState();
    updateAccountDropdownDetails();
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

    const state = readAccountState();
    const hasSteam = Boolean(state.steamId || state.steamName);

    if (hasSteam && accountDropdownState?.dropdownEl) {
      toggleAccountDropdown();
      return;
    }

    openSteamLoginModal();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSteamLoginModal();
    closeAccountDropdown();
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
    updateAccountDropdownDetails();
  }
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) {
    return;
  }

  if (event.data?.type === "bloodline-auth-updated") {
    syncAccountFromBackend();
    renderAccountState();
    updateAccountDropdownDetails();
  }
});

renderAccountState();
accountDropdownState = createAccountDropdown();
updateAccountDropdownDetails();
initConnectPanel();

if (!handleAuthCallbackPage()) {
  syncAccountFromBackend();
}
