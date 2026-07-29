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
const discordStatsUrl = window.BLOODLINE_DISCORD_STATS_URL || "http://localhost:3000/api/discord/stats";
const discordInviteUrl = window.BLOODLINE_DISCORD_INVITE_URL || "https://discord.gg/A3ZywNnpPU";
const storeCartStorageKey = "bloodline-store-cart";
let steamLoginModal = null;
let connectQueueModal = null;
let storeCartState = {
  isOpen: false,
  items: [],
  refs: null,
};
let connectQueueState = {
  statusText: "Offline",
  playersText: "-- / --",
  queuePositionText: "--",
  queueActionLabel: "Connect",
  queueActionEnabled: false,
  queueActionHref: queueJoinUrl,
};
let accountDropdownState = null;
const socialStats = {
  discord: "16,628 members · 3,054 online",
  youtube: "128K subscribers · 24 new videos",
  tiktok: "214K followers · 4.2M views",
  instagram: "96K followers · 14 new posts",
  x: "41K followers · 3.8K active",
};

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

function initSocialButtons() {
  const discordStatsEl = document.querySelector('[data-social-stat="discord"]');
  const discordLinkEl = document.querySelector('[data-social-platform="discord"]');

  const renderDiscordStats = (statsEl, membersText, onlineText) => {
    if (!statsEl) {
      return;
    }

    statsEl.classList.add("social-stats-discord");

    let membersEl = statsEl.querySelector("[data-discord-members]");
    let onlineEl = statsEl.querySelector("[data-discord-online]");

    if (!membersEl) {
      membersEl = document.createElement("span");
      membersEl.setAttribute("data-discord-members", "true");
      statsEl.appendChild(membersEl);
    }

    if (!onlineEl) {
      onlineEl = document.createElement("span");
      onlineEl.setAttribute("data-discord-online", "true");
      statsEl.appendChild(onlineEl);
    }

    membersEl.textContent = membersText;
    onlineEl.textContent = onlineText;
  };

  const setDiscordLinkState = (url) => {
    if (!discordLinkEl) {
      return;
    }

    const nextUrl = typeof url === "string" ? url.trim() : "";
    if (nextUrl) {
      discordLinkEl.setAttribute("href", nextUrl);
      discordLinkEl.removeAttribute("aria-disabled");
      discordLinkEl.setAttribute("target", "_blank");
      discordLinkEl.setAttribute("rel", "noopener noreferrer");
      return;
    }

    discordLinkEl.setAttribute("href", "#");
    discordLinkEl.setAttribute("aria-disabled", "true");
    discordLinkEl.removeAttribute("target");
    discordLinkEl.removeAttribute("rel");
  };

  const formatCount = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return "--";
    }
    return Math.round(numeric).toLocaleString("en-US");
  };

  setDiscordLinkState(discordInviteUrl);

  if (discordStatsEl && socialStats.discord) {
    const [defaultMembers, defaultOnline] = socialStats.discord.split("·").map((value) => value.trim());
    renderDiscordStats(discordStatsEl, defaultMembers || "-- members", defaultOnline || "-- online");
  }

  document.querySelectorAll("[data-social-stat]").forEach((el) => {
    const key = el.getAttribute("data-social-stat");
    if (key === "discord") {
      return;
    }
    if (key && socialStats[key]) {
      el.textContent = socialStats[key];
    }
  });

  if (discordStatsUrl && discordStatsEl) {
    fetch(discordStatsUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("discord-stats-unavailable");
        }
        return response.json();
      })
      .then((payload) => {
        const memberCount = formatCount(payload.memberCount);
        const onlineCount = formatCount(payload.onlineCount);
        renderDiscordStats(discordStatsEl, `${memberCount} members`, `${onlineCount} online`);

        if (typeof payload.inviteUrl === "string") {
          setDiscordLinkState(payload.inviteUrl);
        }
      })
      .catch(() => {
      });
  }

  document.querySelectorAll("[data-social-platform]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (link.getAttribute("href") === "#") {
        event.preventDefault();
      }
    });
  });
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

function ensureConnectQueueModal() {
  if (connectQueueModal) {
    return connectQueueModal;
  }

  connectQueueModal = document.createElement("div");
  connectQueueModal.className = "login-modal connect-modal";
  connectQueueModal.setAttribute("aria-hidden", "true");
  connectQueueModal.innerHTML = `
    <div class="login-modal-card connect-modal-card" role="dialog" aria-modal="true" aria-labelledby="connectQueueTitle">
      <button class="modal-close connect-modal-close" type="button" aria-label="Close queue popup">Close</button>
      <div class="steam-login-mark">Bloodline RP</div>
      <h2 id="connectQueueTitle">Connect Queue</h2>
      <div class="connect-modal-copy">
        <div class="connect-modal-status">
          <span class="connect-stat-label">Server Status</span>
          <strong id="connectQueueStatusText">Offline</strong>
        </div>
        <div class="connect-modal-status">
          <span class="connect-stat-label">Queue Position</span>
          <strong id="connectQueuePositionText">--</strong>
        </div>
        <p class="connect-modal-message" id="connectQueueMessage">Waiting for live status...</p>
        <div class="connect-modal-actions">
          <button class="connect-action" id="connectQueueModalAction" type="button">Connect</button>
          <button class="btn btn-ghost" type="button" data-connect-modal-close>Close</button>
        </div>
        <p class="connect-modal-note" id="connectQueueNote">This popup stays small and will only enable connect when you are next in line.</p>
      </div>
    </div>
  `;

  document.body.appendChild(connectQueueModal);

  connectQueueModal.addEventListener("click", (event) => {
    if (event.target === connectQueueModal) {
      closeConnectQueueModal();
    }
  });

  const closeButton = connectQueueModal.querySelector(".connect-modal-close");
  if (closeButton) {
    closeButton.addEventListener("click", closeConnectQueueModal);
  }

  const footerCloseButton = connectQueueModal.querySelector("[data-connect-modal-close]");
  if (footerCloseButton) {
    footerCloseButton.addEventListener("click", closeConnectQueueModal);
  }

  const actionButton = connectQueueModal.querySelector("#connectQueueModalAction");
  if (actionButton) {
    actionButton.addEventListener("click", () => {
      if (!connectQueueState.queueActionEnabled || !connectQueueState.queueActionHref) {
        return;
      }

      window.location.href = connectQueueState.queueActionHref;
    });
  }

  return connectQueueModal;
}

function closeConnectQueueModal() {
  if (!connectQueueModal) {
    return;
  }

  connectQueueModal.classList.remove("is-open");
  connectQueueModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function updateConnectQueueModal() {
  const modal = ensureConnectQueueModal();
  const statusEl = modal.querySelector("#connectQueueStatusText");
  const positionEl = modal.querySelector("#connectQueuePositionText");
  const messageEl = modal.querySelector("#connectQueueMessage");
  const noteEl = modal.querySelector("#connectQueueNote");
  const actionButton = modal.querySelector("#connectQueueModalAction");

  if (statusEl) {
    statusEl.textContent = connectQueueState.statusText;
  }
    statusEl.classList.toggle("status-online", connectQueueState.statusText === "Online");
    statusEl.classList.toggle("status-offline", connectQueueState.statusText === "Offline");

  if (positionEl) {
    positionEl.textContent = connectQueueState.queuePositionText;
  }

  if (messageEl) {
    messageEl.textContent = connectQueueState.messageText || "Waiting for live status...";
  }

  if (noteEl) {
    noteEl.textContent = connectQueueState.noteText || "This popup stays small and will only enable connect when you are next in line.";
  }

  if (actionButton) {
    actionButton.textContent = connectQueueState.queueActionLabel || "Connect";
    actionButton.disabled = !connectQueueState.queueActionEnabled;
    actionButton.setAttribute("aria-disabled", String(!connectQueueState.queueActionEnabled));
  }
}

function openConnectQueueModal() {
  const modal = ensureConnectQueueModal();
  updateConnectQueueModal();
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
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

  updateStoreCartAuthState();
}

function readStoreCartState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storeCartStorageKey));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoreCartState(items) {
  localStorage.setItem(storeCartStorageKey, JSON.stringify(items));
}

function extractPriceValue(priceText) {
  if (!priceText) {
    return 0;
  }

  const match = String(priceText).match(/[\d,]+(?:\.\d{1,2})?/);
  if (!match) {
    return 0;
  }

  const normalized = match[0].replace(/,/g, "");
  return Number.parseFloat(normalized) || 0;
}

function formatMonthlyPrice(value) {
  return `$${value.toFixed(2)} / month`;
}

function getPrimaryCheckoutUrl() {
  return window.BLOODLINE_UNIFIED_CHECKOUT_URL
    || window.BLOODLINE_STRIPE_CHECKOUT_URL
    || window.BLOODLINE_PAYPAL_CHECKOUT_URL
    || window.BLOODLINE_CASHAPP_CHECKOUT_URL
    || "";
}

function hasLoggedInAccount() {
  const state = readAccountState();
  return Boolean(state.steamId || state.steamName);
}

function updateStoreCartAuthState() {
  if (!storeCartState.refs?.checkoutButton) {
    return;
  }

  const isLoggedIn = hasLoggedInAccount();
  storeCartState.refs.checkoutButton.textContent = isLoggedIn ? "Checkout" : "Log in to check out";
}

function renderStoreCart() {
  if (!storeCartState.refs) {
    return;
  }

  const { itemsContainer, emptyEl, totalEl, countEl } = storeCartState.refs;
  const items = storeCartState.items;
  const total = items.reduce((sum, item) => sum + (item.value || 0), 0);

  itemsContainer.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = "store-cart-item";
    row.innerHTML = `
      <div>
        <p class="store-cart-item-tier">${item.tier}</p>
        <p class="store-cart-item-price">${item.priceLabel}</p>
      </div>
      <button class="store-cart-remove" type="button" data-remove-tier="${item.tier}">Remove</button>
    `;
    itemsContainer.appendChild(row);
  });

  if (items.length > 0) {
    countEl.hidden = false;
    countEl.textContent = String(items.length);
  } else {
    countEl.hidden = true;
    countEl.textContent = "";
  }
  totalEl.textContent = formatMonthlyPrice(total);
  emptyEl.hidden = items.length > 0;
  updateStoreCartAuthState();
}

function openStoreCartDrawer() {
  if (!storeCartState.refs?.drawer) {
    return;
  }

  storeCartState.isOpen = true;
  storeCartState.refs.drawer.classList.add("is-open");
  storeCartState.refs.drawer.setAttribute("aria-hidden", "false");
  if (storeCartState.refs.toggleButton) {
    storeCartState.refs.toggleButton.setAttribute("aria-expanded", "true");
  }
}

function closeStoreCartDrawer() {
  if (!storeCartState.refs?.drawer) {
    return;
  }

  storeCartState.isOpen = false;
  storeCartState.refs.drawer.classList.remove("is-open");
  storeCartState.refs.drawer.setAttribute("aria-hidden", "true");
  if (storeCartState.refs.toggleButton) {
    storeCartState.refs.toggleButton.setAttribute("aria-expanded", "false");
  }
}

function toggleStoreCartDrawer() {
  if (storeCartState.isOpen) {
    closeStoreCartDrawer();
    return;
  }
  openStoreCartDrawer();
}

function addTierToStoreCart(tier, priceLabel) {
  const existing = storeCartState.items.some((item) => item.tier === tier);
  if (existing) {
    openStoreCartDrawer();
    return;
  }

  storeCartState.items.push({
    tier,
    priceLabel,
    value: extractPriceValue(priceLabel),
  });
  writeStoreCartState(storeCartState.items);
  renderStoreCart();
  openStoreCartDrawer();
}

function removeTierFromStoreCart(tier) {
  storeCartState.items = storeCartState.items.filter((item) => item.tier !== tier);
  writeStoreCartState(storeCartState.items);
  renderStoreCart();
}

function initStoreCart() {
  const drawer = document.getElementById("storeCartDrawer");
  const toggleButton = document.getElementById("storeCartToggle");
  const closeButton = document.getElementById("storeCartClose");
  const backdrop = document.getElementById("storeCartBackdrop");
  const itemsContainer = document.getElementById("storeCartItems");
  const emptyEl = document.getElementById("storeCartEmpty");
  const totalEl = document.getElementById("storeCartTotal");
  const countEl = document.getElementById("storeCartCount");
  const checkoutButton = document.getElementById("storeCartCheckout");
  const subscribeButtons = document.querySelectorAll(".store-subscribe-btn");

  if (!drawer || !toggleButton || !itemsContainer || !emptyEl || !totalEl || !countEl || !checkoutButton || !subscribeButtons.length) {
    return;
  }

  storeCartState.refs = {
    drawer,
    toggleButton,
    closeButton,
    backdrop,
    itemsContainer,
    emptyEl,
    totalEl,
    countEl,
    checkoutButton,
  };

  storeCartState.items = readStoreCartState().map((item) => ({
    tier: item.tier,
    priceLabel: item.priceLabel,
    value: Number.isFinite(item.value) ? item.value : extractPriceValue(item.priceLabel),
  })).filter((item) => item.tier && item.priceLabel);

  renderStoreCart();

  toggleButton.addEventListener("click", (event) => {
    event.preventDefault();
    toggleStoreCartDrawer();
  });

  if (closeButton) {
    closeButton.addEventListener("click", closeStoreCartDrawer);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeStoreCartDrawer);
  }

  subscribeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tier = button.getAttribute("data-tier") || "Supporter";
      const priceLabel = button.getAttribute("data-price") || "$0 / month";
      addTierToStoreCart(tier, priceLabel);
    });
  });

  itemsContainer.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-tier]");
    if (!removeButton) {
      return;
    }
    const tier = removeButton.getAttribute("data-remove-tier");
    if (tier) {
      removeTierFromStoreCart(tier);
    }
  });

  checkoutButton.addEventListener("click", () => {
    if (!hasLoggedInAccount()) {
      openSteamLoginModal();
      return;
    }

    const checkoutUrl = getPrimaryCheckoutUrl();
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
    }
  });

  updateStoreCartAuthState();
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
  const statusEl = document.getElementById("serverStatusText");

  if (!connectButton || !populationEl || !statusEl) {
    return;
  }

  connectButton.addEventListener("click", (event) => {
    event.preventDefault();
    openConnectQueueModal();
  });

  if (!serverStatusUrl) {
    populationEl.textContent = "Unavailable";
    connectQueueState = {
      ...connectQueueState,
      statusText: "Offline",
      playersText: "Unavailable",
      queuePositionText: "Unavailable",
      messageText: "The live status endpoint is not configured yet.",
      noteText: "Queue access will enable once the server status feed is live.",
      queueActionLabel: "Connect",
      queueActionEnabled: false,
    };
    updateConnectQueueModal();
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
      const queuePosition = payload.queuePosition ?? payload.position ?? payload.place ?? payload.queueIndex ?? payload.queueSpot ?? payload.rank ?? null;
      const rawStatus = payload.status ?? payload.serverStatus ?? payload.state ?? payload.online ?? payload.isOnline;
      const isOnline = rawStatus === true || rawStatus === "online" || rawStatus === "running" || rawStatus === "up";
      const isNext = payload.next === true || payload.isNext === true || queuePosition === 1 || queuePosition === 0;
      const isIn = payload.in === true || payload.isIn === true || payload.connected === true || payload.ready === true;
      const actionEnabled = Boolean(queueJoinUrl && (isNext || isIn));

      connectQueueState = {
        ...connectQueueState,
        statusText: isOnline ? "Online" : "Offline",
        playersText: `${players}/${maxPlayers}`,
        queuePositionText: queuePosition === null || queuePosition === undefined ? `Queue: ${queue}` : (isNext ? "You're next" : queuePosition === 0 ? "You're in" : `#${queuePosition}`),
        messageText: isOnline
          ? (isIn ? "You're in. Connect now to join the server." : isNext ? "You're next in line. Keep this popup open and connect when ready." : `You're in queue behind ${queue} player${queue === 1 ? "" : "s"}.`)
          : "The server is currently offline.",
        noteText: isOnline
          ? (actionEnabled ? "Connect is enabled because you are next in line." : "The connect button will unlock when you reach the front of the queue.")
          : "Queue access will enable once the server comes back online.",
        queueActionLabel: actionEnabled ? "Connect Now" : "Connect",
        queueActionEnabled: actionEnabled,
        queueActionHref: queueJoinUrl,
      };

      populationEl.textContent = `${players}/${maxPlayers}`;
      statusEl.textContent = isOnline ? "Online" : "Offline";
      statusEl.classList.toggle("status-online", isOnline);
      statusEl.classList.toggle("status-offline", !isOnline);
      updateConnectQueueModal();
    })
    .catch(() => {
      populationEl.textContent = "Unavailable";
      statusEl.textContent = "Offline";
      statusEl.classList.remove("status-online");
      statusEl.classList.add("status-offline");
      connectQueueState = {
        ...connectQueueState,
        statusText: "Offline",
        playersText: "Unavailable",
        queuePositionText: "Unavailable",
        messageText: "Could not reach the live status endpoint.",
        noteText: "Queue access will enable once the status feed is available.",
        queueActionLabel: "Connect",
        queueActionEnabled: false,
      };
      updateConnectQueueModal();
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
    closeConnectQueueModal();
    closeStoreCartDrawer();
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
initSocialButtons();
initConnectPanel();
initStoreCart();

if (!handleAuthCallbackPage()) {
  syncAccountFromBackend();
}
