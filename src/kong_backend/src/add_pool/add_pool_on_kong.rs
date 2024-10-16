use ic_cdk::update;

use crate::canister::guards::caller_is_kingkong;
use crate::stable_pool::pool_map;

/// Changes an existing pool on the system to appear on or not on Kong
///
/// # Arguments
///
/// * `symbol` - The symbol of the pool to update.
/// * `on_kong` - A boolean indicating whether the pool should appear on Kong.
///
/// # Returns
///
/// * `Ok(String)` - A JSON string representation of the updated pool if successful.
/// * `Err(String)` - An error message if the operation fails.
///
/// # Errors
///
/// This function returns an error if:
/// - The caller is not a controller.
/// - The pool with the given ID is not found.
/// - The tokens associated with the pool are not found.
/// - Updating the tokens or pool fails.
/// - Serializing the updated pool fails.
#[update(hidden = true, guard = "caller_is_kingkong")]
fn add_pool_on_kong(symbol: String, on_kong: bool) -> Result<String, String> {
    let mut pool = pool_map::get_by_token(&symbol)?;
    pool.set_on_kong(on_kong);

    serde_json::to_string(&pool).map_err(|e| format!("Failed to serialize: {}", e))
}
