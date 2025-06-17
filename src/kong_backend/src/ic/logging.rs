use super::network::ICNetwork;

impl ICNetwork {
    pub fn info_log(msg: &str) {
        ICNetwork::log("INFO", msg);
    }

    pub fn error_log(msg: &str) {
        ICNetwork::log("ERROR", msg);
    }

    fn log(level: &str, msg: &str) {
        ic_cdk::print(format!("[{}] {}", level, msg));
    }
}
