NETWORK="--network ic"
IDENTITY="--identity kong"

KONG_BACKEND=$(dfx canister id ${NETWORK} kong_backend)

#dfx ledger ${NETWORK} balance      # get ICP balance
#dfx ledger ${NETWORK} account-id   # get account-id to send ICP to
#dfx cycles balance ${NETWORK}
#dfx cycles convert ${NETWORK} --amount 5    # 5 ICP
dfx cycles top-up ${NETWORK} ${IDENTITY} ${KONG_BACKEND} 10_000_000_000_000