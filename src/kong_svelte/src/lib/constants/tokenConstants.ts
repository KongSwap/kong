export const ALLOWED_TOKEN_SYMBOLS = ['ICP', 'ckUSDT'];
export const DEFAULT_TOKEN = 'ICP';

const defaultTokens = () => {
  if (process.env.DFX_NETWORK === 'local') {
    return {
      icp: process.env.CANISTER_ID_KSICP_LEDGER,
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
    exe: "rh2pm-ryaaa-aaaan-qeniq-cai",
    dkp: "zfcdd-tqaaa-aaaaq-aaaga-cai",
    alex: "ysy5f-2qaaa-aaaap-qkmmq-cai",
    nicp: "buwm7-7yaaa-aaaar-qagva-cai",
    tcycles: "um5iw-rqaaa-aaaaq-qaaba-cai",
    gldgov: "tyyy3-4aaaa-aaaaq-aab7a-cai",
    gldt: "6c7su-kiaaa-aaaar-qaira-cai",
    bob: "7pail-xaaaa-aaaas-aabmq-cai",
    alice: "oj6if-riaaa-aaaaq-aaeha-cai",
    ntn: "f54if-eqaaa-aaaaq-aacea-cai",
    ogy: "lkwrt-vyaaa-aaaaq-aadhq-cai",
    cloud: "pcj6u-uaaaa-aaaak-aewnq-cai"
  };
};

export const DEFAULT_TOKENS = defaultTokens();
