# Test Jobs

Test scenarios for Solana outgoing transfers. Each file is one scenario.

## Scenarios

| File | What it tests |
|------|---------------|
| `happy_path.rs` | Creates 10 valid SOL transfers (0.001 SOL each). Jobs go Pending → Confirmed. |

## Usage

```bash
# destination_address: Solana address (base58)
dfx canister call kong_backend spawn_test_jobs_happy_path '("DESTINATION_ADDRESS")'
```

Returns a vec of 10 job_ids so you can poll for status changes.


