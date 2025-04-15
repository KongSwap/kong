# `prediction_markets`
```

## Running the project locally

If you want to test your project locally, you can use the following commands:

```bash
# Starts the replica, running in the background
dfx start --background

# Deploys your canisters to the replica and generates your candid interface
dfx deploy prediction_markets_backend
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