use ic_cdk::update;
#[allow(unused_imports)]
use kong_lib::ic::address::Address;

use crate::canister::update_sol_swap_callback;
use crate::solana::guards::caller_is_kong_rpc;
#[allow(unused_imports)]
use crate::solana::kong_rpc::transaction_notification::{
    TransactionNotification, TransactionNotificationId, TransactionNotificationStatus,
};
#[allow(unused_imports)]
use crate::solana::stable_memory::{with_solana_tx_notifications_mut, with_swap_job_queue_mut};
#[allow(unused_imports)]
use crate::solana::swap_job::{SwapJobId, SwapJobStatus};
#[allow(unused_imports)]
use kong_lib::ic::logging::{error_log, info_log};
#[allow(unused_imports)]
use kong_lib::ic::network::ICNetwork;

// TODO: refactor update_solana_swap API
/// Update a Solana swap job status (called by kong_rpc after transaction execution)

// pub fn update_solana_swap(
//     job_id: u64,
//     final_solana_tx_sig: Option<String>,
//     error_msg: Option<String>,
// ) {
// }

#[update(hidden = true, guard = "caller_is_kong_rpc")]
pub fn update_solana_swap(
    job_id: u64,
    final_solana_tx_sig: String,
    _was_successful: bool,
    error_msg: Option<String>,
) -> Result<(), String> {
    let was_successful = error_msg.is_none();
    // Add or update transaction notification
    // with_solana_tx_notifications_mut(|notifications| {
    //     let notification_id = TransactionNotificationId(final_solana_tx_sig.clone());
    //     let mut notification = notifications.get(&notification_id).unwrap_or_else(|| {
    //         // Create a new notification if it doesn't exist (e.g., if submission failed and was_successful is false)
    //         TransactionNotification {
    //             status: TransactionNotificationStatus::Processed,
    //             metadata: None,
    //             timestamp: ICNetwork::get_time(),
    //             tx_signature: final_solana_tx_sig.clone(),
    //             job_id,
    //             is_completed: false, // Default to false
    //         }
    //     });
    //     notification.is_completed = was_successful; // Set is_completed based on success status
    //     notifications.insert(notification_id, notification);
    // });

    // Update the swap job status in the main map
    with_swap_job_queue_mut(|queue| {
        if let Some(mut job) = queue.get(&SwapJobId(job_id)) {
            match job.status {
                SwapJobStatus::Pending => {
                    if was_successful {
                        // Normal transition: Pending -> Confirmed
                        job.status = SwapJobStatus::Confirmed;
                        job.solana_tx_signature_of_payout = Some(final_solana_tx_sig.clone());
                    } else {
                        job.status = SwapJobStatus::Failed;
                        job.error_message = error_msg.clone();
                    }
                    job.updated_at = ICNetwork::get_time();
                    queue.insert(SwapJobId(job_id), job.clone());

                    update_sol_swap_callback(job, final_solana_tx_sig, error_msg);

                    Ok(())
                }
                SwapJobStatus::Confirmed => {
                    if job.status != SwapJobStatus::Confirmed {
                        error_log(&format!(
                            "Job {} is already confirmed, new is_success={}, txhash={}, errmsg={}",
                            job_id,
                            was_successful,
                            final_solana_tx_sig,
                            error_msg.unwrap_or_default()
                        ));
                    }
                    Ok(())
                }
                SwapJobStatus::Failed => {
                    if job.status != SwapJobStatus::Failed {
                        error_log(&format!(
                            "Job {} is already failed, new is_success={}, txhash={}, errmsg={}",
                            job_id,
                            was_successful,
                            final_solana_tx_sig,
                            error_msg.unwrap_or_default()
                        ));
                    }

                    Ok(())
                }
                SwapJobStatus::Expired => {
                    // Job expired - requires manual intervention
                    // kong_rpc should not be calling this for expired jobs
                    error_log(&format!(
                        "Job {} is already expired, new is_success={}, txhash={}, errmsg={}",
                        job_id,
                        was_successful,
                        final_solana_tx_sig,
                        error_msg.unwrap_or_default()
                    ));
                    Ok(())
                }
            }
        } else {
            error_log(&format!(
                "Job {} not found, new is_success={}, txhash={}, errmsg={}",
                job_id,
                was_successful,
                final_solana_tx_sig,
                error_msg.unwrap_or_default()
            ));
            Ok(())
        }
    })
}
