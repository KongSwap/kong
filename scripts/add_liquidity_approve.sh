#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity konguser1"	# cannot be mint account

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

# inputs
ICP_CKUSDT=9.50
ICP_CKUSDT=${ICP_CKUSDT//_/}      # remove underscore
CKUSDC_CKUSDT=1
CKUSDC_CKUSDT=${CKUSDC_CKUSDT//_/}
CKBTC_CKUSDT=64_250
CKBTC_CKUSDT=${CKBTC_CKUSDT//_/}
CKETH_CKUSDT=3_175
CKETH_CKUSDT=${CKETH_CKUSDT//_/}

# ICP
ICP_TOKEN="ICP"
ICP_AMOUNT=500_000_000_000                  # 5,000 ICP
ICP_AMOUNT=${ICP_AMOUNT//_/}                # remove underscore
# ckUSDC
CKUSDC_TOKEN="ckUSDC"
CKUSDC_AMOUNT=50_000_000_000                # 50,000 ckUSDC
CKUSDC_AMOUNT=${CKUSDC_AMOUNT//_/}
# ckBTC
CKBTC_TOKEN="ckBTC"
CKBTC_AMOUNT=100_000_000                    # 1 ckBTC
CKBTC_AMOUNT=${CKBTC_AMOUNT//_/}
# ckETH
CKETH_TOKEN="ckETH"
CKETH_AMOUNT=20_000_000_000_000_000_000	    # 20 ckETH
CKETH_AMOUNT=${CKETH_AMOUNT//_/}

# ckUSDT
CKUSDT_TOKEN="ckUSDT"
CKUSDT_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${CKUSDT_TOKEN} | tr '[:upper:]' '[:lower:]')_ledger)
CKUSDT_DECIMALS=$(dfx canister call ${CKUSDT_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
CKUSDT_DECIMALS=$(echo "10^${CKUSDT_DECIMALS}" | bc)
CKUSDT_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
CKUSDT_FEE=${CKUSDT_FEE//_/}

# ICP/ckUSDT pool
ICP_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${ICP_TOKEN} | tr '[:upper:]' '[:lower:]')_ledger)
ICP_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${ICP_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
ICP_DECIMALS=$(echo "10^${ICP_DECIMALS}" | bc)
ICP_CKUSDT_DECIMALS=$(echo "${ICP_DECIMALS} / ${CKUSDT_DECIMALS}" | bc -l) # convert ICP to ckUSDT precision
ICP_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${ICP_LEDGER} transfer_fee "(record {})" | awk -F'=' '{print $3}' | awk '{print $1}')
ICP_FEE=${ICP_FEE//_/}
CKUSDT_AMOUNT=$(echo "scale=0; ${ICP_AMOUNT} * ${ICP_CKUSDT} / ${ICP_CKUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

APPROVE_TOKEN0_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${ICP_LEDGER} icrc2_approve "(record {
    amount = $(echo "${ICP_AMOUNT} + ${ICP_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

APPROVE_TOKEN1_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDT_AMOUNT} + ${CKUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_liquidity "(record {
    token0 = \"${ICP_TOKEN}\";
    amount0 = ${ICP_AMOUNT};
    token1 = \"${CKUSDT_TOKEN}\";
    amount1 = ${CKUSDT_AMOUNT};
})"

# ckUSDC/ckUSDT pool
CKUSDC_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${CKUSDC_TOKEN} | tr '[:upper:]' '[:lower:]')_ledger)
CKUSDC_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDC_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
CKUSDC_DECIMALS=$(echo "10^${CKUSDC_DECIMALS}" | bc)
CKUSDC_CKUSDT_DECIMALS=$(echo "${CKUSDC_DECIMALS} / ${CKUSDT_DECIMALS}" | bc -l) # convert ckUSDC to ckUSDT precision
CKUSDC_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDC_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
CKUSDC_FEE=${CKUSDC_FEE//_/}
CKUSDT_AMOUNT=$(echo "scale=0; ${CKUSDC_AMOUNT} * ${CKUSDC_CKUSDT} / ${CKUSDC_CKUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

APPROVE_TOKEN0_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDC_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDC_AMOUNT} + ${CKUSDC_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

APPROVE_TOKEN1_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDT_AMOUNT} + ${CKUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_liquidity "(record {
    token0 = \"${CKUSDC_TOKEN}\";
    amount0 = ${CKUSDC_AMOUNT};
    token1 = \"${CKUSDT_TOKEN}\";
    amount1 = ${CKUSDT_AMOUNT};
})"

# ckBTC/ckUSDT pool
CKBTC_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${CKBTC_TOKEN} | tr '[:upper:]' '[:lower:]')_ledger)
CKBTC_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKBTC_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
CKBTC_DECIMALS=$(echo "10^${CKBTC_DECIMALS}" | bc)
CKBTC_CKUSDT_DECIMALS=$(echo "${CKBTC_DECIMALS} / ${CKUSDT_DECIMALS}" | bc -l) # convert ckBTC to ckUSDT precision
CKBTC_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKBTC_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
CKBTC_FEE=${CKBTC_FEE//_/}
CKUSDT_AMOUNT=$(echo "scale=0; ${CKBTC_AMOUNT} * ${CKBTC_CKUSDT} / ${CKBTC_CKUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

APPROVE_TOKEN0_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKBTC_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKBTC_AMOUNT} + ${CKBTC_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

APPROVE_TOKEN1_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDT_AMOUNT} + ${CKUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_liquidity "(record {
    token0 = \"${CKBTC_TOKEN}\";
    amount0 = ${CKBTC_AMOUNT};
    token1 = \"${CKUSDT_TOKEN}\";
    amount1 = ${CKUSDT_AMOUNT};
})"

# ckETH/ckUSDT pool
CKETH_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${CKETH_TOKEN} | tr '[:upper:]' '[:lower:]')_ledger)
CKETH_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKETH_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
CKETH_DECIMALS=$(echo "10^${CKETH_DECIMALS}" | bc)
CKETH_CKUSDT_DECIMALS=$(echo "${CKETH_DECIMALS} / ${CKUSDT_DECIMALS}" | bc -l) # convert ckETH to ckUSDT precision
CKETH_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKETH_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
CKETH_FEE=${CKETH_FEE//_/}
CKUSDT_AMOUNT=$(echo "scale=0; ${CKETH_AMOUNT} * ${CKETH_CKUSDT} / ${CKETH_CKUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

APPROVE_TOKEN0_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKETH_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKETH_AMOUNT} + ${CKETH_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})" | awk -F'=' '{print $2}' | awk '{print $1}')

APPROVE_TOKEN1_BLOCK_ID=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDT_AMOUNT} + ${CKUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
},)" | awk -F'=' '{print $2}' | awk '{print $1}')

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_liquidity "(record {
	token0 = \"${CKETH_TOKEN}\";
    amount0 = ${CKETH_AMOUNT};
    token1 = \"${CKUSDT_TOKEN}\";
    amount1 = ${CKUSDT_AMOUNT};
})"
