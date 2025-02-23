#!/usr/bin/env bash
set -e

# Configuration: ensure we target the IC mainnet and have a controller principal
export DFX_NETWORK=ic
CONTROLLER_PRINCIPAL=$(dfx identity get-principal)  # Principal controlling the new canister
CMC_CANISTER_ID="rkp4c-7iaaa-aaaaa-aaaca-cai"        # Cycles Minting Canister ID (mainnet)

# Memo value for canister creation ("CREA")
MEMO_CREATE_CANISTER=1095062083

echo "Controller principal: $CONTROLLER_PRINCIPAL"
echo "Cycles Minting Canister ID: $CMC_CANISTER_ID"
echo "Using memo: $MEMO_CREATE_CANISTER (CREA)"

# Derive the subaccount hex from the controller principal (used as subaccount for the destination)
SUBACCOUNT_HEX=$(python3 -c "import base64,sys
p=sys.argv[1].replace('-','').upper()
for pad in (0,1,3,4,6):
    try:
        raw=base64.b32decode(p + '='*pad); break
    except Exception:
        continue
principal_bytes = raw[4:]
sub = bytes([len(principal_bytes)]) + principal_bytes + bytes(32 - len(principal_bytes) - 1)
print(sub.hex())" "$CONTROLLER_PRINCIPAL")

# Compute the destination account identifier using the CMC canister and subaccount
DEST_ACCOUNT_ID=$(dfx ledger account-id --of-principal "$CMC_CANISTER_ID" --subaccount "$SUBACCOUNT_HEX")
echo "Destination account (CMC with controller subaccount): $DEST_ACCOUNT_ID"

# 1. Transfer 0.5 ICP with the creation memo
TRANSFER_OUTPUT=$(dfx ledger transfer --amount 0.5 --memo $MEMO_CREATE_CANISTER "$DEST_ACCOUNT_ID" --network ic)
echo "$TRANSFER_OUTPUT"

# 2. Extract the block height from the transfer output.
# Adjusted to capture the number from the output.
BLOCK_HEIGHT=$(echo "$TRANSFER_OUTPUT" | grep -Eo '[0-9]+' | tail -n 1)
echo "Block height: $BLOCK_HEIGHT"

# 3. Notify the ledger to trigger canister creation.
dfx ledger notify "$BLOCK_HEIGHT" "$CONTROLLER_PRINCIPAL" --network ic
