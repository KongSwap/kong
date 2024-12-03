#[cfg(not(feature = "prod"))]
pub const KONG_BACKEND: &str = "l4lgk-raaaa-aaaar-qahpq-cai";
#[cfg(feature = "prod")]
pub const KONG_BACKEND: &str = "3ldz4-aiaaa-aaaar-qaina-cai";

#[cfg(not(feature = "prod"))]
pub const KONG_DATA: &str = "cbefx-hqaaa-aaaar-qakrq-cai";
#[cfg(feature = "prod")]
pub const KONG_DATA: &str = "cbefx-hqaaa-aaaar-qakrq-cai";
