NETWORK="--network ic"

./switch_prod.sh

KONG_BACKEND=$(dfx canister id ${NETWORK} kong_backend)
KONG_SVELTE=$(dfx canister id ${NETWORK} kong_svelte)

#dfx ledger ${NETWORK} balance      # get ICP balance
#dfx ledger ${NETWORK} account-id   # get account-id to send ICP to
#dfx cycles balance ${NETWORK}
#dfx cycles convert ${NETWORK} --amount 5    # 5 ICP
dfx cycles top-up ${NETWORK} ${KONG_BACKEND} 30_000_000_000_000