pub const KONG_BACKEND: &str = if cfg!(feature = "staging") {
    "l4lgk-raaaa-aaaar-qahpq-cai"
} else {
    // local or prod
    "2ipq2-uqaaa-aaaar-qailq-cai"
};

pub const KONG_DATA: &str = if cfg!(feature = "staging") {
    "6ukzc-hiaaa-aaaah-qpxqa-cai"
} else {
    // local or prod
    "cbefx-hqaaa-aaaar-qakrq-cai"
};
