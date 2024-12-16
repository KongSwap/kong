#[cfg(feature = "local")]
pub const KONG_BACKEND: &str = "2ipq2-uqaaa-aaaar-qailq-cai";
#[cfg(feature = "staging")]
pub const KONG_BACKEND: &str = "l4lgk-raaaa-aaaar-qahpq-cai";
#[cfg(feature = "prod")]
pub const KONG_BACKEND: &str = "2ipq2-uqaaa-aaaar-qailq-cai";

#[cfg(feature = "local")]
pub const KONG_DATA: &str = "cbefx-hqaaa-aaaar-qakrq-cai";
#[cfg(feature = "staging")]
pub const KONG_DATA: &str = "6ukzc-hiaaa-aaaah-qpxqa-cai";
#[cfg(feature = "prod")]
pub const KONG_DATA: &str = "cbefx-hqaaa-aaaar-qakrq-cai";
