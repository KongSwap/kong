// canisterConstants.ts

export const CKUSDT_CANISTER_ID = process.env.CANISTER_ID_CKUSDT_LEDGER || 'cngnf-vqaaa-aaaar-qag4q-cai';
// @ts-ignore
export const ICP_CANISTER_ID = process.env.CANISTER_ID_ICP_LEDGER || 'ryjl3-tyaaa-aaaaa-aaaba-cai';

export const KONG_BACKEND_PRINCIPAL = process.env.CANISTER_ID_KONG_BACKEND || '2ipq2-uqaaa-aaaar-qailq-cai';
export const KONG_DATA_PRINCIPAL = process.env.CANISTER_ID_KONG_DATA || 'cbefx-hqaaa-aaaar-qakrq-cai';
function getIndexerUrl() {
  if (process.env.NODE_ENV === 'local') {
    return 'http://localhost:8080';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'https://api.kongswap.io';
  } else {
    return 'https://api.kongswap.io';
  }
}
export const INDEXER_URL = getIndexerUrl();

// Frontend Canister IDs
export const KONG_SVELTE_CANISTER_ID = process.env.CANISTER_ID_KONG_SVELTE;
export const KONG_BACKEND_CANISTER_ID = process.env.CANISTER_ID_KONG_BACKEND;

// Token Canister IDs
export const CHAT_CANISTER_ID = '2ouva-viaaa-aaaaq-aaamq-cai';
export const NANAS_CANISTER_ID = 'mwen2-oqaaa-aaaam-adaca-cai';
export const GHOST_CANISTER_ID = '4c4fd-caaaa-aaaaq-aaa3a-cai';
export const CTZ_CANISTER_ID = 'uf2wh-taaaa-aaaaq-aabna-cai';
export const KINIC_CANISTER_ID = '73mez-iiaaa-aaaaq-aaasq-cai';
export const DOLR_CANISTER_ID = '6rdgd-kyaaa-aaaaq-aaavq-cai';
export const KONG_CANISTER_ID = 'o7oak-iyaaa-aaaaq-aadzq-cai';
export const CLOUD_CANISTER_ID = 'pcj6u-uaaaa-aaaak-aewnq-cai';
export const ICS_CANISTER_ID = 'ca6gz-lqaaa-aaaaq-aacwa-cai';
