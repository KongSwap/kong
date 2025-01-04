// canisterConstants.ts

export const CKUSDT_CANISTER_ID = process.env.CANISTER_ID_CKUSDT_LEDGER || 'cngnf-vqaaa-aaaar-qag4q-cai';
// @ts-ignore
export const ICP_CANISTER_ID = process.env.CANISTER_ID_ICP_LEDGER || 'ryjl3-tyaaa-aaaaa-aaaba-cai';

export const KONG_BACKEND_PRINCIPAL = process.env.CANISTER_ID_KONG_BACKEND || '2ipq2-uqaaa-aaaar-qailq-cai';
export const KONG_DATA_PRINCIPAL = process.env.CANISTER_ID_KONG_DATA || 'cbefx-hqaaa-aaaar-qakrq-cai';
function getIndexerUrl() {
    if (process.env.DFX_NETWORK === "local") {
        return "http://localhost:8080";
    } else if (process.env.DFX_NETWORK === "staging") {
        return "http://api.staging.kongswap.io";
    } else {
        return "https://api.kongswap.io";
    }
}

export const INDEXER_URL = getIndexerUrl();

// Frontend Canister IDs
export const KONG_FRONTEND_CANISTER_ID = process.env.CANISTER_ID_KONG_FRONTEND;
export const KONG_SVELTE_CANISTER_ID = process.env.CANISTER_ID_KONG_SVELTE;
export const KONG_BACKEND_CANISTER_ID = process.env.CANISTER_ID_KONG_BACKEND;

// Token Canister IDs
export const CKBTC_CANISTER_ID = 'mxzaz-hqaaa-aaaar-qaada-cai';
export const CKUSDC_CANISTER_ID = 'xevnm-gaaaa-aaaar-qafnq-cai';
export const CKETH_CANISTER_ID = 'ss2fx-dyaaa-aaaar-qacoq-cai';
export const DKP_CANISTER_ID = 'zfcdd-tqaaa-aaaaq-aaaga-cai';
export const BITS_CANISTER_ID = 'j5lhj-xyaaa-aaaai-qpfeq-cai';
export const CHAT_CANISTER_ID = '2ouva-viaaa-aaaaq-aaamq-cai';
export const NANAS_CANISTER_ID = 'mwen2-oqaaa-aaaam-adaca-cai';
export const ND64_CANISTER_ID = 'esbhr-giaaa-aaaam-ac4jq-cai';
export const NICP_CANISTER_ID = 'buwm7-7yaaa-aaaar-qagva-cai';
export const WTN_CANISTER_ID = 'jcmow-hyaaa-aaaaq-aadlq-cai';
export const YUGE_CANISTER_ID = 'nc4uk-iiaaa-aaaai-qpf5q-cai';
export const BOB_CANISTER_ID = '7pail-xaaaa-aaaas-aabmq-cai';
export const EXE_CANISTER_ID = 'rh2pm-ryaaa-aaaan-qeniq-cai';
export const SNEED_CANISTER_ID = 'hvgxa-wqaaa-aaaaq-aacia-cai';
export const WUMBO_CANISTER_ID = 'wkv3f-iiaaa-aaaap-ag73a-cai';
export const DAMONIC_CANISTER_ID = 'zzsnb-aaaaa-aaaap-ag66q-cai';
export const ALPACALB_CANISTER_ID = 'jncxy-2qaaa-aaaak-aflhq-cai';
export const MCS_CANISTER_ID = '67mu5-maaaa-aaaar-qadca-cai';
export const PARTY_CANISTER_ID = '7xkvf-zyaaa-aaaal-ajvra-cai';
export const CLOWN_CANISTER_ID = 'iwv6l-6iaaa-aaaal-ajjjq-cai';
export const BURN_CANISTER_ID = 'egjwt-lqaaa-aaaak-qi2aa-cai';
export const NTN_CANISTER_ID = 'f54if-eqaaa-aaaaq-aacea-cai';
export const DCD_CANISTER_ID = 'xsi2v-cyaaa-aaaaq-aabfq-cai';
export const GLDGOV_CANISTER_ID = 'tyyy3-4aaaa-aaaaq-aab7a-cai';
export const OWL_CANISTER_ID = 'k762w-hiaaa-aaaai-qpfpq-cai';
export const OGY_CANISTER_ID = 'lkwrt-vyaaa-aaaaq-aadhq-cai';
export const FPL_CANISTER_ID = 'ddsp7-7iaaa-aaaaq-aacqq-cai';
export const DITTO_CANISTER_ID = 'o3mvq-caaaa-aaaai-qpfua-cai';
export const ICVC_CANISTER_ID = 'm6xut-mqaaa-aaaaq-aadua-cai';
export const GLDT_CANISTER_ID = '6c7su-kiaaa-aaaar-qaira-cai';
export const GHOST_CANISTER_ID = '4c4fd-caaaa-aaaaq-aaa3a-cai';
export const CTZ_CANISTER_ID = 'uf2wh-taaaa-aaaaq-aabna-cai';
export const ELNA_CANISTER_ID = 'gemj7-oyaaa-aaaaq-aacnq-cai';
export const DOGMI_CANISTER_ID = 'np5km-uyaaa-aaaaq-aadrq-cai';
export const EST_CANISTER_ID = 'bliq2-niaaa-aaaaq-aac4q-cai';
export const PANDA_CANISTER_ID = 'druyg-tyaaa-aaaaq-aactq-cai';
export const KINIC_CANISTER_ID = '73mez-iiaaa-aaaaq-aaasq-cai';
export const DOLR_CANISTER_ID = '6rdgd-kyaaa-aaaaq-aaavq-cai';
export const TRAX_CANISTER_ID = 'emww2-4yaaa-aaaaq-aacbq-cai';
export const MOTOKO_CANISTER_ID = 'k45jy-aiaaa-aaaaq-aadcq-cai';
export const CKPEPE_CANISTER_ID = 'etik7-oiaaa-aaaar-qagia-cai';
export const CKSHIB_CANISTER_ID = 'fxffn-xiaaa-aaaar-qagoa-cai';
export const DOD_CANISTER_ID = 'cp4zx-yiaaa-aaaah-aqzea-cai';
export const PACA_CANISTER_ID = '6zn6a-cyaaa-aaaai-q3m3q-cai';
export const KONG_CANISTER_ID = 'o7oak-iyaaa-aaaaq-aadzq-cai';

// new ones for default logo
export const CLOUD_CANISTER_ID = 'pcj6u-uaaaa-aaaak-aewnq-cai';
export const ICS_CANISTER_ID = 'ca6gz-lqaaa-aaaaq-aacwa-cai';
