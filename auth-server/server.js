const path = require("path");
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

const steamEnabled = Boolean(steamApiKey);
const discordEnabled = Boolean(discordClientId && discordClientSecret);

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
    (accessToken, refreshToken, profile, done) => {
      const user = {
        provider: "discord",
        discordId: profile.id,
        username: profile.username,
        globalName: profile.global_name || profile.username,
        avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : "",
        accessToken,
        refreshToken,
      };
      done(null, user);
    }
  ));
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
  res.json({
    account: req.session.account || null,
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
    };

    res.redirect(buildFrontendUrl("auth-callback.html", {
      provider: "discord",
      status: "success",
      discordId: user.discordId,
      discordName: user.globalName,
      discordUsername: user.username,
      discordAvatar: user.avatar,
    }));
  })(req, res, next);
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(port, () => {
  console.log(`Bloodline auth server listening on ${backendBaseUrl}`);
  console.log(`Frontend callback base: ${frontendBaseUrl}`);
});
