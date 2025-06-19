pub mod common;

use anyhow::Result;
use candid::{decode_one, encode_one, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use pocket_ic::PocketIc;
use num_traits::cast::ToPrimitive;

use kong_backend::add_pool::add_pool_args::AddPoolArgs;
use kong_backend::add_pool::add_pool_reply::AddPoolReply;
use kong_backend::add_token::add_token_args::AddTokenArgs;
use kong_backend::add_token::add_token_reply::AddTokenReply;
use kong_backend::stable_transfer::tx_id::TxId;

use common::identity::{get_identity_from_pem_file, get_new_identity};
use common::setup::{setup_ic_environment, CONTROLLER_PEM_FILE};

// Constants
const TOKEN_A_FEE: u64 = 10_000;

const TOKEN_B_FEE_ICP: u64 = 10_000;

// Enum to represent expected test outcomes
pub enum ExpectedOutcome {
    Success,
    Failure { error_contains: &'static str },
    OtherUserFailure { error_contains: &'static str }, // Special case for testing with another user's tx ID
}

// Configuration for pool tests
pub struct PoolTestConfig {
    pub use_token_a_approval: bool,
    pub use_token_b_approval: bool,
    pub token_a_amount_factor: f64,
    pub token_b_amount_factor: f64,
    pub token_a_approval_factor: f64,
    pub token_b_approval_factor: f64,
    pub expected_outcome: ExpectedOutcome,
    pub lp_fee_bps: Option<u8>,
}

impl PoolTestConfig {
    pub fn standard() -> Self {
        Self {
            use_token_a_approval: false,
            use_token_b_approval: false,
            token_a_amount_factor: 1.0,
            token_b_amount_factor: 1.0,
            token_a_approval_factor: 1.0,
            token_b_approval_factor: 1.0,
            expected_outcome: ExpectedOutcome::Success,
            lp_fee_bps: None,
        }
    }
    
    pub fn with_token_a_approval(mut self) -> Self {
        self.use_token_a_approval = true;
        self
    }
    
    pub fn with_token_b_approval(mut self) -> Self {
        self.use_token_b_approval = true;
        self
    }
    
    pub fn with_insufficient_balance_a(mut self) -> Self {
        self.token_a_amount_factor = 0.5;
        self
    }
    
    pub fn with_insufficient_balance_b(mut self) -> Self {
        self.token_b_amount_factor = 0.5;
        self
    }
    
    pub fn with_insufficient_allowance_a(mut self) -> Self {
        self.token_a_approval_factor = 0.5;
        self
    }
    
    pub fn with_insufficient_allowance_b(mut self) -> Self {
        self.token_b_approval_factor = 0.5;
        self
    }
    
    pub fn with_lp_fee_bps(mut self, bps: u8) -> Self {
        self.lp_fee_bps = Some(bps);
        self
    }
    
    pub fn expecting_failure(mut self, error_contains: &'static str) -> Self {
        self.expected_outcome = ExpectedOutcome::Failure { error_contains };
        self
    }
    
    pub fn expecting_other_user_failure(mut self, error_contains: &'static str) -> Self {
        self.expected_outcome = ExpectedOutcome::OtherUserFailure { error_contains };
        self
    }
}

// TestSetup holds the environment state
pub struct TestSetup {
    pub ic: PocketIc,
    pub kong_backend: Principal,
    pub controller_principal: Principal,
    pub user_principal: Principal,
    pub other_user_principal: Principal,
    pub token_a_ledger_id: Principal,
    pub token_b_ledger_id: Principal,
    pub user_account: Account,
    pub other_user_account: Account,
    pub kong_account: Account,
    pub token_a_str: String,
    pub token_b_str: String,
    pub token_a_liquidity_amount: Nat,
    pub token_b_liquidity_amount: Nat,
    pub token_a_fee: Nat,
    pub token_b_fee: Nat,
}

impl TestSetup {
    pub fn new() -> Result<Self> {
        let (ic, kong_backend) = setup_ic_environment()?;
        
        let controller_identity = get_identity_from_pem_file(CONTROLLER_PEM_FILE)?;
        let controller_principal = controller_identity.sender().expect("Failed to get controller principal");
        let _controller_account = Account {
            owner: controller_principal,
            subaccount: None,
        };
        
        let (token_a_ledger_id, token_b_ledger_id, _, _) = setup_test_tokens(&ic, false, None)?;
        
        // Tokens are already added during setup_ic_environment
        
        // Set up user
        let user_identity = get_new_identity()?;
        let user_principal = user_identity.sender().expect("Failed to get user principal");
        let user_account = Account {
            owner: user_principal,
            subaccount: None,
        };
        
        // Set up another user for testing transaction ID stealing
        let other_user_identity = get_new_identity()?;
        let other_user_principal = other_user_identity.sender().expect("Failed to get other user principal");
        let other_user_account = Account {
            owner: other_user_principal,
            subaccount: None,
        };
        
        let kong_account = Account {
            owner: kong_backend,
            subaccount: None,
        };
        
        // Format token identifiers
        let token_a_str = format!("IC.{}", token_a_ledger_id.to_text());
        let token_b_str = format!("IC.{}", token_b_ledger_id.to_text());
        
        // Base liquidity amounts
        let token_a_liquidity_amount = Nat::from(1_000_000u64);
        let token_b_liquidity_amount = Nat::from(1_000_000u64);
        
        // Fee amounts
        let token_a_fee = Nat::from(TOKEN_A_FEE);
        let token_b_fee = Nat::from(TOKEN_B_FEE_ICP);
        
        Ok(Self {
            ic,
            kong_backend,
            controller_principal,
            user_principal,
            other_user_principal,
            token_a_ledger_id,
            token_b_ledger_id,
            user_account,
            other_user_account,
            kong_account,
            token_a_str,
            token_b_str,
            token_a_liquidity_amount,
            token_b_liquidity_amount,
            token_a_fee,
            token_b_fee,
        })
    }
    
    pub fn calculate_amounts(&self, config: &PoolTestConfig) -> (Nat, Nat) {
        let token_a_amount = multiply_nat(&self.token_a_liquidity_amount, config.token_a_amount_factor);
        let token_b_amount = multiply_nat(&self.token_b_liquidity_amount, config.token_b_amount_factor);
        (token_a_amount, token_b_amount)
    }
    
    pub fn calculate_approval_amounts(&self, config: &PoolTestConfig) -> (Nat, Nat) {
        let (token_a_amount, token_b_amount) = self.calculate_amounts(config);
        
        let token_a_approval = if config.use_token_a_approval {
            // Amount plus fee, multiplied by approval factor
            multiply_nat(&(token_a_amount.clone() + self.token_a_fee.clone()), config.token_a_approval_factor)
        } else {
            Nat::from(0u64)
        };
        
        let token_b_approval = if config.use_token_b_approval {
            // Amount plus fee, multiplied by approval factor
            multiply_nat(&(token_b_amount.clone() + self.token_b_fee.clone()), config.token_b_approval_factor)
        } else {
            Nat::from(0u64)
        };
        
        (token_a_approval, token_b_approval)
    }
    
    pub fn calculate_total_mint_amounts(&self, config: &PoolTestConfig) -> (Nat, Nat) {
        let (token_a_amount, token_b_amount) = self.calculate_amounts(config);
        
        // For insufficient balance tests, we need to mint less than what will be used
        // For insufficient balance test A, we'll mint just enough to pay the approval fee
        // but not enough for the actual transfer
        let total_mint_amount_a = if config.token_a_amount_factor < 1.0 && config.use_token_a_approval {
            // For insufficient balance test, mint just enough to pay the approval fee
            self.token_a_fee.clone()
        } else if config.use_token_a_approval {
            token_a_amount.clone() + self.token_a_fee.clone() + self.token_a_fee.clone()
        } else {
            token_a_amount.clone() + self.token_a_fee.clone()
        };
        
        // Same logic for token B
        let total_mint_amount_b = if config.token_b_amount_factor < 1.0 && config.use_token_b_approval {
            // For insufficient balance test, mint just enough to pay the approval fee
            self.token_b_fee.clone()
        } else if config.use_token_b_approval {
            token_b_amount.clone() + self.token_b_fee.clone() + self.token_b_fee.clone()
        } else {
            token_b_amount.clone() + self.token_b_fee.clone()
        };
        
        (total_mint_amount_a, total_mint_amount_b)
    }
    
    pub fn mint_tokens(&self, config: &PoolTestConfig) -> Result<()> {
        let (total_mint_amount_a, total_mint_amount_b) = self.calculate_total_mint_amounts(config);
        
        // Mint token A to user
        let transfer_result_a = common::icrc1_ledger::icrc1_transfer(
            &self.ic,
            self.token_a_ledger_id,
            self.controller_principal,
            self.user_account,
            total_mint_amount_a.clone(),
            None,
            None,
        );
        
        if transfer_result_a.is_err() {
            return Err(anyhow::anyhow!("Minting Token A to user failed: {:?}", transfer_result_a));
        }
        
        // Mint token B to user
        let transfer_result_b = common::icrc1_ledger::icrc1_transfer(
            &self.ic,
            self.token_b_ledger_id,
            self.controller_principal,
            self.user_account,
            total_mint_amount_b.clone(),
            None,
            None,
        );
        
        if transfer_result_b.is_err() {
            return Err(anyhow::anyhow!("Minting Token B to user failed: {:?}", transfer_result_b));
        }
        
        // For the special case of testing with another user's tx ID,
        // we also need to mint tokens to the other user
        if matches!(config.expected_outcome, ExpectedOutcome::OtherUserFailure { .. }) {
            // Mint the same amounts to the other user
            let other_user_transfer_a = common::icrc1_ledger::icrc1_transfer(
                &self.ic,
                self.token_a_ledger_id,
                self.controller_principal,
                self.other_user_account,
                total_mint_amount_a.clone(),
                None,
                None,
            );
            
            if other_user_transfer_a.is_err() {
                return Err(anyhow::anyhow!("Minting Token A to other user failed: {:?}", other_user_transfer_a));
            }
            
            let other_user_transfer_b = common::icrc1_ledger::icrc1_transfer(
                &self.ic,
                self.token_b_ledger_id,
                self.controller_principal,
                self.other_user_account,
                total_mint_amount_b.clone(),
                None,
                None,
            );
            
            if other_user_transfer_b.is_err() {
                return Err(anyhow::anyhow!("Minting Token B to other user failed: {:?}", other_user_transfer_b));
            }
        }
        
        Ok(())
    }
    
    pub fn approve_token_a(&self, config: &PoolTestConfig) -> Result<()> {
        if !config.use_token_a_approval {
            return Ok(());
        }
        
        let (token_a_approval, _) = self.calculate_approval_amounts(config);
        
        let approve_result = common::icrc1_ledger::icrc2_approve(
            &self.ic,
            self.token_a_ledger_id,
            self.user_principal,
            self.kong_account,
            token_a_approval.clone(),
            None,
            None,
            Some(self.token_a_fee.clone()),
            None,
        );
        
        if approve_result.is_err() {
            return Err(anyhow::anyhow!("User approval for Token A failed: {:?}", approve_result));
        }
        
        Ok(())
    }
    
    pub fn approve_token_b(&self, config: &PoolTestConfig) -> Result<()> {
        if !config.use_token_b_approval {
            return Ok(());
        }
        
        let (_, token_b_approval) = self.calculate_approval_amounts(config);
        
        let approve_result = common::icrc1_ledger::icrc2_approve(
            &self.ic,
            self.token_b_ledger_id,
            self.user_principal,
            self.kong_account,
            token_b_approval.clone(),
            None,
            None,
            Some(self.token_b_fee.clone()),
            None,
        );
        
        if approve_result.is_err() {
            return Err(anyhow::anyhow!("User approval for Token B failed: {:?}", approve_result));
        }
        
        Ok(())
    }
    
    pub fn transfer_token_a(&self, config: &PoolTestConfig) -> Result<Option<Nat>> {
        if config.use_token_a_approval {
            return Ok(None);
        }
        
        let (token_a_amount, _) = self.calculate_amounts(config);
        
        let transfer_result = common::icrc1_ledger::icrc1_transfer(
            &self.ic,
            self.token_a_ledger_id,
            self.user_principal,
            self.kong_account,
            token_a_amount.clone(),
            None,
            None,
        );
        
        match transfer_result {
            Ok(tx_id) => Ok(Some(tx_id)),
            Err(e) => Err(anyhow::anyhow!("Transfer of Token A to Kong failed: {:?}", e)),
        }
    }
    
    pub fn transfer_token_a_other_user(&self, config: &PoolTestConfig) -> Result<Option<Nat>> {
        if !matches!(config.expected_outcome, ExpectedOutcome::OtherUserFailure { .. }) {
            return Ok(None);
        }
        
        let (token_a_amount, _) = self.calculate_amounts(config);
        
        // Have the other user transfer tokens to Kong
        let transfer_result = common::icrc1_ledger::icrc1_transfer(
            &self.ic,
            self.token_a_ledger_id,
            self.other_user_principal,
            self.kong_account,
            token_a_amount.clone(),
            None,
            None,
        );
        
        match transfer_result {
            Ok(tx_id) => Ok(Some(tx_id)),
            Err(e) => Err(anyhow::anyhow!("Transfer of Token A from other user to Kong failed: {:?}", e)),
        }
    }
    
    pub fn transfer_token_b(&self, config: &PoolTestConfig) -> Result<Option<Nat>> {
        if config.use_token_b_approval {
            return Ok(None);
        }
        
        let (_, token_b_amount) = self.calculate_amounts(config);
        
        let transfer_result = common::icrc1_ledger::icrc1_transfer(
            &self.ic,
            self.token_b_ledger_id,
            self.user_principal,
            self.kong_account,
            token_b_amount.clone(),
            None,
            None,
        );
        
        match transfer_result {
            Ok(tx_id) => Ok(Some(tx_id)),
            Err(e) => Err(anyhow::anyhow!("Transfer of Token B to Kong failed: {:?}", e)),
        }
    }
    
    pub fn transfer_token_b_other_user(&self, config: &PoolTestConfig) -> Result<Option<Nat>> {
        if !matches!(config.expected_outcome, ExpectedOutcome::OtherUserFailure { .. }) {
            return Ok(None);
        }
        
        let (_, token_b_amount) = self.calculate_amounts(config);
        
        // Have the other user transfer tokens to Kong
        let transfer_result = common::icrc1_ledger::icrc1_transfer(
            &self.ic,
            self.token_b_ledger_id,
            self.other_user_principal,
            self.kong_account,
            token_b_amount.clone(),
            None,
            None,
        );
        
        match transfer_result {
            Ok(tx_id) => Ok(Some(tx_id)),
            Err(e) => Err(anyhow::anyhow!("Transfer of Token B from other user to Kong failed: {:?}", e)),
        }
    }
    
    pub fn execute_add_pool(&self, config: &PoolTestConfig, tx_id_a: Option<Nat>, tx_id_b: Option<Nat>) -> Result<Result<AddPoolReply, String>> {
        let (token_a_amount, token_b_amount) = self.calculate_amounts(config);
        
        let add_pool_args = AddPoolArgs {
            token_0: self.token_a_str.clone(),
            amount_0: token_a_amount,
            tx_id_0: tx_id_a.map(TxId::BlockIndex),
            token_1: self.token_b_str.clone(),
            amount_1: token_b_amount,
            tx_id_1: tx_id_b.map(TxId::BlockIndex),
            lp_fee_bps: config.lp_fee_bps,
            signature_0: None,
            signature_1: None,
            timestamp: None,
        };
        
        let add_pool_payload = encode_one(&add_pool_args).expect("Failed to encode add_pool_args");
        
        let add_pool_response_bytes = self.ic
            .update_call(self.kong_backend, self.user_principal, "add_pool", add_pool_payload)
            .map_err(|e| anyhow::anyhow!("Failed to call add_pool: {:?}", e))?;
        
        let add_pool_result = decode_one::<Result<AddPoolReply, String>>(&add_pool_response_bytes)
            .expect("Failed to decode add_pool response");
        
        Ok(add_pool_result)
    }
    
    pub fn verify_balances(&self, config: &PoolTestConfig, add_pool_succeeded: bool) -> Result<()> {
        let (token_a_amount, token_b_amount) = self.calculate_amounts(config);
        
        // Get current balances
        let kong_balance_a = common::icrc1_ledger::get_icrc1_balance(&self.ic, self.token_a_ledger_id, self.kong_account);
        let kong_balance_b = common::icrc1_ledger::get_icrc1_balance(&self.ic, self.token_b_ledger_id, self.kong_account);
        let user_balance_a = common::icrc1_ledger::get_icrc1_balance(&self.ic, self.token_a_ledger_id, self.user_account);
        let user_balance_b = common::icrc1_ledger::get_icrc1_balance(&self.ic, self.token_b_ledger_id, self.user_account);
        
        if add_pool_succeeded {
            // If successful, Kong should have the full amounts
            assert_eq!(
                kong_balance_a, token_a_amount,
                "Kong backend balance for Token A incorrect after add_pool"
            );
            
            assert_eq!(
                kong_balance_b, token_b_amount,
                "Kong backend balance for Token B incorrect after add_pool"
            );
            
            // User balances are more complex to verify because of fees,
            // but we can at least check they're reasonable (non-zero and not excessive)
            let (_total_mint_a, _total_mint_b) = self.calculate_total_mint_amounts(config);
            
            // User should have at most the total mint amount (minus what was transferred/approved)
            assert!(
                user_balance_a <= _total_mint_a,
                "User balance for Token A is unreasonably high after successful add_pool"
            );
            
            assert!(
                user_balance_b <= _total_mint_b,
                "User balance for Token B is unreasonably high after successful add_pool"
            );
        } else {
            // If failed, Kong balances should be at most a few fees worth
            assert!(
                kong_balance_a <= self.token_a_fee.clone() * Nat::from(2u64),
                "Kong balance for Token A is unexpectedly high after failed add_pool: {}",
                kong_balance_a
            );
            
            assert!(
                kong_balance_b <= self.token_b_fee.clone() * Nat::from(2u64),
                "Kong balance for Token B is unexpectedly high after failed add_pool: {}",
                kong_balance_b
            );
            
            // User balances should still be present (minus fees)
            let (_total_mint_a, _total_mint_b) = self.calculate_total_mint_amounts(config);
            
            // For insufficient balance tests, we may have a zero balance after the approval fee is paid
            // So we'll relax this check for those specific tests
            if !(config.token_a_amount_factor < 1.0 && config.use_token_a_approval) {
                assert!(
                    user_balance_a > 0u64,
                    "User balance for Token A should not be zero after failed add_pool"
                );
            }
            
            if !(config.token_b_amount_factor < 1.0 && config.use_token_b_approval) {
                assert!(
                    user_balance_b > 0u64,
                    "User balance for Token B should not be zero after failed add_pool"
                );
            }
        }
        
        Ok(())
    }
}

// Helper function to multiply a Nat by a float factor
fn multiply_nat(nat: &Nat, factor: f64) -> Nat {
    // Convert the Nat to a u128, multiply it by the factor, then convert back to Nat
    let value = nat.0.to_u128().unwrap_or(0);
    let result = (value as f64 * factor) as u128;
    Nat::from(result)
}


// Helper function to set up test tokens
fn setup_test_tokens(
    _ic: &PocketIc,
    _token_b_use_icrc1: bool,
    _token_b_principal_id_opt: Option<Principal>,
) -> Result<(Principal, Principal, Principal, Account)> {
    let controller_identity = get_identity_from_pem_file(CONTROLLER_PEM_FILE)
        .expect("Failed to get controller identity");
    let controller_principal = controller_identity
        .sender()
        .expect("Failed to get controller principal");
    let controller_account = Account {
        owner: controller_principal,
        subaccount: None,
    };

    let token_a_ledger_id = Principal::from_text("zdzgz-siaaa-aaaar-qaiba-cai")
        .expect("Invalid ksUSDT Principal ID");
    let token_b_ledger_id = Principal::from_text("nppha-riaaa-aaaal-ajf2q-cai")
        .expect("Invalid ICP Principal ID");

    Ok((token_a_ledger_id, token_b_ledger_id, controller_principal, controller_account))
}

// Main test execution function
pub fn run_pool_test(config: PoolTestConfig) -> Result<()> {
    let setup = TestSetup::new()?;
    
    // 1. Mint tokens based on configuration
    setup.mint_tokens(&config)?;
    
    // 2. Set approvals if required by config
    if config.use_token_a_approval {
        setup.approve_token_a(&config)?;
    }
    
    if config.use_token_b_approval {
        setup.approve_token_b(&config)?;
    }
    
    // 3. Transfer tokens if not using approval
    let tx_id_a = if !config.use_token_a_approval {
        setup.transfer_token_a(&config)?
    } else {
        None
    };
    
    let tx_id_b = if !config.use_token_b_approval {
        setup.transfer_token_b(&config)?
    } else {
        None
    };
    
    // Handle the OtherUserFailure case separately
    if let ExpectedOutcome::OtherUserFailure { error_contains } = &config.expected_outcome {
        // Have other user transfer tokens to Kong
        let other_user_tx_id_a = setup.transfer_token_a_other_user(&config)?;
        let other_user_tx_id_b = setup.transfer_token_b_other_user(&config)?;
        
        // Use a unique token name to avoid "pool already exists" errors
        let unique_token_a = format!("{}_test_{}", setup.token_a_str, other_user_tx_id_a.as_ref().unwrap());
        let unique_token_b = format!("{}_test_{}", setup.token_b_str, other_user_tx_id_b.as_ref().unwrap());
        
        // First, add these unique tokens to make them valid
        let add_token_a_args = AddTokenArgs {
            token: unique_token_a.clone(),
            name: None,
            symbol: None,
            decimals: None,
            fee: None,
            program_id: None,
            total_supply: None,
        };
        let args_a = encode_one(&add_token_a_args).expect("Failed to encode add_token arguments");
        let response_a = setup.ic
            .update_call(setup.kong_backend, setup.controller_principal, "add_token", args_a)
            .map_err(|e| anyhow::anyhow!("Failed to call add_token: {:?}", e))?;
        let _result_a = decode_one::<Result<AddTokenReply, String>>(&response_a).expect("Failed to decode add_token response");
        
        let add_token_b_args = AddTokenArgs {
            token: unique_token_b.clone(),
            name: None,
            symbol: None,
            decimals: None,
            fee: None,
            program_id: None,
            total_supply: None,
        };
        let args_b = encode_one(&add_token_b_args).expect("Failed to encode add_token arguments");
        let response_b = setup.ic
            .update_call(setup.kong_backend, setup.controller_principal, "add_token", args_b)
            .map_err(|e| anyhow::anyhow!("Failed to call add_token: {:?}", e))?;
        let _result_b = decode_one::<Result<AddTokenReply, String>>(&response_b).expect("Failed to decode add_token response");
        
        // Try adding pool with other user's tx IDs
        let add_pool_args = AddPoolArgs {
            token_0: unique_token_a,
            amount_0: setup.token_a_liquidity_amount.clone(),
            tx_id_0: other_user_tx_id_a.map(TxId::BlockIndex), // Use other user's tx ID
            token_1: unique_token_b,
            amount_1: setup.token_b_liquidity_amount.clone(),
            tx_id_1: other_user_tx_id_b.map(TxId::BlockIndex), // Use other user's tx ID
            lp_fee_bps: None,
            signature_0: None,
            signature_1: None,
            timestamp: None,
        };
        
        let add_pool_payload = encode_one(&add_pool_args).expect("Failed to encode add_pool_args");
        
        let add_pool_response_bytes = setup.ic
            .update_call(setup.kong_backend, setup.user_principal, "add_pool", add_pool_payload)
            .map_err(|e| anyhow::anyhow!("Failed to call add_pool with other user tx_id: {:?}", e))?;
        
        let result_with_other_tx = decode_one::<Result<AddPoolReply, String>>(&add_pool_response_bytes)
            .expect("Failed to decode add_pool response");
        
        assert!(result_with_other_tx.is_err(), "Expected failure when using other user's tx ID but got success");
        if let Err(err) = result_with_other_tx {
            assert!(
                err.contains(error_contains) || err.contains("forbidden") || err.contains("owner"),
                "Error '{}' doesn't contain expected text '{}', 'forbidden', or 'owner'",
                err, error_contains
            );
        }
        
        return Ok(());
    }
    
    // For all other test cases, run the standard flow:
    // 4. Create and execute add_pool call
    let result = setup.execute_add_pool(&config, tx_id_a, tx_id_b)?;
    
    // 5. Verify result against expected outcome
    match config.expected_outcome {
        ExpectedOutcome::Success => {
            assert!(result.is_ok(), "Expected success but got error: {:?}", result);
            setup.verify_balances(&config, true)?;
        }
        ExpectedOutcome::Failure { error_contains } => {
            assert!(result.is_err(), "Expected failure but got success");
            if let Err(err) = result {
                assert!(
                    err.contains(error_contains),
                    "Error '{}' doesn't contain expected text '{}'",
                    err, error_contains
                );
            }
            setup.verify_balances(&config, false)?;
        }
        ExpectedOutcome::OtherUserFailure { .. } => {
            unreachable!("OtherUserFailure should be handled in the special case above")
        }
    }
    
    Ok(())
}

// Example test cases using the new pattern
#[test]
fn test_add_pool_using_approvals() {
    let config = PoolTestConfig::standard()
        .with_token_a_approval()
        .with_token_b_approval();
    
    run_pool_test(config).unwrap();
}

#[test]
fn test_add_pool_using_transfers() {
    let config = PoolTestConfig::standard();
    // Default is already using transfers
    
    run_pool_test(config).unwrap();
}

#[test]
fn test_add_pool_with_mixed_methods() {
    let config = PoolTestConfig::standard()
        .with_token_a_approval();
    // Token B will use transfer
    
    run_pool_test(config).unwrap();
}

#[test]
fn test_add_pool_insufficient_token_a_balance() {
    let config = PoolTestConfig::standard()
        .with_token_a_approval()
        .with_token_b_approval()
        .with_insufficient_balance_a()
        .expecting_failure("doesn't have enough funds");
    
    run_pool_test(config).unwrap();
}

#[test]
fn test_add_pool_insufficient_token_b_balance() {
    let config = PoolTestConfig::standard()
        .with_token_a_approval()
        .with_token_b_approval()
        .with_insufficient_balance_b()
        .expecting_failure("doesn't have enough funds");
    
    run_pool_test(config).unwrap();
}

#[test]
fn test_add_pool_insufficient_allowance() {
    let config = PoolTestConfig::standard()
        .with_token_a_approval()
        .with_token_b_approval()
        .with_insufficient_allowance_a()
        .expecting_failure("spender account does not have sufficient allowance");
    
    run_pool_test(config).unwrap();
}

#[test]
fn test_add_pool_with_custom_fee() {
    let config = PoolTestConfig::standard()
        .with_lp_fee_bps(30); // 0.3% fee
    
    run_pool_test(config).unwrap();
}

#[test]
fn test_add_pool_with_other_user_tx_id() {
    // This test directly attempts to use a tx_id from another user
    // We'll manually set up everything instead of using the builder pattern
    
    // 1. Set up environment
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");
    
    // Set up tokens
    let (token_a_ledger_id, token_b_ledger_id, controller_principal, _) =
        setup_test_tokens(&ic, false, None).expect("Failed to setup test tokens");
    
    // Tokens are already added during setup_ic_environment
    
    // 2. Create two users
    let user_identity = get_new_identity().expect("Failed to create new user identity");
    let user_principal = user_identity.sender().expect("Failed to get user principal");
    let user_account = Account {
        owner: user_principal,
        subaccount: None,
    };
    
    let other_user_identity = get_new_identity().expect("Failed to create second user identity");
    let other_user_principal = other_user_identity.sender().expect("Failed to get other user principal");
    let other_user_account = Account {
        owner: other_user_principal,
        subaccount: None,
    };
    
    let kong_account = Account {
        owner: kong_backend,
        subaccount: None,
    };
    
    // 3. Mint tokens to both users
    let token_a_amount = Nat::from(1_000_000u64);
    let token_b_amount = Nat::from(1_000_000u64);
    let token_a_fee = Nat::from(TOKEN_A_FEE);
    let token_b_fee = Nat::from(TOKEN_B_FEE_ICP);
    
    // Mint to other user (who will make the original transactions)
    let _mint_a_to_other = common::icrc1_ledger::icrc1_transfer(
        &ic,
        token_a_ledger_id,
        controller_principal,
        other_user_account,
        token_a_amount.clone() + token_a_fee.clone(),
        None,
        None,
    ).expect("Failed to mint token A to other user");
    
    let _mint_b_to_other = common::icrc1_ledger::icrc1_transfer(
        &ic,
        token_b_ledger_id,
        controller_principal,
        other_user_account,
        token_b_amount.clone() + token_b_fee.clone(),
        None,
        None,
    ).expect("Failed to mint token B to other user");
    
    // Mint to main user (who will try to claim the other user's transactions)
    let _mint_a_to_user = common::icrc1_ledger::icrc1_transfer(
        &ic,
        token_a_ledger_id,
        controller_principal,
        user_account,
        token_a_amount.clone() + token_a_fee.clone(),
        None,
        None,
    ).expect("Failed to mint token A to user");
    
    let _mint_b_to_user = common::icrc1_ledger::icrc1_transfer(
        &ic,
        token_b_ledger_id,
        controller_principal,
        user_account,
        token_b_amount.clone() + token_b_fee.clone(),
        None,
        None,
    ).expect("Failed to mint token B to user");
    
    // 4. Other user transfers tokens to Kong
    let tx_id_a = common::icrc1_ledger::icrc1_transfer(
        &ic,
        token_a_ledger_id,
        other_user_principal,
        kong_account,
        token_a_amount.clone(),
        None,
        None,
    ).expect("Failed to transfer token A from other user to Kong");
    
    let tx_id_b = common::icrc1_ledger::icrc1_transfer(
        &ic,
        token_b_ledger_id,
        other_user_principal,
        kong_account,
        token_b_amount.clone(),
        None,
        None,
    ).expect("Failed to transfer token B from other user to Kong");
    
    // 5. Main user tries to claim other user's tx_ids to create a pool
    let token_a_str = format!("IC.{}", token_a_ledger_id.to_text());
    let token_b_str = format!("IC.{}", token_b_ledger_id.to_text());
    
    let add_pool_args = AddPoolArgs {
        token_0: token_a_str,
        amount_0: token_a_amount,
        tx_id_0: Some(TxId::BlockIndex(tx_id_a)),  // Using OTHER user's tx ID
        token_1: token_b_str,
        amount_1: token_b_amount,
        tx_id_1: Some(TxId::BlockIndex(tx_id_b)),  // Using OTHER user's tx ID
        lp_fee_bps: None,
        signature_0: None,
        signature_1: None,
        timestamp: None,
    };
    
    let add_pool_payload = encode_one(&add_pool_args).expect("Failed to encode add_pool_args");
    
    let add_pool_response_bytes = ic
        .update_call(kong_backend, user_principal, "add_pool", add_pool_payload)
        .expect("Failed to call add_pool");
    
    let add_pool_result = decode_one::<Result<AddPoolReply, String>>(&add_pool_response_bytes)
        .expect("Failed to decode add_pool response");
    
    // Verify failure - should reject because the tx IDs belong to a different user
    assert!(add_pool_result.is_err(), "Expected failure when using other user's tx ID but got success");
    
    // TODO: this is a hack to check if the error contains the expected text
    if let Err(err) = add_pool_result {
        let error_lower = err.to_lowercase();
        assert!(
            error_lower.contains("principal") || 
            error_lower.contains("caller") || 
            error_lower.contains("transaction") || 
            error_lower.contains("tx") || 
            error_lower.contains("verification") || 
            error_lower.contains("forbidden") || 
            error_lower.contains("owner"),
            "Error doesn't indicate an ownership verification failure: {}", 
            err
        );
    }
}
