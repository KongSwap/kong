use crate::stable_kong_settings::kong_settings;

pub const CKUSDT_SYMBOL: &str = "ckUSDT";
pub const CKUSDT_SYMBOL_WITH_CHAIN: &str = "IC.ckUSDT";
#[cfg(not(feature = "prod"))]
pub const CKUSDT_ADDRESS: &str = "zdzgz-siaaa-aaaar-qaiba-cai";
#[cfg(not(feature = "prod"))]
pub const CKUSDT_ADDRESS_WITH_CHAIN: &str = "IC.zdzgz-siaaa-aaaar-qaiba-cai";
#[cfg(feature = "prod")]
pub const CKUSDT_ADDRESS: &str = "cngnf-vqaaa-aaaar-qag4q-cai";
#[cfg(feature = "prod")]
pub const CKUSDT_ADDRESS_WITH_CHAIN: &str = "IC.cngnf-vqaaa-aaaar-qag4q-cai";

pub fn is_ckusdt(token: &str) -> bool {
    let kong_settings = kong_settings::get();
    if token == kong_settings.ckusdt_symbol
        || token == kong_settings.ckusdt_symbol_with_chain
        || token == kong_settings.ckusdt_address
        || token == kong_settings.ckusdt_address_with_chain
    {
        return true;
    }
    false
}
