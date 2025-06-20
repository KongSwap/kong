pub const ICP_TOKEN_ID: u32 = 2;
pub const ICP_SYMBOL: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "ICP"
} else {
    "ICP"
};
pub const ICP_SYMBOL_WITH_CHAIN: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "IC.ICP"
} else {
    "IC.ICP"
};
pub const ICP_ADDRESS: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "ryjl3-tyaaa-aaaaa-aaaba-cai"
} else {
    "ryjl3-tyaaa-aaaaa-aaaba-cai"
};
pub const ICP_ADDRESS_WITH_CHAIN: &str = if cfg!(any(feature = "local", feature = "staging")) {
    "IC.ryjl3-tyaaa-aaaaa-aaaba-cai"
} else {
    "IC.ryjl3-tyaaa-aaaaa-aaaba-cai"
};
