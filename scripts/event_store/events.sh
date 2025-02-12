if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong"
EVENT_STORE_CANISTER_ID=$(dfx canister id ${NETWORK} event_store)

dfx canister call ${NETWORK} ${IDENTITY} ${EVENT_STORE_CANISTER_ID} events "(
    record {
        start = (0: nat64);
        length = (100: nat64);
    }
)"
