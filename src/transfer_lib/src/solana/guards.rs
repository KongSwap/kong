use candid::Principal;
use kong_lib::ic::network::ICNetwork;

// Authorized proxy principals
const PROXY_PRINCIPAL_ONE: &str = "6d7py-dit3v-5kk25-r7dci-gtr3f-rbxl7-m5oxw-7rhyu-4pmpp-j4lj2-lqe";
const PROXY_PRINCIPAL_TWO: &str = "xlotz-rhc3l-wkpkp-yzvau-ww2qy-zftze-2wrpx-pzcd2-fqa4t-3n36y-rae";

/// Guard that checks if the caller is kong_rpc
pub fn caller_is_kong_rpc() -> Result<(), String> {
    let caller = ICNetwork::caller();
    if caller == Principal::from_text(PROXY_PRINCIPAL_ONE).unwrap() || caller == Principal::from_text(PROXY_PRINCIPAL_TWO).unwrap() {
        Ok(())
    } else {
        Err("Caller is not kong_rpc".to_string())
    }
}
