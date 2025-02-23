# Token Mining Backend

A unique proof-of-work mining system for ICRC tokens that focuses on gamification and achievements rather than transaction validation.

## Overview

This token backend implements a novel approach to cryptocurrency mining:

- **ICRC Token Integration**: All actual token transactions are handled by the official ICRC ledger canister
- **Event-Based Mining**: Instead of validating transactions, miners solve blocks that contain various events:
  - Mining achievements and milestones
  - System announcements and updates
  - Difficulty adjustments
  - Reward halvings
  - Competition results

## Key Features

### Mining System
- SHA256-based proof-of-work mining
- Difficulty auto-adjustment based on block times
- Block reward halving system
- Merkle tree for event verification

### Achievement System
- Progressive mining milestones:
  - Bronze Miner (10 blocks)
  - Silver Miner (100 blocks)
  - Gold Miner (1000 blocks)
  - Diamond Miner (10000 blocks)
- Achievement events stored in blocks
- Permanent record of accomplishments 

### Event Types
1. **Mining Events**
   - Difficulty adjustments
   - Reward halvings
   - Mining milestones
   - Achievement unlocks

2. **Competition Events**
   - Leaderboard updates
   - Competition results
   - Special rewards

3. **System Events**
   - Version upgrades
   - Protocol changes
   - Important announcements

## Technical Details

### Block Structure
```rust
pub struct BlockTemplate {
    version: u32,
    height: u64,
    prev_hash: Hash,
    timestamp: u64,
    merkle_root: Hash,
    difficulty: u32,
    events: Vec<Event>,
    target: Hash,
    nonce: u64,
}
```

### Mining Parameters (DEFAULT)
- Initial difficulty: 16 leading zeros
- Block time target: 60 seconds
- Difficulty adjustment period: 2016 blocks
- Maximum difficulty: 48 leading zeros

## Integration with ICRC Ledger

This backend works alongside an ICRC ledger canister:
1. The ICRC ledger handles all token transfers and balances
2. Mining rewards are paid out via ICRC transfer calls
3. Token supply is controlled by the ICRC ledger but used by Token_Backend for mining rewards
4. This backend focuses on mining mechanics and gamification, and lets the ICRC ledger handle the token transfers and balances

### Configuration
Key parameters can be adjusted in the initialization besides the ICRC ledger parameters:
```rust
init_mining_params(
    initial_block_reward: u64,
    initial_difficulty: u32,
    block_time_target: u64,
    difficulty_adjustment_blocks: u64
)
```

## Architecture

```
token_backend/
├── src/
│   ├── block_templates.rs  # Block and event definitions
│   ├── mining.rs           # Mining logic and achievement tracking
│   ├── http.rs             # HTTP interface for frontend
│   ├── types.rs            # Shared type definitions
│   └── lib.rs              # Main canister logic
└── frontend/               # Web interface
```
