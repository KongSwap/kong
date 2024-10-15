# Kong Swap rust SDK

to compile: cargo build

to run: cargo run [OPTIONS]

Options:
  --staging  - using Kong Swap's staging environment with test tokens
  --prod     - using Kong Swap's producation environment with real tokens
  [empty]    - using Kong Swap's local environment with IC replica running locally


Directory structure:

main.rs  - main project that runs a bot on doing swap. Demostrates how to call swap(), swap_async(), add_liquidity() and remove_liquidity()
swap.rs  - swap() helper functions
add_liquditiy.rs - add_liquidity() helper functions
remove_liquidity.rs - remove_liquidity() helper functions
agent.rs - agent-rs for IC to create random user identity
kong_backend - interface library to interact with the kong swap canister
kong_faucet - interface library to interact with the testnet faucet

main.rs has a lot of config and commented out commands to plan around with
