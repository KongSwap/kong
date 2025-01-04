// canisterConstants.ts
import canisters from '../../../../../canister_ids.all.json';

const network = process.env.DFX_NETWORK || 'local';

// Import canister IDs from canister_ids.all.json based on network
export const KONG_BACKEND_CANISTER_ID = canisters.kong_backend[network];
export const KONG_DATA_PRINCIPAL = canisters.kong_data[network];
export const KONG_FRONTEND_CANISTER_ID = canisters.kong_svelte[network];
export const KONG_SVELTE_CANISTER_ID = canisters.kong_svelte[network];
export const KONG_BACKEND_PRINCIPAL = canisters.kong_backend[network];

export const INDEXER_URL = network === 'local'
  ? 'http://localhost:8080'
  : network === 'staging'
    ? 'https://api-staging.kongswap.io'
    : network === 'ic'
      ? 'https://api.kongswap.io'
      : 'https://api.kongswap.io';

// Token Canister IDs from canister_ids.json
export const CKBTC_CANISTER_ID = canisters.ksbtc_ledger[network];
export const CKETH_CANISTER_ID = canisters.kseth_ledger[network];
export const KONG_CANISTER_ID = canisters.kskong_ledger[network];
export const CKUSDT_CANISTER_ID = canisters.ksusdt_ledger[network];
export const ICP_CANISTER_ID = canisters.ksicp_ledger[network];

// Community token canister IDs (mainnet only)
export const GHOST_CANISTER_ID = '4c4fd-caaaa-aaaaq-aaa3a-cai';
export const KINIC_CANISTER_ID = '73mez-iiaaa-aaaaq-aaasq-cai';
export const CHAT_CANISTER_ID = '2ouva-viaaa-aaaaq-aaamq-cai';
export const CTZ_CANISTER_ID = 'uf2wh-taaaa-aaaaq-aabna-cai';
export const DOLR_CANISTER_ID = '6rdgd-kyaaa-aaaaq-aaavq-cai';
export const CLOUD_CANISTER_ID = 'pcj6u-uaaaa-aaaak-aewnq-cai';
export const ICS_CANISTER_ID = 'ca6gz-lqaaa-aaaaq-aacwa-cai';
