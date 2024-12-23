pub const ICP_TOKEN_ID: u32 = 2;
pub const ICP_SYMBOL: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "ksICP"
} else {
    "ICP"
};
pub const ICP_SYMBOL_WITH_CHAIN: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "IC.ksICP"
} else {
    "IC.ICP"
};
pub const ICP_ADDRESS: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "nppha-riaaa-aaaal-ajf2q-cai"
} else {
    "ryjl3-tyaaa-aaaaa-aaaba-cai"
};
pub const ICP_ADDRESS_WITH_CHAIN: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "IC.nppha-riaaa-aaaal-ajf2q-cai"
} else {
    "IC.ryjl3-tyaaa-aaaaa-aaaba-cai"
};
