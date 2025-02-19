CANISTER_ID=$(jq -r ".prediction_markets_backend.${NETWORK}" "${root_dir}"/canister_ids.all.json)
echo "CANISTER_ID: ${CANISTER_ID}"
# Verify canister ID exists before deploying
if [ -z "$CANISTER_ID" ] || [ "$CANISTER_ID" == "null" ]; then
    echo "Error: Missing prediction_markets_backend canister ID for network ${NETWORK}"
    exit 1
fi

dfx deploy prediction_markets_backend --network "${NETWORK}" --specified-id "${CANISTER_ID}"
