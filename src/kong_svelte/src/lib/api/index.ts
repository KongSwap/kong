function getIndexerUrl() {
  if (process.env.DFX_NETWORK === "local") {
      return "http://localhost:8080";
  } else {
      return "https://seashell-app-tva2e.ondigitalocean.app";
  }
}
export const INDEXER_URL = getIndexerUrl();