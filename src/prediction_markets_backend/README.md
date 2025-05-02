# Prediction Markets Backend

A decentralized prediction markets system built as a canister smart contract for the Internet Computer (IC).

## Code Review & Architecture

### System Overview

This canister implements a complete prediction markets platform where users can:

- Create markets with multiple possible outcomes
- Place bets on outcomes using KONG tokens
- Resolve markets through various methods (admin, oracle, or decentralized)
- Automatically distribute winnings to successful bettors

### Core Components

1. **Market Management**
   - Well-designed market data structure with flexible resolution methods
   - Support for different categories (Crypto, Sports, Politics, Memes, etc.)
   - User and admin market creation with validation
   - Market activation requiring minimum bet amount
   - Comprehensive market querying capabilities

2. **Betting System**
   - ICRC-2 token integration with KONG tokens
   - Secure bet recording in stable storage
   - Pool-based odds calculation
   - Automatic fee handling (configurable)

3. **Resolution & Payout**
   - Multiple resolution strategies (admin, oracle, decentralized)
   - Dual approval resolution system for user-created markets
   - Automatic winner determination and payout distribution
   - Market voiding capabilities for edge cases
   - Token burning mechanism for resolution disagreements

4. **State Management**
   - Robust persistence using IC's stable structures
   - CBOR serialization for efficient storage
   - Thread-local storage for stable BTree collections
   - Proper upgrade hooks for canister safety

5. **Security & Access Control**
   - Admin controls for sensitive operations
   - ICRC-21 consent message integration
   - ICRC-34 delegation support
   - Oracle-based verification

### Technical Implementation

- Built with Rust and the IC CDK
- Follows modern Rust patterns for safety and maintainability
- Uses Candid for interface definition
- Integrates with ICRC token standards

## Detailed Technical Specifications

### Core Data Structures

#### Market

```rust
pub struct Market {
    pub id: MarketId,
    pub creator: Principal,
    pub question: String,
    pub category: MarketCategory,
    pub rules: String,
    pub outcomes: Vec<String>,
    pub resolution_method: ResolutionMethod,
    pub image_url: Option<String>,
    pub status: MarketStatus,  // Now includes Pending and Active states
    pub created_at: Timestamp,
    pub end_time: Timestamp,
    pub total_pool: StorableNat,
    pub resolution_data: Option<String>,
    pub outcome_pools: Vec<StorableNat>,
    pub outcome_percentages: Vec<f64>,
    pub bet_counts: Vec<StorableNat>,
    pub bet_count_percentages: Vec<f64>,
    pub resolved_by: Option<Principal>,
    pub uses_time_weighting: bool,
    pub time_weight_alpha: Option<f64>,
    pub creator_resolution: Option<ResolutionProposal>, // For dual resolution system
}
```

#### Bet

```rust
pub struct Bet {
    pub user: Principal,
    pub market_id: MarketId,
    pub amount: StorableNat,
    pub outcome_index: StorableNat,
    pub timestamp: Timestamp,
}
```

#### Resolution Methods

```rust
pub enum ResolutionMethod {
    Admin,
    Oracle {
        oracle_principals: BTreeSet<Principal>,
        required_confirmations: candid::Nat,
    },
    Decentralized {
        quorum: candid::Nat,
    },
}

// New structure for dual resolution system
pub struct ResolutionProposal {
    pub outcome_index: StorableNat,
    pub resolution_data: Option<String>,
    pub timestamp: Timestamp,
}
```

### Stable Storage Implementation

The system uses IC's stable structures for persistent state management:

```rust
thread_local! {
    static MARKETS: RefCell<StableBTreeMap<MarketId, Market, Memory>> = /* ... */
    static BETS: RefCell<StableBTreeMap<MarketId, BetStore, Memory>> = /* ... */
    static BALANCES: RefCell<StableBTreeMap<Principal, u64, Memory>> = /* ... */
    static FEE_BALANCE: RefCell<StableBTreeMap<Principal, u64, Memory>> = /* ... */
    static ORACLES: RefCell<StableBTreeMap<Principal, bool, Memory>> = /* ... */
    static DELEGATIONS: RefCell<StableBTreeMap<Principal, DelegationVec, Memory>> = /* ... */
}
```

### Architectural Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                 Prediction Markets Canister                      │
├─────────────────┬─────────────────────────┬────────────────────┤
│  Market Module  │     Betting Module      │  Resolution Module │
│                 │                         │                    │
│ - Create Market │ - Place Bet            │ - Admin Resolution │
│ - Get Markets   │ - Get Market Bets      │ - Oracle Resolution│
│ - Market Status │ - Update Pools         │ - Market Voiding   │
│ - Categories    │ - Calculate Odds       │ - Distribute Wins  │
├─────────────────┴─────────────────────────┴────────────────────┤
│                      Persistent Storage                         │
│                                                                │
│  - Markets (StableBTreeMap)                                    │
│  - Bets (StableBTreeMap)                                       │
│  - Balances (StableBTreeMap)                                   │
│  - Delegations (StableBTreeMap)                                │
├────────────────────────────────┬───────────────────────────────┤
│     User & Admin Controls      │      External Integrations    │
│                                │                               │
│  - Admin Authorization         │  - KONG Token (ICRC-2)        │
│  - Delegation (ICRC-34)        │  - Consent Messages (ICRC-21) │
│  - Oracle Management           │  - Trusted Origins (ICRC-28)  │
└────────────────────────────────┴───────────────────────────────┘
```

### Key Technical Features

1. **Atomic Market ID Generation**

   ```rust
   pub static MARKET_ID: AtomicU64 = AtomicU64::new(0);
   ```

   Uses atomic operations for thread-safe ID generation.

2. **CBOR Serialization for Efficiency**

   ```rust
   impl Storable for Market {
       fn to_bytes(&self) -> Cow<[u8]> {
           let mut buf = vec![];
           ciborium::ser::into_writer(self, &mut buf).expect("Failed to serialize Market");
           Cow::Owned(buf)
       }
       // ...
   }
   ```

   Compact binary serialization format optimized for constrained environments.

3. **Token Integration via ICRC Standards**

   ```rust
   match ic_cdk::call::<(TransferFromArgs,), (Result<Nat, TransferFromError>,)>(
       kong_ledger, "icrc2_transfer_from", (args,)).await { /* ... */ }
   ```

   Leverages ICRC-2's transfer_from for token movement between accounts.

4. **Pooled Betting with Automatic Odds Calculation**

   ```rust
   market.outcome_percentages = market
       .outcome_pools
       .iter()
       .map(|pool| {
           if !market.total_pool.is_zero() {
               (pool.to_u64() as f64) / (market.total_pool.to_u64() as f64)
           } else { 0.0 }
       })
       .collect();
   ```

   Dynamically recalculates odds based on bet distribution.

5. **Upgrade Safety with Pre/Post Hooks**

   ```rust
   #[pre_upgrade]
   fn pre_upgrade() { /* state preservation logic */ }
   
   #[post_upgrade]
   fn post_upgrade() { /* state restoration logic */ }
   ```

   Ensures state persistence during canister upgrades.

## Time-Weighted Prediction Markets

The system implements an **Exponential Weighting with Return Floor** model to incentivize early participation in prediction markets while ensuring fair reward distribution.

### Core Concept

The time-weighted prediction markets feature introduces a mechanism where earlier bets receive higher rewards than later bets (for the same outcome), encouraging users to participate early and share their predictions when they have valuable information.

### Mathematical Model

#### Exponential Weighting Function

The weight of a bet is calculated using an exponential decay function:

```math
w(t) = α^(t/T)
```

Where:

- **t**: Time elapsed since market creation (when bet was placed)
- **T**: Total market duration
- **α**: Parameter controlling decay rate (default: 0.1)

This means:

- At market creation (t=0), weight = 1.0 (maximum)
- At market end (t=T), weight = α (minimum)

#### Return Floor Guarantee

All correct predictors receive at least their original contribution back, plus a share of the bonus pool based on their weighted contribution:

```math
reward_i = a_i + (c_i/C) * (P - W)
```

Where:

- **a_i**: Original bet amount
- **c_i**: Weighted contribution (bet amount * weight)
- **C**: Total weighted contributions
- **P**: Total market pool
- **W**: Total winning pool (sum of all winning bets)

### Key Components

#### 1. Enhanced Market Structure

```rust
pub struct Market {
    // ... existing fields
    pub uses_time_weighting: bool,       // Whether this market uses time-weighted rewards
    pub time_weight_alpha: Option<f64>,  // Alpha parameter for exponential decay (default: 0.1)
}
```

#### 2. Reward Estimation

Users can estimate their potential returns before placing bets:

```rust
pub struct EstimatedReturn {
    pub market_id: MarketId,
    pub outcome_index: StorableNat,
    pub bet_amount: StorableNat,
    pub current_market_pool: StorableNat,
    pub current_outcome_pool: StorableNat,
    pub scenarios: Vec<EstimatedReturnScenario>,
    pub uses_time_weighting: bool,
    pub time_weight_alpha: Option<f64>,
    pub current_time: Timestamp,
}
```

#### 3. Transaction Records

Detailed payout information is recorded for transparency:

```rust
pub struct BetPayoutRecord {
    pub market_id: MarketId,
    pub user: Principal,
    pub bet_amount: StorableNat,
    pub payout_amount: StorableNat,
    pub timestamp: Timestamp,
    pub outcome_index: StorableNat,
    pub was_time_weighted: bool,
    pub time_weight: Option<f64>,
    pub original_contribution_returned: StorableNat,
    pub bonus_amount: Option<StorableNat>,
}
```

#### 4. Activity Metrics

Market activity is tracked over time to analyze participation patterns:

```rust
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
```

### API Endpoints

#### Creating Time-Weighted Markets

```candid
create_market : (
    text,                  // question
    MarketCategory,        // category
    text,                  // rules
    vec text,              // outcomes
    ResolutionMethod,      // resolution_method
    MarketEndTime,         // end_time
    opt text,              // image_url
    opt bool,              // uses_time_weighting
    opt float64,           // time_weight_alpha
) -> (Result);
```

#### Estimating Returns

```candid
estimate_bet_return : (nat64, nat64, nat64, nat64) -> (EstimatedReturn) query;
```

Parameters: market_id, outcome_index, bet_amount, current_time

#### Time Weight Visualization

```candid
generate_time_weight_curve : (nat64, nat64) -> (vec TimeWeightPoint) query;
```

Parameters: market_id, number_of_points

```candid
simulate_future_weight : (nat64, nat64, nat64) -> (float64) query;
```

Parameters: market_id, bet_time, future_time

#### Payout Records

```candid
get_market_payout_records : (nat64) -> (vec BetPayoutRecord) query;
```

Parameters: market_id

### Benefits

1. **Early Participation Incentives**: Rewards users who contribute information early
2. **Guaranteed Returns**: Ensures all correct predictors receive at least their original bet back
3. **Transparent Reward Calculation**: Provides clear formulas and estimation tools
4. **Configurable Parameters**: Allows market creators to adjust the alpha parameter
5. **Backward Compatibility**: Works alongside traditional markets without disruption

## User Market Creation & Dual Resolution

The system now supports user-created markets with a dual resolution mechanism to ensure fairness and prevent manipulation.

### Core Concept

Users can create their own prediction markets, but these markets require:

1. An initial activation bet (minimum 3000 KONG) from the creator
2. Admin approval for final resolution

### Market Lifecycle

1. **Creation**: User creates a market which starts in `Pending` status
2. **Activation**: Creator must place an activation bet (≥ 3000 KONG) to change status to `Active`
3. **Betting**: Other users can place bets only on `Active` markets
4. **Resolution**: When the market ends, both creator and admin propose resolutions

### Dual Resolution Process

#### Agreement Scenario

If the creator and admin agree on the outcome:
- Market is resolved to that outcome
- Winnings are distributed normally
- Creator receives their activation bet back plus any winnings

#### Disagreement Scenario

If the creator and admin disagree on the outcome:
- Market is voided for all regular bettors (they receive refunds)
- Creator's activation bet (3000 KONG) is burned as a penalty
- Tokens are sent to the KONG minter address, effectively removing them from circulation

### Token Burning Mechanism

```rust
pub async fn burn_tokens(amount: TokenAmount) -> Result<(), String> {
    // Select the appropriate minter principal based on environment
    let minter_address = if KONG_LEDGER_ID == "o7oak-iyaaa-aaaaq-aadzq-cai" {
        // Production environment
        KONG_MINTER_PRINCIPAL_PROD
    } else {
        // Local or test environment
        KONG_MINTER_PRINCIPAL_LOCAL
    };
    
    // Transfer tokens to the minter address (burning them)
    transfer_kong(amount, minter_address).await
}
```

### API Endpoints

```candid
// User market creation (same as admin but restricted to Admin resolution method)
create_market : (
    text,                  // question
    MarketCategory,        // category
    text,                  // rules
    vec text,              // outcomes
    ResolutionMethod,      // resolution_method (must be Admin for user markets)
    MarketEndTime,         // end_time
    opt text,              // image_url
    opt bool,              // uses_time_weighting
    opt float64,           // time_weight_alpha
) -> (Result);

// Creator resolution proposal
propose_resolution : (nat64, nat64, opt text) -> (Result);

// Admin final resolution
resolve_market : (nat64, nat64, opt text) -> (Result);
```

### Benefits

1. **Decentralized Market Creation**: Any user can create markets
2. **Quality Control**: Activation bet requirement ensures creator commitment
3. **Dispute Resolution**: Dual approval system prevents manipulation
4. **Economic Incentives**: Burning mechanism discourages bad behavior


## Running the project locally

If you want to test your project locally, you can use the following commands:

```bash
# Starts the replica, running in the background
dfx start --background --pocketic

# Deploys your canisters to the replica and generates your candid interface
dfx deploy prediction_markets_backend
```

### Testing Scripts

The project includes various test scripts to validate functionality:

```bash
# Test user market creation and activation
./scripts/prediction_markets/user_mkts/01_test_market_creation.sh

# Test dual resolution system
./scripts/prediction_markets/user_mkts/02_test_dual_resolution.sh

# Test bet return estimation
./scripts/prediction_markets/user_mkts/03_test_estimate_bet_return.sh

# Test market payout records
./scripts/prediction_markets/user_mkts/04_test_payout_records.sh

# Test market creation method restrictions
./scripts/prediction_markets/user_mkts/05_test_market_creation_restrictions.sh

# Test time-weighted markets
./scripts/prediction_markets/01_test_time_weighting.sh
```
#deploy the kskong_ledger canister
```bash
dfx deploy kskong_ledger
```

#mint tokens for the selected profiles (change the principals in the mint_kong.sh script to send to your identities)  
```bash
./scripts/mint_kong.sh
```

#end to end testing of the markets run
```bash
./e2e_testing.sh
```

#run a test tournament

this will in itiate the tournament, create the markets and place the bets, for each market.
```bash
./01_madness_tournament_testing.sh
```
after the creation and placing bets is verified, run the resolution of the markets, to determine the winner of each pair and manage the payouts.
```bash
./02_resolve_markets.sh
```

check if the market resolution is correct and the balances of the selected profiles match the expected results
```bash
./scripts/get_balance.sh
```