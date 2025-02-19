pub const KONG_BACKEND: &str = if cfg!(feature = "staging") {
    "l4lgk-raaaa-aaaar-qahpq-cai"
} else {
    "2ipq2-uqaaa-aaaar-qailq-cai"
};

pub const KONG_DATA: &str = if cfg!(feature = "staging") {
    "6ukzc-hiaaa-aaaah-qpxqa-cai"
} else {
    "cbefx-hqaaa-aaaar-qakrq-cai"
};

pub const EVENT_STORE: &str = if cfg!(feature = "staging") {
    ""
} else {
    "rsp5s-2yaaa-aaaar-qaojq-cai"
};
