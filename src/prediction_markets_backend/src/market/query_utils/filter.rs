//! # Market Filtering Utilities
//! 
//! This module provides a flexible and reusable market filtering system
//! that centralizes filter logic across various market query functions.

use candid::Principal;
use std::ops::Range;

use crate::market::market::{Market, MarketStatus};
use crate::category::market_category::MarketCategory;
use crate::types::{MarketId, TokenIdentifier};

/// A builder-pattern structure for filtering markets by various criteria
#[derive(Default, Clone)]
pub struct MarketFilter {
    /// Filter by market status (e.g., Active, Pending, Closed)
    pub statuses: Option<Vec<MarketStatus>>,
    
    /// Filter by the creator's principal ID
    pub creator: Option<Principal>,
    
    /// Filter by market category
    pub category: Option<MarketCategory>,
    
    /// Filter by market end time range (inclusive)
    pub end_time_range: Option<Range<u64>>,
    
    /// Filter by market creation time range (inclusive)
    pub creation_time_range: Option<Range<u64>>,
    
    /// Filter by token identifier
    pub token_id: Option<TokenIdentifier>,
    
    /// Filter by text search in market question
    pub text_search: Option<String>,
    
    /// Filter to show only markets that are expired but unresolved
    pub only_expired_unresolved: Option<bool>,
}

impl MarketFilter {
    /// Create a new empty filter that would match all markets
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Filter markets by one or more status values
    pub fn with_statuses(mut self, statuses: Vec<MarketStatus>) -> Self {
        self.statuses = Some(statuses);
        self
    }
    
    /// Filter markets by a specific creator
    pub fn with_creator(mut self, creator: Principal) -> Self {
        self.creator = Some(creator);
        self
    }
    
    /// Filter markets by category
    pub fn with_category(mut self, category: MarketCategory) -> Self {
        self.category = Some(category);
        self
    }
    
    /// Filter markets by a range of end times
    pub fn with_end_time_range(mut self, start: u64, end: u64) -> Self {
        self.end_time_range = Some(start..end);
        self
    }
    
    /// Filter markets by a range of creation times
    pub fn with_creation_time_range(mut self, start: u64, end: u64) -> Self {
        self.creation_time_range = Some(start..end);
        self
    }
    
    /// Filter markets by token identifier
    pub fn with_token_id(mut self, token_id: TokenIdentifier) -> Self {
        self.token_id = Some(token_id);
        self
    }
    
    /// Filter markets by text search in the question field
    pub fn with_text_search(mut self, query: String) -> Self {
        self.text_search = Some(query);
        self
    }
    
    /// Filter to show only markets that are expired but not yet resolved
    pub fn only_expired_unresolved(mut self, value: bool) -> Self {
        self.only_expired_unresolved = Some(value);
        self
    }
    
    /// Apply the filter to a collection of markets
    pub fn apply(&self, markets: Vec<(MarketId, Market)>) -> Vec<(MarketId, Market)> {
        let now = ic_cdk::api::time();
        
        markets
            .into_iter()
            .filter(|(_, market)| self.matches_market(market, now))
            .collect()
    }
    
    /// Check if a market matches all the filter criteria
    fn matches_market(&self, market: &Market, current_time: u64) -> bool {
        // Status filter
        if let Some(ref statuses) = self.statuses {
            let status_matches = statuses.iter().any(|s| {
                match (s, &market.status) {
                    // For active status, consider both Active and Pending
                    (MarketStatus::Active, MarketStatus::Active) => true,
                    (MarketStatus::Active, MarketStatus::Pending) => true,
                    
                    // For closed status, only match Closed with any outcomes
                    (MarketStatus::Closed(_), MarketStatus::Closed(_)) => true,
                    
                    // For any other status, compare directly
                    _ => std::mem::discriminant(s) == std::mem::discriminant(&market.status),
                }
            });
            if !status_matches {
                return false;
            }
        }
        
        // Expired but unresolved filter (special case)
        if let Some(true) = self.only_expired_unresolved {
            match market.status {
                MarketStatus::Active | MarketStatus::Pending => {
                    // Only include if end time has passed
                    if current_time < market.end_time.to_u64() {
                        return false;
                    }
                },
                MarketStatus::Disputed => {
                    // Disputed markets are considered unresolved
                    // Include them in expired_unresolved
                },
                _ => {
                    // Other statuses are not expired_unresolved
                    return false;
                }
            }
        }
        
        // Creator filter
        if let Some(creator) = self.creator {
            if market.creator != creator {
                return false;
            }
        }
        
        // Category filter
        if let Some(ref category) = self.category {
            if &market.category != category {
                return false;
            }
        }
        
        // End time range filter
        if let Some(ref range) = self.end_time_range {
            let end_time = market.end_time.to_u64();
            if !range.contains(&end_time) {
                return false;
            }
        }
        
        // Creation time range filter
        if let Some(ref range) = self.creation_time_range {
            let created_at = market.created_at.to_u64();
            if !range.contains(&created_at) {
                return false;
            }
        }
        
        // Token ID filter
        if let Some(ref token_id) = self.token_id {
            if &market.token_id != token_id {
                return false;
            }
        }
        
        // Text search filter
        if let Some(ref query) = self.text_search {
            let query_lower = query.to_lowercase();
            let question_lower = market.question.to_lowercase();
            
            if !question_lower.contains(&query_lower) {
                return false;
            }
        }
        
        // All filters passed
        true
    }
}
