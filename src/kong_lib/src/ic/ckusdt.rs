pub const CKUSDT_TOKEN_ID: u32 = 1;
pub const CKUSDT_SYMBOL: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "ksUSDT"
} else {
    "ckUSDT"
};
pub const CKUSDT_SYMBOL_WITH_CHAIN: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "IC.ksUSDT"
} else {
    "IC.ckUSDT"
};
pub const CKUSDT_ADDRESS: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "zdzgz-siaaa-aaaar-qaiba-cai"
} else {
    "cngnf-vqaaa-aaaar-qag4q-cai"
};
pub const CKUSDT_ADDRESS_WITH_CHAIN: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "IC.zdzgz-siaaa-aaaar-qaiba-cai"
} else {
    "IC.cngnf-vqaaa-aaaar-qag4q-cai"
};
