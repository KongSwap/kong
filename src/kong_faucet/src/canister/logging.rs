pub fn log(msg: &str) {
    ic_cdk::print(msg);
}

pub fn error_log(msg: &str) {
    ic_cdk::print(format!("ERROR: {}", msg));
}
