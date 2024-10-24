NETWORK="--network ic"
IDENTITY="--identity kong"

KONG_BACKEND=$(dfx canister id ${NETWORK} kong_backend)

dfx cycles top-up ${NETWORK} ${IDENTITY} ${KONG_BACKEND} 10_000_000_000_000