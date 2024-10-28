#[cfg(not(feature = "prod"))]
pub const KONG_BACKEND: &str = "oaq4p-2iaaa-aaaar-qahqa-cai";
#[cfg(feature = "prod")]
pub const KONG_BACKEND: &str = "3ldz4-aiaaa-aaaar-qaina-cai";

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
