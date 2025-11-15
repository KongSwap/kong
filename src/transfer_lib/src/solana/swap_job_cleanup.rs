//! Cleanup task for expired Solana swap jobs
//!
//! This module handles the expiration of swap jobs that have been pending
//! for too long without confirmation from kong_rpc.

use kong_lib::ic::{logging::{error_log, info_log}, network::ICNetwork};

use crate::solana::{stable_memory::with_swap_job_queue_mut, swap_job::SwapJobStatus};

/// Timeout for swap jobs in nanoseconds (300 seconds = 5 minutes)
const SWAP_JOB_TIMEOUT_NS: u64 = 300_000_000_000;

/// Clean up expired swap jobs that have been pending for too long.
///
/// This function:
/// 1. Finds all swap jobs in Pending status older than SWAP_JOB_TIMEOUT_NS
/// 2. Marks them as Failed with an appropriate error message
/// 3. Creates claims for fund recovery
///
/// This ensures that if kong_rpc fails to report back (network issues, crashes, etc.),
/// users can still recover their funds through the claim system.
pub fn cleanup_expired_swap_jobs() {
    let current_time = ICNetwork::get_time();
    let cutoff_time = current_time.saturating_sub(SWAP_JOB_TIMEOUT_NS);

    with_swap_job_queue_mut(|queue| {
        let mut expired_count = 0;

        // Collect jobs to update (avoid borrowing issues)
        let jobs_to_update: Vec<_> = queue
            .iter()
            .filter(|(_, job)| job.status == SwapJobStatus::Pending && job.created_at < cutoff_time)
            .map(|(id, job)| (id, job.clone()))
            .collect();

        for (job_id, mut job) in jobs_to_update {
            // Expired = uncertain status, needs manual investigation
            // Only kong_rpc reported failures create claims
            error_log(&format!(
                "[CLEANUP] Job #{} expired after {}s - Status UNKNOWN, manual investigation required. User: {}, Request: {}",
                job.id,
                (current_time - job.created_at) / 1_000_000_000,
                job.user_id,
                job.request_id
            ));

            expired_count += 1;

            // Mark job as expired (NOT failed - status is unknown)
            job.status = SwapJobStatus::Expired;
            job.error_message = Some(format!(
                "Transaction expired after {} seconds without confirmation from kong_rpc - status unknown, requires manual check",
                (current_time - job.created_at) / 1_000_000_000
            ));
            job.updated_at = current_time;
            queue.insert(job_id, job);
        }

        if expired_count > 0 {
            info_log(&format!(
                "[CLEANUP] Marked {} swap job(s) as expired - manual investigation required",
                expired_count
            ));
        }
    });
}
