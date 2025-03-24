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

# Store current identity
CURRENT_IDENTITY=$(dfx identity whoami)
echo "Current identity: ${CURRENT_IDENTITY}"

# Set kong identity for deployment
IDENTITY="--identity kong"
PRINCIPAL_ID=$(dfx identity get-principal)
echo "Kong Principal ID: ${PRINCIPAL_ID}"

# Switch to apis identity 
if dfx identity list | grep -q "apis"; then
	# Switch to apis identity
	echo "Switching to 'apis' identity to get push principal..."
	dfx identity use apis
	
	# Get API principal for push whitelist
	API_PRINCIPAL=$(dfx identity get-principal)
	PUSH_WHITELIST_PRINCIPAL="principal \"${API_PRINCIPAL}\""
	echo "APIs Principal for pushing events: ${PUSH_WHITELIST_PRINCIPAL}"
	
	# Switch back to original identity
	echo "Switching back to '${CURRENT_IDENTITY}' identity..."
	dfx identity use ${CURRENT_IDENTITY}
else
	echo "Error: 'apis' identity does not exist. Please create it first with 'dfx identity new apis'"
	exit 1
fi

# Get kong identity principal for read access
READ_WHITELIST_PRINCIPAL="principal \"${PRINCIPAL_ID}\""
echo "Kong Principal for reading events: ${READ_WHITELIST_PRINCIPAL}"

# Deploy with both principals properly specified
echo "Deploying event_store canister with appropriate permissions..."
dfx deploy ${NETWORK} ${IDENTITY} ${REINSTALL_FLAG} event_store --argument "(
    record {
        push_events_whitelist = vec { ${PUSH_WHITELIST_PRINCIPAL} };
        read_events_whitelist = vec { ${READ_WHITELIST_PRINCIPAL} };
    }
)"
echo "Event store deployment completed."