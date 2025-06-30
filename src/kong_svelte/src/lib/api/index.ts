// Export the API URL
export const API_URL = getIndexerUrl();
// export const API_URL = "http://localhost:8081";

// Export base API components
export * from './base';

// Export token API components
export * from './tokens';

// Export user API components
export * from './users';
export * from './pools';
export * from './predictionMarket';
export * from './leaderboard';
export * from './balances';
export * from './transactions';
export { 
  type Message,
  type MessagesPage,
  type MessagePayload,
  getMessages,
  getMessage,
  createMessage,
  deleteMessage,
  banUser,
  unbanUser,
  checkBanStatus
  // Excluding PaginationParams and isAdmin to avoid conflicts
} from './trollbox';
export * from './upload';

function getIndexerUrl() {
  if (process.env.DFX_NETWORK === "local") {
      return "http://localhost:8081";
  } else if (process.env.DFX_NETWORK === "staging") {
      return 'https://clownfish-app-2dvg3.ondigitalocean.app';
  } else {
      return "https://api.kongswap.io";
  }
}