# Bloodline Auth Server

This server handles real Steam OpenID and Discord OAuth for the Bloodline RP website.

## What it does
- Starts Steam authentication at `/auth/steam`
- Handles Steam callback at `/auth/steam/return`
- Starts Discord OAuth at `/auth/discord`
- Handles Discord callback at `/auth/discord/callback`
- Redirects the popup back to `auth-callback.html`, where the static site stores the linked account state locally

## Setup
1. Copy `.env.example` to `.env`
2. Fill in:
   - `STEAM_API_KEY`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
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
