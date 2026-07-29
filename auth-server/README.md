# Bloodline Auth Server

This server handles Steam OpenID, Discord OAuth, Discord live stats, and application submission APIs for the Bloodline RP website.

## What it does
- Starts Steam authentication at `/auth/steam`
- Handles Steam callback at `/auth/steam/return`
- Starts Discord OAuth at `/auth/discord`
- Handles Discord callback at `/auth/discord/callback`
- Stores and serves application records for account-linked submissions
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
