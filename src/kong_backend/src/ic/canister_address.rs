#[cfg(not(feature = "prod"))]
pub const KONG_BACKEND: &str = "oaq4p-2iaaa-aaaar-qahqa-cai";
#[cfg(feature = "prod")]
pub const KONG_BACKEND: &str = "3ldz4-aiaaa-aaaar-qaina-cai";
