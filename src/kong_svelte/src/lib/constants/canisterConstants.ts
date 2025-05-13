// canisterConstants.ts

const defaultTokens = () => {
  if (process.env.DFX_NETWORK === 'local') {
    return {
      icp: process.env.CANISTER_ID_ICP_LEDGER,
      ckusdt: process.env.CANISTER_ID_CKUSDT_LEDGER,
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

// Frontend Canister IDs
export const KONG_BACKEND_CANISTER_ID = process.env.CANISTER_ID_KONG_BACKEND;
export const KONG_LEDGER_CANISTER_ID = 'o7oak-iyaaa-aaaaq-aadzq-cai';

// Token Canister IDs
export const CKUSDC_CANISTER_ID = 'xevnm-gaaaa-aaaar-qafnq-cai';
export const KONG_CANISTER_ID = 'o7oak-iyaaa-aaaaq-aadzq-cai';
export const CKUSDT_CANISTER_ID = process.env.DFX_NETWORK === 'local' ? process.env.CANISTER_ID_CKUSDT_LEDGER : "cngnf-vqaaa-aaaar-qag4q-cai";
export const ICP_CANISTER_ID = process.env.DFX_NETWORK === 'local' ? process.env.CANISTER_ID_ICP_LEDGER : process.env.CANISTER_ID_ICP_LEDGER;
