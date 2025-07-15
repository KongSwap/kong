use std::collections::HashMap;
use tokio_postgres::{Client, Statement};
use anyhow::{Context, Result};

#[derive(Clone)]
pub struct PreparedStatements {
    statements: HashMap<&'static str, Statement>,
}

impl PreparedStatements {
    pub async fn new(client: &Client) -> Result<Self> {
        let mut statements = HashMap::new();
        
        // Request statements
        let insert_request = client.prepare(
            "INSERT INTO requests (request_id, user_id, request_type, request, reply, statuses, ts)
             VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7))
             ON CONFLICT (request_id) DO UPDATE SET
                 user_id = $2,
                 request_type = $3,
                 request = $4,
                 reply = $5,
                 statuses = $6,
                 ts = to_timestamp($7)"
        ).await.context("Failed to prepare insert_request statement")?;
        statements.insert("insert_request", insert_request);
        
        // Token statements
        let insert_token = client.prepare(
            "INSERT INTO tokens (token_id, token_type, name, symbol, address, canister_id, decimals, fee, icrc1, icrc2, icrc3, is_removed, raw_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (token_id) DO UPDATE SET
                 token_type = $2,
                 name = $3,
                 symbol = $4,
                 address = $5,
                 canister_id = $6,
                 decimals = $7,
                 fee = $8,
                 icrc1 = $9,
                 icrc2 = $10,
                 icrc3 = $11,
                 is_removed = $12,
                 raw_json = $13"
        ).await.context("Failed to prepare insert_token statement")?;
        statements.insert("insert_token", insert_token);
        
        // Pool statements
        let insert_pool = client.prepare(
            "INSERT INTO pools (pool_id, token_id_0, balance_0, lp_fee_0, kong_fee_0, token_id_1, balance_1, lp_fee_1, kong_fee_1, lp_fee_bps, kong_fee_bps, lp_token_id, is_removed, tvl, rolling_24h_volume, rolling_24h_lp_fee, rolling_24h_num_swaps, rolling_24h_apy, raw_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
             ON CONFLICT (pool_id) DO UPDATE SET
                 token_id_0 = $2,
                 balance_0 = $3,
                 lp_fee_0 = $4,
                 kong_fee_0 = $5,
                 token_id_1 = $6,
                 balance_1 = $7,
                 lp_fee_1 = $8,
                 kong_fee_1 = $9,
                 lp_fee_bps = $10,
                 kong_fee_bps = $11,
                 lp_token_id = $12,
                 is_removed = $13,
                 tvl = $14,
                 rolling_24h_volume = $15,
                 rolling_24h_lp_fee = $16,
                 rolling_24h_num_swaps = $17,
                 rolling_24h_apy = $18,
                 raw_json = $19"
        ).await.context("Failed to prepare insert_pool statement")?;
        statements.insert("insert_pool", insert_pool);
        
        // User statements
        let insert_user = client.prepare(
            "INSERT INTO users (user_id, principal_id, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, raw_json)
             VALUES ($1, $2, $3, $4, to_timestamp($5), $6, to_timestamp($7), $8)
             ON CONFLICT (user_id) DO UPDATE SET
                 principal_id = $2,
                 my_referral_code = $3,
                 referred_by = $4,
                 referred_by_expires_at = to_timestamp($5),
                 fee_level = $6,
                 fee_level_expires_at = to_timestamp($7),
                 raw_json = $8"
        ).await.context("Failed to prepare insert_user statement")?;
        statements.insert("insert_user", insert_user);
        
        // Transfer statements
        let insert_transfer = client.prepare(
            "INSERT INTO transfers (transfer_id, request_id, is_send, token_id, amount, block_index, tx_hash, ts, raw_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), $9)
             ON CONFLICT (transfer_id) DO UPDATE SET
                 request_id = $2,
                 is_send = $3,
                 token_id = $4,
                 amount = $5,
                 block_index = $6,
                 tx_hash = $7,
                 ts = to_timestamp($8),
                 raw_json = $9"
        ).await.context("Failed to prepare insert_transfer statement")?;
        statements.insert("insert_transfer", insert_transfer);
        
        // Transaction statements
        let insert_tx = client.prepare(
            "INSERT INTO txs (tx_id, tx_type, user_id, request_id, ts, raw_json)
             VALUES ($1, $2, $3, $4, to_timestamp($5), $6)
             ON CONFLICT (tx_id) DO UPDATE SET
                 tx_type = $2,
                 user_id = $3,
                 request_id = $4,
                 ts = to_timestamp($5),
                 raw_json = $6"
        ).await.context("Failed to prepare insert_tx statement")?;
        statements.insert("insert_tx", insert_tx);
        
        // Claim statements
        let insert_claim = client.prepare(
            "INSERT INTO claims (claim_id, user_id, token_id, status, amount, request_id, to_address, \"desc\", attempt_request_id, transfer_ids, ts, raw_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_timestamp($11), $12)
             ON CONFLICT (claim_id) DO UPDATE SET
                 user_id = $2,
                 token_id = $3,
                 status = $4,
                 amount = $5,
                 request_id = $6,
                 to_address = $7,
                 \"desc\" = $8,
                 attempt_request_id = $9,
                 transfer_ids = $10,
                 ts = to_timestamp($11),
                 raw_json = $12"
        ).await.context("Failed to prepare insert_claim statement")?;
        statements.insert("insert_claim", insert_claim);
        
        // LP Token statements
        let insert_lp_token = client.prepare(
            "INSERT INTO lp_tokens (lp_token_id, user_id, token_id, amount, ts, raw_json)
             VALUES ($1, $2, $3, $4, to_timestamp($5), $6)
             ON CONFLICT (lp_token_id) DO UPDATE SET
                 user_id = $2,
                 token_id = $3,
                 amount = $4,
                 ts = to_timestamp($5),
                 raw_json = $6"
        ).await.context("Failed to prepare insert_lp_token statement")?;
        statements.insert("insert_lp_token", insert_lp_token);
        
        // Query statements
        let get_token_decimals = client.prepare(
            "SELECT decimals FROM tokens WHERE token_id = $1"
        ).await.context("Failed to prepare get_token_decimals statement")?;
        statements.insert("get_token_decimals", get_token_decimals);
        
        let load_all_tokens = client.prepare(
            "SELECT token_id, decimals FROM tokens"
        ).await.context("Failed to prepare load_all_tokens statement")?;
        statements.insert("load_all_tokens", load_all_tokens);
        
        let load_all_pools = client.prepare(
            "SELECT pool_id, token_id_0, token_id_1 FROM pools"
        ).await.context("Failed to prepare load_all_pools statement")?;
        statements.insert("load_all_pools", load_all_pools);
        
        Ok(Self { statements })
    }
    
    pub fn get(&self, name: &str) -> Option<&Statement> {
        self.statements.get(name)
    }
    
    pub fn insert_request(&self) -> &Statement {
        self.statements.get("insert_request").unwrap()
    }
    
    pub fn insert_token(&self) -> &Statement {
        self.statements.get("insert_token").unwrap()
    }
    
    pub fn insert_pool(&self) -> &Statement {
        self.statements.get("insert_pool").unwrap()
    }
    
    pub fn insert_user(&self) -> &Statement {
        self.statements.get("insert_user").unwrap()
    }
    
    pub fn insert_transfer(&self) -> &Statement {
        self.statements.get("insert_transfer").unwrap()
    }
    
    pub fn insert_tx(&self) -> &Statement {
        self.statements.get("insert_tx").unwrap()
    }
    
    pub fn insert_claim(&self) -> &Statement {
        self.statements.get("insert_claim").unwrap()
    }
    
    pub fn insert_lp_token(&self) -> &Statement {
        self.statements.get("insert_lp_token").unwrap()
    }
    
    pub fn get_token_decimals(&self) -> &Statement {
        self.statements.get("get_token_decimals").unwrap()
    }
    
    pub fn load_all_tokens(&self) -> &Statement {
        self.statements.get("load_all_tokens").unwrap()
    }
    
    pub fn load_all_pools(&self) -> &Statement {
        self.statements.get("load_all_pools").unwrap()
    }
}

// Thread-safe prepared statements cache
use std::sync::Arc;
use tokio::sync::RwLock;

pub type PreparedStatementsCache = Arc<RwLock<Option<PreparedStatements>>>;

pub async fn get_or_create_prepared_statements(
    cache: &PreparedStatementsCache,
    client: &Client,
) -> Result<PreparedStatements> {
    // Try to read from cache first
    {
        let read_guard = cache.read().await;
        if let Some(statements) = read_guard.as_ref() {
            return Ok(statements.clone());
        }
    }
    
    // Cache miss - create new statements
    let statements = PreparedStatements::new(client).await?;
    
    // Update cache
    {
        let mut write_guard = cache.write().await;
        *write_guard = Some(statements.clone());
    }
    
    Ok(statements)
}

pub fn create_prepared_statements_cache() -> PreparedStatementsCache {
    Arc::new(RwLock::new(None))
}