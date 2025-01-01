use crate::stable_kong_settings::kong_settings_map;

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

pub fn is_icp_token_id(token_id: u32) -> bool {
    token_id == ICP_TOKEN_ID
}

pub fn is_icp(token: &str) -> bool {
    let kong_settings = kong_settings_map::get();
    if token == kong_settings.icp_symbol
        || token == kong_settings.icp_symbol_with_chain
        || token == kong_settings.icp_address
        || token == kong_settings.icp_address_with_chain
    {
        return true;
    }
    false
}
