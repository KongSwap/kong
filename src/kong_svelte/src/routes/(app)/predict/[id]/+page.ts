import type { PageLoad, EntryGenerator } from './$types';
import { env } from '$env/dynamic/public';

// Disable pre-rendering for dynamic routes that need IC data
export const prerender = false;
export const trailingSlash = 'never';

// Define which paths to pre-render at build time
export const entries: EntryGenerator = async () => {
  // Only pre-render if enabled via environment variable
  if (env.PUBLIC_PRERENDER_MARKETS !== 'true') {
    return [];
  }
  
  try {
    // In production, this would fetch from your API
    // For now, return empty array to allow on-demand rendering
    return [];
    
    // Example implementation:
    // const response = await fetch('https://api.example.com/top-markets');
    // const markets = await response.json();
    // return markets.slice(0, 20).map(market => ({ id: market.id.toString() }));
  } catch (error) {
    console.error('Failed to generate pre-render entries:', error);
    return [];
  }
};

export const load: PageLoad = async ({ data }) => {
  // Pass through server data
  return data;
};
