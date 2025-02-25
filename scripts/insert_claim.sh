#!/usr/bin/env bash
if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong"

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

CLAIM='{
    \"claim_id\": 0,
    \"user_id\": 100,
    \"status\": \"Claimable\",
    \"token_id\": 1,
    \"amount\": [1],
    \"attempt_request_id\": [],
    \"transfer_ids\": [],
    \"ts\": 1739460597002834319
}'

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} insert_claim "(
	\"${CLAIM}\"
)"