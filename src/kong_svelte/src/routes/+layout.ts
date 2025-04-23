import type { LayoutLoad } from './$types';

// We are enabling prerendering for this layout
export const prerender = true;

// Default values
const defaultTitle = process.env.DFX_NETWORK === 'ic' ? 'KongSwap' : 'KongSwap [DEV]';
const defaultDescription = 'Trade on prediction markets with KongSwap';
const defaultImage = 'https://kongswap.io/images/banner.webp';

// Define metadata for specific routes
const routeMetadata = {
  '/': {
    title: 'KongSwap - Rumble in the crypto jungle with the most advanced multi-chain DeFi platform in the world!',
    description: 'KongSwap is the most advanced multi-chain DeFi platform in the world, providing a fully on-chain, DAO owned, and permissionless DeFi experience.',
    image: defaultImage 
  },
  '/predict': {
    title: 'Prediction Markets - KongSwap',
    description: 'Trade on prediction markets with KongSwap',
    image: 'https://kongswap.io/images/predictionmarket-og.png'
  }
  // Add more routes as needed
};

// Function to find the best matching metadata for a given path
function getMetadataForPath(path: string) {
  // Check for exact match first
  if (routeMetadata[path]) {
    return routeMetadata[path];
  }
  
  // Find the most specific *startsWith* match (excluding exact match already checked)
  let bestMatch = null;
  let longestMatchLength = 0;
  
  for (const [route, metadata] of Object.entries(routeMetadata)) {
    if (path.startsWith(route) && route.length > longestMatchLength && route !== path) {
      bestMatch = metadata;
      longestMatchLength = route.length;
    }
  }

  if (bestMatch) {
    return bestMatch;
  }
  
  // Return defaults if no matches
  return {
    title: defaultTitle,
    description: defaultDescription,
    image: defaultImage
  };
}

export const load: LayoutLoad = ({ url }) => {
  const path = url.pathname;
  const metadata = getMetadataForPath(path);

  return {
    metadata: {
      ...metadata,
      url: url.href // Add the canonical URL
    }
  };
};
