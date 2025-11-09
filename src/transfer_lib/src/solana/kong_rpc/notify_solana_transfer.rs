use ic_cdk::update;
use kong_lib::ic::network::ICNetwork;

use super::transaction_notification::{TransactionNotification, TransactionNotificationId, TransactionNotificationStatus};
use crate::solana::{guards::caller_is_kong_rpc, stable_memory::with_solana_tx_notifications_mut};

/// Notify about a Solana transfer (called by kong_rpc)
#[update(hidden = true, guard = "caller_is_kong_rpc")]
pub fn notify_solana_transfer(tx_signature: String, metadata: String) -> Result<(), String> {
    let key = TransactionNotificationId(tx_signature.clone());
    let value = TransactionNotification {
        status: TransactionNotificationStatus::Confirmed, // Incoming payments are always confirmed
        metadata: Some(metadata),
        timestamp: ICNetwork::get_time(),
        tx_signature: tx_signature.clone(),
        job_id: 0,          // For incoming transfers, there's no associated job_id
        is_completed: true, // Incoming payments are always completed when notified
    };
    // insert the notification into the stable memory map for further processing when user calls swap(), add_liquidity() or add_pool()
    with_solana_tx_notifications_mut(|notification| {
        notification.insert(key, value);
        Ok(())
    })
}
