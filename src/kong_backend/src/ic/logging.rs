/// Logs an informational message.
///
/// # Arguments
///
/// * `msg` - The message to log.
pub fn info_log(msg: &str) {
    log("INFO", msg);
}

/// Logs an error message.
///
/// # Arguments
///
/// * `msg` - The message to log.
pub fn error_log(msg: &str) {
    log("ERROR", msg);
}

/// Logs a message with a specified level.
///
/// # Arguments
///
/// * `level` - The log level (e.g., "INFO", "ERROR").
/// * `msg` - The message to log.
fn log(level: &str, msg: &str) {
    ic_cdk::api::debug_print(format!("{}: {}", level, msg));
}
