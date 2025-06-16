use crate::ic::network::ICNetwork;

impl ICNetwork {
    pub fn get_time() -> u64 {
        ic_cdk::api::time()
    }
}
