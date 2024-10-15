# kongswap

Welcome to the Kong Swap project.

To get started, you might want to explore the project directory structure.

## Running the project locally

Requirements:
1) Linux/MacOS development environment - using Ubuntu 24.04.01
2) Rust/Cargo installed - using v1.80.1
3) Node.js/npm installed - using Node v22.9.0, npm 10.8.3
4) Dfinity CDK (dfx) installed v0.24.0
5) jq - commandline JSON processor

If you want to test the project locally, you use the following commands:

```bash
# Starts replica, running in the background
# run with --clean option if you want to start from scratch, BUT this will erase all existing data
# may need to stop it first: 'dfx stop' or even 'dfx killall' to make sure you don't have multiple replicas running
dfx start [--clean] --background

# create user identities
# only need to run this once. will create kong (admin) and kong_user1 (user will tokens) unencrypted PEM file identities
# 'dfx identity list' will give you the list of users
cd scripts/local
./create_identity.sh

# Create and deploy your canisters
# this may take awhile as it'll compile the code and deploy locally
./deploy_kong.sh

# if successful, you should see at the end
#
# Deployed canisters.
# URLs:
#   Frontend canister via browser
#     internet_identity: http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943/
#     kong_frontend: http://oaq4p-2iaaa-aaaar-qahqa-cai.localhost:4943/
#   Backend canister via Candid interface:
#     ckbtc_ledger: http://bkyz2-fmaaa-aaaaa-qaaaq-cai.localhost:4943/?id=zeyan-7qaaa-aaaar-qaibq-cai
#     cketh_ledger: http://bkyz2-fmaaa-aaaaa-qaaaq-cai.localhost:4943/?id=zr7ra-6yaaa-aaaar-qaica-cai
#     ckusdc_ledger: http://bkyz2-fmaaa-aaaaa-qaaaq-cai.localhost:4943/?id=zw6xu-taaaa-aaaar-qaicq-cai
#     ckusdt_ledger: http://bkyz2-fmaaa-aaaaa-qaaaq-cai.localhost:4943/?id=zdzgz-siaaa-aaaar-qaiba-cai
#     icp_ledger: http://bkyz2-fmaaa-aaaaa-qaaaq-cai.localhost:4943/?id=nppha-riaaa-aaaal-ajf2q-cai
#     internet_identity: http://bkyz2-fmaaa-aaaaa-qaaaq-cai.localhost:4943/?id=rdmx6-jaaaa-aaaaa-aaadq-cai
#     kong_backend: http://bkyz2-fmaaa-aaaaa-qaaaq-cai.localhost:4943/?id=l4lgk-raaaa-aaaar-qahpq-cai
#     kong_faucet: http://bkyz2-fmaaa-aaaaa-qaaaq-cai.localhost:4943/?id=ohr23-xqaaa-aaaar-qahqq-cai
# (variant { Ok = 1 : nat })
# (variant { Ok = 1 : nat })
# (variant { Ok = 1 : nat })
# (variant { Ok = 1 : nat })
# (variant { Ok = 1 : nat })
#

# everything is deployed and running. To access the front end, go to: http://oaq4p-2iaaa-aaaar-qahqa-cai.localhost:4943/ in your browser.

# however, the system is empty. You will need to add tokens and liquidity pools.
# look into the script deploy_tokens_pools.sh to change the settings like amounts and prices
./deploy_tokens_pools.sh

# once the tokens and pools are created, everything should be up and running.
```

Kong Swap will be available at http://oaq4p-2iaaa-aaaar-qahqa-cai.localhost:4943/
