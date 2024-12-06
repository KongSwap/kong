export const CKUSDT_CANISTER_ID = process.env.CANISTER_ID_CKUSDT_LEDGER;
// @ts-ignore
export const ICP_CANISTER_ID = process.env.CANISTER_ID_ICP_LEDGER;
export const KONG_BACKEND_PRINCIPAL = process.env.CANISTER_ID_KONG_BACKEND;
export const INDEXER_URL = process.env.NODE_ENV === 'production' ? "http://api.kongswap.io/api" : "http://localhost:8080/api"

console.log('INDEXER_URL:', INDEXER_URL);
