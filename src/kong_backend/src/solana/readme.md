git clone --recurse-submodules https://github.com/KongSwap/kong.git

dfx start --clean --background

sh scripts/deploy_kong_backend local

make sure local identity is controller or king kong etc

dfx canister call kong_backend cache_solana_address

cd kong_rpc

create a .env and copy pasta the example.env in it

cargo run -r

kong_backend sol address: 8D2rdMP9c2iHyPTWQYLFPy2BmA5chYNdiNaEk9x8CBtv
canister is notified of txs
