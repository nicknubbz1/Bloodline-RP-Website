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
const staffOnlyNavLinks = document.querySelectorAll("[data-staff-only-nav]");
const authCallbackMessageEl = document.getElementById("authCallbackMessage");
const steamPopupUrl = window.BLOODLINE_STEAM_AUTH_URL || "http://localhost:3000/auth/steam";
const discordPopupUrl = window.BLOODLINE_DISCORD_AUTH_URL || "http://localhost:3000/auth/discord";
const authSessionUrl = window.BLOODLINE_AUTH_SESSION_URL || "http://localhost:3000/auth/session";
const apiBaseUrl = window.BLOODLINE_API_BASE_URL || "http://localhost:3000/api";
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  if (!headerActions || document.getElementById("headerAccountDropdown")) {
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "header-account-menu";
  wrapper.innerHTML = `
    <button class="header-account-trigger" id="headerAccountTrigger" type="button" aria-expanded="false">Account</button>
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

  const trigger = wrapper.querySelector("#headerAccountTrigger");
  const dropdown = wrapper.querySelector("#headerAccountDropdown");
  if (!trigger || !dropdown) {
    return null;
  }

  trigger.addEventListener("click", () => {
    const isOpen = dropdown.classList.toggle("is-open");
    trigger.setAttribute("aria-expanded", String(isOpen));
    dropdown.setAttribute("aria-hidden", String(!isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) {
      dropdown.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      dropdown.setAttribute("aria-hidden", "true");
    }
  });

  return {
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

      populationEl.textContent = `${players}/${maxPlayers}`;
      queueEl.textContent = String(queue);
      statusEl.textContent = "Live status updated.";
    })
    .catch(() => {
      populationEl.textContent = "Unavailable";
      queueEl.textContent = "Unavailable";
      statusEl.textContent = "Could not reach live status endpoint.";
    });
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

  const canSeeStaffPanel = Boolean(state.isStaff);
  staffOnlyNavLinks.forEach((link) => {
    link.hidden = !canSeeStaffPanel;
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
      isStaff: Boolean(payload.account.isStaff),
      staffRoleError: payload.account.staffRoleError || "",
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
const applicationFormSelectEl = document.getElementById("applicationFormSelect");
const applicationBuilderFormEl = document.getElementById("applicationBuilderForm");
const applicationBuilderFieldsEl = document.getElementById("applicationBuilderFields");
const applicationBuilderMessageEl = document.getElementById("applicationBuilderMessage");
const storeSubscribeButtons = document.querySelectorAll(".store-subscribe-btn");
const storeCheckoutModal = document.getElementById("storeCheckoutModal");
const storeCheckoutClose = document.getElementById("storeCheckoutClose");
const storeCheckoutTier = document.getElementById("storeCheckoutTier");
const storeCheckoutPrice = document.getElementById("storeCheckoutPrice");
const storeCheckoutHelp = document.getElementById("storeCheckoutHelp");
const storePayWithStripe = document.getElementById("storePayWithStripe");
const storePayWithPaypal = document.getElementById("storePayWithPaypal");
const storePayWithCashapp = document.getElementById("storePayWithCashapp");
const unifiedCheckoutUrl = window.BLOODLINE_UNIFIED_CHECKOUT_URL || "";
const stripeCheckoutUrl = window.BLOODLINE_STRIPE_CHECKOUT_URL || "";
const paypalCheckoutUrl = window.BLOODLINE_PAYPAL_CHECKOUT_URL || "";
const cashappCheckoutUrl = window.BLOODLINE_CASHAPP_CHECKOUT_URL || "";

let staffApplicationCache = [];
let activeStaffApplicationId = "";
const applicationFormDefinitions = Array.isArray(window.BLOODLINE_APPLICATION_FORMS)
  ? window.BLOODLINE_APPLICATION_FORMS
  : [];

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

function setApplicationBuilderMessage(message, kind = "") {
  if (!applicationBuilderMessageEl) {
    return;
  }

  applicationBuilderMessageEl.textContent = message;
  applicationBuilderMessageEl.classList.remove("error", "success");
  if (kind) {
    applicationBuilderMessageEl.classList.add(kind);
  }
}

function setPaymentLink(element, baseUrl, tier, price) {
  if (!element) {
    return;
  }

  if (!baseUrl) {
    element.setAttribute("href", "#");
    element.setAttribute("aria-disabled", "true");
    return;
  }

  element.removeAttribute("aria-disabled");

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("tier", tier);
    url.searchParams.set("price", price);
    element.setAttribute("href", url.toString());
  } catch {
    element.setAttribute("href", baseUrl);
  }
}

function openStoreCheckoutModal(tier, price) {
  if (!storeCheckoutModal) {
    return;
  }

  if (storeCheckoutTier) {
    storeCheckoutTier.textContent = tier;
  }

  if (storeCheckoutPrice) {
    storeCheckoutPrice.textContent = price;
  }

  const stripeUrl = unifiedCheckoutUrl || stripeCheckoutUrl;
  const paypalUrl = unifiedCheckoutUrl || paypalCheckoutUrl;
  const cashappUrl = unifiedCheckoutUrl || cashappCheckoutUrl;

  setPaymentLink(storePayWithStripe, stripeUrl, tier, price);
  setPaymentLink(storePayWithPaypal, paypalUrl, tier, price);
  setPaymentLink(storePayWithCashapp, cashappUrl, tier, price);

  if (storeCheckoutHelp) {
    const hasAnyLink = Boolean(unifiedCheckoutUrl || stripeCheckoutUrl || paypalCheckoutUrl || cashappCheckoutUrl);
    storeCheckoutHelp.textContent = hasAnyLink
      ? (unifiedCheckoutUrl
        ? "All methods route into the same checkout destination account."
        : "Select a payment method to continue your subscription.")
      : "No payment links are configured yet. Add them in auth-config.js.";
  }

  storeCheckoutModal.classList.add("is-open");
  storeCheckoutModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeStoreCheckoutModal() {
  if (!storeCheckoutModal) {
    return;
  }

  storeCheckoutModal.classList.remove("is-open");
  storeCheckoutModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function initStoreCheckout() {
  if (!storeSubscribeButtons.length || !storeCheckoutModal) {
    return;
  }

  storeSubscribeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tier = button.getAttribute("data-tier") || "Supporter Tier";
      const price = button.getAttribute("data-price") || "Custom Price";
      openStoreCheckoutModal(tier, price);
    });
  });

  if (storeCheckoutClose) {
    storeCheckoutClose.addEventListener("click", () => {
      closeStoreCheckoutModal();
    });
  }

  storeCheckoutModal.addEventListener("click", (event) => {
    if (event.target === storeCheckoutModal) {
      closeStoreCheckoutModal();
    }
  });
}

function formatResponseValue(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
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

  const responseList = Array.isArray(application.responses) ? application.responses : [];
  const responseMarkup = responseList.length
    ? `
      <section class="staff-responses">
        <h4>Application Answers</h4>
        ${responseList.map((responseItem) => `
          <article class="staff-response-item">
            <strong>${escapeHtml(responseItem.label || "Question")}</strong>
            <p>${escapeHtml(responseItem.answer || "")}</p>
          </article>
        `).join("")}
      </section>
    `
    : `<p class="staff-body">${escapeHtml(application.body || "")}</p>`;

  staffPanelDetailEl.innerHTML = `
    <article class="staff-detail-card">
      <header>
        <h3>${escapeHtml(application.title)}</h3>
        <span class="status-pill">${escapeHtml(application.status)}</span>
      </header>
      <p><strong>Category:</strong> ${escapeHtml(getAppTypeLabel(application.type))}</p>
      <p><strong>Applicant:</strong> ${escapeHtml(application.applicant?.steamName || "Unknown")} (${escapeHtml(application.applicant?.discordName || "No Discord")})</p>
      <p><strong>Submitted:</strong> ${escapeHtml(new Date(application.createdAt).toLocaleString())}</p>
      ${responseMarkup}
      ${reviewedBy}
      <section class="staff-replies">
        <h4>Staff Replies</h4>
        ${repliesMarkup}
      </section>
    </article>
  `;
}

function renderApplicationBuilderFields() {
  if (!applicationFormSelectEl || !applicationBuilderFieldsEl) {
    return;
  }

  const selectedKey = applicationFormSelectEl.value;
  const selectedForm = applicationFormDefinitions.find((form) => form.key === selectedKey);

  if (!selectedForm) {
    applicationBuilderFieldsEl.innerHTML = "";
    return;
  }

  const fieldsMarkup = selectedForm.questions
    .map((question, index) => {
      const fieldId = `app-q-${question.id}-${index}`;
      const requiredMarker = question.required ? '<span class="app-required">*</span>' : "";
      const requiredAttribute = question.required ? "required" : "";

      if (question.kind === "textarea") {
        return `
          <div class="app-builder-field">
            <label for="${escapeHtml(fieldId)}">${escapeHtml(question.label)}${requiredMarker}</label>
            <textarea id="${escapeHtml(fieldId)}" name="${escapeHtml(question.id)}" data-question-label="${escapeHtml(question.label)}" rows="5" ${requiredAttribute}></textarea>
          </div>
        `;
      }

      if (question.kind === "yesno") {
        return `
          <div class="app-builder-field">
            <label for="${escapeHtml(fieldId)}">${escapeHtml(question.label)}${requiredMarker}</label>
            <select id="${escapeHtml(fieldId)}" name="${escapeHtml(question.id)}" data-question-label="${escapeHtml(question.label)}" ${requiredAttribute}>
              <option value="">Select one</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
        `;
      }

      return `
        <div class="app-builder-field">
          <label for="${escapeHtml(fieldId)}">${escapeHtml(question.label)}${requiredMarker}</label>
          <input id="${escapeHtml(fieldId)}" name="${escapeHtml(question.id)}" data-question-label="${escapeHtml(question.label)}" type="text" ${requiredAttribute} />
        </div>
      `;
    })
    .join("");

  applicationBuilderFieldsEl.innerHTML = fieldsMarkup;
}

async function submitApplicationBuilder(event) {
  event.preventDefault();

  if (!applicationFormSelectEl || !applicationBuilderFormEl || !applicationBuilderFieldsEl) {
    return;
  }

  const selectedForm = applicationFormDefinitions.find((form) => form.key === applicationFormSelectEl.value);
  if (!selectedForm) {
    setApplicationBuilderMessage("Select a valid application form first.", "error");
    return;
  }

  const state = readAccountState();
  if (!state.steamId || !state.discordId) {
    setApplicationBuilderMessage("Link Steam and Discord in Account Center before submitting.", "error");
    return;
  }

  const responses = [];
  let firstInvalidField = null;

  const fields = applicationBuilderFieldsEl.querySelectorAll("input, textarea, select");
  fields.forEach((field) => {
    const questionLabel = field.getAttribute("data-question-label") || field.name;
    const answer = formatResponseValue(field.value);
    const required = field.hasAttribute("required");

    if (required && !answer && !firstInvalidField) {
      firstInvalidField = field;
      return;
    }

    responses.push({
      id: field.name,
      label: questionLabel,
      answer,
    });
  });

  if (firstInvalidField) {
    firstInvalidField.focus();
    setApplicationBuilderMessage("Please complete all required fields.", "error");
    return;
  }

  setApplicationBuilderMessage("Submitting application...");

  try {
    const response = await fetch(`${apiBaseUrl}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        type: selectedForm.type,
        title: selectedForm.title,
        body: `${selectedForm.title} submitted through website form builder.`,
        formKey: selectedForm.key,
        responses,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setApplicationBuilderMessage(payload.error || "Application could not be submitted.", "error");
      return;
    }

    applicationBuilderFormEl.reset();
    renderApplicationBuilderFields();
    setApplicationBuilderMessage("Application submitted successfully. Staff can now review it in the staff panel.", "success");
  } catch {
    setApplicationBuilderMessage("Submission failed. Ensure the auth backend is online.", "error");
  }
}

function initApplicationBuilder() {
  if (!applicationFormSelectEl || !applicationBuilderFormEl || !applicationBuilderFieldsEl) {
    return;
  }

  if (!applicationFormDefinitions.length) {
    setApplicationBuilderMessage("No application forms are currently configured.", "error");
    return;
  }

  applicationFormSelectEl.innerHTML = applicationFormDefinitions
    .map((form) => `<option value="${escapeHtml(form.key)}">${escapeHtml(form.title)}</option>`)
    .join("");

  renderApplicationBuilderFields();

  applicationFormSelectEl.addEventListener("change", () => {
    renderApplicationBuilderFields();
  });

  applicationBuilderFormEl.addEventListener("submit", submitApplicationBuilder);
  setApplicationBuilderMessage("Complete all required fields, then submit directly from the website.");
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

  const currentPage = window.location.pathname.split("/").pop();
  const shouldRedirectIfUnauthorized = currentPage === "staff.html";

  try {
    const response = await fetch(authSessionUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      if (shouldRedirectIfUnauthorized) {
        window.location.replace("index.html");
      }
      return;
    }

    const payload = await response.json();
    const account = payload.account || null;

    mergeAccountState({
      steamId: account?.steamId || "",
      steamName: account?.steamName || "",
      steamAvatar: account?.steamAvatar || "",
      discordId: account?.discordId || "",
      discordName: account?.discordName || "",
      discordUsername: account?.discordUsername || "",
      discordAvatar: account?.discordAvatar || "",
      isStaff: Boolean(account?.isStaff),
      staffRoleError: account?.staffRoleError || "",
    });
    renderAccountState();

    if (!account?.steamId || !account?.discordId) {
      if (shouldRedirectIfUnauthorized) {
        window.location.replace("index.html");
      }
      return;
    }

    if (!account.isStaff) {
      if (shouldRedirectIfUnauthorized) {
        window.location.replace("index.html");
      }
      return;
    }

    staffPanelGateEl.hidden = true;
    staffPanelAppEl.hidden = false;
    await loadStaffApplications();
  } catch {
    if (shouldRedirectIfUnauthorized) {
      window.location.replace("index.html");
    }
    return;
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
initApplicationBuilder();
initStoreCheckout();

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
