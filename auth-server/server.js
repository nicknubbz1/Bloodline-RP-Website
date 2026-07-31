const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const DiscordStrategy = require("passport-discord").Strategy;
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
    createdAt: adminUser.createdAt,
    updatedAt: adminUser.updatedAt,
  };
}

function buildSeedApplications() {
  const createdAt = nowIso();
  return [
    {
      id: "seed-server-staff",
      type: "server",
      title: "Staff Application",
      status: "pending",
      body: "Applicant wants to help with reports and moderation during NA evening hours.",
      applicant: {
        steamId: "76561198000000001",
        steamName: "Sample Applicant One",
        discordId: "100000000000000001",
        discordName: "SampleOne",
      },
      replies: [],
      createdAt,
      updatedAt: createdAt,
      reviewedBy: null,
    },
    {
      id: "seed-ems",
      type: "public-safety",
      title: "EMS Application",
      status: "pending",
      body: "Applicant has prior EMS RP experience and can cover overnight city shifts.",
      applicant: {
        steamId: "76561198000000002",
        steamName: "Sample Applicant Two",
        discordId: "100000000000000002",
        discordName: "SampleTwo",
      },
      replies: [],
      createdAt,
      updatedAt: createdAt,
      reviewedBy: null,
    },
    {
      id: "seed-business",
      type: "business-gang",
      title: "Business Application",
      status: "pending",
      body: "Applicant requests approval to operate a custom tuning and towing business.",
      applicant: {
        steamId: "76561198000000003",
        steamName: "Sample Applicant Three",
        discordId: "100000000000000003",
        discordName: "SampleThree",
      },
      replies: [],
      createdAt,
      updatedAt: createdAt,
      reviewedBy: null,
    },
  ];
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
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallbackData;
  }
}

function writeJsonFile(filePath, nextValue) {
  ensureJsonFile(filePath, nextValue);
  fs.writeFileSync(filePath, JSON.stringify(nextValue, null, 2), "utf8");
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
  ensureApplicationStore();

  try {
    const raw = fs.readFileSync(applicationStorePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.applications)) {
      return { applications: [] };
    }
    return parsed;
  } catch {
    return { applications: [] };
  }
}

function writeApplicationStore(nextStore) {
  ensureApplicationStore();
  fs.writeFileSync(applicationStorePath, JSON.stringify(nextStore, null, 2), "utf8");
}

function getApplicationById(applications, id) {
  return applications.find((application) => application.id === id) || null;
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
  return new Promise((resolve, reject) => {
    const request = https.request(
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
      (response) => {
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
      }
    );

    request.on("error", (error) => reject(error));
    if (body !== undefined) {
      request.write(JSON.stringify(body));
    }
    request.end();
  });
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

async function fetchDiscordMemberRoles(discordId) {
  if (!discordGuildId || !discordBotToken || !discordId) {
    return [];
  }

  const response = await discordGet(`/guilds/${discordGuildId}/members/${discordId}`);

  if (response.statusCode === 404) {
    return [];
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Discord role check failed (${response.statusCode}).`);
  }

  const payload = JSON.parse(response.body || "{}");
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
  if (!sessionAdmin?.id) {
    res.status(401).json({ error: "Admin login required." });
    return;
  }

  const store = readAdminUsersStore();
  const adminUser = store.users.find((user) => user.id === sessionAdmin.id) || null;
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
app.use(express.json());
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
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
    redirectAuthError(res, "steam", "Steam auth is not configured on the backend yet.");
    return;
  }
  passport.authenticate("steam")(req, res, next);
});

app.get("/auth/steam/return", (req, res, next) => {
  if (!steamEnabled) {
    redirectAuthError(res, "steam", "Steam auth is not configured on the backend yet.");
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

app.get("/auth/discord/callback", (req, res, next) => {
  if (!discordEnabled) {
    redirectAuthError(res, "discord", "Discord auth is not configured on the backend yet.");
    return;
  }

  passport.authenticate("discord", (error, user) => {
    if (error || !user) {
      redirectAuthError(res, "discord", "Discord authentication failed.");
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
  const store = readApplicationStore();
  const myApplications = store.applications.filter((application) => application.applicant?.steamId === req.session.account.steamId);

  res.json({
    applications: myApplications,
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

  res.json({
    ok: true,
    admin: sanitizeAdminUser(adminUser),
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
  let applications = source === "archived" ? [...archivedStore.applications] : [...activeStore.applications];

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

  const store = readApplicationStore();
  const application = getApplicationById(store.applications, req.params.id);

  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  const reply = {
    id: crypto.randomUUID(),
    authorAdminId: req.adminUser.id,
    authorName: req.adminUser.username,
    message,
    createdAt: nowIso(),
  };

  application.replies = Array.isArray(application.replies) ? application.replies : [];
  application.replies.push(reply);
  application.updatedAt = nowIso();

  writeApplicationStore(store);

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

  const store = readApplicationStore();
  const application = getApplicationById(store.applications, req.params.id);

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

  writeApplicationStore(store);

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

app.post("/api/admin/applications/:id/archive", requireAdminSession, requireAdminPermission("applications"), (req, res) => {
  const activeStore = readApplicationStore();
  const archivedStore = readArchivedApplicationStore();
  const target = getApplicationById(activeStore.applications, req.params.id);

  if (!target) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  activeStore.applications = activeStore.applications.filter((entry) => entry.id !== target.id);
  archivedStore.applications.unshift({
    ...target,
    archivedAt: nowIso(),
    archivedBy: req.adminUser.username,
    updatedAt: nowIso(),
  });

  writeApplicationStore(activeStore);
  writeArchivedApplicationStore(archivedStore);

  res.json({ ok: true });
});

app.delete("/api/admin/applications/:id", requireAdminSession, requireAdminPermission("applications"), (req, res) => {
  const archivedStore = readArchivedApplicationStore();
  const before = archivedStore.applications.length;
  archivedStore.applications = archivedStore.applications.filter((entry) => entry.id !== req.params.id);
  if (archivedStore.applications.length === before) {
    res.status(404).json({ error: "Archived application not found." });
    return;
  }

  writeArchivedApplicationStore(archivedStore);
  res.json({ ok: true });
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
  current: [
    {
      id: "seed-sub-1",
      name: "Sample Supporter",
      tier: "Gold",
      renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      amount: "$14.99 / month",
    },
  ],
  ended: [
    {
      id: "seed-sub-ended-1",
      name: "Expired Supporter",
      tier: "Silver",
      endedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
      amount: "$9.99 / month",
    },
  ],
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
