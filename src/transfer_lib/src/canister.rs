use std::{cell::RefCell, time::Duration};

use crate::solana::{guards::caller_is_kong_rpc, swap_job::SwapJob};
use ic_cdk::update;
use ic_cdk_timers::set_timer_interval;
use kong_lib::ic::logging::{self, error_log, info_log};

use crate::{
    solana::{
        kong_rpc::{add_spl_token_args::AddSplTokenArgs, solana_reply::SolanaReply},
        stable_memory::{cleanup_old_notifications, get_cached_solana_address},
        swap_job_cleanup::cleanup_expired_swap_jobs,
    },
    LIB_NAME, LIB_VERSION,
};

type AddSplTokenFn = Box<dyn Fn(AddSplTokenArgs) -> Result<SolanaReply, String>>;
type UpdateSolSwapCallback = Box<dyn Fn(SwapJob, String, Option<String>)>;

pub struct InitArgs {
    pub add_spl_token_fn: Option<AddSplTokenFn>,
    pub update_sol_swap_fn: Option<UpdateSolSwapCallback>,
}

thread_local! {
    static ADD_SPL_TOKEN_FN: RefCell<Option<AddSplTokenFn>> = RefCell::new(None);
    static UPDATE_SOL_SWAP_FN: RefCell<Option<UpdateSolSwapCallback>> = RefCell::new(None);
}

pub fn update_sol_swap_callback(job: SwapJob, final_solana_tx_sig: String, error_msg: Option<String>) {
    UPDATE_SOL_SWAP_FN.with(|update_sol_swap_fn| {
        let update_sol_swap_fn = update_sol_swap_fn.borrow();

        match &*update_sol_swap_fn {
            Some(update_sol_swap_fn) => update_sol_swap_fn(job, final_solana_tx_sig, error_msg),
            None => logging::error_log("sol swap callback unimplemented"),
        }
    });
}

fn set_add_spl_token(init_args: InitArgs) {
    ADD_SPL_TOKEN_FN.with(|add_token_fn| {
        *add_token_fn.borrow_mut() = init_args.add_spl_token_fn;
    });

    UPDATE_SOL_SWAP_FN.with(|update_sol_swap_fn| {
        *update_sol_swap_fn.borrow_mut() = init_args.update_sol_swap_fn;
    });
}

pub fn init(init_args: InitArgs) {
    info_log(&format!("{} canister is being initialized, version={}", LIB_NAME, LIB_VERSION));
    set_timer_processes();
    set_add_spl_token(init_args);
}

pub fn pre_upgrade() {
    info_log(&format!("{} library is being upgraded from {}", LIB_NAME, LIB_VERSION));
}

pub fn post_upgrade(init_args: InitArgs) {
    info_log(&format!("{} canister has been upgraded {}", LIB_NAME, LIB_VERSION));

    // Check if Solana address is cached
    // NOTE: We cannot make inter-canister calls in post_upgrade, even with spawn
    // The verification must be done by calling cache_solana_address() after upgrade
    let cached_solana_address = get_cached_solana_address();
    if !cached_solana_address.is_empty() {
        info_log(&format!("Solana address: {}", cached_solana_address));
    } else {
        error_log("No cached Solana address found");
        error_log("REQUIRED: Call cache_solana_address() to initialize it");
    }

    set_timer_processes();
    set_add_spl_token(init_args);
}

fn set_timer_processes() {
    // start the background timer to cleanup old Solana notifications
    let _ = set_timer_interval(Duration::from_secs(3600), || {
        // Clean up every hour
        ic_cdk::futures::spawn(async {
            cleanup_old_notifications();
        });
    });

    // start the background timer to cleanup expired Solana swap jobs
    let _ = set_timer_interval(Duration::from_secs(60), || {
        // Check every minute for expired swap jobs
        ic_cdk::futures::spawn(async {
            cleanup_expired_swap_jobs();
        });
    });
}

#[update(hidden = true, guard = "caller_is_kong_rpc")]
async fn add_spl_token(args: AddSplTokenArgs) -> Result<SolanaReply, String> {
    ADD_SPL_TOKEN_FN.with(|add_token_fn| {
        let add_token_fn = add_token_fn.borrow();

        match &*add_token_fn {
            Some(add_token_fn) => add_token_fn(args),
            None => Err("Unimplemented".to_string()),
        }
    })
}
