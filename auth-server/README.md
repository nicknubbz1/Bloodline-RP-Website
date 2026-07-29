# Bloodline Auth Server

This server handles Steam OpenID, Discord OAuth, Discord live stats, application submission APIs, and the admin dashboard APIs for the Bloodline RP website.

## What it does
- Starts Steam authentication at `/auth/steam`
- Handles Steam callback at `/auth/steam/return`
- Starts Discord OAuth at `/auth/discord`
- Handles Discord callback at `/auth/discord/callback`
- Stores and serves application records for account-linked submissions
- Provides admin login, permission-managed admin profiles, moderation actions, subscription views, and maintenance mode toggling
- Redirects the popup back to `auth-callback.html`, where the static site stores the linked account state locally

## Setup
1. Copy `.env.example` to `.env`
2. Fill in:
   - `STEAM_API_KEY`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `DISCORD_GUILD_ID`
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_INVITE_URL`
   - `SESSION_SECRET`
   - Optional: `MAIN_ADMIN_USERNAME` (default: `1234`)
   - Optional: `MAIN_ADMIN_PASSWORD` (default: `1234`)
   - Optional: `ADMIN_SESSION_DAYS` (default: `30`)
3. Install dependencies:
   - `npm install`
4. Start the server:
   - `npm start`

## Local defaults
- Frontend: `http://localhost:5500`
- Backend: `http://localhost:3000`

## Production notes
- GitHub Pages can host the static website, but not this server
- Deploy this auth server separately to a Node host
- Update `auth-config.js` on the frontend to point to the deployed backend URL

## API endpoints
- `GET /api/application-types`: return available application categories
- `GET /api/discord/stats`: return live Discord member count, online count, and invite URL
- `POST /api/applications`: create a new application (requires linked Steam and Discord)
- `GET /api/my-applications`: list applications submitted by the current account
- `GET /api/site-status`: public maintenance-mode status
- `POST /api/admin/login`: admin login (supports stay-signed-in cookie)
- `POST /api/admin/logout`: admin logout
- `GET /api/admin/session`: read active admin session
- `POST /api/admin/change-password`: change current admin password
- `POST /api/admin/change-username`: change username (main admin only)
- `GET /api/admin/users`: list admin profiles (permissions access)
- `POST /api/admin/users`: create admin profile (permissions access)
- `PATCH /api/admin/users/:id`: update permissions or override password
- `DELETE /api/admin/users/:id`: delete admin profile
- `GET /api/admin/settings`: read admin settings
- `POST /api/admin/settings/maintenance`: toggle maintenance mode
- `GET /api/admin/applications`: list active or archived applications
- `POST /api/admin/applications/:id/replies`: reply to an application
- `POST /api/admin/applications/:id/decision`: accept/deny/pending decision
- `POST /api/admin/applications/:id/archive`: move application to archive
- `DELETE /api/admin/applications/:id`: permanently delete archived application
- `GET /api/admin/subscriptions`: list current and ended subscriptions
