# Prediction Markets Backend

A decentralized prediction markets system built as a canister smart contract for the Internet Computer (IC) with multi-token support, time-weighted payouts, and a dual approval resolution system.

## Code Review & Architecture

### System Overview

This canister implements a complete prediction markets platform where users can:
- Create markets with multiple possible outcomes
- Place bets on specific market outcomes using KONG tokens
- Resolve markets through various methods (admin, oracle, or decentralized)
- Automatically distribute winnings to successful bettors

### Core Components

1. **Market Management**
   - Well-designed market data structure with flexible resolution methods
   - Support for different categories (Crypto, Sports, Politics, Memes, etc.)
   - User and admin market creation with validation
   - Market activation requiring minimum bet amount
   - Featured markets functionality for highlighting important markets in the UI
   - Admin controls for managing featured market status
   - Smart sorting to prioritize featured markets in listings
   - Comprehensive market querying capabilities

2. **Betting System**
   - Multi-token support with ICRC-1 token integration (KONG, ICP, ckUSDT, ckUSDC, ckBTC, DKP, GLDT)
   - Token-specific activation fees for user-created markets
   - Secure bet recording in stable storage with token information
   - Pool-based odds calculation
   - Time-weighted betting that rewards early participants
   - Automatic fee handling with token-specific fee percentages
   - Configurable platform fee per token type (1-5% depending on token)

3. **Resolution & Payout**
   - Multiple resolution strategies (admin, oracle, decentralized)
   - Dual approval resolution system with distinct flows for admin-created vs user-created markets
   - Time-weighted payout distribution algorithm for fairer rewards
   - Automatic winner determination and payout distribution in the market's native token
   - Token-specific platform fees collected from winning pools and sent to minter
   - Market voiding capabilities with refunds in the original token
   - Token burning mechanism for resolution disagreements using the market's token

4. **State Management**
   - Robust persistence using IC's stable structures
   - Thread-local storage for stable BTree collections
   - Type-safe storage abstraction layer
   - Claims-based payout management
   - Proper upgrade hooks for canister safety

5. **Security & Access Control**
   - Admin controls for sensitive operations
   - ICRC-21 consent message integration
   - ICRC-34 delegation support with principal-based verification
   - Oracle-based verification

### Technical Implementation

- Built with Rust and the IC CDK
- Follows modern Rust patterns for safety and maintainability
- Uses Candid for interface definition
- Integrates with ICRC token standards

### Multi-Token and Fee System

#### Supported Tokens

- KONG: Native platform token (1% fee)
- ICP: Internet Computer Protocol token (2% fee)
- ckUSDT: Chain key USD Tether token (2% fee)
- ckUSDC: Chain key USD Coin token (2% fee)
- ckBTC: Chain key Bitcoin token (2% fee)
- DKP: Dragginz Kingdom Points token (2% fee)
- GLDT: Gold token (2% fee)

#### Token-Specific Activation Fees

User-created markets require a minimum activation fee based on the token:
- KONG: 3000 KONG
- ICP: 25 ICP
- ckUSDT: 100 ckUSDT
- ckUSDC: 100 ckUSDC
- ckBTC: 0.001 ckBTC
- DKP: 70000 DKP
- GLDT: 100 GLDT

#### Platform Fee System

- Token-specific platform fees (1-2%) applied to all winning pools
  - KONG: 1% platform fee
  - All other tokens: 2% platform fee
- Fee is automatically calculated and deducted during market finalization
- Fee tokens are sent to the minter account for collection
- Remaining percentage of winnings is distributed to users who made correct predictions
- Fee is transparently displayed in estimated returns
- Fee percentages can be updated via admin interfaces

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
    pub status: MarketStatus,
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
    pub creator_resolution: Option<ResolutionProposal>,
    pub token_id: TokenIdentifier, // Token used for this market's bets
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
    // Markets indexed by MarketId
    static STABLE_MARKETS: RefCell<StableBTreeMap<MarketId, Market, Memory>> = /* ... */
    
    // Bets indexed by composite key (MarketId, BetId)
    static STABLE_BETS: RefCell<StableBTreeMap<(MarketId, u64), Bet, Memory>> = /* ... */
    
    // Resolution proposals indexed by MarketId
    static STABLE_RESOLUTION_PROPOSALS: RefCell<StableBTreeMap<MarketId, ResolutionProposal, Memory>> = /* ... */
    
    // Delegations indexed by Principal (delegator)
    static STABLE_DELEGATIONS: RefCell<StableBTreeMap<Principal, Delegation, Memory>> = /* ... */
    
    // Oracle whitelist
    static STABLE_ORACLE_WHITELIST: RefCell<StableBTreeMap<Principal, bool, Memory>> = /* ... */
    
    // User token balances
    static BALANCES: RefCell<StableBTreeMap<Principal, u64, Memory>> = /* ... */
    
    // Platform fee collection
    static FEE_BALANCE: RefCell<StableBTreeMap<Principal, u64, Memory>> = /* ... */
}
```

### Architectural Overview

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                      Prediction Markets Canister                          │
├─────────────────┬──────────────────────────┬───────────────────────────────┤
│  Market Module  │      Betting Module      │      Resolution Module        │
│                 │                          │                               │
│ - Create Market │ - Place Bet             │ - Admin Resolution            │
│ - Get Markets   │ - Get Market Bets       │ - User-created Resolution     │
│ - Market Status │ - Update Pools          │ - Market Voiding              │
│ - Categories    │ - Time-weighted Returns │ - Time-weighted Distribution  │
├─────────────────┼──────────────────────────┼───────────────────────────────┤
│  Claims Module  │      Token Module       │       User Module             │
│                 │                          │                               │
│ - Create Claims │ - Multi-token Support   │ - User History                │
│ - Process Claims│ - Token Transfer        │ - ICRC Delegation             │
│ - Track Claims  │ - Fee Management        │ - User Preferences            │
├─────────────────┴──────────────────────────┴───────────────────────────────┤
│                         Persistent Storage                                │
│                                                                          │
│  - Markets (StableBTreeMap)          - Resolution Proposals              │
│  - Bets (StableBTreeMap)             - Claims                            │
│  - Delegations (StableBTreeMap)      - Market Payouts                    │
├──────────────────────────────────┬───────────────────────────────────────┤
│     User & Admin Controls        │      External Integrations            │
│                                  │                                       │
│  - Admin Authorization           │  - KONG Token (ICRC-1)                │
│  - Principal-based Delegation    │  - ICP & other tokens (ICRC-1)        │
│  - Oracle Management             │  - Consent Messages (ICRC-21)         │
│  - Dual Approval Resolution      │  - Trusted Origins (ICRC-28)          │
└──────────────────────────────────┴───────────────────────────────────────┘
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

### Core Concept

The time-weighted prediction markets feature introduces a mechanism where earlier bets receive higher rewards than later bets (for the same outcome), encouraging users to participate early and share their predictions when they have valuable information. This system rewards users who contribute early insights while still ensuring all correct predictors receive at least their original bet amount back.

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

#### Featured Markets Management

```candid
set_market_featured : (nat, bool) -> (variant { Ok; Err : text });
```

Parameters: market_id, featured_status

Admin-only function to set or unset the featured status of a market.

```candid
get_featured_markets : (GetFeaturedMarketsArgs) -> (GetFeaturedMarketsResult) query;
```

Parameters:

```candid
type GetFeaturedMarketsArgs = record {
  start : nat;
  length : nat;
};
```

Returns:

```candid
type GetFeaturedMarketsResult = record {
  markets : vec Market;
  total : nat;
};
```

Query function to retrieve paginated featured markets.

### Benefits

1. **Early Participation Incentives**: Rewards users who contribute information early
2. **Guaranteed Returns**: Ensures all correct predictors receive at least their original bet back
3. **Transparent Reward Calculation**: Provides clear formulas and estimation tools
4. **Configurable Parameters**: Allows market creators to adjust the alpha parameter
5. **Backward Compatibility**: Works alongside traditional markets without disruption

## User Market Creation & Dual Resolution

The system now supports user-created markets with a dual resolution mechanism to ensure fairness and prevent manipulation.

### User Market Concept

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

### Resolution API Endpoints

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

### Key Benefits

1. **Decentralized Market Creation**: Any user can create markets
2. **Quality Control**: Activation bet requirement ensures creator commitment
3. **Dispute Resolution**: Dual approval system prevents manipulation
4. **Economic Incentives**: Burning mechanism discourages bad behavior

## System Architecture

The Kong Swap prediction markets backend follows a modular architecture organized around key domain concepts:

### Core Components

1. **Market Module** - Manages market lifecycle and data
   - Market creation and configuration
   - Status tracking and transitions
   - Query capabilities for UI integration
   - Featured markets management

2. **Bet Module** - Handles bet placement and recording
   - Multi-token bet processing
   - Time-weighted bet recording
   - Market activation logic
   - Fee calculation and collection

3. **Resolution Module** - Implements market resolution flows
   - Dual approval for user-created markets
   - Direct resolution for admin-created markets
   - Dispute handling and market voiding
   - Payout calculation and distribution

4. **Token Module** - Provides token operations and accounting
   - ICRC-1/2 token standard integration
   - Transfer operations with error handling
   - Token registry with configurable parameters
   - Balance reconciliation and verification

5. **Claims Module** - Manages user payouts
   - Claims record creation and processing
   - On-demand claim retrieval
   - Failed transaction recovery

### State Management

The system uses Internet Computer's stable structures pattern for persistent storage:

```rust
thread_local! {
    // Markets storage (Market ID -> Market)
    pub static MARKETS: RefCell<StableBTreeMap<MarketId, Market>> = 
        RefCell::new(StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MARKETS_MEMORY_ID))));    
    
    // Bets storage (BetKey -> Bet)
    pub static BETS: RefCell<StableBTreeMap<BetKey, Bet>> = 
        RefCell::new(StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(BETS_MEMORY_ID))));
}
```

### Resolution Flows

The system implements two distinct resolution paths:

1. **Admin-Created Markets**:
   - Direct resolution by any admin
   - Single-step process with immediate finalization

2. **User-Created Markets**:
   - Requires dual approval (creator + admin)
   - Two-step process with proposal and confirmation
   - Dispute handling if creator and admin disagree

## Recent Implementations

### Token Balance Reconciliation System

We've implemented a comprehensive token balance reconciliation system that compares expected token balances with actual balances in the canister accounts. This provides administrators with real-time insights into token allocation and detects any discrepancies.

```candid
// Calculate token balance reconciliation for all supported tokens
calculate_token_balance_reconciliation : () -> (BalanceReconciliationSummary);

// Get the most recent balance reconciliation without recalculating
get_latest_token_balance_reconciliation : () -> (opt BalanceReconciliationSummary) query;
```

#### Token Reconciliation Features

- **Comprehensive Breakdown**: Detailed allocation of tokens (active markets, pending claims, etc.)
- **Multi-Token Support**: Works with all supported tokens in the system
- **Large Value Handling**: Correctly handles large token amounts exceeding the u64 range
- **Admin-Only Access**: Secured access to sensitive financial data
- **CLI Tool**: Dedicated `token_balance_check.sh` script for administrative oversight

### Time-Weighted Distribution Enhancements

We've enhanced the time-weighted betting feature that rewards early participants with higher payouts. The implementation uses an exponential weighting model that ensures:

- Early bettors receive higher rewards based on how early they placed their bet
- All winning bettors receive at least their original bet amount back
- Configurable alpha parameter controls the steepness of the reward curve

```candid
// Time-weighted reward structures
type TimeWeightPoint = record {
  bet_id : nat64;
  weight : float64;
  original_amount : nat;
};

type BetPayoutRecord = record {
  bet_id : nat64;
  payout_amount : nat;
  original_amount : nat;
  weight : float64;
};
```

### Multi-Token Payout Improvements

Fixed critical issues in the token transfer mechanism to ensure reliable payouts across all supported tokens:

- Improved error handling in token transfers
- Properly nested Result pattern matching for ICRC-1 token responses
- Enhanced payout processing to continue even if individual transfers fail
- More robust transaction recovery for failed payouts

## Testing and Development

### Running the Project Locally

To test the project locally:

```bash
# Start the replica in the background
dfx start --background --pocketic

# Deploy the prediction markets canister
dfx deploy prediction_markets_backend

# Deploy a token ledger for testing
dfx deploy kong_ledger

# Mint tokens for test identities
./scripts/prediction_markets/mint_kong.sh

# Run various test scenarios
./scripts/prediction_markets/01_user_mkt_test.sh
./scripts/prediction_markets/03_no_winner.sh
./scripts/prediction_markets/04_dispute_resolution.sh

# Check token balance reconciliation
./scripts/prediction_markets/token_balance_check.sh --refresh
```

### Testing Strategy

The prediction markets system uses a multi-layered testing approach:

1. **Unit Tests**
   - Focused on core business logic functions
   - Located alongside implementation files
   - Run with `cargo test`

2. **Integration Scripts**
   - End-to-end testing of market flows
   - Located in `/scripts/prediction_markets/`
   - Test specific scenarios like market creation, dispute resolution, etc.

3. **Testing Instances**
   - Local: Run with dfx for rapid iteration
   - Dev: Deployed to the IC test subnet for environment testing
   - Prod: Staging environment for final verification

### Key Test Scenarios

1. **Market Lifecycle Tests**
   - Create market → Place bets → Resolve → Claim winnings
   - Tests both admin and user-created markets

2. **Token Handling Tests**
   - Multi-token bet placement and payouts
   - Balance reconciliation verification

3. **Resolution Flow Tests**
   - Admin direct resolution
   - User-admin dual approval resolution
   - Dispute handling and market voiding

## Future Development

Planned improvements and extensions to the prediction markets system:

1. **Enhanced Market Types**
   - Scalar markets with continuous outcome ranges
   - Conditional markets linked to external events
   - Tournament-style markets with brackets

2. **Governance Integration**
   - Token-based voting for disputed markets
   - Community-driven market curation

3. **Performance Optimizations**
   - Canister cycles optimization
   - Pagination for large market datasets
   - On-demand data loading patterns

4. **Advanced Analytics**
   - Market activity dashboards
   - User performance tracking
   - System health monitoring

5. **Security Enhancements**
   - Additional audit trail mechanisms
   - Advanced fraud detection systems
   - Circuit breakers for extreme market conditions
