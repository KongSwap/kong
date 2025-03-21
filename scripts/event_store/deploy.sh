if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi

# Check if reinstall flag is provided
REINSTALL_FLAG=""
if [ "$2" = "reinstall" ]; then
	REINSTALL_FLAG="--mode reinstall"
	echo "Reinstall mode enabled"
fi

IDENTITY="--identity kong"
PRINCIPAL_ID=$(dfx identity ${IDENTITY} get-principal)

if [ -f "apis/apis.pem" ]; then
	# Import PEM file as 'apis' identity if it doesn't exist
	if ! dfx identity list | grep -q "apis"; then
		echo "Importing apis.pem as 'apis' identity..."
		dfx identity import apis apis/apis.pem
	fi
	
	# Store current identity
	CURRENT_IDENTITY=$(dfx identity whoami)
	
	# Switch to apis identity
	dfx identity use apis
	
	# Get API principal
	API_PRINCIPAL=$(dfx identity get-principal)
	WHITELIST_PRINCIPAL="principal \"${API_PRINCIPAL}\""
	echo "APIs PEM Principal: ${WHITELIST_PRINCIPAL}"
	
	# Switch back to original identity
	dfx identity use ${CURRENT_IDENTITY}
else
	# Fallback to kong_data canister
	KONG_DATA_CANISTER_ID=$(dfx canister id ${NETWORK} kong_data)
	WHITELIST_PRINCIPAL="principal \"${KONG_DATA_CANISTER_ID}\""
fi

dfx deploy ${NETWORK} ${IDENTITY} ${REINSTALL_FLAG} event_store --subnet-type fiduciary --argument "(
    record {
        push_events_whitelist = vec { ${WHITELIST_PRINCIPAL} };
        read_events_whitelist = vec { principal \"${PRINCIPAL_ID}\"};
    }
)"
