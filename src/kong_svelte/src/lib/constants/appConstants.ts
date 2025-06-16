// Define the base URL for the sitemap
// Ensure this matches your production domain
export const SITEMAP_URL = 'https://kongswap.io';

// Navigation path mapping for determining active tabs
export const NAV_PATH_MAP: { [key: string]: string | null } = {
  "/pro": "pro",
  "/predict": "predict",
  "/pools": "earn",
  "/airdrop-claims": "earn",
  "/stats": "stats",
  "/stats/bubbles": "stats",
  "/stats/leaderboard": "stats",
};

// Add other app-wide constants here as needed 