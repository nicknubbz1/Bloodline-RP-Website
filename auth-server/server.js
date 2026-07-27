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
const sessionSecret = process.env.SESSION_SECRET || "change-me-in-production";
const steamApiKey = process.env.STEAM_API_KEY;
const discordClientId = process.env.DISCORD_CLIENT_ID;
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;
const discordGuildId = process.env.DISCORD_GUILD_ID || "";
const discordStaffRoleId = process.env.DISCORD_STAFF_ROLE_ID || "";
const discordBotToken = process.env.DISCORD_BOT_TOKEN || "";

const steamEnabled = Boolean(steamApiKey);
const discordEnabled = Boolean(discordClientId && discordClientSecret);
const staffRoleCheckEnabled = Boolean(discordGuildId && discordStaffRoleId && discordBotToken);

const applicationTypes = [
  { key: "server", label: "Server Applications" },
  { key: "public-safety", label: "Public Safety" },
  { key: "city-hall", label: "City Hall Applications" },
  { key: "business-gang", label: "Business And Gang Applications" },
];
const validApplicationTypeKeys = new Set(applicationTypes.map((entry) => entry.key));
const applicationStorePath = path.join(__dirname, "data", "applications.json");

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function nowIso() {
  return new Date().toISOString();
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

function discordGet(pathname) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        method: "GET",
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
    request.end();
  });
}

async function fetchDiscordMemberRoles(discordId) {
  if (!staffRoleCheckEnabled || !discordId) {
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

async function refreshStaffAccess(account, forceRefresh = false) {
  if (!account || !account.discordId) {
    return account || null;
  }

  if (!staffRoleCheckEnabled) {
    return {
      ...account,
      isStaff: false,
      discordRoles: [],
      staffCheckedAt: null,
      staffRoleError: "Staff role checks are not configured.",
    };
  }

  const checkedAtMs = account.staffCheckedAt ? Date.parse(account.staffCheckedAt) : 0;
  const cacheIsFresh = Number.isFinite(checkedAtMs) && Date.now() - checkedAtMs < 5 * 60 * 1000;
  if (!forceRefresh && cacheIsFresh) {
    return account;
  }

  try {
    const roles = await fetchDiscordMemberRoles(account.discordId);
    return {
      ...account,
      discordRoles: roles,
      isStaff: roles.includes(discordStaffRoleId),
      staffCheckedAt: nowIso(),
      staffRoleError: "",
    };
  } catch (error) {
    return {
      ...account,
      discordRoles: [],
      isStaff: false,
      staffCheckedAt: nowIso(),
      staffRoleError: error.message || "Staff role check failed.",
    };
  }
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

async function requireStaffRole(req, res, next) {
  const account = req.session.account;
  if (!account?.steamId || !account?.discordId) {
    res.status(401).json({ error: "Login with Steam and Discord to access staff tools." });
    return;
  }

  const refreshedAccount = await refreshStaffAccess(account, true);
  req.session.account = refreshedAccount;

  if (!refreshedAccount.isStaff) {
    res.status(403).json({ error: "Staff role is required for this action." });
    return;
  }

  next();
}

app.set("trust proxy", 1);
app.use(cors({
  origin: frontendBaseUrl,
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
          isStaff: staffRoleCheckEnabled ? roles.includes(discordStaffRoleId) : false,
          staffCheckedAt: nowIso(),
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
    staffRoleCheckEnabled,
    backendBaseUrl,
    frontendBaseUrl,
  });
});

app.get("/auth/session", async (req, res) => {
  let account = req.session.account || null;

  if (account?.discordId) {
    account = await refreshStaffAccess(account);
    req.session.account = account;
  }

  res.json({
    account,
    steamEnabled,
    discordEnabled,
    staffRoleCheckEnabled,
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
      isStaff: Boolean(user.isStaff),
      staffCheckedAt: user.staffCheckedAt || nowIso(),
      staffRoleError: "",
    };

    res.redirect(buildFrontendUrl("auth-callback.html", {
      provider: "discord",
      status: "success",
      discordId: user.discordId,
      discordName: user.globalName,
      discordUsername: user.username,
      discordAvatar: user.avatar,
      isStaff: user.isStaff ? "1" : "0",
    }));
  })(req, res, next);
});

app.get("/api/application-types", (_req, res) => {
  res.json({
    types: applicationTypes,
  });
});

app.post("/api/applications", requireLinkedAccount, (req, res) => {
  const type = cleanText(req.body.type, 40).toLowerCase();
  const requestedTitle = cleanText(req.body.title, 80);
  const body = cleanText(req.body.body || req.body.message, 3000);

  if (!validApplicationTypeKeys.has(type)) {
    res.status(400).json({ error: "Invalid application type." });
    return;
  }

  if (!body) {
    res.status(400).json({ error: "Application details are required." });
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

app.get("/api/staff/applications", requireStaffRole, (req, res) => {
  const type = cleanText(req.query.type, 40).toLowerCase();
  const status = cleanText(req.query.status, 40).toLowerCase();
  const search = cleanText(req.query.search, 120).toLowerCase();

  const store = readApplicationStore();
  let applications = [...store.applications];

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
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });
  }

  applications.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  res.json({
    applications,
    types: applicationTypes,
  });
});

app.get("/api/staff/applications/:id", requireStaffRole, (req, res) => {
  const store = readApplicationStore();
  const application = getApplicationById(store.applications, req.params.id);

  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  res.json({ application });
});

app.post("/api/staff/applications/:id/replies", requireStaffRole, (req, res) => {
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
    authorDiscordId: req.session.account.discordId,
    authorName: req.session.account.discordName || req.session.account.discordUsername || "Staff",
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

app.post("/api/staff/applications/:id/decision", requireStaffRole, (req, res) => {
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
    discordId: req.session.account.discordId,
    name: req.session.account.discordName || req.session.account.discordUsername || "Staff",
    reviewedAt: nowIso(),
    note,
  };
  application.updatedAt = nowIso();

  writeApplicationStore(store);

  res.json({
    ok: true,
    application,
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

ensureApplicationStore();

app.listen(port, () => {
  console.log(`Bloodline auth server listening on ${backendBaseUrl}`);
  console.log(`Frontend callback base: ${frontendBaseUrl}`);
  console.log(`Staff role checks enabled: ${staffRoleCheckEnabled}`);
});
