const bloodlineIsLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
const bloodlineBackendOrigin = bloodlineIsLocalHost
	? "http://localhost:3000"
	: window.location.origin;

window.BLOODLINE_STEAM_AUTH_URL = window.BLOODLINE_STEAM_AUTH_URL || `${bloodlineBackendOrigin}/auth/steam`;
window.BLOODLINE_DISCORD_AUTH_URL = window.BLOODLINE_DISCORD_AUTH_URL || `${bloodlineBackendOrigin}/auth/discord`;
window.BLOODLINE_AUTH_SESSION_URL = window.BLOODLINE_AUTH_SESSION_URL || `${bloodlineBackendOrigin}/auth/session`;
window.BLOODLINE_AUTH_LOGOUT_URL = window.BLOODLINE_AUTH_LOGOUT_URL || `${bloodlineBackendOrigin}/auth/logout`;
window.BLOODLINE_API_BASE_URL = window.BLOODLINE_API_BASE_URL || `${bloodlineBackendOrigin}/api`;
window.BLOODLINE_ADMIN_LOGIN_URL = window.BLOODLINE_ADMIN_LOGIN_URL || `${bloodlineBackendOrigin}/api/admin/login`;
window.BLOODLINE_ADMIN_SESSION_URL = window.BLOODLINE_ADMIN_SESSION_URL || `${bloodlineBackendOrigin}/api/admin/session`;
window.BLOODLINE_ADMIN_LOGOUT_URL = window.BLOODLINE_ADMIN_LOGOUT_URL || `${bloodlineBackendOrigin}/api/admin/logout`;
window.BLOODLINE_SITE_STATUS_URL = window.BLOODLINE_SITE_STATUS_URL || `${bloodlineBackendOrigin}/api/site-status`;
window.BLOODLINE_UNIFIED_CHECKOUT_URL = window.BLOODLINE_UNIFIED_CHECKOUT_URL || "";
window.BLOODLINE_STRIPE_CHECKOUT_URL = window.BLOODLINE_STRIPE_CHECKOUT_URL || "";
window.BLOODLINE_PAYPAL_CHECKOUT_URL = window.BLOODLINE_PAYPAL_CHECKOUT_URL || "";
window.BLOODLINE_CASHAPP_CHECKOUT_URL = window.BLOODLINE_CASHAPP_CHECKOUT_URL || "";
window.BLOODLINE_SERVER_STATUS_URL = window.BLOODLINE_SERVER_STATUS_URL || "";
window.BLOODLINE_QUEUE_JOIN_URL = window.BLOODLINE_QUEUE_JOIN_URL || "";
window.BLOODLINE_DISCORD_STATS_URL = window.BLOODLINE_DISCORD_STATS_URL || "http://localhost:3000/api/discord/stats";
window.BLOODLINE_DISCORD_INVITE_URL = window.BLOODLINE_DISCORD_INVITE_URL || "https://discord.gg/A3ZywNnpPU";
