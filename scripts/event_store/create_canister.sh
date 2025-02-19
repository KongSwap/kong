if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong"

dfx canister create ${NETWORK} ${IDENTITY} event_store --subnet-type fiduciary