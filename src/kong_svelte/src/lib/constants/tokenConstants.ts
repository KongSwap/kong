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
    tcycles: "um5iw-rqaaa-aaaaq-qaaba-cai",
    ckusdc: "xevnm-gaaaa-aaaar-qafnq-cai",
    ckbtc: "mxzaz-hqaaa-aaaar-qaada-cai",
    cketh: "ss2fx-dyaaa-aaaar-qacoq-cai",
    exe: "rh2pm-ryaaa-aaaan-qeniq-cai",
    bil: "ktra4-taaaa-aaaag-atveq-cai",
    dkp: "zfcdd-tqaaa-aaaaq-aaaga-cai",
    chat: "2ouva-viaaa-aaaaq-aaamq-cai",
    nicp: "buwm7-7yaaa-aaaar-qagva-cai",
    wtn: "jcmow-hyaaa-aaaaq-aadlq-cai",
    bob: "7pail-xaaaa-aaaas-aabmq-cai",
    alice: "oj6if-riaaa-aaaaq-aaeha-cai",
    sneed: "hvgxa-wqaaa-aaaaq-aacia-cai",
    party: "7xkvf-zyaaa-aaaal-ajvra-cai",
    ntn: "f54if-eqaaa-aaaaq-aacea-cai",
    dcd: "xsi2v-cyaaa-aaaaq-aabfq-cai",
    gldgov: "tyyy3-4aaaa-aaaaq-aab7a-cai",
    ogy: "lkwrt-vyaaa-aaaaq-aadhq-cai",
    fpl: "ddsp7-7iaaa-aaaaq-aacqq-cai",
    icvc: "m6xut-mqaaa-aaaaq-aadua-cai",
    gldt: "6c7su-kiaaa-aaaar-qaira-cai",
    ghost: "4c4fd-caaaa-aaaaq-aaa3a-cai",
    ctz: "uf2wh-taaaa-aaaaq-aabna-cai",
    elna: "gemj7-oyaaa-aaaaq-aacnq-cai",
    conf: "lrtnw-paaaa-aaaaq-aadfa-cai",
    boom: "vtrom-gqaaa-aaaaq-aabia-cai",
    dogmi: "np5km-uyaaa-aaaaq-aadrq-cai",
    est: "bliq2-niaaa-aaaaq-aac4q-cai",
    panda: "druyg-tyaaa-aaaaq-aactq-cai",
    kinic: "73mez-iiaaa-aaaaq-aaasq-cai",
    dolr: "6rdgd-kyaaa-aaaaq-aaavq-cai",
    trax: "emww2-4yaaa-aaaaq-aacbq-cai",
    well: "o4zzi-qaaaa-aaaaq-aaeeq-cai",
    nua: "rxdbk-dyaaa-aaaaq-aabtq-cai",
    yuku: "atbfz-diaaa-aaaaq-aacyq-cai",
    seer: "rffwt-piaaa-aaaaq-aabqq-cai",
    motoko: "k45jy-aiaaa-aaaaq-aadcq-cai",
    ckpepe: "etik7-oiaaa-aaaar-qagia-cai",
    ckshib: "fxffn-xiaaa-aaaar-qagoa-cai",
  };
};

export const DEFAULT_TOKENS = defaultTokens();
