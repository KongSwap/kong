original_dir=$(pwd)
root_dir="${CANISTER_IDS_ROOT:-${original_dir}/..}"
canister_ids_file="${root_dir}/canister_ids.all.json"

# Set network to local if not provided
NETWORK="${NETWORK:-local}"
echo "Using network: ${NETWORK}"

# Validate that the network exists in the canister_ids file
if ! jq -e ".trollbox.${NETWORK}" "${canister_ids_file}" > /dev/null 2>&1; then
    echo "Error: Network '${NETWORK}' not found in canister_ids file"
    echo "Available networks: $(jq -r '.trollbox | keys | join(", ")' "${canister_ids_file}")"
    exit 1
fi

CANISTER_ID=$(jq -r ".trollbox.${NETWORK}" "${canister_ids_file}")
echo "CANISTER_ID: ${CANISTER_ID}"

# Verify canister ID exists and is not empty
if [ -z "$CANISTER_ID" ] || [ "$CANISTER_ID" == "null" ]; then
    echo "Error: Missing trollbox canister ID for network ${NETWORK}"
    exit 1
fi

dfx deploy trollbox --network "${NETWORK}" --specified-id "${CANISTER_ID}"
