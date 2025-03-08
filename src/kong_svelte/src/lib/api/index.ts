// Export the API URL
export const API_URL = getIndexerUrl();

// Export base API components
export * from './base';

// Export token API components
export * from './tokens';

function getIndexerUrl() {
  if (process.env.DFX_NETWORK === "ic") {
      return "http://localhost:8080";
  } else if (process.env.DFX_NETWORK === "staging") {
      return 'https://clownfish-app-2dvg3.ondigitalocean.app';
  } else {
      return "https://api.kongswap.io";
  }
}