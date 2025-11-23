use ic_cdk::query;
use std::ops::Bound::{Excluded, Unbounded};

use crate::solana::guards::caller_is_kong_rpc;
use crate::solana::stable_memory::with_swap_job_queue;
use crate::solana::swap_job::{SwapJob, SwapJobId, SwapJobStatus};

/// Get pending Solana swap jobs for kong_rpc processing (called by kong_rpc)
#[query(hidden = true, guard = "caller_is_kong_rpc")]
pub fn get_solana_outgoing_transfer(from_job_id: Option<SwapJobId>) -> Result<Vec<SwapJob>, String> {
    const MAX_BATCH_SIZE: usize = 100;

    with_swap_job_queue(|queue| {
        Ok(queue
            .range((from_job_id.map_or(Unbounded, |id| Excluded(id)), Unbounded))
            .filter_map(|(_, job)| matches!(job.status, SwapJobStatus::Pending).then(|| job.clone()))
            .take(MAX_BATCH_SIZE)
            .collect())
    })
}
