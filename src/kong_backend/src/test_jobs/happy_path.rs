//! Happy Path Test Jobs
//!
//! Creates 10 valid SOL transfer jobs that kong_rpc can pick up and process.
//! Expected flow: Pending → Confirmed (if Solana succeeds)

use candid::Nat;
use ic_cdk::update;
use kong_lib::ic::address::Address;
use kong_lib::ic::network::ICNetwork;

use transfer_lib::solana::create_job::create_solana_swap_job;
use transfer_lib::solana::send_info::SendInfo;

/// 0.001 SOL in lamports
const AMOUNT_LAMPORTS: u64 = 1_000_000;

/// Native SOL token (mint address is all 1s)
fn native_sol_token() -> kong_lib::stable_token::solana_token::SolanaToken {
    kong_lib::stable_token::solana_token::SolanaToken {
        token_id: 0,
        symbol: "SOL".to_string(),
        name: "Solana".to_string(),
        decimals: 9,
        fee: Nat::from(0u64),
        mint_address: "11111111111111111111111111111111".to_string(),
        program_id: "11111111111111111111111111111111".to_string(),
        is_removed: false,
        is_spl_token: false,
    }
}

/// Spawn 10 valid SOL transfer jobs.
///
/// # Arguments
/// * `destination_address` - Solana address to send to (base58)
///
/// # Returns
/// Vec of job_ids for the created jobs
#[update]
pub async fn spawn_test_jobs_happy_path(destination_address: String) -> Result<Vec<u64>, String> {
    let sol_token = native_sol_token();
    let amount = Nat::from(AMOUNT_LAMPORTS);
    let to_address = Address::SolanaAddress(destination_address);
    let ts = ICNetwork::get_time();

    let mut job_ids = Vec::with_capacity(10);

    for i in 0..10 {
        let send_info = SendInfo {
            request_id: i,
            user_id: 0,
            ts: None,
        };

        let job_id = create_solana_swap_job(&sol_token, &amount, &to_address, &send_info, ts).await?;
        job_ids.push(job_id);
    }

    Ok(job_ids)
}
