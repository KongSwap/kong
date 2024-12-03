#[cfg(not(feature = "prod"))]
pub const KONG_BACKEND: &str = "oaq4p-2iaaa-aaaar-qahqa-cai";
#[cfg(feature = "prod")]
pub const KONG_BACKEND: &str = "3ldz4-aiaaa-aaaar-qaina-cai";

#[cfg(not(feature = "prod"))]
pub const KONG_DATA: &str = "cbefx-hqaaa-aaaar-qakrq-cai";
#[cfg(feature = "prod")]
pub const KONG_DATA: &str = "cbefx-hqaaa-aaaar-qakrq-cai";
