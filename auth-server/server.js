const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const FileStoreFactory = require("session-file-store");
const cors = require("cors");
const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const DiscordStrategy = require("passport-discord").Strategy;
const { normalizeAvatarValue } = require("./avatar-utils");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 3000);
const backendBaseUrl = process.env.BACKEND_BASE_URL || `http://localhost:${port}`;
const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:5500";
const frontendBaseUrls = (process.env.FRONTEND_BASE_URLS || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const sessionSecret = process.env.SESSION_SECRET || "change-me-in-production";
const runtimeIsSecure = backendBaseUrl.startsWith("https://") || process.env.NODE_ENV === "production";
const requestedSessionSameSite = (process.env.SESSION_COOKIE_SAME_SITE || (runtimeIsSecure ? "none" : "lax")).toLowerCase();
const sessionCookieSameSite = ["lax", "strict", "none"].includes(requestedSessionSameSite)
  ? requestedSessionSameSite
  : (runtimeIsSecure ? "none" : "lax");
const sessionCookieSecure = process.env.SESSION_COOKIE_SECURE
  ? String(process.env.SESSION_COOKIE_SECURE).toLowerCase() === "true"
  : runtimeIsSecure;
const steamApiKey = process.env.STEAM_API_KEY;
const discordClientId = process.env.DISCORD_CLIENT_ID;
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;
const discordGuildId = process.env.DISCORD_GUILD_ID || "";
const discordBotToken = process.env.DISCORD_BOT_TOKEN || "";
const discordInviteUrl = process.env.DISCORD_INVITE_URL || "";
const discordAllowlistRoleId = process.env.DISCORD_ALLOWLIST_ROLE_ID || "";
const discordSubscriptionRoleMap = (() => {
  try {
    const parsed = JSON.parse(process.env.DISCORD_SUBSCRIPTION_ROLE_MAP || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [String(key || "").trim().toLowerCase(), String(value || "").trim()])
        .filter(([key, value]) => key && value)
    );
  } catch {
    return {};
  }
})();

const steamEnabled = Boolean(steamApiKey);
const steamOpenIdEnabled = true;
const discordEnabled = Boolean(discordClientId && discordClientSecret);
const allowedFrontendOrigins = new Set([
  frontendBaseUrl,
  ...frontendBaseUrls,
  "http://localhost:5500",
  "https://nicknubbz1.github.io",
]);

const applicationTypes = [
  { key: "server", label: "Server Applications" },
  { key: "public-safety", label: "Public Safety" },
  { key: "city-hall", label: "City Hall Applications" },
  { key: "business-gang", label: "Business And Gang Applications" },
];
const validApplicationTypeKeys = new Set(applicationTypes.map((entry) => entry.key));
const applicationStorePath = path.join(__dirname, "data", "applications.json");
const archivedApplicationStorePath = path.join(__dirname, "data", "applications-archived.json");
const adminUsersStorePath = path.join(__dirname, "data", "admin-users.json");
const adminSettingsStorePath = path.join(__dirname, "data", "admin-settings.json");
const subscriptionsStorePath = path.join(__dirname, "data", "subscriptions.json");
const defaultMainAdminUsername = process.env.MAIN_ADMIN_USERNAME || "1234";
const defaultMainAdminPassword = process.env.MAIN_ADMIN_PASSWORD || "1234";
const adminSessionDays = Number(process.env.ADMIN_SESSION_DAYS || 30);
const accountSessionDays = Number(process.env.ACCOUNT_SESSION_DAYS || 30);
const adminApiTokenSecret = process.env.ADMIN_API_TOKEN_SECRET || sessionSecret;
const adminApiTokenDays = Number(process.env.ADMIN_API_TOKEN_DAYS || adminSessionDays || 30);
const sessionDataPath = path.join(__dirname, "data", "sessions");

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeResponses(rawResponses) {
  if (!Array.isArray(rawResponses)) {
    return [];
  }

  return rawResponses
    .map((item) => {
      const id = cleanText(item?.id, 80);
      const label = cleanText(item?.label, 220);
      const answer = cleanText(item?.answer, 3000);
      if (!id || !label) {
        return null;
      }
      return { id, label, answer };
    })
    .filter(Boolean);
}

function nowIso() {
  return new Date().toISOString();
}

function toBase64Url(rawValue) {
  return Buffer.from(String(rawValue || ""), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(base64UrlValue) {
  if (!base64UrlValue || typeof base64UrlValue !== "string") {
    return "";
  }

  const normalized = base64UrlValue
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padLength = normalized.length % 4;
  const padded = padLength ? `${normalized}${"=".repeat(4 - padLength)}` : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}

function signAdminApiToken(adminUserId, staySignedIn) {
  const normalizedUserId = cleanText(adminUserId, 120);
  if (!normalizedUserId) {
    return "";
  }

  const nowMs = Date.now();
  const maxDays = Number.isFinite(adminApiTokenDays) ? Math.max(1, adminApiTokenDays) : 30;
  const tokenLifetimeMs = Boolean(staySignedIn)
    ? 1000 * 60 * 60 * 24 * maxDays
    : 1000 * 60 * 60 * 12;
  const payload = {
    id: normalizedUserId,
    exp: nowMs + tokenLifetimeMs,
  };

  const payloadRaw = JSON.stringify(payload);
  const payloadEncoded = toBase64Url(payloadRaw);
  const signature = crypto
    .createHmac("sha256", adminApiTokenSecret)
    .update(payloadEncoded)
    .digest("hex");

  return `${payloadEncoded}.${signature}`;
}

function verifyAdminApiToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const [payloadEncoded, providedSignature] = token.split(".");
  if (!payloadEncoded || !providedSignature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", adminApiTokenSecret)
    .update(payloadEncoded)
    .digest("hex");

  if (providedSignature.length !== expectedSignature.length) {
    return null;
  }

  const matches = crypto.timingSafeEqual(
    Buffer.from(providedSignature, "utf8"),
    Buffer.from(expectedSignature, "utf8")
  );
  if (!matches) {
    return null;
  }

  try {
    const payloadRaw = fromBase64Url(payloadEncoded);
    const payload = JSON.parse(payloadRaw);
    const id = cleanText(payload?.id, 120);
    const exp = Number(payload?.exp || 0);
    if (!id || !Number.isFinite(exp) || exp <= Date.now()) {
      return null;
    }
    return { id };
  } catch {
    return null;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const digest = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return {
    salt,
    hash: digest,
  };
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) {
    return false;
  }
  const digest = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(expectedHash, "hex"));
}

function cleanUsername(value) {
  return cleanText(value, 40).toLowerCase();
}

function applyAccountSessionLifetime(req) {
  if (!req || !req.session || !req.session.cookie) {
    return;
  }

  req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * Math.max(1, accountSessionDays);
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let responseBody = "";

      response.on("data", (chunk) => {
        responseBody += chunk;
      });

      response.on("end", () => {
        resolve({
          statusCode: response.statusCode || 500,
          body: responseBody,
        });
      });
    });

    request.on("error", reject);
    if (body !== undefined && body !== null) {
      request.write(body);
    }
    request.end();
  });
}

function normalizePermissions(rawPermissions = {}) {
  return {
    applications: Boolean(rawPermissions.applications),
    applicationAvailability: Boolean(rawPermissions.applicationAvailability),
    websiteMaintenance: Boolean(rawPermissions.websiteMaintenance),
    subscriptions: Boolean(rawPermissions.subscriptions || rawPermissions.giftSubscriptions),
    permissions: Boolean(rawPermissions.permissions),
  };
}

function isMainAdmin(user) {
  return Boolean(user && user.isMainAdmin);
}

function sanitizeAdminUser(adminUser) {
  if (!adminUser) {
    return null;
  }
  return {
    id: adminUser.id,
    username: adminUser.username,
    isMainAdmin: Boolean(adminUser.isMainAdmin),
    permissions: normalizePermissions(adminUser.permissions),
    avatar: normalizeAvatarValue(adminUser.avatar),
    createdAt: adminUser.createdAt,
    updatedAt: adminUser.updatedAt,
  };
}

function buildSeedApplications() {
  return [];
}

function ensureApplicationStore() {
  const dataDir = path.dirname(applicationStorePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(applicationStorePath)) {
    const seed = { applications: buildSeedApplications() };
    fs.writeFileSync(applicationStorePath, JSON.stringify(seed, null, 2), "utf8");
  }
}

function ensureJsonFile(filePath, fallbackData) {
  const dataDir = path.dirname(filePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackData, null, 2), "utf8");
  }
}

function readJsonFile(filePath, fallbackData) {
  ensureJsonFile(filePath, fallbackData);

  const readParsedJson = (targetPath) => {
    try {
      const raw = fs.readFileSync(targetPath, "utf8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const primaryData = readParsedJson(filePath);
  if (primaryData !== null) {
    return primaryData;
  }

  const backupPath = `${filePath}.bak`;
  const backupData = readParsedJson(backupPath);
  if (backupData !== null) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), "utf8");
    } catch {
      // Ignore restoration failures and still return parsed backup data.
    }
    return backupData;
  }

  try {
    return JSON.parse(JSON.stringify(fallbackData));
  } catch {
    return fallbackData;
  }
}

function writeJsonFile(filePath, nextValue) {
  ensureJsonFile(filePath, nextValue);
  const serialized = JSON.stringify(nextValue, null, 2);
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;

  try {
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
    }

    fs.writeFileSync(tempPath, serialized, "utf8");
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore temp cleanup errors.
    }
    throw error;
  }
}

function readArchivedApplicationStore() {
  const store = readJsonFile(archivedApplicationStorePath, { applications: [] });
  if (!Array.isArray(store.applications)) {
    return { applications: [] };
  }
  return store;
}

function writeArchivedApplicationStore(nextStore) {
  writeJsonFile(archivedApplicationStorePath, nextStore);
}

function readAdminUsersStore() {
  const store = readJsonFile(adminUsersStorePath, { users: [] });
  if (!Array.isArray(store.users)) {
    return { users: [] };
  }
  return store;
}

function writeAdminUsersStore(nextStore) {
  writeJsonFile(adminUsersStorePath, nextStore);
}

function readAdminSettingsStore() {
  const store = readJsonFile(adminSettingsStorePath, {
    maintenanceMode: false,
    updatedAt: nowIso(),
    updatedBy: "system",
  });
  return {
    maintenanceMode: Boolean(store.maintenanceMode),
    updatedAt: store.updatedAt || nowIso(),
    updatedBy: store.updatedBy || "system",
  };
}

function writeAdminSettingsStore(nextStore) {
  writeJsonFile(adminSettingsStorePath, {
    maintenanceMode: Boolean(nextStore.maintenanceMode),
    updatedAt: nextStore.updatedAt || nowIso(),
    updatedBy: nextStore.updatedBy || "system",
  });
}

function readSubscriptionsStore() {
  const store = readJsonFile(subscriptionsStorePath, {
    current: [],
    ended: [],
  });
  return {
    current: Array.isArray(store.current) ? store.current : [],
    ended: Array.isArray(store.ended) ? store.ended : [],
  };
}

function writeSubscriptionsStore(nextStore) {
  writeJsonFile(subscriptionsStorePath, {
    current: Array.isArray(nextStore.current) ? nextStore.current : [],
    ended: Array.isArray(nextStore.ended) ? nextStore.ended : [],
  });
}

function ensureAdminBootstrapUser() {
  const store = readAdminUsersStore();
  const users = store.users || [];
  if (users.length > 0) {
    return;
  }

  const now = nowIso();
  const credentials = hashPassword(defaultMainAdminPassword);
  users.push({
    id: crypto.randomUUID(),
    username: cleanUsername(defaultMainAdminUsername),
    isMainAdmin: true,
    permissions: {
      applications: true,
      applicationAvailability: true,
      websiteMaintenance: true,
      subscriptions: true,
      permissions: true,
    },
    passwordSalt: credentials.salt,
    passwordHash: credentials.hash,
    createdAt: now,
    updatedAt: now,
  });

  writeAdminUsersStore({ users });
}

function readApplicationStore() {
  const store = readJsonFile(applicationStorePath, { applications: [] });
  if (!Array.isArray(store.applications)) {
    return { applications: [] };
  }

  return store;
}

function writeApplicationStore(nextStore) {
  writeJsonFile(applicationStorePath, nextStore);
}

function getApplicationById(applications, id) {
  return applications.find((application) => application.id === id) || null;
}

function findApplicationRecordById(id) {
  const activeStore = readApplicationStore();
  const activeApplication = getApplicationById(activeStore.applications, id);
  if (activeApplication) {
    return {
      source: "active",
      application: activeApplication,
      activeStore,
      archivedStore: null,
    };
  }

  const archivedStore = readArchivedApplicationStore();
  const archivedApplication = getApplicationById(archivedStore.applications, id);
  if (archivedApplication) {
    return {
      source: "archived",
      application: archivedApplication,
      activeStore: null,
      archivedStore,
    };
  }

  return null;
}

function buildSteamOpenIdUrl() {
  const returnUrl = `${backendBaseUrl}/auth/steam/return`;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnUrl,
    "openid.realm": backendBaseUrl,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  return `https://steamcommunity.com/openid/login?${params.toString()}`;
}

async function verifySteamOpenIdAssertion(searchParams) {
  const params = new URLSearchParams(searchParams);
  params.set("openid.mode", "check_authentication");

  const response = await httpsRequest(
    {
      method: "POST",
      hostname: "steamcommunity.com",
      path: "/openid/login",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
    params.toString()
  );

  if (response.statusCode < 200 || response.statusCode >= 300) {
    return false;
  }

  return /is_valid\s*:\s*true/i.test(response.body || "");
}

async function fetchSteamProfileFallback(steamId) {
  const normalizedSteamId = cleanText(steamId, 80);
  if (!/^\d{17}$/.test(normalizedSteamId)) {
    return {
      steamId: normalizedSteamId,
      displayName: "Steam User",
      avatar: "",
    };
  }

  try {
    const xmlResponse = await httpsRequest({
      method: "GET",
      hostname: "steamcommunity.com",
      path: `/profiles/${normalizedSteamId}/?xml=1`,
    });

    const xml = String(xmlResponse.body || "");
    const xmlNameMatch = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/i);
    const xmlAvatarMatch = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/i)
      || xml.match(/<avatarMedium><!\[CDATA\[(.*?)\]\]><\/avatarMedium>/i)
      || xml.match(/<avatarIcon><!\[CDATA\[(.*?)\]\]><\/avatarIcon>/i);

    let displayName = cleanText(xmlNameMatch?.[1] || "", 120);
    let avatar = cleanText(xmlAvatarMatch?.[1] || "", 500);

    if (!displayName || !avatar) {
      const htmlResponse = await httpsRequest({
        method: "GET",
        hostname: "steamcommunity.com",
        path: `/profiles/${normalizedSteamId}`,
      });
      const html = String(htmlResponse.body || "");
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const ogTitleMatch = html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i);
      const avatarMatch = html.match(/https:\/\/avatars\.(?:cloudflare\.)?steamstatic\.com\/[a-f0-9]+_(?:full|medium|icon)\.jpg/i);

      if (!displayName) {
        displayName = cleanText(String(ogTitleMatch?.[1] || titleMatch?.[1] || "").replace(/^Steam Community\s*::\s*/i, ""), 120);
      }
      if (!avatar) {
        avatar = cleanText(avatarMatch?.[0] || "", 500);
      }
    }

    return {
      steamId: normalizedSteamId,
      displayName: displayName || "Steam User",
      avatar,
    };
  } catch {
    return {
      steamId: normalizedSteamId,
      displayName: "Steam User",
      avatar: "",
    };
  }
}

function normalizeTierKey(value) {
  return String(value || "").trim().toLowerCase();
}

function isAllowlistApplication(application) {
  const formKey = cleanText(application?.formKey || "", 80).toLowerCase();
  const title = cleanText(application?.title || "", 120).toLowerCase();
  return formKey === "allowlist-app" || title === "allowlist application";
}

function hasAcceptedAllowlistForSteamId(steamId) {
  const normalizedSteamId = cleanText(steamId, 80);
  if (!normalizedSteamId) {
    return false;
  }

  const matchesAcceptedAllowlist = (application) => {
    return String(application?.status || "").toLowerCase() === "accepted"
      && isAllowlistApplication(application)
      && String(application?.applicant?.steamId || "").trim() === normalizedSteamId;
  };

  const activeStore = readApplicationStore();
  if (activeStore.applications.some(matchesAcceptedAllowlist)) {
    return true;
  }

  const archivedStore = readArchivedApplicationStore();
  return archivedStore.applications.some(matchesAcceptedAllowlist);
}

function getEntitledSubscriptionRoleIds(account) {
  const steamId = cleanText(account?.steamId || "", 80);
  const discordId = cleanText(account?.discordId || "", 80);
  const subscriptions = readSubscriptionsStore();
  const entitledRoleIds = new Set();

  subscriptions.current.forEach((entry) => {
    const entrySteamId = cleanText(entry?.steamId || "", 80);
    const entryDiscordId = cleanText(entry?.discordId || "", 80);
    const isMatch = (steamId && entrySteamId === steamId) || (discordId && entryDiscordId === discordId);
    if (!isMatch) {
      return;
    }

    const roleId = discordSubscriptionRoleMap[normalizeTierKey(entry?.tier)];
    if (roleId) {
      entitledRoleIds.add(roleId);
    }
  });

  return entitledRoleIds;
}

function discordRequest(method, pathname, body) {
  return httpsRequest(
    {
      method,
      hostname: "discord.com",
      path: `/api/v10${pathname}`,
      headers: {
        Authorization: `Bot ${discordBotToken}`,
        "Content-Type": "application/json",
        "User-Agent": "BloodlineRP-Website/1.0",
      },
    },
    body !== undefined ? JSON.stringify(body) : undefined
  );
}

function discordGet(pathname) {
  return discordRequest("GET", pathname);
}

function discordPut(pathname) {
  return discordRequest("PUT", pathname);
}

function discordDelete(pathname) {
  return discordRequest("DELETE", pathname);
}

async function fetchDiscordGuildMember(discordId) {
  if (!discordGuildId || !discordBotToken || !discordId) {
    return null;
  }

  const response = await discordGet(`/guilds/${discordGuildId}/members/${discordId}`);

  if (response.statusCode === 404) {
    return null;
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Discord role check failed (${response.statusCode}).`);
  }

  return JSON.parse(response.body || "{}");
}

async function fetchDiscordMemberRoles(discordId) {
  if (!discordGuildId || !discordBotToken || !discordId) {
    return [];
  }

  const payload = await fetchDiscordGuildMember(discordId);
  if (!payload) {
    return [];
  }

  if (!Array.isArray(payload.roles)) {
    return [];
  }

  return payload.roles;
}

async function addDiscordRole(discordId, roleId) {
  const response = await discordPut(`/guilds/${discordGuildId}/members/${discordId}/roles/${roleId}`);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Discord role add failed (${response.statusCode}).`);
  }
}

async function removeDiscordRole(discordId, roleId) {
  const response = await discordDelete(`/guilds/${discordGuildId}/members/${discordId}/roles/${roleId}`);
  if (response.statusCode === 404) {
    return;
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Discord role remove failed (${response.statusCode}).`);
  }
}

async function syncDiscordEntitlementRoles(account) {
  const steamId = cleanText(account?.steamId || "", 80);
  const discordId = cleanText(account?.discordId || "", 80);
  if (!steamId || !discordId || !discordGuildId || !discordBotToken) {
    return { skipped: true, added: [], removed: [] };
  }

  const currentRoles = await fetchDiscordMemberRoles(discordId);
  const currentRoleSet = new Set(currentRoles);
  const added = [];
  const removed = [];

  if (discordAllowlistRoleId && hasAcceptedAllowlistForSteamId(steamId) && !currentRoleSet.has(discordAllowlistRoleId)) {
    await addDiscordRole(discordId, discordAllowlistRoleId);
    currentRoleSet.add(discordAllowlistRoleId);
    added.push(discordAllowlistRoleId);
  }

  const desiredSubscriptionRoleIds = getEntitledSubscriptionRoleIds(account);
  const managedSubscriptionRoleIds = new Set(Object.values(discordSubscriptionRoleMap));

  for (const roleId of managedSubscriptionRoleIds) {
    if (currentRoleSet.has(roleId) && !desiredSubscriptionRoleIds.has(roleId)) {
      await removeDiscordRole(discordId, roleId);
      currentRoleSet.delete(roleId);
      removed.push(roleId);
    }
  }

  for (const roleId of desiredSubscriptionRoleIds) {
    if (!currentRoleSet.has(roleId)) {
      await addDiscordRole(discordId, roleId);
      currentRoleSet.add(roleId);
      added.push(roleId);
    }
  }

  return { skipped: false, added, removed };
}

function buildFrontendUrl(page, params = {}) {
  const url = new URL(page, frontendBaseUrl.endsWith("/") ? frontendBaseUrl : `${frontendBaseUrl}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function redirectAuthError(res, provider, message) {
  res.redirect(buildFrontendUrl("auth-callback.html", {
    provider,
    status: "error",
    message,
  }));
}

function requireSteamSession(req, res, next) {
  if (!req.session.account?.steamId) {
    redirectAuthError(res, "discord", "Steam login is required before Discord can be linked.");
    return;
  }
  next();
}

function requireLinkedAccount(req, res, next) {
  const account = req.session.account;
  if (!account?.steamId || !account?.discordId) {
    res.status(401).json({ error: "Steam and Discord must both be linked to continue." });
    return;
  }
  next();
}

function requireAdminSession(req, res, next) {
  const sessionAdmin = req.session.adminUser;
  let adminUserId = cleanText(sessionAdmin?.id || "", 120);

  if (!adminUserId) {
    const authHeader = String(req.headers.authorization || "");
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch && bearerMatch[1]) {
      const verified = verifyAdminApiToken(String(bearerMatch[1]).trim());
      if (verified?.id) {
        adminUserId = verified.id;
        req.session.adminUser = {
          id: adminUserId,
        };
      }
    }
  }

  if (!adminUserId) {
    res.status(401).json({ error: "Admin login required." });
    return;
  }

  const store = readAdminUsersStore();
  const adminUser = store.users.find((user) => user.id === adminUserId) || null;
  if (!adminUser) {
    req.session.adminUser = null;
    res.status(401).json({ error: "Admin account no longer exists." });
    return;
  }

  req.adminUser = adminUser;
  next();
}

function requireAdminPermission(permissionKey) {
  return (req, res, next) => {
    const adminUser = req.adminUser;
    const permissions = normalizePermissions(adminUser?.permissions);
    if (isMainAdmin(adminUser)) {
      next();
      return;
    }

    if (!permissions[permissionKey]) {
      res.status(403).json({ error: "You do not have permission for this area." });
      return;
    }

    next();
  };
}

app.set("trust proxy", 1);
if (!fs.existsSync(sessionDataPath)) {
  fs.mkdirSync(sessionDataPath, { recursive: true });
}
const FileStore = FileStoreFactory(session);
const sessionStore = new FileStore({
  path: sessionDataPath,
  retries: 1,
  ttl: 60 * 60 * 24 * Math.max(1, accountSessionDays),
});
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedFrontendOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("CORS origin blocked"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(session({
  secret: sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: sessionCookieSameSite,
    secure: sessionCookieSecure,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (steamEnabled) {
  passport.use(new SteamStrategy(
    {
      returnURL: `${backendBaseUrl}/auth/steam/return`,
      realm: backendBaseUrl,
      apiKey: steamApiKey,
    },
    (_identifier, profile, done) => {
      const user = {
        provider: "steam",
        steamId: profile.id,
        displayName: profile.displayName,
        avatar: profile.photos?.[2]?.value || profile.photos?.[0]?.value || "",
      };
      done(null, user);
    }
  ));
}

if (discordEnabled) {
  passport.use(new DiscordStrategy(
    {
      clientID: discordClientId,
      clientSecret: discordClientSecret,
      callbackURL: `${backendBaseUrl}/auth/discord/callback`,
      scope: ["identify"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (discordGuildId && discordBotToken) {
          const guildMember = await fetchDiscordGuildMember(profile.id);
          if (!guildMember) {
            done(null, false, {
              message: "Join the Bloodline Discord server before linking your Discord account.",
            });
            return;
          }
        }

        const roles = await fetchDiscordMemberRoles(profile.id);
        const user = {
          provider: "discord",
          discordId: profile.id,
          username: profile.username,
          globalName: profile.global_name || profile.username,
          avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : "",
          accessToken,
          refreshToken,
          discordRoles: roles,
        };
        done(null, user);
      } catch (error) {
        done(error);
      }
    }
  ));
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    steamEnabled,
    steamOpenIdEnabled,
    discordEnabled,
    backendBaseUrl,
    frontendBaseUrl,
  });
});

app.get("/auth/session", (req, res) => {
  const account = req.session.account || null;
  res.json({
    account,
    steamEnabled,
    discordEnabled,
  });
});

app.get("/auth/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });
});

app.get("/auth/steam", (req, res, next) => {
  if (!steamEnabled) {
    res.redirect(buildSteamOpenIdUrl());
    return;
  }
  passport.authenticate("steam")(req, res, next);
});

app.get("/auth/steam/return", (req, res, next) => {
  if (!steamEnabled) {
    (async () => {
      const params = new URLSearchParams(req.query);
      const mode = params.get("openid.mode") || "";
      const claimedId = params.get("openid.claimed_id") || "";
      const steamIdMatch = claimedId.match(/\/(\d+)$/);

      if (mode === "cancel") {
        redirectAuthError(res, "steam", "Steam sign-in was cancelled.");
        return;
      }

      if (mode !== "id_res" || !steamIdMatch) {
        redirectAuthError(res, "steam", "Steam authentication could not be completed.");
        return;
      }

      const isValid = await verifySteamOpenIdAssertion(params);
      if (!isValid) {
        redirectAuthError(res, "steam", "Steam authentication could not be verified.");
        return;
      }

      const user = await fetchSteamProfileFallback(steamIdMatch[1]);
      req.session.account = {
        ...(req.session.account || {}),
        steamId: user.steamId,
        steamName: user.displayName,
        steamAvatar: user.avatar,
      };
      applyAccountSessionLifetime(req);

      res.redirect(buildFrontendUrl("auth-callback.html", {
        provider: "steam",
        status: "success",
        steamId: user.steamId,
        steamName: user.displayName,
        steamAvatar: user.avatar,
      }));
    })().catch(() => {
      redirectAuthError(res, "steam", "Steam authentication failed.");
    });
    return;
  }

  passport.authenticate("steam", (error, user) => {
    if (error || !user) {
      redirectAuthError(res, "steam", "Steam authentication failed.");
      return;
    }

    req.logIn(user, (loginError) => {
      if (loginError) {
        redirectAuthError(res, "steam", "Steam session could not be created.");
        return;
      }

      req.session.account = {
        ...(req.session.account || {}),
        steamId: user.steamId,
        steamName: user.displayName,
        steamAvatar: user.avatar,
      };
      applyAccountSessionLifetime(req);

      res.redirect(buildFrontendUrl("auth-callback.html", {
        provider: "steam",
        status: "success",
        steamId: user.steamId,
        steamName: user.displayName,
        steamAvatar: user.avatar,
      }));
    });
  })(req, res, next);
});

app.get("/auth/discord", requireSteamSession, (req, res, next) => {
  if (!discordEnabled) {
    redirectAuthError(res, "discord", "Discord auth is not configured on the backend yet.");
    return;
  }
  passport.authenticate("discord")(req, res, next);
});

app.get("/auth/discord/callback", requireSteamSession, (req, res, next) => {
  if (!discordEnabled) {
    redirectAuthError(res, "discord", "Discord auth is not configured on the backend yet.");
    return;
  }

  passport.authenticate("discord", (error, user, info) => {
    if (error) {
      redirectAuthError(res, "discord", "Discord authentication failed.");
      return;
    }

    if (!user) {
      const fallbackMessage = "Discord authentication failed.";
      const joinMessage = "Join the Bloodline Discord server before linking your Discord account.";
      const message = cleanText(info?.message || "", 240) || fallbackMessage;
      redirectAuthError(res, "discord", message.includes("Join the Bloodline Discord server") ? joinMessage : message);
      return;
    }

    req.session.account = {
      ...(req.session.account || {}),
      discordId: user.discordId,
      discordName: user.globalName,
      discordUsername: user.username,
      discordAvatar: user.avatar,
      discordRoles: user.discordRoles || [],
    };
    applyAccountSessionLifetime(req);

    syncDiscordEntitlementRoles(req.session.account)
      .then(async () => {
        try {
          req.session.account.discordRoles = await fetchDiscordMemberRoles(user.discordId);
        } catch {
          req.session.account.discordRoles = user.discordRoles || [];
        }

        res.redirect(buildFrontendUrl("auth-callback.html", {
          provider: "discord",
          status: "success",
          discordId: user.discordId,
          discordName: user.globalName,
          discordUsername: user.username,
          discordAvatar: user.avatar,
        }));
      })
      .catch(() => {
        res.redirect(buildFrontendUrl("auth-callback.html", {
          provider: "discord",
          status: "success",
          discordId: user.discordId,
          discordName: user.globalName,
          discordUsername: user.username,
          discordAvatar: user.avatar,
        }));
      });
  })(req, res, next);
});

app.get("/api/application-types", (_req, res) => {
  res.json({
    types: applicationTypes,
  });
});

app.get("/api/discord/stats", async (_req, res) => {
  if (!discordGuildId || !discordBotToken) {
    res.status(503).json({
      error: "Discord stats are not configured.",
      inviteUrl: discordInviteUrl,
    });
    return;
  }

  try {
    const response = await discordGet(`/guilds/${discordGuildId}?with_counts=true`);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      res.status(502).json({
        error: `Discord stats request failed (${response.statusCode}).`,
        inviteUrl: discordInviteUrl,
      });
      return;
    }

    const payload = JSON.parse(response.body || "{}");
    const memberCount = Number(payload.approximate_member_count ?? payload.member_count ?? 0);
    const onlineCount = Number(payload.approximate_presence_count ?? payload.presence_count ?? 0);

    res.json({
      memberCount: Number.isFinite(memberCount) ? memberCount : 0,
      onlineCount: Number.isFinite(onlineCount) ? onlineCount : 0,
      inviteUrl: discordInviteUrl,
    });
  } catch (error) {
    res.status(500).json({
      error: "Could not load Discord stats.",
      details: error.message || "Unknown error",
      inviteUrl: discordInviteUrl,
    });
  }
});

app.post("/api/applications", requireLinkedAccount, (req, res) => {
  const type = cleanText(req.body.type, 40).toLowerCase();
  const requestedTitle = cleanText(req.body.title, 80);
  const body = cleanText(req.body.body || req.body.message, 3000);
  const formKey = cleanText(req.body.formKey, 80);
  const responses = normalizeResponses(req.body.responses);

  if (!validApplicationTypeKeys.has(type)) {
    res.status(400).json({ error: "Invalid application type." });
    return;
  }

  if (!body) {
    res.status(400).json({ error: "Application details are required." });
    return;
  }

  if (responses.length === 0) {
    res.status(400).json({ error: "Application responses are required." });
    return;
  }

  const matchedType = applicationTypes.find((entry) => entry.key === type);
  const title = requestedTitle || matchedType?.label || "Application";
  const createdAt = nowIso();
  const nextApplication = {
    id: crypto.randomUUID(),
    type,
    title,
    status: "pending",
    body,
    formKey,
    responses,
    applicant: {
      steamId: req.session.account.steamId,
      steamName: req.session.account.steamName || "Unknown Steam User",
      discordId: req.session.account.discordId,
      discordName: req.session.account.discordName || req.session.account.discordUsername || "Unknown Discord User",
    },
    replies: [],
    createdAt,
    updatedAt: createdAt,
    reviewedBy: null,
  };

  const store = readApplicationStore();
  store.applications.unshift(nextApplication);
  writeApplicationStore(store);

  res.status(201).json({
    ok: true,
    application: nextApplication,
  });
});

app.get("/api/my-applications", requireLinkedAccount, (req, res) => {
  const activeStore = readApplicationStore();
  const archivedStore = readArchivedApplicationStore();
  const targetSteamId = String(req.session.account?.steamId || "").trim();

  const matchesUser = (application) => String(application?.applicant?.steamId || "").trim() === targetSteamId;

  const mergedById = new Map();
  [...activeStore.applications, ...archivedStore.applications]
    .filter(matchesUser)
    .forEach((application) => {
      const id = String(application?.id || "").trim();
      if (!id) {
        return;
      }
      mergedById.set(id, application);
    });

  const myApplications = Array.from(mergedById.values()).sort((left, right) => {
    return Date.parse(right?.createdAt || 0) - Date.parse(left?.createdAt || 0);
  });

  res.json({
    applications: myApplications,
  });
});

app.patch("/api/my-applications/:id", requireLinkedAccount, (req, res) => {
  const store = readApplicationStore();
  const application = getApplicationById(store.applications, req.params.id);

  if (!application || application.applicant?.steamId !== req.session.account.steamId) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  const status = String(application.status || "").toLowerCase();
  if (status === "accepted" || status === "denied") {
    res.status(409).json({ error: "Closed applications can no longer be edited." });
    return;
  }

  const responses = normalizeResponses(req.body.responses);
  if (responses.length === 0) {
    res.status(400).json({ error: "Application responses are required." });
    return;
  }

  application.responses = responses;
  application.body = responses
    .filter((entry) => entry.answer)
    .map((entry) => `${entry.label}: ${entry.answer}`)
    .join("\n");
  application.updatedAt = nowIso();

  writeApplicationStore(store);

  res.json({
    ok: true,
    application,
  });
});

app.get("/api/site-status", (_req, res) => {
  const settings = readAdminSettingsStore();
  res.json({
    maintenanceMode: settings.maintenanceMode,
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
  });
});

app.post("/api/admin/login", (req, res) => {
  const username = cleanUsername(req.body.username);
  const password = cleanText(req.body.password, 120);
  const staySignedIn = Boolean(req.body.staySignedIn);

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  const store = readAdminUsersStore();
  const adminUser = store.users.find((entry) => entry.username === username);
  if (!adminUser || !verifyPassword(password, adminUser.passwordSalt, adminUser.passwordHash)) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  req.session.adminUser = {
    id: adminUser.id,
  };

  if (staySignedIn) {
    req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * Math.max(1, adminSessionDays);
  } else {
    req.session.cookie.expires = false;
  }

  const token = signAdminApiToken(adminUser.id, staySignedIn);

  res.json({
    ok: true,
    admin: sanitizeAdminUser(adminUser),
    token,
  });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.adminUser = null;
  res.json({ ok: true });
});

app.get("/api/admin/session", requireAdminSession, (req, res) => {
  res.json({
    ok: true,
    admin: sanitizeAdminUser(req.adminUser),
  });
});

app.post("/api/admin/verify-current-password", requireAdminSession, (req, res) => {
  const currentPassword = cleanText(req.body.currentPassword, 120);

  if (!verifyPassword(currentPassword, req.adminUser.passwordSalt, req.adminUser.passwordHash)) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  res.json({ ok: true });
});

app.post("/api/admin/change-password", requireAdminSession, (req, res) => {
  const currentPassword = cleanText(req.body.currentPassword, 120);
  const nextPassword = cleanText(req.body.newPassword, 120);

  if (!nextPassword) {
    res.status(400).json({ error: "New password is required." });
    return;
  }

  if (!verifyPassword(currentPassword, req.adminUser.passwordSalt, req.adminUser.passwordHash)) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  const credentials = hashPassword(nextPassword);
  const store = readAdminUsersStore();
  const target = store.users.find((entry) => entry.id === req.adminUser.id);
  if (!target) {
    res.status(404).json({ error: "Admin account not found." });
    return;
  }

  target.passwordSalt = credentials.salt;
  target.passwordHash = credentials.hash;
  target.updatedAt = nowIso();
  writeAdminUsersStore(store);

  res.json({ ok: true });
});

app.post("/api/admin/change-username", requireAdminSession, (req, res) => {
  if (!isMainAdmin(req.adminUser)) {
    res.status(403).json({ error: "Only the main admin can change username." });
    return;
  }

  const nextUsername = cleanUsername(req.body.username);
  if (!nextUsername) {
    res.status(400).json({ error: "Username is required." });
    return;
  }

  const store = readAdminUsersStore();
  if (store.users.some((entry) => entry.username === nextUsername && entry.id !== req.adminUser.id)) {
    res.status(409).json({ error: "Username already exists." });
    return;
  }

  const target = store.users.find((entry) => entry.id === req.adminUser.id);
  if (!target) {
    res.status(404).json({ error: "Admin account not found." });
    return;
  }

  target.username = nextUsername;
  target.updatedAt = nowIso();
  writeAdminUsersStore(store);

  req.session.adminUser = { id: target.id };
  res.json({ ok: true, admin: sanitizeAdminUser(target) });
});

app.post("/api/admin/avatar", requireAdminSession, (req, res) => {
  const nextAvatar = normalizeAvatarValue(req.body?.avatar || req.body?.avatarUrl || "", { maxBytes: 1024 * 1024 });
  if (!nextAvatar) {
    res.status(400).json({ error: "A valid image is required." });
    return;
  }

  const store = readAdminUsersStore();
  const target = store.users.find((entry) => entry.id === req.adminUser.id);
  if (!target) {
    res.status(404).json({ error: "Admin account not found." });
    return;
  }

  target.avatar = nextAvatar;
  target.updatedAt = nowIso();
  writeAdminUsersStore(store);

  req.session.adminUser = { id: target.id };
  res.json({ ok: true, admin: sanitizeAdminUser(target) });
});

app.get("/api/admin/users", requireAdminSession, requireAdminPermission("permissions"), (_req, res) => {
  const store = readAdminUsersStore();
  res.json({
    users: store.users.map((entry) => sanitizeAdminUser(entry)),
  });
});

app.post("/api/admin/users", requireAdminSession, requireAdminPermission("permissions"), (req, res) => {
  const username = cleanUsername(req.body.username);
  const password = cleanText(req.body.password, 120);
  const permissions = normalizePermissions(req.body.permissions || {});

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  const store = readAdminUsersStore();
  if (store.users.some((entry) => entry.username === username)) {
    res.status(409).json({ error: "Username already exists." });
    return;
  }

  const credentials = hashPassword(password);
  const now = nowIso();
  const createdUser = {
    id: crypto.randomUUID(),
    username,
    isMainAdmin: false,
    permissions,
    passwordSalt: credentials.salt,
    passwordHash: credentials.hash,
    createdAt: now,
    updatedAt: now,
  };

  store.users.push(createdUser);
  writeAdminUsersStore(store);

  res.status(201).json({
    ok: true,
    user: sanitizeAdminUser(createdUser),
  });
});

app.patch("/api/admin/users/:id", requireAdminSession, requireAdminPermission("permissions"), (req, res) => {
  const store = readAdminUsersStore();
  const target = store.users.find((entry) => entry.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: "Admin profile not found." });
    return;
  }

  if (target.isMainAdmin && !isMainAdmin(req.adminUser)) {
    res.status(403).json({ error: "Only the main admin can modify the main profile." });
    return;
  }

  if (req.body.permissions && !target.isMainAdmin) {
    target.permissions = normalizePermissions(req.body.permissions);
  }

  const nextPassword = cleanText(req.body.newPassword, 120);
  if (nextPassword) {
    const credentials = hashPassword(nextPassword);
    target.passwordSalt = credentials.salt;
    target.passwordHash = credentials.hash;
  }

  target.updatedAt = nowIso();
  writeAdminUsersStore(store);

  res.json({
    ok: true,
    user: sanitizeAdminUser(target),
  });
});

app.delete("/api/admin/users/:id", requireAdminSession, requireAdminPermission("permissions"), (req, res) => {
  const store = readAdminUsersStore();
  const target = store.users.find((entry) => entry.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: "Admin profile not found." });
    return;
  }

  if (target.isMainAdmin) {
    res.status(403).json({ error: "Main admin profile cannot be deleted." });
    return;
  }

  const nextUsers = store.users.filter((entry) => entry.id !== target.id);
  writeAdminUsersStore({ users: nextUsers });
  res.json({ ok: true });
});

app.get("/api/admin/settings", requireAdminSession, (req, res) => {
  const settings = readAdminSettingsStore();
  res.json({
    settings,
    canManageMaintenance: isMainAdmin(req.adminUser) || normalizePermissions(req.adminUser.permissions).websiteMaintenance,
  });
});

app.post("/api/admin/settings/maintenance", requireAdminSession, requireAdminPermission("websiteMaintenance"), (req, res) => {
  const enabled = Boolean(req.body.enabled);
  const settings = {
    maintenanceMode: enabled,
    updatedAt: nowIso(),
    updatedBy: req.adminUser.username,
  };
  writeAdminSettingsStore(settings);
  res.json({ ok: true, settings });
});

app.get("/api/admin/applications", requireAdminSession, requireAdminPermission("applications"), (req, res) => {
  const source = cleanText(req.query.source, 20).toLowerCase();
  const type = cleanText(req.query.type, 40).toLowerCase();
  const status = cleanText(req.query.status, 40).toLowerCase();
  const search = cleanText(req.query.search, 120).toLowerCase();

  const activeStore = readApplicationStore();
  const archivedStore = readArchivedApplicationStore();
  const isClosedStatus = (value) => {
    const normalized = String(value || "").toLowerCase();
    return normalized === "accepted" || normalized === "denied";
  };

  let applications = source === "archived"
    ? (() => {
      const mergedById = new Map();
      [...archivedStore.applications, ...activeStore.applications.filter((entry) => isClosedStatus(entry?.status))]
        .forEach((entry) => {
          const id = cleanText(entry?.id || "", 120);
          if (!id || mergedById.has(id)) {
            return;
          }
          mergedById.set(id, entry);
        });
      return Array.from(mergedById.values());
    })()
    : [...activeStore.applications];

  if (type && type !== "all") {
    applications = applications.filter((application) => application.type === type);
  }

  if (status && status !== "all") {
    applications = applications.filter((application) => application.status === status);
  }

  if (search) {
    applications = applications.filter((application) => {
      const haystack = [
        application.title,
        application.body,
        application.applicant?.steamName,
        application.applicant?.discordName,
        ...(Array.isArray(application.responses)
          ? application.responses.flatMap((responseItem) => [responseItem.label, responseItem.answer])
          : []),
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });
  }

  const adminUsers = readAdminUsersStore().users || [];
  const adminAvatarById = new Map();
  const adminAvatarByUsername = new Map();
  adminUsers.forEach((adminUser) => {
    const avatar = normalizeAvatarValue(adminUser?.avatar || "");
    if (!avatar) {
      return;
    }

    const adminId = cleanText(adminUser?.id, 120);
    if (adminId) {
      adminAvatarById.set(adminId, avatar);
    }

    const username = cleanUsername(adminUser?.username || "").toLowerCase();
    if (username) {
      adminAvatarByUsername.set(username, avatar);
    }
  });

  applications = applications.map((application) => {
    const replies = Array.isArray(application?.replies) ? application.replies : [];
    const nextReplies = replies.map((reply) => {
      const existingAvatar = normalizeAvatarValue(
        reply?.authorAvatar
        || reply?.authorAvatarUrl
        || reply?.avatar
        || ""
      );
      const authorAdminId = cleanText(reply?.authorAdminId || reply?.adminId || reply?.staffId, 120);
      const authorNameRaw = cleanUsername(
        reply?.authorName
        || reply?.author
        || reply?.username
        || reply?.staffName
        || ""
      );
      const authorName = authorNameRaw.toLowerCase();
      const resolvedAvatar = existingAvatar
        || (authorAdminId ? adminAvatarById.get(authorAdminId) : "")
        || (authorName ? adminAvatarByUsername.get(authorName) : "")
        || "";

      return {
        ...reply,
        authorAdminId,
        authorName: authorNameRaw || "Staff",
        authorAvatar: resolvedAvatar,
      };
    });

    return {
      ...application,
      replies: nextReplies,
    };
  });

  applications.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  res.json({
    applications,
    types: applicationTypes,
    source: source === "archived" ? "archived" : "active",
  });
});

app.post("/api/admin/applications/:id/replies", requireAdminSession, requireAdminPermission("applications"), (req, res) => {
  const message = cleanText(req.body.message, 2000);
  if (!message) {
    res.status(400).json({ error: "Reply message is required." });
    return;
  }

  const record = findApplicationRecordById(req.params.id);
  const application = record?.application || null;

  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  const reply = {
    id: crypto.randomUUID(),
    authorAdminId: req.adminUser.id,
    authorName: req.adminUser.username,
    authorAvatar: normalizeAvatarValue(req.adminUser.avatar || ""),
    message,
    createdAt: nowIso(),
  };

  application.replies = Array.isArray(application.replies) ? application.replies : [];
  application.replies.push(reply);
  application.updatedAt = nowIso();

  if (record.source === "archived") {
    writeArchivedApplicationStore(record.archivedStore);
  } else {
    writeApplicationStore(record.activeStore);
  }

  res.status(201).json({
    ok: true,
    reply,
    application,
  });
});

app.post("/api/admin/applications/:id/decision", requireAdminSession, requireAdminPermission("applications"), (req, res) => {
  const decision = cleanText(req.body.decision, 20).toLowerCase();
  const note = cleanText(req.body.note, 1200);

  if (!["accepted", "denied", "pending"].includes(decision)) {
    res.status(400).json({ error: "Decision must be accepted, denied, or pending." });
    return;
  }

  const activeStore = readApplicationStore();
  const application = getApplicationById(activeStore.applications, req.params.id);

  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  application.status = decision;
  application.reviewedBy = {
    adminId: req.adminUser.id,
    name: req.adminUser.username,
    reviewedAt: nowIso(),
    note,
  };
  application.updatedAt = nowIso();

  if (decision === "accepted" || decision === "denied") {
    const archivedStore = readArchivedApplicationStore();
    const archivedApplication = {
      ...application,
      archivedAt: nowIso(),
      archivedBy: req.adminUser.username,
      updatedAt: nowIso(),
    };

    const nextActiveApplications = activeStore.applications.filter((entry) => entry.id !== application.id);
    const nextArchivedApplications = archivedStore.applications.filter((entry) => entry.id !== archivedApplication.id);
    nextArchivedApplications.unshift(archivedApplication);

    try {
      writeArchivedApplicationStore({ applications: nextArchivedApplications });
      writeApplicationStore({ applications: nextActiveApplications });
    } catch (error) {
      try {
        writeArchivedApplicationStore(archivedStore);
      } catch {
        // Ignore rollback failures; preserve original error response.
      }
      res.status(500).json({ error: "Could not archive application safely. Please retry." });
      return;
    }

    const sendResponse = () => {
      res.json({
        ok: true,
        application: archivedApplication,
      });
    };

    if (decision !== "accepted" || !isAllowlistApplication(archivedApplication) || !archivedApplication.applicant?.discordId) {
      sendResponse();
      return;
    }

    syncDiscordEntitlementRoles(archivedApplication.applicant)
      .then(sendResponse)
      .catch(sendResponse);
    return;
  }

  writeApplicationStore(activeStore);

  const sendResponse = () => {
    res.json({
      ok: true,
      application,
    });
  };

  if (decision !== "accepted" || !isAllowlistApplication(application) || !application.applicant?.discordId) {
    sendResponse();
    return;
  }

  syncDiscordEntitlementRoles(application.applicant)
    .then(sendResponse)
    .catch(sendResponse);
});

app.post("/api/admin/applications/:id/grant-allowlist-role", requireAdminSession, requireAdminPermission("applications"), async (req, res) => {
  if (!discordAllowlistRoleId) {
    res.status(400).json({ error: "Allowlist role is not configured on the backend." });
    return;
  }

  if (!discordGuildId || !discordBotToken) {
    res.status(400).json({ error: "Discord role sync is not configured on the backend." });
    return;
  }

  const record = findApplicationRecordById(req.params.id);
  const application = record?.application || null;

  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  if (!isAllowlistApplication(application)) {
    res.status(400).json({ error: "This action is only available for Allowlist applications." });
    return;
  }

  const discordId = cleanText(application?.applicant?.discordId || "", 80);
  if (!discordId) {
    res.status(400).json({ error: "Applicant does not have a Discord account linked." });
    return;
  }

  try {
    const member = await fetchDiscordGuildMember(discordId);
    if (!member) {
      res.status(404).json({ error: "Applicant is not in the configured Discord server." });
      return;
    }

    const currentRoles = Array.isArray(member.roles) ? member.roles : [];
    const alreadyGranted = currentRoles.includes(discordAllowlistRoleId);

    if (!alreadyGranted) {
      await addDiscordRole(discordId, discordAllowlistRoleId);
    }

    application.allowlistRoleGrantedAt = nowIso();
    application.allowlistRoleGrantedBy = req.adminUser.username;
    application.allowlistRoleGrantedToDiscordId = discordId;
    application.updatedAt = nowIso();

    if (record.source === "archived") {
      writeArchivedApplicationStore(record.archivedStore);
    } else {
      writeApplicationStore(record.activeStore);
    }

    res.json({
      ok: true,
      alreadyGranted,
      discordId,
      roleId: discordAllowlistRoleId,
      application,
    });
  } catch (error) {
    res.status(502).json({ error: error?.message || "Could not grant allowlist role right now." });
  }
});

app.post("/api/admin/applications/:id/archive", requireAdminSession, requireAdminPermission("applications"), (req, res) => {
  const activeStore = readApplicationStore();
  const archivedStore = readArchivedApplicationStore();
  const target = getApplicationById(activeStore.applications, req.params.id);

  if (!target) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  const nextArchivedApplication = {
    ...target,
    archivedAt: nowIso(),
    archivedBy: req.adminUser.username,
    updatedAt: nowIso(),
  };

  const nextActiveApplications = activeStore.applications.filter((entry) => entry.id !== target.id);
  const nextArchivedApplications = archivedStore.applications.filter((entry) => entry.id !== target.id);
  nextArchivedApplications.unshift(nextArchivedApplication);

  try {
    writeArchivedApplicationStore({ applications: nextArchivedApplications });
    writeApplicationStore({ applications: nextActiveApplications });
  } catch {
    try {
      writeArchivedApplicationStore(archivedStore);
    } catch {
      // Ignore rollback failures.
    }
    res.status(500).json({ error: "Could not archive application safely. Please retry." });
    return;
  }

  res.json({ ok: true });
});

app.delete("/api/admin/applications/:id", requireAdminSession, requireAdminPermission("applications"), (req, res) => {
  res.status(403).json({ error: "Archived applications are read-only and cannot be deleted." });
});

app.get("/api/admin/subscriptions", requireAdminSession, requireAdminPermission("subscriptions"), (_req, res) => {
  const subscriptions = readSubscriptionsStore();
  res.json({
    current: subscriptions.current,
    ended: subscriptions.ended,
  });
});

app.post("/api/admin/subscriptions/gift", requireAdminSession, requireAdminPermission("subscriptions"), (req, res) => {
  const recipientQuery = cleanText(req.body.recipientQuery, 140);
  const steamId = cleanText(req.body.steamId, 80);
  const steamName = cleanText(req.body.steamName, 120);
  const discordId = cleanText(req.body.discordId, 80);
  const discordName = cleanText(req.body.discordName, 120);
  const tier = cleanText(req.body.tier, 60);
  const duration = cleanText(req.body.duration, 20).toLowerCase();

  if (!recipientQuery || !tier || !duration) {
    res.status(400).json({ error: "Recipient, tier, and duration are required." });
    return;
  }

  if (!["lifetime", "1m", "3m", "6m", "12m"].includes(duration)) {
    res.status(400).json({ error: "Duration must be lifetime, 1m, 3m, 6m, or 12m." });
    return;
  }

  const renewsAt = (() => {
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
  })();

  const displayName = steamName || discordName || recipientQuery;
  const store = readSubscriptionsStore();
  const createdAt = nowIso();
  const giftedSubscription = {
    id: crypto.randomUUID(),
    name: displayName,
    steamId,
    steamName,
    discordId,
    discordName,
    tier,
    duration,
    lifetime: duration === "lifetime",
    renewsAt,
    amount: "Gifted",
    giftedBy: req.adminUser.username,
    giftedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };

  store.current.unshift(giftedSubscription);
  writeSubscriptionsStore(store);

  const sendResponse = () => {
    res.status(201).json({
      ok: true,
      subscription: giftedSubscription,
    });
  };

  if (!giftedSubscription.discordId) {
    sendResponse();
    return;
  }

  syncDiscordEntitlementRoles(giftedSubscription)
    .then(sendResponse)
    .catch(sendResponse);
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

ensureApplicationStore();
ensureJsonFile(archivedApplicationStorePath, { applications: [] });
ensureJsonFile(subscriptionsStorePath, {
  current: [],
  ended: [],
});
ensureJsonFile(adminSettingsStorePath, {
  maintenanceMode: false,
  updatedAt: nowIso(),
  updatedBy: "system",
});
ensureAdminBootstrapUser();

app.listen(port, () => {
  console.log(`Bloodline auth server listening on ${backendBaseUrl}`);
  console.log(`Frontend callback base: ${frontendBaseUrl}`);
});
