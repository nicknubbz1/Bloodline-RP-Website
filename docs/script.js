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
const accountApplicationsCacheKey = "bloodline-account-applications-cache";
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
const authLogoutUrl = window.BLOODLINE_AUTH_LOGOUT_URL || "http://localhost:3000/auth/logout";
const authSessionUrl = window.BLOODLINE_AUTH_SESSION_URL || "http://localhost:3000/auth/session";
const apiBaseUrl = window.BLOODLINE_API_BASE_URL || "http://localhost:3000/api";
const accountDashboardUrl = "account-dashboard.html";
const adminLoginUrl = window.BLOODLINE_ADMIN_LOGIN_URL || `${apiBaseUrl}/admin/login`;
const adminSessionUrl = window.BLOODLINE_ADMIN_SESSION_URL || `${apiBaseUrl}/admin/session`;
const siteStatusUrl = window.BLOODLINE_SITE_STATUS_URL || `${apiBaseUrl}/site-status`;
const serverStatusUrl = window.BLOODLINE_SERVER_STATUS_URL || "";
const forceServerOffline = true;
const queueJoinUrl = window.BLOODLINE_QUEUE_JOIN_URL || "";
const adminDashboardUrl = "admin.html?v=20260731n7";
const adminDashboardScriptVersion = "v=20260731n7";
const discordStatsUrl = window.BLOODLINE_DISCORD_STATS_URL || "http://localhost:3000/api/discord/stats";
const discordInviteUrl = window.BLOODLINE_DISCORD_INVITE_URL || "https://discord.gg/A3ZywNnpPU";
const storeCartStorageKey = "bloodline-store-cart";
const adminAuthStorageKey = "bloodline-admin-auth";
const adminApiTokenStorageKey = "bloodline-admin-api-token";
const localAdminUsersKey = "bloodline-local-admin-users";
const localAdminSessionKey = "bloodline-local-admin-session";
const localAdminSessionTempKey = "bloodline-local-admin-session-temp";
const localAdminSettingsKey = "bloodline-local-admin-settings";
const appAvailabilityStorageKey = "bloodline-application-form-availability";
let steamLoginModal = null;
let connectQueueModal = null;
let storeCartState = {
  isOpen: false,
  items: [],
  refs: null,
};
let connectQueueState = {
  statusText: "Offline",
  playersText: "0/0",
  queuePositionText: "In queue",
  queueCountText: "0/0",
  queueActionLabel: "Connect",
  queueActionEnabled: false,
  queueActionHref: queueJoinUrl,
  noteText: "Connect stays locked until you are next in line.",
  readyExpiresAt: 0,
  readySecondsRemaining: 0,
};
const connectQueuePollMs = 5000;
const connectReadyWindowMs = 60000;
let connectQueuePollTimer = null;
let connectQueueReadyTimer = null;
let accountDropdownState = null;
let steamProfileHydrationPromise = null;
const socialStats = {
  discord: "16,628 members · 3,054 online",
  youtube: "128K subscribers · 24 new videos",
  tiktok: "214K followers · 4.2M views",
  instagram: "96K followers · 14 new posts",
  x: "41K followers · 3.8K active",
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
    permissions: {
      applications: Boolean(user.permissions?.applications),
      applicationAvailability: Boolean(user.permissions?.applicationAvailability),
      websiteMaintenance: Boolean(user.permissions?.websiteMaintenance),
      subscriptions: Boolean(user.permissions?.subscriptions || user.permissions?.giftSubscriptions),
      permissions: Boolean(user.permissions?.permissions),
    },
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

function writeLocalAdminSession(adminUser, staySignedIn) {
  const payload = {
    id: adminUser.id,
  };

  if (staySignedIn) {
    writeStoredJson(localStorage, localAdminSessionKey, payload);
    sessionStorage.removeItem(localAdminSessionTempKey);
    return;
  }

  writeStoredJson(sessionStorage, localAdminSessionTempKey, payload);
  localStorage.removeItem(localAdminSessionKey);
}

function clearLocalAdminSession() {
  localStorage.removeItem(localAdminSessionKey);
  sessionStorage.removeItem(localAdminSessionTempKey);
}

function localAdminLogin(username, password, staySignedIn) {
  const users = ensureLocalAdminUsers();
  const target = users.find((entry) => entry.username === username && entry.password === password);
  if (!target) {
    return null;
  }

  writeLocalAdminSession(target, staySignedIn);
  return sanitizeLocalAdminUser(target);
}

function upsertLocalAdminFromRemote(adminUser, password, staySignedIn) {
  if (!adminUser || !adminUser.username) {
    return null;
  }

  const users = ensureLocalAdminUsers();
  const normalized = {
    id: adminUser.id || `remote-${String(adminUser.username).toLowerCase()}`,
    username: String(adminUser.username),
    password: String(password || ""),
    isMainAdmin: Boolean(adminUser.isMainAdmin),
    permissions: {
      applications: Boolean(adminUser.permissions?.applications),
      applicationAvailability: Boolean(adminUser.permissions?.applicationAvailability),
      websiteMaintenance: Boolean(adminUser.permissions?.websiteMaintenance),
      subscriptions: Boolean(adminUser.permissions?.subscriptions || adminUser.permissions?.giftSubscriptions),
      permissions: Boolean(adminUser.permissions?.permissions),
    },
  };

  const existingIndex = users.findIndex((entry) => {
    return entry.id === normalized.id || entry.username === normalized.username;
  });

  if (existingIndex >= 0) {
    const existing = users[existingIndex];
    users[existingIndex] = {
      ...existing,
      ...normalized,
      password: normalized.password || existing.password || "",
      permissions: {
        ...(existing.permissions || {}),
        ...normalized.permissions,
      },
    };
  } else {
    users.push(normalized);
  }

  writeStoredJson(localStorage, localAdminUsersKey, users);
  writeLocalAdminSession(normalized, staySignedIn);
  return sanitizeLocalAdminUser(normalized);
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

function readLocalMaintenanceMode() {
  const settings = readStoredJson(localStorage, localAdminSettingsKey, { maintenanceMode: false });
  return Boolean(settings?.maintenanceMode);
}

function writeLocalMaintenanceMode(enabled, metadata) {
  const existing = readStoredJson(localStorage, localAdminSettingsKey, { maintenanceMode: false });
  const nextSettings = {
    ...(existing && typeof existing === "object" ? existing : {}),
    maintenanceMode: Boolean(enabled),
    updatedAt: metadata?.updatedAt || new Date().toISOString(),
    updatedBy: metadata?.updatedBy || existing?.updatedBy || "system",
  };
  writeStoredJson(localStorage, localAdminSettingsKey, nextSettings);
}

const maintenanceGatePollMs = 10000;
const maintenanceGateIgnoredPages = new Set(["admin.html"]);
let maintenanceGateOverlay = null;
let maintenanceGateEnabled = null;
let maintenanceResizeBound = false;

const maintenanceLockedNavSelectors = [
  ".header-brand",
  "#navMenu a",
  ".icon-btn",
  ".login-trigger",
];

function isMaintenanceGatePage() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  return !maintenanceGateIgnoredPages.has(page);
}

function ensureMaintenanceGateOverlay() {
  if (maintenanceGateOverlay) {
    return maintenanceGateOverlay;
  }

  const overlay = document.createElement("section");
  overlay.className = "maintenance-screen maintenance-screen-overlay";
  overlay.setAttribute("aria-live", "polite");
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="maintenance-screen-panel">
      <h1>Website Down For Maintenance</h1>
      <p>Website will be back up shortly.</p>
    </div>
  `;

  document.body.appendChild(overlay);
  maintenanceGateOverlay = overlay;
  return maintenanceGateOverlay;
}

function updateMaintenanceOverlayOffset() {
  if (!maintenanceGateOverlay) {
    return;
  }

  const headerEl = document.querySelector(".site-header");
  const topOffset = headerEl
    ? Math.ceil(headerEl.getBoundingClientRect().height)
    : 0;
  maintenanceGateOverlay.style.setProperty("--maintenance-top-offset", `${topOffset}px`);
}

function setMaintenanceNavigationLocked(active) {
  const locked = Boolean(active);
  const staffLink = document.querySelector(".join-btn");
  const links = maintenanceLockedNavSelectors
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)));

  links.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    if (locked) {
      if (!link.dataset.maintenanceHref) {
        link.dataset.maintenanceHref = link.getAttribute("href") || "";
      }
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.classList.add("maintenance-nav-disabled");
      return;
    }

    const originalHref = link.dataset.maintenanceHref;
    if (originalHref !== undefined) {
      if (originalHref) {
        link.setAttribute("href", originalHref);
      } else {
        link.removeAttribute("href");
      }
      delete link.dataset.maintenanceHref;
    }
    link.removeAttribute("aria-disabled");
    link.classList.remove("maintenance-nav-disabled");
  });

  if (staffLink instanceof HTMLAnchorElement) {
    if (locked) {
      if (!staffLink.dataset.maintenanceHref) {
        staffLink.dataset.maintenanceHref = staffLink.getAttribute("href") || "";
      }
      if (!staffLink.dataset.maintenanceLabel) {
        staffLink.dataset.maintenanceLabel = staffLink.textContent || "";
      }
      staffLink.setAttribute("href", adminDashboardUrl);
      staffLink.textContent = "Staff Dashboard";
    } else {
      const originalHref = staffLink.dataset.maintenanceHref;
      const originalLabel = staffLink.dataset.maintenanceLabel;
      if (originalHref !== undefined) {
        if (originalHref) {
          staffLink.setAttribute("href", originalHref);
        } else {
          staffLink.removeAttribute("href");
        }
        delete staffLink.dataset.maintenanceHref;
      }
      if (originalLabel !== undefined) {
        staffLink.textContent = originalLabel;
        delete staffLink.dataset.maintenanceLabel;
      }
    }
  }
}

function setMaintenanceGate(enabled) {
  if (!isMaintenanceGatePage()) {
    return;
  }

  const active = Boolean(enabled);
  if (maintenanceGateEnabled === active) {
    return;
  }

  maintenanceGateEnabled = active;
  const overlay = ensureMaintenanceGateOverlay();
  const mainEl = document.querySelector("main");
  const footerEl = document.querySelector(".footer");

  updateMaintenanceOverlayOffset();

  overlay.hidden = !active;

  if (mainEl) {
    mainEl.style.display = active ? "none" : "";
  }
  if (footerEl) {
    footerEl.style.display = active ? "none" : "";
  }

  document.body.classList.toggle("maintenance-gated", active);
  setMaintenanceNavigationLocked(active);

  if (active && !maintenanceResizeBound) {
    window.addEventListener("resize", updateMaintenanceOverlayOffset);
    maintenanceResizeBound = true;
  }
}

if (isMaintenanceGatePage() && readLocalMaintenanceMode()) {
  setMaintenanceGate(true);
}

function ensureLatestAdminDashboardScript() {
  const currentPage = window.location.pathname.split("/").pop() || "";
  if (currentPage !== "admin.html") {
    return;
  }

  window.BLOODLINE_ADMIN_DASHBOARD_REQUIRED_VERSION = adminDashboardScriptVersion;
  const requiredSrc = `admin-dashboard.js?${adminDashboardScriptVersion}`;
  const alreadyPresent = Array.from(document.querySelectorAll("script[src]")).some((scriptEl) => {
    const src = String(scriptEl.getAttribute("src") || "");
    return src.includes(requiredSrc);
  });

  if (alreadyPresent) {
    return;
  }

  const scriptEl = document.createElement("script");
  scriptEl.src = requiredSrc;
  scriptEl.async = false;
  (document.body || document.documentElement).appendChild(scriptEl);
}

ensureLatestAdminDashboardScript();

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getAuthUrlDetails(url) {
  try {
    return new URL(url, window.location.origin);
  } catch {
    return null;
  }
}

function isInvalidLiveAuthUrl(url) {
  const parsedUrl = getAuthUrlDetails(url);
  if (!parsedUrl) {
    return true;
  }

  const currentHost = window.location.hostname;
  const currentPageIsLocal = isLocalHostname(currentHost);
  if (currentPageIsLocal) {
    return false;
  }

  if (isLocalHostname(parsedUrl.hostname)) {
    return true;
  }

  const isGithubPagesHost = /\.github\.io$/i.test(currentHost);
  const isAuthPath = parsedUrl.pathname.startsWith("/auth/");
  if (isGithubPagesHost && parsedUrl.hostname === currentHost && isAuthPath) {
    return true;
  }

  return false;
}

function showAuthUnavailableMessage() {
  window.alert("Authentication is not configured for this live site yet. Set BLOODLINE_BACKEND_ORIGIN to your deployed auth server URL.");
}

function buildFrontendAuthCallbackUrl() {
  return new URL("auth-callback.html", window.location.href);
}

function buildSteamOpenIdFallbackUrl() {
  const callbackUrl = buildFrontendAuthCallbackUrl();
  callbackUrl.searchParams.set("provider", "steam");

  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.return_to": callbackUrl.toString(),
    "openid.realm": window.location.origin,
  });

  return `https://steamcommunity.com/openid/login?${params.toString()}`;
}

function parseSteamOpenIdCallback(params) {
  const mode = params.get("openid.mode") || "";
  const claimedId = params.get("openid.claimed_id") || "";
  const steamIdMatch = claimedId.match(/\/id\/(\d+)$/);

  if (mode === "id_res" && steamIdMatch) {
    return {
      provider: "steam",
      status: "success",
      steamId: steamIdMatch[1],
      steamName: params.get("steamName") || "Steam User",
      steamAvatar: params.get("steamAvatar") || "",
      message: "Steam connected successfully. This popup will close automatically.",
    };
  }

  if (mode === "cancel") {
    return {
      provider: "steam",
      status: "error",
      message: "Steam sign-in was cancelled.",
    };
  }

  if (mode) {
    return {
      provider: "steam",
      status: "error",
      message: "Steam authentication could not be completed.",
    };
  }

  return null;
}

function isPlaceholderSteamName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return !normalized || normalized === "steam user";
}

function normalizeSteamDisplayName(rawName) {
  const value = String(rawName || "").trim();
  if (!value) {
    return "";
  }

  return value
    .replace(/^Steam Community\s*::\s*/i, "")
    .trim();
}

async function fetchSteamProfileFromXml(steamId) {
  const normalizedSteamId = String(steamId || "").trim();
  if (!/^\d{17}$/.test(normalizedSteamId)) {
    return null;
  }

  const steamProfileUrl = `https://steamcommunity.com/profiles/${normalizedSteamId}/?xml=1`;
  const lookupUrl = `https://corsproxy.io/?${encodeURIComponent(steamProfileUrl)}`;

  try {
    const response = await fetch(lookupUrl, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const xmlText = await response.text();
    if (!xmlText) {
      return null;
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");

    const readTag = (tagName) => {
      const node = xmlDoc.querySelector(tagName);
      return node ? String(node.textContent || "").trim() : "";
    };

    const steamName = readTag("steamID");
    const steamAvatar = readTag("avatarFull") || readTag("avatarMedium") || readTag("avatarIcon");

    return {
      steamName,
      steamAvatar,
    };
  } catch {
    return null;
  }
}

async function fetchSteamProfileFromHtml(steamId) {
  const normalizedSteamId = String(steamId || "").trim();
  if (!/^\d{17}$/.test(normalizedSteamId)) {
    return null;
  }

  const steamProfileUrl = `https://steamcommunity.com/profiles/${normalizedSteamId}`;
  const lookupUrl = `https://corsproxy.io/?${encodeURIComponent(steamProfileUrl)}`;

  try {
    const response = await fetch(lookupUrl, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const htmlText = await response.text();
    if (!htmlText) {
      return null;
    }

    const titleMatch = htmlText.match(/<title>([^<]+)<\/title>/i);
    const ogTitleMatch = htmlText.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const nameFromTitle = normalizeSteamDisplayName(ogTitleMatch?.[1] || titleMatch?.[1] || "");

    const avatarMatch = htmlText.match(/https:\/\/avatars\.(?:cloudflare\.)?steamstatic\.com\/[a-f0-9]+_(?:full|medium|icon)\.jpg/i);
    const steamAvatar = avatarMatch ? avatarMatch[0] : "";

    return {
      steamName: nameFromTitle,
      steamAvatar,
    };
  } catch {
    return null;
  }
}

async function hydrateSteamProfileFromPublicLookup() {
  if (steamProfileHydrationPromise) {
    return steamProfileHydrationPromise;
  }

  steamProfileHydrationPromise = (async () => {
    const state = readAccountState();
    const steamId = String(state.steamId || "").trim();
    if (!steamId) {
      return;
    }

    const needsName = isPlaceholderSteamName(state.steamName);
    const needsAvatar = !String(state.steamAvatar || "").trim();
    if (!needsName && !needsAvatar) {
      return;
    }

    const profileFromXml = await fetchSteamProfileFromXml(steamId);
    let nextSteamName = String(profileFromXml?.steamName || "").trim();
    let nextSteamAvatar = String(profileFromXml?.steamAvatar || "").trim();

    const needsHtmlLookup = isPlaceholderSteamName(nextSteamName) || !nextSteamAvatar;
    if (needsHtmlLookup) {
      const profileFromHtml = await fetchSteamProfileFromHtml(steamId);
      if (profileFromHtml) {
        const htmlName = String(profileFromHtml.steamName || "").trim();
        const htmlAvatar = String(profileFromHtml.steamAvatar || "").trim();
        if (htmlName && isPlaceholderSteamName(nextSteamName)) {
          nextSteamName = htmlName;
        }
        if (htmlAvatar && !nextSteamAvatar) {
          nextSteamAvatar = htmlAvatar;
        }
      }
    }

    if (!nextSteamName && !nextSteamAvatar) {
      return;
    }

    const nextState = mergeAccountState({
      steamName: nextSteamName || state.steamName,
      steamAvatar: nextSteamAvatar || state.steamAvatar,
    });

    renderHeaderAccountTrigger(nextState);
    updateAccountDropdownDetails();
  })().finally(() => {
    steamProfileHydrationPromise = null;
  });

  return steamProfileHydrationPromise;
}

function openAuthPopup(url, popupName) {
  if (isInvalidLiveAuthUrl(url)) {
    showAuthUnavailableMessage();
    return;
  }

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
  const fallbackUrl = buildSteamOpenIdFallbackUrl();
  const targetUrl = isInvalidLiveAuthUrl(steamPopupUrl) ? fallbackUrl : steamPopupUrl;
  openAuthPopup(targetUrl, "bloodline-steam-login");
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
      <button class="modal-close steam-modal-close" type="button" aria-label="Close login popup">X</button>
      <div class="steam-login-mark">Bloodline RP</div>
      <h2 id="steamLoginTitle" style="text-align: center;">Welcome Back</h2>
      <p class="steam-login-copy">Sign in with your Steam account to access your dashboard and manage applications. <span class="steam-login-warning">DO NOT forget to link your discord in the dashboard.</span></p>
      <button class="steam-login-button" type="button">
        <span class="steam-icon" aria-hidden="true">
          <img src="https://cdn.simpleicons.org/steam/ffffff" alt="" width="18" height="18" />
        </span>
        <span class="steam-login-button-text">Login With Steam</span>
      </button>
      <p class="steam-login-note">We only use Steam for authentication. We never access your games, inventory, or personal data.</p>
    </div>
  `;

  document.body.appendChild(steamLoginModal);

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
      <button class="modal-close connect-modal-close" type="button" aria-label="Close queue popup">X</button>
      <div class="steam-login-mark">Bloodline RP</div>
      <h2 id="connectQueueTitle">Connect Queue</h2>
      <div class="connect-modal-copy">
        <div class="connect-modal-status">
          <span class="connect-stat-label">Server Status</span>
          <strong id="connectQueueStatusText">Offline</strong>
        </div>
        <div class="connect-modal-status">
          <span class="connect-stat-label">Player Count</span>
          <strong id="connectQueuePlayerCountText">0/0</strong>
        </div>
        <div class="connect-modal-status">
          <span class="connect-stat-label">Queue</span>
          <strong id="connectQueueCountText">0/0</strong>
        </div>
        <div class="connect-modal-actions">
          <button class="connect-action" id="connectQueueModalAction" type="button">Connect</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(connectQueueModal);

  const closeButton = connectQueueModal.querySelector(".connect-modal-close");
  if (closeButton) {
    closeButton.addEventListener("click", closeConnectQueueModal);
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

function clearConnectReadyCountdown() {
  if (connectQueueReadyTimer !== null) {
    clearInterval(connectQueueReadyTimer);
    connectQueueReadyTimer = null;
  }
}

function markConnectWindowExpired() {
  clearConnectReadyCountdown();
  connectQueueState = {
    ...connectQueueState,
    queueActionEnabled: false,
    queueActionLabel: "Connect",
    queuePositionText: "In queue",
    noteText: "Wait until you are next in line again to unlock Connect.",
    readyExpiresAt: 0,
    readySecondsRemaining: 0,
  };
  updateConnectQueueModal();
}

function beginConnectReadyWindow() {
  const expiresAt = Date.now() + connectReadyWindowMs;
  connectQueueState = {
    ...connectQueueState,
    readyExpiresAt: expiresAt,
    readySecondsRemaining: Math.ceil(connectReadyWindowMs / 1000),
  };

  clearConnectReadyCountdown();
  connectQueueReadyTimer = window.setInterval(() => {
    const secondsLeft = Math.max(0, Math.ceil((connectQueueState.readyExpiresAt - Date.now()) / 1000));
    if (secondsLeft <= 0) {
      markConnectWindowExpired();
      return;
    }

    connectQueueState = {
      ...connectQueueState,
      readySecondsRemaining: secondsLeft,
    };
    updateConnectQueueModal();
  }, 1000);
}

function clearConnectReadyWindow() {
  clearConnectReadyCountdown();
  connectQueueState = {
    ...connectQueueState,
    readyExpiresAt: 0,
    readySecondsRemaining: 0,
  };
}

function resolveQueueDisplay(payload) {
  const queuePosition = Number(payload.queuePosition ?? payload.position ?? payload.place ?? payload.queueIndex ?? payload.queueSpot ?? payload.rank ?? null);
  const queueTotal = Number(payload.queueTotal ?? payload.totalQueued ?? payload.queueSize ?? payload.waiting ?? payload.queueCount ?? payload.queue ?? payload.queued ?? 0);

  const validPosition = Number.isFinite(queuePosition) && queuePosition >= 0 ? queuePosition : null;
  const validTotal = Number.isFinite(queueTotal) && queueTotal >= 0 ? queueTotal : 0;

  return {
    positionValue: validPosition,
    totalValue: validTotal,
    queueCountText: `${validPosition ?? 0}/${validTotal}`,
  };
}

function applyConnectStatusPayload(payload) {
  const players = Number(payload.players ?? payload.online ?? payload.population ?? 0);
  const maxPlayers = Number(payload.maxPlayers ?? payload.max ?? payload.capacity ?? 0);
  const rawStatus = payload.status ?? payload.serverStatus ?? payload.state ?? payload.online ?? payload.isOnline;
  const isOnline = rawStatus === true || rawStatus === "online" || rawStatus === "running" || rawStatus === "up";
  const queueInfo = resolveQueueDisplay(payload);

  const isNext = payload.next === true || payload.isNext === true || queueInfo.positionValue === 1 || queueInfo.positionValue === 0;
  const isIn = payload.in === true || payload.isIn === true || payload.connected === true || payload.ready === true || queueInfo.positionValue === 0;
  const shouldEnableConnect = Boolean(queueJoinUrl && isOnline && (isNext || isIn));

  if (shouldEnableConnect && !connectQueueState.readyExpiresAt) {
    beginConnectReadyWindow();
  }

  if (!shouldEnableConnect && connectQueueState.readyExpiresAt) {
    clearConnectReadyWindow();
  }

  const secondsLeft = connectQueueState.readyExpiresAt
    ? Math.max(0, Math.ceil((connectQueueState.readyExpiresAt - Date.now()) / 1000))
    : 0;

  connectQueueState = {
    ...connectQueueState,
    statusText: isOnline ? "Online" : "Offline",
    playersText: `${Number.isFinite(players) ? players : 0}/${Number.isFinite(maxPlayers) && maxPlayers > 0 ? maxPlayers : 0}`,
    queueCountText: queueInfo.queueCountText,
    queuePositionText: "In queue",
    noteText: shouldEnableConnect
      ? "If you do not connect in time, you will be placed back into queue automatically."
      : "Connect unlocks only when you are next in line and ready.",
    queueActionLabel: shouldEnableConnect ? "Connect Now" : "Connect",
    queueActionEnabled: shouldEnableConnect && secondsLeft > 0,
    queueActionHref: queueJoinUrl,
    readySecondsRemaining: secondsLeft,
  };
}

function applyConnectOfflineFallback(message, note) {
  clearConnectReadyWindow();
  connectQueueState = {
    ...connectQueueState,
    statusText: "Offline",
    playersText: "0/0",
    queueCountText: "0/0",
    queuePositionText: "In queue",
    noteText: note,
    queueActionLabel: "Connect",
    queueActionEnabled: false,
  };
}

function refreshConnectPanelStatus(populationEl, statusEl) {
  if (forceServerOffline) {
    applyConnectOfflineFallback(
      "The server is offline right now.",
      "Connect unlocks when the server is online and you are next in queue."
    );
    populationEl.textContent = "0/0";
    statusEl.textContent = "Offline";
    statusEl.classList.remove("status-online");
    statusEl.classList.add("status-offline");
    updateConnectQueueModal();
    return;
  }

  if (!serverStatusUrl) {
    applyConnectOfflineFallback(
      "The live status endpoint is not configured yet.",
      "Connect unlocks when the server is online and you are next in queue."
    );
    populationEl.textContent = "0/0";
    statusEl.textContent = "Offline";
    statusEl.classList.remove("status-online");
    statusEl.classList.add("status-offline");
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
      applyConnectStatusPayload(payload || {});
      populationEl.textContent = connectQueueState.playersText;
      statusEl.textContent = connectQueueState.statusText;
      statusEl.classList.toggle("status-online", connectQueueState.statusText === "Online");
      statusEl.classList.toggle("status-offline", connectQueueState.statusText === "Offline");
      updateConnectQueueModal();
    })
    .catch(() => {
      applyConnectOfflineFallback(
        "Could not reach the live status endpoint.",
        "Connect unlocks when the status feed is available and you are next in queue."
      );
      populationEl.textContent = "0/0";
      statusEl.textContent = "Offline";
      statusEl.classList.remove("status-online");
      statusEl.classList.add("status-offline");
      updateConnectQueueModal();
    });
}

function updateConnectQueueModal() {
  const modal = ensureConnectQueueModal();
  const statusEl = modal.querySelector("#connectQueueStatusText");
  const playerCountEl = modal.querySelector("#connectQueuePlayerCountText");
  const countEl = modal.querySelector("#connectQueueCountText");
  const actionButton = modal.querySelector("#connectQueueModalAction");

  if (statusEl) {
    statusEl.textContent = connectQueueState.statusText;
    statusEl.classList.toggle("status-online", connectQueueState.statusText === "Online");
    statusEl.classList.toggle("status-offline", connectQueueState.statusText === "Offline");
  }

  if (playerCountEl) {
    playerCountEl.textContent = connectQueueState.playersText || "0/0";
  }

  if (countEl) {
    countEl.textContent = connectQueueState.queueCountText || "0/0";
  }

  if (actionButton) {
    const baseLabel = connectQueueState.queueActionLabel || "Connect";
    const secondsLeft = Number(connectQueueState.readySecondsRemaining || 0);
    const showTimer = connectQueueState.queueActionEnabled && secondsLeft > 0;

    if (showTimer) {
      actionButton.classList.add("has-timer");
      actionButton.innerHTML = `<span class="connect-action-label">${baseLabel}</span><span class="connect-action-timer">${secondsLeft}s</span>`;
    } else {
      actionButton.classList.remove("has-timer");
      actionButton.textContent = baseLabel;
    }

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

function hasLinkedSteamAccount(state) {
  return Boolean(String(state?.steamId || "").trim());
}

function formatSteamIdentityLabel(state) {
  const steamId = String(state?.steamId || "").trim();
  const steamName = String(state?.steamName || "").trim();

  if (steamName && steamId) {
    return `${steamName} (${steamId})`;
  }

  return steamName || steamId || "Awaiting Steam Login";
}

function getAccountLogoutButtons() {
  return document.querySelectorAll('[data-auth-action="logout"]');
}

function getInitialsFromName(name) {
  const value = String(name || "").trim();
  if (!value) {
    return "ST";
  }

  const parts = value.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
  return initials || value.slice(0, 2).toUpperCase();
}

function renderHeaderAccountTrigger(state) {
  const hasSteam = hasLinkedSteamAccount(state);

  loginTriggers.forEach((trigger) => {
    if (!trigger.dataset.defaultMarkup) {
      trigger.dataset.defaultMarkup = trigger.innerHTML;
    }

    if (!hasSteam) {
      trigger.classList.remove("account-chip-trigger");
      trigger.removeAttribute("data-logged-in");
      trigger.setAttribute("aria-label", "Login with Steam");
      trigger.innerHTML = trigger.dataset.defaultMarkup || trigger.innerHTML;
      return;
    }

    const displayName = String(state.steamName || "Steam User").trim() || "Steam User";
    const displayId = String(state.steamId || "Connected").trim() || "Connected";
    const avatarUrl = String(state.steamAvatar || "").trim();

    trigger.classList.add("account-chip-trigger");
    trigger.setAttribute("data-logged-in", "true");
    trigger.setAttribute("aria-label", "Open account menu");

    const avatarEl = document.createElement("span");
    avatarEl.className = "account-chip-avatar";

    if (avatarUrl) {
      const imageEl = document.createElement("img");
      imageEl.src = avatarUrl;
      imageEl.alt = "";
      imageEl.loading = "lazy";
      avatarEl.appendChild(imageEl);
    } else {
      const fallbackEl = document.createElement("span");
      fallbackEl.className = "account-chip-avatar-fallback";
      fallbackEl.textContent = getInitialsFromName(displayName);
      avatarEl.appendChild(fallbackEl);
    }

    const metaEl = document.createElement("span");
    metaEl.className = "account-chip-meta";

    const nameEl = document.createElement("span");
    nameEl.className = "account-chip-name";
    nameEl.textContent = displayName;

    const idEl = document.createElement("span");
    idEl.className = "account-chip-id";
    idEl.textContent = displayId;

    metaEl.appendChild(nameEl);
    metaEl.appendChild(idEl);

    const caretEl = document.createElement("span");
    caretEl.className = "account-chip-caret";
    caretEl.setAttribute("aria-hidden", "true");

    trigger.replaceChildren(avatarEl, metaEl, caretEl);
  });
}

async function logoutAccount() {
  const currentPage = window.location.pathname.split("/").pop() || "";

  try {
    await fetch(authLogoutUrl, {
      credentials: "include",
      mode: "cors",
    });
  } catch {
    // Ignore backend logout failures when running static-only.
  }

  localStorage.removeItem(accountStorageKey);
  renderAccountState();
  updateAccountDropdownDetails();
  closeAccountDropdown();

  if (currentPage === accountDashboardUrl) {
    window.location.href = "index.html";
  }
}

function renderAccountState() {
  const state = readAccountState();
  const steamIdentityLabel = formatSteamIdentityLabel(state);
  const discordName = state.discordName || "Not Connected";
  const hasSteam = hasLinkedSteamAccount(state);
  const hasDiscord = Boolean(state.discordName);

  if (hasSteam) {
    closeSteamLoginModal();
  }

  renderHeaderAccountTrigger(state);

  if (discordButton) {
    discordButton.disabled = !hasSteam;
  }

  discordAuthButtons.forEach((button) => {
    button.disabled = !hasSteam;
  });

  getAccountLogoutButtons().forEach((button) => {
    button.disabled = !hasSteam;
  });

  if (accountNameEl) {
    accountNameEl.textContent = steamIdentityLabel;
  }

  if (steamStatusEl) {
    steamStatusEl.textContent = hasSteam ? `Steam Connected: ${steamIdentityLabel}` : "Steam Pending";
  }

  if (discordStatusEl) {
    discordStatusEl.textContent = hasDiscord ? "Discord Connected" : "Discord Pending";
  }

  if (discordDisplayEl) {
    discordDisplayEl.textContent = discordName;
  }

  void hydrateSteamProfileFromPublicLookup();

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
  return hasLinkedSteamAccount(state);
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

function ensureStoreCartUi() {
  let toggleButton = document.getElementById("storeCartToggle");
  if (!toggleButton) {
    toggleButton = document.querySelector(".icon-btn[aria-label='Store']");
  }

  if (toggleButton) {
    toggleButton.id = "storeCartToggle";
    toggleButton.classList.add("store-cart-toggle");
    toggleButton.setAttribute("aria-label", "Open cart");
    toggleButton.setAttribute("aria-controls", "storeCartDrawer");
    if (!toggleButton.hasAttribute("aria-expanded")) {
      toggleButton.setAttribute("aria-expanded", "false");
    }
    if (toggleButton instanceof HTMLAnchorElement) {
      if (!toggleButton.dataset.storeCartHref) {
        toggleButton.dataset.storeCartHref = toggleButton.getAttribute("href") || "";
      }
      toggleButton.removeAttribute("href");
      toggleButton.setAttribute("role", "button");
      toggleButton.setAttribute("tabindex", "0");
    }

    let countEl = toggleButton.querySelector("#storeCartCount");
    if (!countEl) {
      countEl = document.createElement("span");
      countEl.className = "store-cart-count";
      countEl.id = "storeCartCount";
      countEl.hidden = true;
      toggleButton.appendChild(countEl);
    }
  }

  let drawer = document.getElementById("storeCartDrawer");
  if (!drawer) {
    drawer = document.createElement("div");
    drawer.className = "store-cart-drawer";
    drawer.id = "storeCartDrawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML = `
      <div class="store-cart-backdrop" id="storeCartBackdrop" aria-hidden="true"></div>
      <aside class="store-cart-panel" role="dialog" aria-modal="true" aria-labelledby="storeCartTitle">
        <div class="store-cart-header">
          <div>
            <p class="eyebrow">Store</p>
            <h2 id="storeCartTitle">Your Cart</h2>
          </div>
          <button class="modal-close" id="storeCartClose" type="button" aria-label="Close cart">X</button>
        </div>
        <div class="store-cart-body">
          <p class="store-cart-empty" id="storeCartEmpty">Your cart is empty.</p>
          <div class="store-cart-items" id="storeCartItems"></div>
        </div>
        <div class="store-cart-footer">
          <p class="store-cart-total">Total <strong id="storeCartTotal">$0 / month</strong></p>
          <button class="btn btn-primary" id="storeCartCheckout" type="button">Log in to check out</button>
        </div>
      </aside>
    `;
    document.body.appendChild(drawer);
  }
}

function initStoreCart() {
  ensureStoreCartUi();

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

  if (!drawer || !toggleButton || !itemsContainer || !emptyEl || !totalEl || !countEl || !checkoutButton) {
    return;
  }

  if (toggleButton.dataset.cartReady === "true") {
    storeCartState.items = readStoreCartState().map((item) => ({
      tier: item.tier,
      priceLabel: item.priceLabel,
      value: Number.isFinite(item.value) ? item.value : extractPriceValue(item.priceLabel),
    })).filter((item) => item.tier && item.priceLabel);
    renderStoreCart();
    return;
  }

  toggleButton.dataset.cartReady = "true";

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

  if (toggleButton instanceof HTMLAnchorElement) {
    toggleButton.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleStoreCartDrawer();
      }
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", closeStoreCartDrawer);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeStoreCartDrawer);
  }

  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) {
      closeStoreCartDrawer();
    }
  });

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

function formatSubscriptionTierLabel(rawTier) {
  const tier = String(rawTier || "").trim();
  if (!tier) {
    return "None";
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
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
      subTierEl: document.getElementById("headerSubscriptionTier"),
      dashboardLinkEl: document.getElementById("headerAccountDashboardLink"),
    };
  }

  const wrapper = document.createElement("div");
  wrapper.className = "header-account-menu";
  wrapper.innerHTML = `
    <div class="header-account-dropdown" id="headerAccountDropdown" aria-hidden="true">
      <section class="account-dropdown-block">
        <h4>Connections</h4>
        <p class="account-dropdown-status-row"><span>Steam</span><span id="headerSteamLinkStatus" class="status-unlinked">Unlinked</span></p>
        <p class="account-dropdown-status-row"><span>Discord</span><span id="headerDiscordLinkStatus" class="status-unlinked">Unlinked</span></p>
      </section>
      <section class="account-dropdown-block">
        <h4>Current Subscription</h4>
        <p id="headerSubscriptionTier">None</p>
      </section>
      <section class="account-dropdown-block">
        <h4>Actions</h4>
        <div class="account-dropdown-inline-actions account-dropdown-actions-column">
          <a class="btn btn-primary" id="headerAccountDashboardLink" href="account-dashboard.html">Dashboard</a>
          <button class="btn btn-ghost" type="button" data-auth-action="logout" disabled>Logout</button>
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
    subTierEl: wrapper.querySelector("#headerSubscriptionTier"),
    dashboardLinkEl: wrapper.querySelector("#headerAccountDashboardLink"),
  };
}

async function updateAccountDropdownDetails() {
  if (!accountDropdownState) {
    return;
  }

  const state = readAccountState();
  const hasSteam = hasLinkedSteamAccount(state);
  const hasDiscord = Boolean(state.discordId || state.discordName);

  if (accountDropdownState.dropdownEl) {
    if (hasSteam) {
      accountDropdownState.dropdownEl.removeAttribute("hidden");
      accountDropdownState.dropdownEl.removeAttribute("inert");
    } else {
      closeAccountDropdown();
      accountDropdownState.dropdownEl.setAttribute("hidden", "hidden");
      accountDropdownState.dropdownEl.setAttribute("inert", "");
    }
  }

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
    accountDropdownState.subTierEl.textContent = formatSubscriptionTierLabel(subscription.tier);
  }

  if (accountDropdownState.dashboardLinkEl) {
    accountDropdownState.dashboardLinkEl.setAttribute("href", hasSteam ? accountDashboardUrl : "account.html");
  }

  getAccountLogoutButtons().forEach((button) => {
    button.disabled = !hasSteam;
  });
}

function formatDashboardApplicationDate(dateValue) {
  if (!dateValue) {
    return "Unknown date";
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

function getDashboardApplicationTitle(entry) {
  return String(entry?.formName || entry?.title || entry?.id || "Application").trim() || "Application";
}

function getDashboardApplicationStatus(entry) {
  return String(entry?.status || "pending").trim().toLowerCase() || "pending";
}

function isDashboardApplicationClosed(entry) {
  const status = getDashboardApplicationStatus(entry);
  return status === "accepted" || status === "denied";
}

function getDashboardApplicationCommentCount(entry) {
  return Array.isArray(entry?.replies) ? entry.replies.length : 0;
}

function getDashboardApplicationStatusClass(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "accepted") {
    return "application-status-accepted";
  }
  if (normalized === "denied") {
    return "application-status-denied";
  }
  return "application-status-pending";
}

function renderDashboardApplicationList(container, applications, emptyText, options = {}) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!applications.length) {
    const item = document.createElement("li");
    item.textContent = emptyText;
    container.appendChild(item);
    return;
  }

  const onView = typeof options.onView === "function" ? options.onView : null;
  const onEdit = typeof options.onEdit === "function" ? options.onEdit : null;

  applications.forEach((entry) => {
    const title = getDashboardApplicationTitle(entry);
    const status = getDashboardApplicationStatus(entry);
    const submittedOn = formatDashboardApplicationDate(entry?.createdAt);
    const reviewedOn = formatDashboardApplicationDate(entry?.reviewedBy?.reviewedAt || entry?.updatedAt);
    const commentCount = getDashboardApplicationCommentCount(entry);
    const closed = isDashboardApplicationClosed(entry);
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    const statusClass = getDashboardApplicationStatusClass(status);

    const item = document.createElement("li");
    item.className = "dashboard-application-item";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "dashboard-application-toggle";
    toggleButton.setAttribute("aria-expanded", "false");

    const titleEl = document.createElement("span");
    titleEl.className = "dashboard-application-title";
    titleEl.textContent = title;

    const chevronEl = document.createElement("span");
    chevronEl.className = "dashboard-application-chevron";
    chevronEl.textContent = "▾";

    toggleButton.appendChild(titleEl);
    toggleButton.appendChild(chevronEl);

    const details = document.createElement("div");
    details.className = "dashboard-application-details";
    details.hidden = true;

    const addDetailRow = (label, value, valueClassName = "") => {
      const row = document.createElement("p");
      row.className = "dashboard-application-detail-row";

      const labelEl = document.createElement("span");
      labelEl.className = "dashboard-application-detail-label";
      labelEl.textContent = `${label}:`;

      const valueEl = document.createElement("span");
      valueEl.className = "dashboard-application-detail-value";
      if (valueClassName) {
        valueEl.classList.add(valueClassName);
      }
      valueEl.textContent = value;

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      details.appendChild(row);
    };

    addDetailRow("Submitted", submittedOn);
    addDetailRow("Status", statusLabel, statusClass);
    addDetailRow("Staff comments", String(commentCount));

    if (closed) {
      addDetailRow("Reviewed", `${statusLabel} on ${reviewedOn}`);
    }

    const actions = document.createElement("div");
    actions.className = "dashboard-application-actions";

    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.className = "btn btn-ghost";
    viewButton.textContent = "View";
    viewButton.addEventListener("click", () => {
      if (onView) {
        onView(entry);
      }
    });
    actions.appendChild(viewButton);

    if (!closed) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "btn btn-primary";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => {
        if (onEdit) {
          onEdit(entry);
        }
      });
      actions.appendChild(editButton);
    }

    toggleButton.addEventListener("click", () => {
      const nextExpanded = toggleButton.getAttribute("aria-expanded") !== "true";
      toggleButton.setAttribute("aria-expanded", String(nextExpanded));
      details.hidden = !nextExpanded;
      item.classList.toggle("is-open", nextExpanded);
    });

    details.appendChild(actions);
    item.appendChild(toggleButton);
    item.appendChild(details);
    container.appendChild(item);
  });
}

async function initAccountDashboardPage() {
  const currentPage = window.location.pathname.split("/").pop();
  if (currentPage !== "account-dashboard.html") {
    return;
  }

  const steamStatusEl = document.getElementById("dashboardSteamLinkStatus");
  const discordStatusEl = document.getElementById("dashboardDiscordLinkStatus");
  const subscriptionTierEl = document.getElementById("dashboardSubscriptionTier");
  const subscriptionRenewalEl = document.getElementById("dashboardSubscriptionRenewal");
  const subscriptionNextPaymentEl = document.getElementById("dashboardSubscriptionNextPayment");
  const pendingCountEl = document.getElementById("dashboardPendingApplications");
  const closedCountEl = document.getElementById("dashboardClosedApplications");
  const stateEl = document.getElementById("dashboardApplicationState");
  const pendingListEl = document.getElementById("dashboardPendingList");
  const closedListEl = document.getElementById("dashboardClosedList");
  const discordLinkButtonEl = document.getElementById("dashboardDiscordLinkButton");
  const detailPopupEl = document.getElementById("dashboardApplicationDetailPopup");
  const detailPopupCloseEl = document.getElementById("dashboardApplicationPopupClose");
  const detailPopupBodyEl = document.getElementById("dashboardApplicationPopupBody");
  const detailPopupActionsEl = document.getElementById("dashboardApplicationPopupActions");
  const detailPopupMessageEl = document.getElementById("dashboardApplicationPopupMessage");
  const detailPopupTitleEl = document.getElementById("dashboardApplicationPopupTitle");

  const readCachedApplications = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(accountApplicationsCacheKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeCachedApplications = (applications) => {
    if (!Array.isArray(applications)) {
      return;
    }
    localStorage.setItem(accountApplicationsCacheKey, JSON.stringify(applications));
  };

  const renderApplicationsWithCounts = (applications, stateText) => {
    const pendingApplications = applications.filter((entry) => String(entry.status || "").toLowerCase() === "pending");
    const closedApplications = applications.filter((entry) => String(entry.status || "").toLowerCase() !== "pending");

    if (pendingCountEl) {
      pendingCountEl.textContent = String(pendingApplications.length);
    }

    if (closedCountEl) {
      closedCountEl.textContent = String(closedApplications.length);
    }

    if (stateEl) {
      stateEl.textContent = stateText;
    }

    renderDashboardApplicationList(pendingListEl, pendingApplications, "No pending applications.", {
      onView: (application) => renderApplicationPopup(application, "view"),
      onEdit: (application) => renderApplicationPopup(application, "edit"),
    });
    renderDashboardApplicationList(closedListEl, closedApplications, "No closed applications.", {
      onView: (application) => renderApplicationPopup(application, "view"),
    });
  };

  const closeDetailPopup = () => {
    if (!detailPopupEl) {
      return;
    }
    detailPopupEl.hidden = true;
    document.body.classList.remove("modal-open");
  };

  const openDetailPopup = () => {
    if (!detailPopupEl) {
      return;
    }
    detailPopupEl.hidden = false;
    document.body.classList.add("modal-open");
  };

  if (detailPopupCloseEl) {
    detailPopupCloseEl.onclick = closeDetailPopup;
  }

  if (detailPopupEl) {
    detailPopupEl.onclick = (event) => {
      if (event.target === detailPopupEl) {
        closeDetailPopup();
      }
    };
  }

  const renderApplicationPopup = (application, mode) => {
    if (!detailPopupBodyEl || !detailPopupActionsEl || !detailPopupTitleEl) {
      return;
    }

    const title = getDashboardApplicationTitle(application);
    const status = getDashboardApplicationStatus(application);
    const closed = isDashboardApplicationClosed(application);
    const editable = mode === "edit" && !closed;

    detailPopupTitleEl.textContent = editable ? `Edit ${title}` : `View ${title}`;
    detailPopupBodyEl.innerHTML = "";
    detailPopupActionsEl.innerHTML = "";

    if (detailPopupMessageEl) {
      detailPopupMessageEl.hidden = true;
      detailPopupMessageEl.textContent = "";
      detailPopupMessageEl.classList.remove("error", "success");
    }

    const summary = document.createElement("p");
    summary.className = "dashboard-application-popup-summary";
    summary.textContent = `Submitted on ${formatDashboardApplicationDate(application.createdAt)}. Status: ${status}.`;
    detailPopupBodyEl.appendChild(summary);

    if (closed) {
      const decisionLine = document.createElement("p");
      decisionLine.className = "dashboard-application-popup-summary";
      decisionLine.textContent = `${status} on ${formatDashboardApplicationDate(application?.reviewedBy?.reviewedAt || application?.updatedAt)}.`;
      detailPopupBodyEl.appendChild(decisionLine);
    }

    const responsesTitle = document.createElement("h4");
    responsesTitle.textContent = "Application Answers";
    detailPopupBodyEl.appendChild(responsesTitle);

    const responses = Array.isArray(application.responses) ? application.responses : [];

    if (!responses.length) {
      const emptyResponses = document.createElement("p");
      emptyResponses.textContent = "No saved answers found.";
      detailPopupBodyEl.appendChild(emptyResponses);
    } else if (editable) {
      const editGrid = document.createElement("div");
      editGrid.className = "dashboard-application-edit-grid";

      responses.forEach((response, index) => {
        const responseId = String(response?.id || `question-${index + 1}`).trim() || `question-${index + 1}`;
        const responseLabel = String(response?.label || responseId || `Question ${index + 1}`).trim();
        const responseAnswer = String(response?.answer || "");

        const group = document.createElement("div");
        group.className = "dashboard-application-edit-field";

        const label = document.createElement("label");
        label.textContent = responseLabel;
        label.setAttribute("for", `dashboardAppEdit-${responseId}-${index}`);

        const textarea = document.createElement("textarea");
        textarea.id = `dashboardAppEdit-${responseId}-${index}`;
        textarea.rows = Math.max(3, Math.min(8, Math.ceil((responseAnswer.length || 30) / 48)));
        textarea.value = responseAnswer;
        textarea.setAttribute("data-response-id", responseId);
        textarea.setAttribute("data-response-label", responseLabel);

        group.appendChild(label);
        group.appendChild(textarea);
        editGrid.appendChild(group);
      });

      detailPopupBodyEl.appendChild(editGrid);
    } else {
      const responsesList = document.createElement("ul");
      responsesList.className = "dashboard-application-response-list";

      responses.forEach((response, index) => {
        const responseLabel = String(response?.label || response?.id || `Question ${index + 1}`).trim();
        const responseAnswer = String(response?.answer || "").trim() || "No answer provided.";

        const item = document.createElement("li");
        const question = document.createElement("strong");
        question.textContent = responseLabel;
        const answer = document.createElement("p");
        answer.textContent = responseAnswer;

        item.appendChild(question);
        item.appendChild(answer);
        responsesList.appendChild(item);
      });

      detailPopupBodyEl.appendChild(responsesList);
    }

    const commentsSection = document.createElement("section");
    commentsSection.className = "dashboard-application-comments-section";

    const commentsTitle = document.createElement("h4");
    commentsTitle.textContent = "Staff Comments";
    commentsSection.appendChild(commentsTitle);

    const comments = Array.isArray(application.replies) ? application.replies : [];
    if (!comments.length) {
      const emptyComments = document.createElement("p");
      emptyComments.className = "dashboard-application-comments-empty";
      emptyComments.textContent = "No staff comments yet.";
      commentsSection.appendChild(emptyComments);
    } else {
      const commentsList = document.createElement("ul");
      commentsList.className = "dashboard-application-comment-list";
      comments.forEach((reply) => {
        const item = document.createElement("li");
        item.className = "dashboard-application-comment-item";

        const author = String(reply?.authorName || "Staff").trim() || "Staff";
        const created = formatDashboardApplicationDate(reply?.createdAt);
        const avatarUrl = String(reply?.authorAvatar || "").trim();

        const avatar = document.createElement("span");
        avatar.className = "dashboard-application-comment-avatar";
        if (avatarUrl) {
          const avatarImage = document.createElement("img");
          avatarImage.src = avatarUrl;
          avatarImage.alt = "";
          avatarImage.loading = "lazy";
          avatar.appendChild(avatarImage);
        } else {
          avatar.textContent = getInitialsFromName(author);
        }

        const content = document.createElement("div");
        content.className = "dashboard-application-comment-content";

        const header = document.createElement("div");
        header.className = "dashboard-application-comment-head";

        const nameEl = document.createElement("span");
        nameEl.className = "dashboard-application-comment-author";
        nameEl.textContent = author;

        const dateEl = document.createElement("span");
        dateEl.className = "dashboard-application-comment-date";
        dateEl.textContent = created;

        const body = document.createElement("p");
        body.className = "dashboard-application-comment-body";
        body.textContent = String(reply?.message || "").trim() || "No comment text.";

        header.appendChild(nameEl);
        header.appendChild(dateEl);
        content.appendChild(header);
        content.appendChild(body);

        item.appendChild(avatar);
        item.appendChild(content);
        commentsList.appendChild(item);
      });
      commentsSection.appendChild(commentsList);
    }

    detailPopupBodyEl.appendChild(commentsSection);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "btn btn-ghost";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", closeDetailPopup);
    detailPopupActionsEl.appendChild(closeButton);

    if (editable) {
      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "btn btn-primary";
      saveButton.textContent = "Save Changes";
      saveButton.addEventListener("click", async () => {
        const fields = Array.from(detailPopupBodyEl.querySelectorAll("textarea[data-response-id]"));
        const nextResponses = fields.map((field) => ({
          id: String(field.getAttribute("data-response-id") || "").trim(),
          label: String(field.getAttribute("data-response-label") || "").trim(),
          answer: String(field.value || "").trim(),
        }));

        const hasEmptyAnswer = nextResponses.some((entry) => !entry.answer);
        if (hasEmptyAnswer) {
          if (detailPopupMessageEl) {
            detailPopupMessageEl.hidden = false;
            detailPopupMessageEl.classList.remove("success");
            detailPopupMessageEl.classList.add("error");
            detailPopupMessageEl.textContent = "Please complete all answers before saving.";
          }
          return;
        }

        saveButton.disabled = true;
        try {
          const response = await fetch(`${apiBaseUrl}/my-applications/${application.id}`, {
            method: "PATCH",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ responses: nextResponses }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            if (detailPopupMessageEl) {
              detailPopupMessageEl.hidden = false;
              detailPopupMessageEl.classList.remove("success");
              detailPopupMessageEl.classList.add("error");
              detailPopupMessageEl.textContent = payload.error || "Could not save your application right now.";
            }
            return;
          }

          if (detailPopupMessageEl) {
            detailPopupMessageEl.hidden = false;
            detailPopupMessageEl.classList.remove("error");
            detailPopupMessageEl.classList.add("success");
            detailPopupMessageEl.textContent = "Application answers updated.";
          }

          await initAccountDashboardPage();
          closeDetailPopup();
        } catch {
          if (detailPopupMessageEl) {
            detailPopupMessageEl.hidden = false;
            detailPopupMessageEl.classList.remove("success");
            detailPopupMessageEl.classList.add("error");
            detailPopupMessageEl.textContent = "Could not save your application right now.";
          }
        } finally {
          saveButton.disabled = false;
        }
      });
      detailPopupActionsEl.appendChild(saveButton);
    }

    openDetailPopup();
  };

  const state = readAccountState();
  const hasSteam = hasLinkedSteamAccount(state);
  const hasDiscord = Boolean(state.discordId || state.discordName || state.discordUsername);
  const subscription = readSubscriptionState();

  if (steamStatusEl) {
    steamStatusEl.textContent = hasSteam ? "Linked" : "Unlinked";
    steamStatusEl.className = hasSteam ? "status-linked" : "status-unlinked";
  }

  if (discordStatusEl) {
    discordStatusEl.textContent = hasDiscord ? "Linked" : "Unlinked";
    discordStatusEl.className = hasDiscord ? "status-linked" : "status-unlinked";
  }

  if (discordLinkButtonEl) {
    discordLinkButtonEl.hidden = !hasSteam || hasDiscord;
    discordLinkButtonEl.disabled = !hasSteam || hasDiscord;
    discordLinkButtonEl.onclick = () => {
      if (!hasLinkedSteamAccount(readAccountState())) {
        openSteamLoginModal();
        return;
      }
      openDiscordPopup();
    };
  }

  if (subscriptionTierEl) {
    subscriptionTierEl.textContent = formatSubscriptionTierLabel(subscription.tier);
  }

  if (subscriptionRenewalEl) {
    subscriptionRenewalEl.textContent = `Auto renew: ${formatDateValue(subscription.renewsAt)}`;
  }

  if (subscriptionNextPaymentEl) {
    subscriptionNextPaymentEl.textContent = `Next payment: ${formatDateValue(subscription.nextPaymentAt)}`;
  }

  if (!hasSteam) {
    if (stateEl) {
      stateEl.textContent = "Sign in with Steam on the account page to load application data.";
    }
    if (pendingCountEl) {
      pendingCountEl.textContent = "0";
    }
    if (closedCountEl) {
      closedCountEl.textContent = "0";
    }
    renderDashboardApplicationList(pendingListEl, [], "No pending applications.");
    renderDashboardApplicationList(closedListEl, [], "No closed applications.");
    return;
  }

  if (stateEl) {
    stateEl.textContent = "Loading application data...";
  }

  try {
    const response = await fetch(`${apiBaseUrl}/my-applications`, {
      credentials: "include",
    });

    if (!response.ok) {
      const cachedApplications = readCachedApplications();
      const isAuthFailure = response.status === 401 || response.status === 403;
      if (cachedApplications.length > 0) {
        renderApplicationsWithCounts(
          cachedApplications,
          isAuthFailure
            ? "Session expired. Showing your last saved applications. Log in again to refresh live data."
            : "Could not refresh applications. Showing your last saved applications."
        );
        return;
      }

      if (stateEl) {
        stateEl.textContent = isAuthFailure
          ? "Session expired. Log in again to load your applications."
          : "Could not load applications right now.";
      }
      if (pendingCountEl) {
        pendingCountEl.textContent = "0";
      }
      if (closedCountEl) {
        closedCountEl.textContent = "0";
      }
      renderDashboardApplicationList(pendingListEl, [], "No pending applications.");
      renderDashboardApplicationList(closedListEl, [], "No closed applications.");
      return;
    }

    const payload = await response.json();
    const applications = Array.isArray(payload.applications) ? payload.applications : [];
    writeCachedApplications(applications);
    renderApplicationsWithCounts(applications, "Application data is up to date.");
  } catch {
    const cachedApplications = readCachedApplications();
    if (cachedApplications.length > 0) {
      renderApplicationsWithCounts(cachedApplications, "Could not refresh applications. Showing your last saved applications.");
      return;
    }

    if (stateEl) {
      stateEl.textContent = "Could not load applications right now.";
    }
    if (pendingCountEl) {
      pendingCountEl.textContent = "0";
    }
    if (closedCountEl) {
      closedCountEl.textContent = "0";
    }
    renderDashboardApplicationList(pendingListEl, [], "No pending applications.");
    renderDashboardApplicationList(closedListEl, [], "No closed applications.");
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
  if (!hasLoggedInAccount()) {
    openSteamLoginModal();
    return;
  }

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

  connectButton.disabled = false;
  connectButton.removeAttribute("aria-disabled");

  connectButton.addEventListener("click", (event) => {
    event.preventDefault();
    openConnectQueueModal();
  });

  refreshConnectPanelStatus(populationEl, statusEl);

  if (connectQueuePollTimer === null) {
    connectQueuePollTimer = window.setInterval(() => {
      refreshConnectPanelStatus(populationEl, statusEl);
    }, connectQueuePollMs);
  }

  window.addEventListener("focus", () => {
    refreshConnectPanelStatus(populationEl, statusEl);
  });
}

async function syncAccountFromBackend() {
  try {
    const response = await fetch(authSessionUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(accountStorageKey);
        renderAccountState();
        updateAccountDropdownDetails();
        initAccountDashboardPage();
      }
      return;
    }

    const payload = await response.json();
    if (!payload.account) {
      localStorage.removeItem(accountStorageKey);
      renderAccountState();
      updateAccountDropdownDetails();
      initAccountDashboardPage();
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
    initAccountDashboardPage();
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
  const openIdResult = parseSteamOpenIdCallback(params);
  const provider = params.get("provider") || openIdResult?.provider || "";
  const status = params.get("status") || openIdResult?.status || "";
  const message = params.get("message") || openIdResult?.message || "";

  if (status === "success") {
    if (provider === "steam") {
      const existingState = readAccountState();
      const resolvedSteamName = params.get("steamName") || openIdResult?.steamName || "";
      const resolvedSteamAvatar = params.get("steamAvatar") || openIdResult?.steamAvatar || "";
      mergeAccountState({
        steamId: params.get("steamId") || openIdResult?.steamId || "",
        steamName: isPlaceholderSteamName(resolvedSteamName)
          ? (existingState.steamName || "Steam User")
          : resolvedSteamName,
        steamAvatar: resolvedSteamAvatar || existingState.steamAvatar || "",
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

let adminLoginModal = null;
let adminSessionState = {
  loggedIn: false,
  admin: null,
};

function getJoinButtons() {
  return Array.from(document.querySelectorAll(".join-btn"));
}

function readAdminAuthState() {
  try {
    return JSON.parse(localStorage.getItem(adminAuthStorageKey) || "{}") || {};
  } catch {
    return {};
  }
}

function writeAdminAuthState(nextState) {
  localStorage.setItem(adminAuthStorageKey, JSON.stringify(nextState || {}));
}

function readAdminApiToken() {
  try {
    return String(localStorage.getItem(adminApiTokenStorageKey) || "").trim();
  } catch {
    return "";
  }
}

function writeAdminApiToken(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    localStorage.removeItem(adminApiTokenStorageKey);
    return;
  }
  localStorage.setItem(adminApiTokenStorageKey, normalizedToken);
}

function clearAdminApiToken() {
  localStorage.removeItem(adminApiTokenStorageKey);
}

function shouldAllowLocalAdminFallback() {
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function buildAdminAuthHeaders() {
  const token = readAdminApiToken();
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

function sanitizeAdminAuthSnapshot(admin) {
  if (!admin || typeof admin !== "object") {
    return null;
  }

  if (!admin.id || !admin.username) {
    return null;
  }

  return {
    id: admin.id,
    username: admin.username,
    isMainAdmin: Boolean(admin.isMainAdmin),
    permissions: {
      applications: Boolean(admin.permissions?.applications),
      applicationAvailability: Boolean(admin.permissions?.applicationAvailability),
      websiteMaintenance: Boolean(admin.permissions?.websiteMaintenance),
      subscriptions: Boolean(admin.permissions?.subscriptions || admin.permissions?.giftSubscriptions),
      permissions: Boolean(admin.permissions?.permissions),
    },
  };
}

function ensureAdminLoginModal() {
  if (adminLoginModal) {
    return adminLoginModal;
  }

  adminLoginModal = document.createElement("div");
  adminLoginModal.className = "login-modal admin-login-modal";
  adminLoginModal.setAttribute("aria-hidden", "true");
  adminLoginModal.innerHTML = `
    <div class="login-modal-card admin-login-card" role="dialog" aria-modal="true" aria-labelledby="adminLoginTitle">
      <button class="modal-close" type="button" data-admin-close aria-label="Close staff login">X</button>
      <div class="steam-login-mark">Bloodline RP</div>
      <h2 id="adminLoginTitle">Staff Login</h2>
      <p class="steam-login-copy">Sign in with your staff credentials.</p>
      <form id="adminLoginForm" class="admin-login-form">
        <label for="adminUsernameInput">Username</label>
        <input id="adminUsernameInput" name="username" type="text" autocomplete="username" required />
        <label for="adminPasswordInput">Password</label>
        <input id="adminPasswordInput" name="password" type="password" autocomplete="current-password" required />
        <label class="admin-stay-signed">
          <input id="adminStaySignedInInput" name="staySignedIn" type="checkbox" />
          <span>Stay signed in</span>
        </label>
        <p id="adminLoginMessage" class="admin-login-message" hidden></p>
        <button class="connect-action" type="submit">Login</button>
      </form>
    </div>
  `;

  document.body.appendChild(adminLoginModal);

  const closeButton = adminLoginModal.querySelector("[data-admin-close]");
  if (closeButton) {
    closeButton.addEventListener("click", closeAdminLoginModal);
  }

  const form = adminLoginModal.querySelector("#adminLoginForm");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const usernameInput = form.querySelector("#adminUsernameInput");
      const passwordInput = form.querySelector("#adminPasswordInput");
      const staySignedInInput = form.querySelector("#adminStaySignedInInput");
      const messageEl = form.querySelector("#adminLoginMessage");

      if (!usernameInput || !passwordInput || !staySignedInInput || !messageEl) {
        return;
      }

      messageEl.hidden = true;
      const username = String(usernameInput.value || "").trim();
      const password = String(passwordInput.value || "").trim();
      const staySignedIn = Boolean(staySignedInInput.checked);

      if (!username || !password) {
        messageEl.textContent = "Enter username and password.";
        messageEl.hidden = false;
        return;
      }

      try {
        const response = await fetch(adminLoginUrl, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password, staySignedIn }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (!shouldAllowLocalAdminFallback()) {
            clearLocalAdminSession();
            clearAdminApiToken();
            messageEl.textContent = payload.error || "Login failed.";
            messageEl.hidden = false;
            return;
          }

          const localAdmin = localAdminLogin(username, password, staySignedIn);
          if (!localAdmin) {
            messageEl.textContent = payload.error || "Login failed.";
            messageEl.hidden = false;
            return;
          }

          adminSessionState = {
            loggedIn: true,
            admin: localAdmin,
          };
          writeAdminAuthState({
            staySignedIn,
            loggedIn: true,
            admin: sanitizeAdminAuthSnapshot(localAdmin),
            updatedAt: new Date().toISOString(),
          });
          clearAdminApiToken();
          closeAdminLoginModal();
          updateAdminJoinButtons();
          window.location.href = adminDashboardUrl;
          return;
        }

        const remoteAdmin = payload.admin || null;
        const localShadowAdmin = remoteAdmin
          ? upsertLocalAdminFromRemote(remoteAdmin, password, staySignedIn)
          : localAdminLogin(username, password, staySignedIn);

        adminSessionState = {
          loggedIn: true,
          admin: remoteAdmin || localShadowAdmin || null,
        };
        writeAdminAuthState({
          staySignedIn,
          loggedIn: true,
          admin: sanitizeAdminAuthSnapshot(remoteAdmin || localShadowAdmin),
          updatedAt: new Date().toISOString(),
        });
        writeAdminApiToken(payload.token || "");
        closeAdminLoginModal();
        updateAdminJoinButtons();
        window.location.href = adminDashboardUrl;
      } catch {
        if (!shouldAllowLocalAdminFallback()) {
          clearLocalAdminSession();
          clearAdminApiToken();
          messageEl.textContent = "Could not reach admin server.";
          messageEl.hidden = false;
          return;
        }

        const localAdmin = localAdminLogin(username, password, staySignedIn);
        if (!localAdmin) {
          messageEl.textContent = "Could not reach admin server.";
          messageEl.hidden = false;
          return;
        }

        adminSessionState = {
          loggedIn: true,
          admin: localAdmin,
        };
        writeAdminAuthState({
          staySignedIn,
          loggedIn: true,
          admin: sanitizeAdminAuthSnapshot(localAdmin),
          updatedAt: new Date().toISOString(),
        });
        clearAdminApiToken();
        closeAdminLoginModal();
        updateAdminJoinButtons();
        window.location.href = adminDashboardUrl;
      }
    });
  }

  return adminLoginModal;
}

function openAdminLoginModal() {
  const modal = ensureAdminLoginModal();
  const staySignedInInput = modal.querySelector("#adminStaySignedInInput");
  const saved = readAdminAuthState();
  if (staySignedInInput) {
    staySignedInInput.checked = Boolean(saved.staySignedIn);
  }
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  const usernameInput = modal.querySelector("#adminUsernameInput");
  if (usernameInput) {
    usernameInput.focus();
  }
}

window.openAdminLoginModal = openAdminLoginModal;

function closeAdminLoginModal() {
  if (!adminLoginModal) {
    return;
  }
  adminLoginModal.classList.remove("is-open");
  adminLoginModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function updateAdminJoinButtons() {
  const buttons = getJoinButtons();
  const forceDashboardAccess = Boolean(maintenanceGateEnabled) && isMaintenanceGatePage();
  buttons.forEach((button) => {
    if (adminSessionState.loggedIn || forceDashboardAccess) {
      button.textContent = "Staff Dashboard";
      button.setAttribute("href", adminDashboardUrl);
      button.setAttribute("aria-label", "Open staff dashboard");
    } else {
      button.textContent = "Staff Login";
      button.setAttribute("href", "#admin-login");
      button.setAttribute("aria-label", "Open staff login");
    }
  });
}

function attachAdminJoinButtonHandlers() {
  getJoinButtons().forEach((button) => {
    if (button.dataset.adminReady === "true") {
      return;
    }

    button.dataset.adminReady = "true";
    button.addEventListener("click", (event) => {
      if (adminSessionState.loggedIn || (Boolean(maintenanceGateEnabled) && isMaintenanceGatePage())) {
        return;
      }
      event.preventDefault();
      openAdminLoginModal();
    });
  });
}

async function refreshAdminSession() {
  const setCachedAdminState = () => {
    const snapshot = readAdminAuthState();
    if (snapshot?.loggedIn && snapshot?.admin?.id) {
      adminSessionState = {
        loggedIn: true,
        admin: snapshot.admin,
      };
      updateAdminJoinButtons();
      return true;
    }
    return false;
  };

  try {
    const response = await fetch(adminSessionUrl, {
      credentials: "include",
      headers: buildAdminAuthHeaders(),
    });

    if (!response.ok) {
      const isAuthFailure = response.status === 401 || response.status === 403;
      if (!isAuthFailure && setCachedAdminState()) {
        return;
      }

      if (!shouldAllowLocalAdminFallback()) {
        adminSessionState = {
          loggedIn: false,
          admin: null,
        };
        clearLocalAdminSession();
        if (isAuthFailure) {
          clearAdminApiToken();
        }
        writeAdminAuthState({
          ...readAdminAuthState(),
          loggedIn: false,
          admin: null,
          updatedAt: new Date().toISOString(),
        });
        updateAdminJoinButtons();
        return;
      }

      const localAdmin = resolveLocalAdminFromSession();
      if (localAdmin) {
        adminSessionState = {
          loggedIn: true,
          admin: localAdmin,
        };
        writeAdminAuthState({
          ...readAdminAuthState(),
          loggedIn: true,
          admin: sanitizeAdminAuthSnapshot(localAdmin),
          updatedAt: new Date().toISOString(),
        });
        updateAdminJoinButtons();
        return;
      }

      adminSessionState = {
        loggedIn: false,
        admin: null,
      };
      writeAdminAuthState({
        ...readAdminAuthState(),
        loggedIn: false,
        admin: null,
        updatedAt: new Date().toISOString(),
      });
      updateAdminJoinButtons();
      return;
    }

    const payload = await response.json();
    if (payload?.token) {
      writeAdminApiToken(payload.token);
    }
    adminSessionState = {
      loggedIn: true,
      admin: payload.admin || null,
    };
    writeAdminAuthState({
      ...readAdminAuthState(),
      loggedIn: true,
      admin: sanitizeAdminAuthSnapshot(payload.admin || null),
      updatedAt: new Date().toISOString(),
    });
    updateAdminJoinButtons();
  } catch {
    if (setCachedAdminState()) {
      return;
    }

    if (!shouldAllowLocalAdminFallback()) {
      adminSessionState = {
        loggedIn: false,
        admin: null,
      };
      clearLocalAdminSession();
      writeAdminAuthState({
        ...readAdminAuthState(),
        loggedIn: false,
        admin: null,
        updatedAt: new Date().toISOString(),
      });
      updateAdminJoinButtons();
      return;
    }

    const localAdmin = resolveLocalAdminFromSession();
    if (localAdmin) {
      adminSessionState = {
        loggedIn: true,
        admin: localAdmin,
      };
      writeAdminAuthState({
        ...readAdminAuthState(),
        loggedIn: true,
        admin: sanitizeAdminAuthSnapshot(localAdmin),
        updatedAt: new Date().toISOString(),
      });
      updateAdminJoinButtons();
      return;
    }

    adminSessionState = {
      loggedIn: false,
      admin: null,
    };
    writeAdminAuthState({
      ...readAdminAuthState(),
      loggedIn: false,
      admin: null,
      updatedAt: new Date().toISOString(),
    });
    updateAdminJoinButtons();
  }
}

async function applyMaintenanceGate() {
  if (!isMaintenanceGatePage()) {
    return;
  }

  setMaintenanceGate(readLocalMaintenanceMode());

  try {
    const cacheBustedStatusUrl = siteStatusUrl.includes("?")
      ? `${siteStatusUrl}&_ts=${Date.now()}`
      : `${siteStatusUrl}?_ts=${Date.now()}`;
    const response = await fetch(cacheBustedStatusUrl, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) {
      setMaintenanceGate(readLocalMaintenanceMode());
      return;
    }

    const payload = await response.json();
    const enabled = Boolean(payload?.maintenanceMode);
    writeLocalMaintenanceMode(enabled, {
      updatedAt: payload?.updatedAt,
      updatedBy: payload?.updatedBy,
    });
    setMaintenanceGate(enabled);
  } catch {
    setMaintenanceGate(readLocalMaintenanceMode());
  }
}

function initAdminEntry() {
  attachAdminJoinButtonHandlers();
  updateAdminJoinButtons();
  refreshAdminSession();
}

function readApplicationAvailabilityMap() {
  return readStoredJson(localStorage, appAvailabilityStorageKey, {});
}

function isAllowlistOpen() {
  const availability = readApplicationAvailabilityMap();
  if (!availability || typeof availability !== "object") {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(availability, "allowlist-app")) {
    return true;
  }
  return availability["allowlist-app"] !== false;
}

function updateAllowlistHeroButtonState() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  if (page !== "index.html" && page !== "") {
    return;
  }

  const allowlistButton = document.querySelector("a[href^='application-view.html?form=allowlist-app']");
  if (!allowlistButton) {
    return;
  }

  const open = isAllowlistOpen();
  const titleMarkup = '<span class="allowlist-btn-title">Allowlist Application</span>';
  if (open) {
    allowlistButton.innerHTML = titleMarkup;
    allowlistButton.setAttribute("href", "application-view.html?form=allowlist-app");
    allowlistButton.classList.remove("allowlist-btn-stacked");
    allowlistButton.classList.remove("btn-disabled");
    allowlistButton.removeAttribute("aria-disabled");
    return;
  }

  allowlistButton.innerHTML = `${titleMarkup}<span class="allowlist-btn-status">Closed</span>`;
  allowlistButton.classList.add("allowlist-btn-stacked");
  allowlistButton.removeAttribute("href");
  allowlistButton.classList.add("btn-disabled");
  allowlistButton.setAttribute("aria-disabled", "true");
}

function initRulesPageNavigation() {
  const sideNav = document.querySelector(".side-nav");
  if (!sideNav) {
    return;
  }

  const navLinks = Array.from(sideNav.querySelectorAll('a[href^="#"]'));
  if (!navLinks.length) {
    return;
  }

  const sections = navLinks
    .map((link) => {
      const hash = String(link.getAttribute("href") || "");
      if (!hash.startsWith("#") || hash.length < 2) {
        return null;
      }
      return document.getElementById(hash.slice(1));
    })
    .filter(Boolean);

  if (!sections.length) {
    return;
  }

  const linkBySectionId = new Map();
  navLinks.forEach((link) => {
    const hash = String(link.getAttribute("href") || "");
    const id = hash.startsWith("#") ? hash.slice(1) : "";
    if (id) {
      linkBySectionId.set(id, link);
    }
  });

  let manualActiveSectionId = "";
  let manualActiveUntil = 0;

  const setActiveLink = function (sectionId) {
    navLinks.forEach((link) => {
      const linkHash = String(link.getAttribute("href") || "");
      const isActive = linkHash === `#${sectionId}`;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const updateFromHash = function () {
    const hash = decodeURIComponent(String(window.location.hash || "").replace(/^#/, ""));
    if (hash && linkBySectionId.has(hash)) {
      setActiveLink(hash);
      return true;
    }
    return false;
  };

  navLinks.forEach((link) => {
    link.addEventListener("click", function () {
      const hash = String(link.getAttribute("href") || "");
      const id = hash.startsWith("#") ? hash.slice(1) : "";
      if (id) {
        manualActiveSectionId = id;
        manualActiveUntil = Date.now() + 900;
        setActiveLink(id);
      }
    });
  });

  if (!updateFromHash()) {
    setActiveLink(sections[0].id);
  }

  const syncActiveLinkToScroll = function () {
    if (manualActiveSectionId && Date.now() < manualActiveUntil) {
      setActiveLink(manualActiveSectionId);
      return;
    }

    manualActiveSectionId = "";
    const activationOffset = 170;
    let activeSectionId = sections[0].id;

    sections.forEach((section) => {
      const top = section.getBoundingClientRect().top;
      if (top - activationOffset <= 0) {
        activeSectionId = section.id;
      }
    });

    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (nearBottom) {
      activeSectionId = sections[sections.length - 1].id;
    }

    setActiveLink(activeSectionId);
  };

  window.addEventListener("hashchange", function () {
    if (!updateFromHash()) {
      syncActiveLinkToScroll();
    }
  });
  window.addEventListener("scroll", syncActiveLinkToScroll, { passive: true });
  window.addEventListener("resize", syncActiveLinkToScroll);
  setTimeout(syncActiveLinkToScroll, 0);
}

loginTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();

    if (!hasLoggedInAccount()) {
      openSteamLoginModal();
      return;
    }

    if (accountDropdownState?.dropdownEl) {
      toggleAccountDropdown();
      return;
    }

    openSteamLoginModal();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
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

document.addEventListener("click", async (event) => {
  const actionTarget = event.target instanceof Element
    ? event.target.closest('[data-auth-action="logout"]')
    : null;

  if (!actionTarget) {
    return;
  }

  event.preventDefault();
  await logoutAccount();
});

window.addEventListener("storage", (event) => {
  if (event.key === accountStorageKey) {
    renderAccountState();
    updateAccountDropdownDetails();
    initAccountDashboardPage();
  }

  if (event.key === localAdminSettingsKey) {
    setMaintenanceGate(readLocalMaintenanceMode());
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    applyMaintenanceGate();
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
    initAccountDashboardPage();
    closeSteamLoginModal();
  }
});

renderAccountState();
accountDropdownState = createAccountDropdown();
updateAccountDropdownDetails();
initAdminEntry();
applyMaintenanceGate();
setInterval(applyMaintenanceGate, maintenanceGatePollMs);
updateAllowlistHeroButtonState();
initRulesPageNavigation();
initSocialButtons();
initConnectPanel();
initStoreCart();
initAccountDashboardPage();

if (!handleAuthCallbackPage()) {
  syncAccountFromBackend();
}
