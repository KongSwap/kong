use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::nat::*;

/// Time segment for tracking market activity
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Hash)]
pub enum TimeSegment {
    Hour(u64),    // Hour of the day (0-23)
    Day(u64),     // Day of the month (1-31)
    Week(u64),    // Week of the year (1-53)
    Month(u64),   // Month of the year (1-12)
    Quarter(u64), // Quarter of the year (1-4)
}

/// Activity metrics for a specific time segment
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SegmentActivity {
    pub segment: TimeSegment,
    pub bet_count: usize,
    pub total_volume: StorableNat,
    pub unique_users: usize,
    pub start_timestamp: Timestamp,
    pub end_timestamp: Timestamp,
}

impl SegmentActivity {
    pub fn new(segment: TimeSegment, start: u64, end: u64) -> Self {
        Self {
            segment,
            bet_count: 0,
            total_volume: StorableNat::from(0u64),
            unique_users: 0,
            start_timestamp: Timestamp::from(start),
            end_timestamp: Timestamp::from(end),
        }
    }
}

/// Market activity metrics tracked over time
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MarketActivityMetrics {
    pub market_id: MarketId,
    pub total_bets: usize,
    pub total_volume: StorableNat,
    pub unique_users: usize,
    pub hourly_activity: HashMap<u64, SegmentActivity>,
    pub daily_activity: HashMap<u64, SegmentActivity>,
    pub weekly_activity: HashMap<u64, SegmentActivity>,
    pub monthly_activity: HashMap<u64, SegmentActivity>,
}

impl MarketActivityMetrics {
    pub fn new(market_id: MarketId) -> Self {
        Self {
            market_id,
            total_bets: 0,
            total_volume: StorableNat::from(0u64),
            unique_users: 0,
            hourly_activity: HashMap::new(),
            daily_activity: HashMap::new(),
            weekly_activity: HashMap::new(),
            monthly_activity: HashMap::new(),
        }
    }

    /// Record a new bet in the activity metrics
    pub fn record_bet(&mut self, _user: Principal, amount: StorableNat, timestamp: u64) {
        // Update overall metrics
        self.total_bets += 1;
        self.total_volume = self.total_volume.clone() + amount.clone();
        
        // Extract time components
        let hour = timestamp / 3600;
        let day = timestamp / 86400;
        let week = timestamp / 604800;
        let month = timestamp / 2592000; // Approximate month (30 days)
        
        // Process hourly activity
        let hour_key = hour % 24;
        let hour_segment = TimeSegment::Hour(hour_key);
        let hour_start = hour * 3600;
        let hour_end = (hour + 1) * 3600;
        let hour_entry = self.hourly_activity.entry(hour_key).or_insert_with(|| {
            SegmentActivity::new(hour_segment, hour_start, hour_end)
        });
        hour_entry.bet_count += 1;
        hour_entry.total_volume = hour_entry.total_volume.clone() + amount.clone();
        hour_entry.unique_users += 1; // Simplified, in a real implementation we'd track unique users
        
        // Process daily activity
        let day_key = day % 31 + 1;
        let day_segment = TimeSegment::Day(day_key);
        let day_start = day * 86400;
        let day_end = (day + 1) * 86400;
        let day_entry = self.daily_activity.entry(day_key).or_insert_with(|| {
            SegmentActivity::new(day_segment, day_start, day_end)
        });
        day_entry.bet_count += 1;
        day_entry.total_volume = day_entry.total_volume.clone() + amount.clone();
        day_entry.unique_users += 1;
        
        // Process weekly activity
        let week_key = week % 53 + 1;
        let week_segment = TimeSegment::Week(week_key);
        let week_start = week * 604800;
        let week_end = (week + 1) * 604800;
        let week_entry = self.weekly_activity.entry(week_key).or_insert_with(|| {
            SegmentActivity::new(week_segment, week_start, week_end)
        });
        week_entry.bet_count += 1;
        week_entry.total_volume = week_entry.total_volume.clone() + amount.clone();
        week_entry.unique_users += 1;
        
        // Process monthly activity
        let month_key = month % 12 + 1;
        let month_segment = TimeSegment::Month(month_key);
        let month_start = month * 2592000;
        let month_end = (month + 1) * 2592000;
        let month_entry = self.monthly_activity.entry(month_key).or_insert_with(|| {
            SegmentActivity::new(month_segment, month_start, month_end)
        });
        month_entry.bet_count += 1;
        month_entry.total_volume = month_entry.total_volume.clone() + amount;
        month_entry.unique_users += 1;
    }
    
    // This method is no longer needed as we've inlined the logic in record_bet
}
