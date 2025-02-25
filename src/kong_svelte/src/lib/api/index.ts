function getIndexerUrl() {
  if (process.env.DFX_NETWORK === "local") {
      return "http://localhost:8080";
  } else if (process.env.DFX_NETWORK === "staging") {
      return 'https://clownfish-app-2dvg3.ondigitalocean.app';
  } else {
      return "https://api.kongswap.io";
  }
}
export const API_URL = getIndexerUrl();