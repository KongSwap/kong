// canisterConstants.ts

export const ALLOWED_TOKEN_SYMBOLS = ['ICP', 'ckUSDT'];
export const DEFAULT_TOKEN = 'ICP';

const defaultTokens = () => {
  if (process.env.DFX_NETWORK === 'local') {
    return {
      icp: process.env.CANISTER_ID_ICP_LEDGER,
      ckusdt: process.env.CANISTER_ID_KSUSDT_LEDGER,
      kong: process.env.CANISTER_ID_KONG_LEDGER,
    };
  }
  return {
    icp: "ryjl3-tyaaa-aaaaa-aaaba-cai",
    ckusdt: "cngnf-vqaaa-aaaar-qag4q-cai",
    kong: "o7oak-iyaaa-aaaaq-aadzq-cai",
    ckusdc: "xevnm-gaaaa-aaaar-qafnq-cai",
    ckbtc: "mxzaz-hqaaa-aaaar-qaada-cai",
    cketh: "ss2fx-dyaaa-aaaar-qacoq-cai",
    dkp: "zfcdd-tqaaa-aaaaq-aaaga-cai",
    exe: "rh2pm-ryaaa-aaaan-qeniq-cai",
    party: "7xkvf-zyaaa-aaaal-ajvra-cai",
    motoko: "k45jy-aiaaa-aaaaq-aadcq-cai",
    nicp: "buwm7-7yaaa-aaaar-qagva-cai",
    tcycles: "um5iw-rqaaa-aaaaq-qaaba-cai",
    gldgov: "tyyy3-4aaaa-aaaaq-aab7a-cai",
    gldt: "6c7su-kiaaa-aaaar-qaira-cai",
    alex: "ysy5f-2qaaa-aaaap-qkmmq-cai",
    bob: "7pail-xaaaa-aaaas-aabmq-cai",
    ntn: "f54if-eqaaa-aaaaq-aacea-cai",
    cloud: "pcj6u-uaaaa-aaaak-aewnq-cai",
    panda: "druyg-tyaaa-aaaaq-aactq-cai",
    dcd: "xsi2v-cyaaa-aaaaq-aabfq-cai"
  };
};

export const DEFAULT_TOKENS = defaultTokens();

export const CKUSDT_CANISTER_ID = process.env.DFX_NETWORK === 'local' ? process.env.CANISTER_ID_KSUSDT_LEDGER : "cngnf-vqaaa-aaaar-qag4q-cai";
// @ts-ignore
export const ICP_CANISTER_ID = process.env.DFX_NETWORK === 'local' ? process.env.CANISTER_ID_ICP_LEDGER : process.env.CANISTER_ID_ICP_LEDGER;

export const KONG_BACKEND_PRINCIPAL = process.env.CANISTER_ID_KONG_BACKEND || '2ipq2-uqaaa-aaaar-qailq-cai';
export const KONG_DATA_PRINCIPAL = process.env.CANISTER_ID_KONG_DATA || 'cbefx-hqaaa-aaaar-qakrq-cai';

// Frontend Canister IDs
export const KONG_SVELTE_CANISTER_ID = process.env.CANISTER_ID_KONG_SVELTE;
export const KONG_BACKEND_CANISTER_ID = process.env.CANISTER_ID_KONG_BACKEND;
export const KONG_LEDGER_CANISTER_ID = 'o7oak-iyaaa-aaaaq-aadzq-cai';
export const PREDICTION_MARKETS_CANISTER_ID = process.env.CANISTER_ID_PREDICTION_MARKETS_BACKEND

// Token Canister IDs
export const BIL_CANISTER_ID = 'ktra4-taaaa-aaaag-atveq-cai';
export const CKBTC_CANISTER_ID = process.env.DFX_NETWORK === 'local' ? process.env.CANISTER_ID_KSBTC_LEDGER : 'mxzaz-hqaaa-aaaar-qaada-cai';
export const CKUSDC_CANISTER_ID = 'xevnm-gaaaa-aaaar-qafnq-cai';
export const CKETH_CANISTER_ID = process.env.DFX_NETWORK === 'local' ? process.env.CANISTER_ID_KSETH_LEDGER : 'ss2fx-dyaaa-aaaar-qacoq-cai';
export const DKP_CANISTER_ID = 'zfcdd-tqaaa-aaaaq-aaaga-cai';
export const BITS_CANISTER_ID = 'j5lhj-xyaaa-aaaai-qpfeq-cai';
export const CHAT_CANISTER_ID = '2ouva-viaaa-aaaaq-aaamq-cai';
export const NANAS_CANISTER_ID = 'mwen2-oqaaa-aaaam-adaca-cai';
export const GHOST_CANISTER_ID = '4c4fd-caaaa-aaaaq-aaa3a-cai';
export const CTZ_CANISTER_ID = 'uf2wh-taaaa-aaaaq-aabna-cai';
export const KINIC_CANISTER_ID = '73mez-iiaaa-aaaaq-aaasq-cai';
export const DOLR_CANISTER_ID = '6rdgd-kyaaa-aaaaq-aaavq-cai';
export const KONG_CANISTER_ID = 'o7oak-iyaaa-aaaaq-aadzq-cai';
export const ICS_CANISTER_ID = 'ca6gz-lqaaa-aaaaq-aacwa-cai';
export const EXE_CANISTER_ID = 'rh2pm-ryaaa-aaaan-qeniq-cai';
export const TROLLBOX_CANISTER_ID = process.env.CANISTER_ID_TROLLBOX
