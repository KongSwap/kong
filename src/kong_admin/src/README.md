# Kong Admin Source Organization

## Directory Structure

- **canister/**: Internet Computer blockchain communication
  - `agent.rs`: Identity and agent management
  - `kong_data.rs`: Read-only canister interface
  - `kong_backend.rs`: Read-write canister interface
  
- **database/**: PostgreSQL database layer
  - `pool.rs`: Connection pool management
  - `state.rs`: Application state persistence
  - `prepared.rs`: SQL prepared statements
  - `cache.rs`: In-memory caching
  
- **sync/**: Data synchronization logic
  - `updates.rs`: Main synchronization engine
  - `adapters.rs`: Database adapter patterns
  
- **domain/**: Business entities and logic
  - Each file represents a domain entity (users, tokens, etc.)
  
- **utils/**: Shared utilities
  - `math.rs`: Mathematical helper functions
  - `nat.rs`: NAT type conversions