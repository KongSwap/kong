use crate::stable_kong_settings::kong_settings;

pub const ICP_SYMBOL: &str = "ICP";
pub const ICP_SYMBOL_WITH_CHAIN: &str = "IC.ICP";
#[cfg(not(feature = "prod"))]
pub const ICP_ADDRESS: &str = "nppha-riaaa-aaaal-ajf2q-cai";
#[cfg(not(feature = "prod"))]
pub const ICP_ADDRESS_WITH_CHAIN: &str = "IC.nppha-riaaa-aaaal-ajf2q-cai";
#[cfg(feature = "prod")]
pub const ICP_ADDRESS: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";
#[cfg(feature = "prod")]
pub const ICP_ADDRESS_WITH_CHAIN: &str = "IC.ryjl3-tyaaa-aaaaa-aaaba-cai";

pub fn is_icp(token: &str) -> bool {
    let kong_settings = kong_settings::get();
    if token == kong_settings.icp_symbol
        || token == kong_settings.icp_symbol_with_chain
        || token == kong_settings.icp_address
        || token == kong_settings.icp_address_with_chain
    {
        return true;
    }
    false
}
