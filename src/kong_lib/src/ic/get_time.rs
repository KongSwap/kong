/// Retrieves the current time from the IC.
///
/// # Returns
///
/// * `u64` - The current time in nanoseconds since the Unix epoch.
pub fn get_time() -> u64 {
    ic_cdk::api::time()
}
