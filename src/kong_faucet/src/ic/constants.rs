// Tokens
pub const ICP: &str = "ICP";
pub const ICP_LEDGER: &str = if cfg!(feature = "staging") {
    "nppha-riaaa-aaaal-ajf2q-cai"
} else {
    "ryjl3-tyaaa-aaaaa-aaaba-cai"
};

pub const CKUSDT: &str = "ckUSDT";
pub const CKUSDT_LEDGER: &str = if cfg!(feature = "staging") {
    "zdzgz-siaaa-aaaar-qaiba-cai"
} else {
    "cngnf-vqaaa-aaaar-qag4q-cai"
};

pub const CKBTC: &str = "ckBTC";
pub const CKBTC_LEDGER: &str = if cfg!(feature = "staging") {
    "zeyan-7qaaa-aaaar-qaibq-cai"
} else {
    "mxzaz-hqaaa-aaaar-qaada-cai"
};

pub const CKETH: &str = "ckETH";
pub const CKETH_LEDGER: &str = if cfg!(feature = "staging") {
    "zr7ra-6yaaa-aaaar-qaica-cai"
} else {
    "ss2fx-dyaaa-aaaar-qacoq-cai"
};

pub const KONG: &str = "KONG";
pub const KONG_LEDGER: &str = if cfg!(feature = "staging") {
    "ed276-pqaaa-aaaag-atuhq-cai"
} else {
    "o7oak-iyaaa-aaaaq-aadzq-cai"
};
