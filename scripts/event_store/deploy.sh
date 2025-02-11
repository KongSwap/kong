if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong"
PRINCIPAL_ID=$(dfx identity ${IDENTITY} get-principal)
KONG_DATA_CANISTER_ID='cbefx-hqaaa-aaaar-qakrq-cai'

dfx deploy ${NETWORK} ${IDENTITY} event_store --argument "(
    record {
        push_events_whitelist = vec { principal \"${KONG_DATA_CANISTER_ID}\" };
        read_events_whitelist = vec { principal \"${PRINCIPAL_ID}\"};
    }
)"
