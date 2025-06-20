#!/bin/bash
# test_burn.sh - Tests burning KONG tokens by sending them to the minter account

set -e

echo "==== Testing KONG Token Burn Functionality ====" 

# Get canister IDs
KONG_LEDGER=$(dfx canister id kong_ledger)
MINTER_ID="faaxe-sf6cf-hmx3r-ujxc6-7ppwl-3lkf3-zpj6i-2m75x-bqmba-dod7q-4qe"
KONG_FEE=$(dfx canister call ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
BURN_AMOUNT=10000000 # 10 KONG

echo "KONG Ledger: $KONG_LEDGER"
echo "Minter ID: $MINTER_ID"
echo "KONG Fee: $KONG_FEE"

# Get the current transaction count to compare later
echo -e "\n==== Getting current transaction count ===="
TX_RESPONSE=$(dfx canister call ${KONG_LEDGER} get_transactions "(record { start = 0; length = 1 })")
LOG_LENGTH=$(echo $TX_RESPONSE | grep -o 'log_length[^0-9]*[0-9]\+' | grep -o '[0-9]\+')
echo "Current transaction log length: $LOG_LENGTH"

# Step 1: Check current balance of the sender
echo -e "\n==== Step 1: Checking current balance ===="
dfx identity use default
SENDER_PRINCIPAL=$(dfx identity get-principal)
echo "Using sender principal: $SENDER_PRINCIPAL"

SENDER_BALANCE=$(dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$SENDER_PRINCIPAL\" })")
echo "Current balance: $SENDER_BALANCE"

# Step 2: Send tokens to the minter (burn)
echo -e "\n==== Step 2: Attempting to burn $BURN_AMOUNT tokens ===="

# Try to burn tokens using the burn method if available
echo "Attempting direct burn operation..."
BURN_RESULT=$(dfx canister call ${KONG_LEDGER} icrc1_transfer "(record {
    to = record {
        owner = principal \"${MINTER_ID}\"; 
    };
    amount = ${BURN_AMOUNT};
    memo = opt blob \"BURN\"; 
})")

echo "Operation result: $BURN_RESULT"

# Step 3: Check updated balance of the sender
echo -e "\n==== Step 3: Checking updated balance after operation ===="
UPDATED_BALANCE=$(dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$SENDER_PRINCIPAL\" })")
echo "Updated balance: $UPDATED_BALANCE"

# Step 4: Check minter balance (optional)
echo -e "\n==== Step 4: Checking minter balance ===="
MINTER_BALANCE=$(dfx canister call ${KONG_LEDGER} icrc1_balance_of "(record { owner = principal \"$MINTER_ID\" })")
echo "Minter balance: $MINTER_BALANCE"

# Step 5: Verify transaction type using get_transactions
echo -e "\n==== Step 5: Verifying transaction type ===="
# Get the latest transaction
NEW_TX_RESPONSE=$(dfx canister call ${KONG_LEDGER} get_transactions "(record { start = 0; length = 1 })")
NEW_LOG_LENGTH=$(echo $NEW_TX_RESPONSE | grep -o 'log_length[^0-9]*[0-9]\+' | grep -o '[0-9]\+')
LATEST_TX_INDEX=$((NEW_LOG_LENGTH - 1))

echo "Getting transaction details for index $LATEST_TX_INDEX"
TX_DETAILS=$(dfx canister call ${KONG_LEDGER} get_transactions "(record { start = $LATEST_TX_INDEX; length = 1 })")

echo -e "\nTransaction details:"
echo "$TX_DETAILS"

# Check if it's a burn transaction
if [[ $TX_DETAILS == *"kind = \"burn\""* ]]; then
    echo -e "\n\u2705 CONFIRMED: This was a proper BURN transaction"
    echo "The transaction was recorded as a burn operation in the ledger."
else
    if [[ $TX_DETAILS == *"to=record {owner=principal \"$MINTER_ID\""* ]]; then
        echo -e "\n\u26a0\ufe0f NOTE: This was a TRANSFER to the minter, not a true burn operation"
        echo "The tokens were sent to the minter account but not actually burned in the protocol sense."
    else
        echo -e "\n\u274c This transaction is neither a burn nor a transfer to the minter"
        echo "Please check the transaction details for more information."
    fi
fi

# Calculate expected balance reduction
EXPECTED_REDUCTION=$((BURN_AMOUNT + KONG_FEE))
echo -e "\n==== Summary ===="
if [[ $TX_DETAILS == *"kind = \"burn\""* ]]; then
    echo "Burned $BURN_AMOUNT tokens (10 KONG)"
else
    echo "Sent $BURN_AMOUNT tokens (10 KONG) to minter ID"
fi
echo "Paid $KONG_FEE fee"
echo "Total reduction should be $EXPECTED_REDUCTION tokens"
echo "==== Test completed ===="
