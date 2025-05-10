#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_user1"	# cannot be mint account

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)
if [ -z "$KONG_CANISTER" ]; then
    echo "Error: Could not get KONG_CANISTER ID. Is dfx running and configured for network '$1'?"
    exit 1
fi
echo "Using KONG_CANISTER: $KONG_CANISTER"


perform_swap() {
    local P_TOKEN_SYMBOL=$1
    local R_TOKEN_SYMBOL=$2
    local P_AMOUNT_UNITS=$3
    local SWAP_NAME="$4"

    echo
    echo "Starting Swap ($SWAP_NAME): Paying ${P_AMOUNT_UNITS} ${P_TOKEN_SYMBOL} to receive ${R_TOKEN_SYMBOL}"
    echo "----------------------------------------------------------------------"

    local CURRENT_PAY_TOKEN_LEDGER
    CURRENT_PAY_TOKEN_LEDGER=$(dfx canister id ${NETWORK} "$(echo "${P_TOKEN_SYMBOL}" | tr '[:upper:]' '[:lower:]')_ledger")

    if [ -z "$CURRENT_PAY_TOKEN_LEDGER" ]; then
        echo "Error: Could not get ledger ID for ${P_TOKEN_SYMBOL}. Skipping this swap."
        echo "----------------------------------------------------------------------"
        return 1
    fi
    echo "PAY_TOKEN_LEDGER (${P_TOKEN_SYMBOL}): ${CURRENT_PAY_TOKEN_LEDGER}"

    local P_AMOUNT_CLEANED=${P_AMOUNT_UNITS//_/}
    local CURRENT_MAX_SLIPPAGE=1.0  # 1%
    local CURRENT_EXPIRES_AT
    CURRENT_EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc) # 60 seconds from now

    echo "Submitting icrc1_transfer to allow ${KONG_CANISTER} to spend ${P_AMOUNT_CLEANED} ${P_TOKEN_SYMBOL}..."
    STATE1_START=$SECONDS
    local TRANSFER_OUTPUT
    TRANSFER_OUTPUT=$(dfx canister call ${NETWORK} ${IDENTITY} "${CURRENT_PAY_TOKEN_LEDGER}" icrc1_transfer "(record {
        to = record {
            owner = principal \"${KONG_CANISTER}\";
            subaccount = null;
        };
        fee = null;
        memo = null;
        created_at_time = null;
        amount = ${P_AMOUNT_CLEANED};
    })")
    STATE1_FINISH=$SECONDS

    echo "icrc1_transfer output: ${TRANSFER_OUTPUT}"
    echo "STATE1_DURATION (icrc1_transfer): $((STATE1_FINISH - STATE1_START)) seconds"

    local CURRENT_TRANSFER_BLOCK_ID
    if [[ "$TRANSFER_OUTPUT" == *"Ok ="* ]]; then
        CURRENT_TRANSFER_BLOCK_ID=$(echo "$TRANSFER_OUTPUT" | awk -F'Ok = ' '{print $2}' | awk -F'[: )]' '{print $1}' | tr -dc '0-9')
    elif [[ "$TRANSFER_OUTPUT" == *"Ok = Nat("* ]]; then
         CURRENT_TRANSFER_BLOCK_ID=$(echo "$TRANSFER_OUTPUT" | awk -F'Nat\\(' '{print $2}' | awk -F'\\)' '{print $1}' | tr -dc '0-9')
    else
        CURRENT_TRANSFER_BLOCK_ID=$(echo "$TRANSFER_OUTPUT" | awk -F'=' '{print $2}' | awk '{print $1}' | tr -dc '0-9')
    fi

    if [ -z "$CURRENT_TRANSFER_BLOCK_ID" ]; then
        echo "Error: Failed to get a valid transfer block ID from output: '${TRANSFER_OUTPUT}'. Skipping swap."
        echo "----------------------------------------------------------------------"
        return 1
    fi
    echo "icrc1_transfer block id: ${CURRENT_TRANSFER_BLOCK_ID}"

    echo "Submitting swap to ${KONG_CANISTER}..."
    STATE2_START=$SECONDS
    dfx canister call ${NETWORK} ${IDENTITY} "${KONG_CANISTER}" swap "(record {
        pay_token = \"${P_TOKEN_SYMBOL}\";
        pay_amount = ${P_AMOUNT_CLEANED};
        pay_tx_id = opt variant { BlockIndex = ${CURRENT_TRANSFER_BLOCK_ID} };
        receive_token = \"${R_TOKEN_SYMBOL}\";
        receive_amount = null;
        max_slippage = opt ${CURRENT_MAX_SLIPPAGE};
        expires_at = opt ${CURRENT_EXPIRES_AT};
    })"
    STATE2_FINISH=$SECONDS
    echo "STATE2_DURATION (kong_backend swap): $((STATE2_FINISH - STATE2_START)) seconds"
    echo "----------------------------------------------------------------------"
    sleep 3
}

# --- Define and Execute The Grand Swap Sequence! ---
echo "Starting Swap Sequence"

# Amounts are in smallest units:
# 1 ksUSDT (6 decimals) = 1_000_000
# 0.01 ICP (8 decimals) = 100_000
# 0.0001 ksBTC (8 decimals) = 1_000
# 0.00000001 ksETH (18 decimals) = 10_000_000_000
# 0.1 ksKONG (8 decimals) = 1_000_000

# Pool 1: ICP / ksUSDT
perform_swap "ksUSDT" "ICP"   "1000000"     "Swap_1_ksUSDT_to_ICP"
perform_swap "ICP"    "ksUSDT" "100000"      "Swap_2_ICP_to_ksUSDT"

# Pool 2: ksBTC / ksUSDT
perform_swap "ksUSDT" "ksBTC" "1000000"     "Swap_3_ksUSDT_to_ksBTC"
perform_swap "ksBTC"  "ksUSDT" "1000"        "Swap_4_ksBTC_to_ksUSDT"

# Pool 3: ksETH / ksUSDT
perform_swap "ksUSDT" "ksETH" "1000000"     "Swap_5_ksUSDT_to_ksETH"
perform_swap "ksETH"  "ksUSDT" "10000000000" "Swap_6_ksETH_to_ksUSDT"

# Pool 4: ksKONG / ksUSDT
perform_swap "ksUSDT" "ksKONG" "1000000"     "Swap_7_ksUSDT_to_ksKONG"
perform_swap "ksKONG" "ksUSDT" "1000000"     "Swap_8_ksKONG_to_ksUSDT"

echo "Grand Swap Sequence Finished!"