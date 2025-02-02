function getIndexerUrl() {
  if (process.env.DFX_NETWORK === "local") {
      return "http://localhost:8080";
  } else {
      return "https://api.kongswap.io";
  }
}
export const INDEXER_URL = getIndexerUrl();