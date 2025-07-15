use std::collections::BTreeMap;
use anyhow::{Context, Result};

use super::pool::DbPool;
use super::prepared::PreparedStatements;

/// Smart cache for tokens that only fetches missing entries instead of full table scans
#[derive(Debug, Clone)]
pub struct TokenCache {
    pub tokens_map: BTreeMap<u32, u8>,
    last_full_reload: Option<std::time::Instant>,
    reload_interval: std::time::Duration,
}

impl TokenCache {
    pub fn new() -> Self {
        Self {
            tokens_map: BTreeMap::new(),
            last_full_reload: None,
            reload_interval: std::time::Duration::from_secs(30), // 30 seconds
        }
    }

    /// Get token decimals, fetching from DB if not cached
    pub async fn get_token_decimals(
        &mut self,
        token_id: u32,
        db_pool: &DbPool,
        prepared_statements: Option<&PreparedStatements>,
    ) -> Result<u8> {
        // Check if token is already cached
        if let Some(&decimals) = self.tokens_map.get(&token_id) {
            return Ok(decimals);
        }

        // Fetch single token from database
        self.fetch_single_token(token_id, db_pool, prepared_statements).await?;
        
        // Return the cached value (should exist now)
        self.tokens_map.get(&token_id)
            .copied()
            .ok_or_else(|| anyhow::anyhow!("Token {} not found after fetch", token_id))
    }

    /// Fetch a single token's decimals and add to cache
    async fn fetch_single_token(
        &mut self,
        token_id: u32,
        db_pool: &DbPool,
        prepared_statements: Option<&PreparedStatements>,
    ) -> Result<()> {
        let db_client = db_pool.get().await.context("Failed to get database connection")?;
        
        let row = if let Some(stmts) = prepared_statements {
            db_client.query_opt(
                stmts.get_token_decimals(),
                &[&(token_id as i32)]
            ).await.context("Failed to query token decimals with prepared statement")?
        } else {
            db_client.query_opt(
                "SELECT decimals FROM tokens WHERE token_id = $1",
                &[&(token_id as i32)]
            ).await.context("Failed to query token decimals")?
        };

        if let Some(row) = row {
            let decimals: i16 = row.get(0);
            self.tokens_map.insert(token_id, decimals as u8);
            println!("Cached token {} with {} decimals", token_id, decimals);
        } else {
            return Err(anyhow::anyhow!("Token {} not found in database", token_id));
        }

        Ok(())
    }

    /// Ensure token exists in cache, fetch if needed
    pub async fn ensure_token_cached(
        &mut self,
        token_id: u32,
        db_pool: &DbPool,
        prepared_statements: Option<&PreparedStatements>,
    ) -> Result<()> {
        if !self.tokens_map.contains_key(&token_id) {
            self.fetch_single_token(token_id, db_pool, prepared_statements).await?;
        }
        Ok(())
    }

    /// Check if a full reload is needed (based on time interval)
    pub fn should_full_reload(&self) -> bool {
        match self.last_full_reload {
            None => true, // Never loaded
            Some(last) => last.elapsed() > self.reload_interval,
        }
    }

    /// Perform full reload from database (fallback for initial load or periodic refresh)
    pub async fn full_reload(
        &mut self,
        db_pool: &DbPool,
        prepared_statements: Option<&PreparedStatements>,
    ) -> Result<()> {
        let db_client = db_pool.get().await.context("Failed to get database connection")?;
        
        let rows = if let Some(stmts) = prepared_statements {
            db_client.query(stmts.load_all_tokens(), &[]).await?
        } else {
            db_client.query("SELECT token_id, decimals FROM tokens", &[]).await?
        };

        self.tokens_map.clear();
        for row in rows {
            let token_id: i32 = row.get(0);
            let decimals: i16 = row.get(1);
            self.tokens_map.insert(token_id as u32, decimals as u8);
        }

        self.last_full_reload = Some(std::time::Instant::now());
        println!("Full token cache reload: {} tokens loaded", self.tokens_map.len());
        Ok(())
    }

    /// Add a new token to the cache (called when a new token is inserted)
    pub fn add_token(&mut self, token_id: u32, decimals: u8) {
        self.tokens_map.insert(token_id, decimals);
    }

    /// Get the number of cached tokens
    pub fn len(&self) -> usize {
        self.tokens_map.len()
    }

    /// Check if cache is empty
    pub fn is_empty(&self) -> bool {
        self.tokens_map.is_empty()
    }
}

/// Smart cache for pools that only fetches missing entries instead of full table scans
#[derive(Debug, Clone)]
pub struct PoolCache {
    pub pools_map: BTreeMap<u32, (u32, u32)>, // pool_id -> (token_id_0, token_id_1)
    last_full_reload: Option<std::time::Instant>,
    reload_interval: std::time::Duration,
}

impl PoolCache {
    pub fn new() -> Self {
        Self {
            pools_map: BTreeMap::new(),
            last_full_reload: None,
            reload_interval: std::time::Duration::from_secs(600), // 10 minutes
        }
    }

    /// Get pool token pair, fetching from DB if not cached
    pub async fn get_pool_tokens(
        &mut self,
        pool_id: u32,
        db_pool: &DbPool,
        prepared_statements: Option<&PreparedStatements>,
    ) -> Result<(u32, u32)> {
        // Check if pool is already cached
        if let Some(&tokens) = self.pools_map.get(&pool_id) {
            return Ok(tokens);
        }

        // Fetch single pool from database
        self.fetch_single_pool(pool_id, db_pool, prepared_statements).await?;
        
        // Return the cached value (should exist now)
        self.pools_map.get(&pool_id)
            .copied()
            .ok_or_else(|| anyhow::anyhow!("Pool {} not found after fetch", pool_id))
    }

    /// Fetch a single pool's token pair and add to cache
    async fn fetch_single_pool(
        &mut self,
        pool_id: u32,
        db_pool: &DbPool,
        prepared_statements: Option<&PreparedStatements>,
    ) -> Result<()> {
        let db_client = db_pool.get().await.context("Failed to get database connection")?;
        
        let row = if let Some(_stmts) = prepared_statements {
            // Use prepared statement if available
            db_client.query_opt(
                "SELECT token_id_0, token_id_1 FROM pools WHERE pool_id = $1",
                &[&(pool_id as i32)]
            ).await.context("Failed to query pool with prepared statement")?
        } else {
            db_client.query_opt(
                "SELECT token_id_0, token_id_1 FROM pools WHERE pool_id = $1",
                &[&(pool_id as i32)]
            ).await.context("Failed to query pool")?
        };

        if let Some(row) = row {
            let token_id_0: i32 = row.get(0);
            let token_id_1: i32 = row.get(1);
            self.pools_map.insert(pool_id, (token_id_0 as u32, token_id_1 as u32));
            println!("Cached pool {} with tokens ({}, {})", pool_id, token_id_0, token_id_1);
        } else {
            return Err(anyhow::anyhow!("Pool {} not found in database", pool_id));
        }

        Ok(())
    }

    /// Ensure pool exists in cache, fetch if needed
    pub async fn ensure_pool_cached(
        &mut self,
        pool_id: u32,
        db_pool: &DbPool,
        prepared_statements: Option<&PreparedStatements>,
    ) -> Result<()> {
        if !self.pools_map.contains_key(&pool_id) {
            self.fetch_single_pool(pool_id, db_pool, prepared_statements).await?;
        }
        Ok(())
    }

    /// Check if a full reload is needed (based on time interval)
    pub fn should_full_reload(&self) -> bool {
        match self.last_full_reload {
            None => true, // Never loaded
            Some(last) => last.elapsed() > self.reload_interval,
        }
    }

    /// Perform full reload from database (fallback for initial load or periodic refresh)
    pub async fn full_reload(
        &mut self,
        db_pool: &DbPool,
        prepared_statements: Option<&PreparedStatements>,
    ) -> Result<()> {
        let db_client = db_pool.get().await.context("Failed to get database connection")?;
        
        let rows = if let Some(stmts) = prepared_statements {
            db_client.query(stmts.load_all_pools(), &[]).await?
        } else {
            db_client.query("SELECT pool_id, token_id_0, token_id_1 FROM pools", &[]).await?
        };

        self.pools_map.clear();
        for row in rows {
            let pool_id: i32 = row.get(0);
            let token_id_0: i32 = row.get(1);
            let token_id_1: i32 = row.get(2);
            self.pools_map.insert(pool_id as u32, (token_id_0 as u32, token_id_1 as u32));
        }

        self.last_full_reload = Some(std::time::Instant::now());
        println!("Full pool cache reload: {} pools loaded", self.pools_map.len());
        Ok(())
    }

    /// Add a new pool to the cache (called when a new pool is inserted)
    pub fn add_pool(&mut self, pool_id: u32, token_id_0: u32, token_id_1: u32) {
        self.pools_map.insert(pool_id, (token_id_0, token_id_1));
    }

    /// Get the number of cached pools
    pub fn len(&self) -> usize {
        self.pools_map.len()
    }

    /// Check if cache is empty
    pub fn is_empty(&self) -> bool {
        self.pools_map.is_empty()
    }
}

/// Combined smart cache for both tokens and pools
#[derive(Debug, Clone)]
pub struct SmartCache {
    pub token_cache: TokenCache,
    pub pool_cache: PoolCache,
}

impl SmartCache {
    pub fn new() -> Self {
        Self {
            token_cache: TokenCache::new(),
            pool_cache: PoolCache::new(),
        }
    }

    /// Initialize cache with full load if empty or if periodic reload is needed
    pub async fn initialize_if_needed(
        &mut self,
        db_pool: &DbPool,
        prepared_statements: Option<&PreparedStatements>,
    ) -> Result<()> {
        // Only do full reload if we're completely empty (first run)
        // Otherwise rely on lazy loading for better performance
        if self.token_cache.is_empty() {
            println!("Performing initial token cache load...");
            self.token_cache.full_reload(db_pool, prepared_statements).await?;
        }

        if self.pool_cache.is_empty() {
            println!("Performing initial pool cache load...");
            self.pool_cache.full_reload(db_pool, prepared_statements).await?;
        }

        Ok(())
    }

    /// Convert to legacy BTreeMap format for compatibility
    pub fn to_legacy_maps(&self) -> (BTreeMap<u32, u8>, BTreeMap<u32, (u32, u32)>) {
        (self.token_cache.tokens_map.clone(), self.pool_cache.pools_map.clone())
    }
    
    /// Get references to the internal maps without cloning
    pub fn get_maps_ref(&self) -> (&BTreeMap<u32, u8>, &BTreeMap<u32, (u32, u32)>) {
        (&self.token_cache.tokens_map, &self.pool_cache.pools_map)
    }

    /// Update from legacy BTreeMap format
    pub fn from_legacy_maps(tokens_map: BTreeMap<u32, u8>, pools_map: BTreeMap<u32, (u32, u32)>) -> Self {
        let mut cache = Self::new();
        cache.token_cache.tokens_map = tokens_map;
        cache.pool_cache.pools_map = pools_map;
        cache.token_cache.last_full_reload = Some(std::time::Instant::now());
        cache.pool_cache.last_full_reload = Some(std::time::Instant::now());
        cache
    }
}

impl Default for TokenCache {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for PoolCache {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for SmartCache {
    fn default() -> Self {
        Self::new()
    }
}