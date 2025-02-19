if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong"
PRINCIPAL_ID=$(dfx identity ${IDENTITY} get-principal)
EVENT_STORE_CANISTER_ID=$(dfx canister id ${NETWORK} event_store)
NOW=$(date +%s%3N)

dfx canister call ${NETWORK} ${IDENTITY} ${EVENT_STORE_CANISTER_ID} push_events "(
    record {
        events = vec {
            record {
                idempotency_key = (3: nat);
                name = \"KongSwap\";
                source = opt variant { Public=\"${PRINCIPAL_ID}\" };
                user = opt variant { Public=\"${PRINCIPAL_ID}\" };
                timestamp = (${NOW}: nat64);
                payload = blob \"{prop1 : \\\"hello world\\\"}\";
            };
        }
    }
)"
