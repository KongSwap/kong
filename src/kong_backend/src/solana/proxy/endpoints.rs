use ic_cdk::{query, update};

use crate::ic::guards::caller_is_proxy;
use crate::ic::network::ICNetwork;
use crate::stable_memory::{
    with_solana_latest_blockhash_mut, with_swap_job_queue, with_swap_job_queue_mut,
    store_transaction_notification
};
use crate::swap::swap_job::{SwapJob, SwapJobStatus};
use crate::solana::latest_blockhash::LatestBlockhash;
use std::ops::Bound::{Excluded, Unbounded};

/// Update the latest Solana blockhash (called by proxy)
#[update(guard = "caller_is_proxy")]
pub fn update_solana_latest_blockhash(blockhash: String) -> Result<(), String> {
    let timestamp_nanos = ICNetwork::get_time();
    
    with_solana_latest_blockhash_mut(|cell| {
        cell.set(LatestBlockhash {
            blockhash,
            timestamp_nanos,
        }).map_err(|_| "Failed to update latest blockhash".to_string())?;
        Ok(())
    })
}

/// Get pending Solana swap jobs for proxy processing
#[query]
pub fn get_pending_solana_swaps(after_job_id: Option<u64>) -> Result<Vec<SwapJob>, String> {
    const MAX_BATCH_SIZE: usize = 100;
    
    with_swap_job_queue(|queue| {
        Ok(queue
            .range((after_job_id.map_or(Unbounded, Excluded), Unbounded))
            .filter_map(|(_, job)| {
                matches!(job.status, SwapJobStatus::Pending).then(|| job.clone())
            })
            .take(MAX_BATCH_SIZE)
            .collect())
    })
}

/// Update a Solana swap job status (called by proxy after transaction execution)
#[update(guard = "caller_is_proxy")]
pub fn update_solana_swap(
    job_id: u64,
    final_solana_tx_sig: String,
    was_successful: bool,
    error_msg: Option<String>,
) -> Result<(), String> {
    with_swap_job_queue_mut(|queue| {
        if let Some(mut job) = queue.get(&job_id) {
            let target_status = if was_successful {
                SwapJobStatus::Confirmed
            } else {
                SwapJobStatus::Failed
            };

            match job.status {
                SwapJobStatus::PendingVerification => {
                    // Jobs still in verification shouldn't be finalized
                    Err(format!(
                        "Job {} is still in payment verification, cannot finalize yet",
                        job_id
                    ))
                }
                SwapJobStatus::Pending => {
                    // Normal transition: Pending -> Confirmed/Failed
                    job.status = target_status;
                    job.solana_tx_signature_of_payout = Some(final_solana_tx_sig);
                    job.error_message = error_msg;
                    job.updated_at = ICNetwork::get_time();
                    queue.insert(job_id, job);
                    Ok(())
                }
                SwapJobStatus::Confirmed => {
                    if was_successful {
                        // Already confirmed - idempotent if same signature
                        match &job.solana_tx_signature_of_payout {
                            Some(existing_sig) if existing_sig == &final_solana_tx_sig => Ok(()),
                            _ => Err(format!("Job {} already confirmed with different signature", job_id))
                        }
                    } else {
                        // Can't fail a confirmed job
                        Err(format!("Job {} is already confirmed, cannot mark as failed", job_id))
                    }
                }
                SwapJobStatus::Failed => {
                    if was_successful {
                        // Rare case: job previously failed but now succeeded (retry worked)
                        job.status = SwapJobStatus::Confirmed;
                        job.solana_tx_signature_of_payout = Some(final_solana_tx_sig);
                        job.error_message = None;
                        job.updated_at = ICNetwork::get_time();
                        queue.insert(job_id, job);
                        Ok(())
                    } else {
                        // Already failed - update error message if different
                        if job.error_message != error_msg {
                            job.error_message = error_msg;
                            job.updated_at = ICNetwork::get_time();
                            queue.insert(job_id, job);
                        }
                        Ok(())
                    }
                }
            }
        } else {
            Err(format!("Job {} not found", job_id))
        }
    })
}

/// Notify about a Solana transfer (called by proxy)
#[update(guard = "caller_is_proxy")]
pub fn notify_solana_transfer(
    signature: String,
    metadata: Option<String>,
) -> Result<(), String> {
    use crate::solana::proxy::types::TransactionNotification;
    
    let notification = TransactionNotification {
        signature: signature.clone(),
        status: "confirmed".to_string(), // Incoming payments are always confirmed
        metadata,
        timestamp: ICNetwork::get_time(),
    };
    
    store_transaction_notification(notification);
    Ok(())
}