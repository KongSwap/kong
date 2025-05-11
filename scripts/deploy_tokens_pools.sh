#!/usr/bin/env bash

bash create_canister_id.sh $1
NETWORK="--network $1"
KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

# 1. Add ckUSDT token
# only controller (kong) can add token
IDENTITY="--identity kong"

CKUSDT_SYMBOL="ckUSDT"
CKUSDT_CHAIN="IC"
CKUSDT_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${CKUSDT_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
CKUSDT_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
CKUSDT_DECIMALS=$(echo "10^${CKUSDT_DECIMALS}" | bc)
CKUSDT_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
CKUSDT_FEE=${CKUSDT_FEE//_/}

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_token --output json "(record {
    token = \"${CKUSDT_CHAIN}.${CKUSDT_LEDGER}\";
    on_kong = opt true;
})" | jq

# 2. Add ICP/ckUSDT pool
IDENTITY="--identity kong_user1"

ICP_SYMBOL="ICP"
ICP_CKUSDT_PRICE=7.50
ICP_CKUSDT_PRICE=${ICP_CKUSDT_PRICE//_/}        # remove underscore
ICP_AMOUNT=500_000_000_000            # 5,000 ICP
ICP_AMOUNT=${ICP_AMOUNT//_/}        # remove underscore
ICP_CHAIN="IC"
ICP_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${ICP_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
ICP_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${ICP_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
ICP_DECIMALS=$(echo "10^${ICP_DECIMALS}" | bc)
ICP_CKUSDT_DECIMALS=$(echo "${ICP_DECIMALS} / ${CKUSDT_DECIMALS}" | bc -l) # convert ICP to ckUSDT precision
ICP_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${ICP_LEDGER} transfer_fee "(record {})" | awk -F'=' '{print $3}' | awk '{print $1}')
ICP_FEE=${ICP_FEE//_/}
CKUSDT_AMOUNT=$(echo "scale=0; ${ICP_AMOUNT} * ${ICP_CKUSDT_PRICE} / ${ICP_CKUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${ICP_LEDGER} icrc2_approve "(record {
    amount = $(echo "${ICP_AMOUNT} + ${ICP_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDT_AMOUNT} + ${CKUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${ICP_CHAIN}.${ICP_LEDGER}\";
    amount_0 = ${ICP_AMOUNT};
    token_1 = \"${CKUSDT_CHAIN}.${CKUSDT_LEDGER}\";
    amount_1 = ${CKUSDT_AMOUNT};
    on_kong = opt true;
})" | jq

# 3. Add ckBTC/ckUSDT pool
CKBTC_SYMBOL="ckBTC"
CKBTC_CKUSDT_PRICE=58_000
CKBTC_CKUSDT_PRICE=${CKBTC_CKUSDT_PRICE//_/}        # remove underscore
CKBTC_AMOUNT=100_000_000                # 1 ckBTC
CKBTC_AMOUNT=${CKBTC_AMOUNT//_/}        # remove underscore
CKBTC_CHAIN="IC"
CKBTC_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${CKBTC_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
CKBTC_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKBTC_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
CKBTC_DECIMALS=$(echo "10^${CKBTC_DECIMALS}" | bc)
CKBTC_CKUSDT_DECIMALS=$(echo "${CKBTC_DECIMALS} / ${CKUSDT_DECIMALS}" | bc -l) # convert ckBTC to ckUSDT precision
CKBTC_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKBTC_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
CKBTC_FEE=${CKBTC_FEE//_/}
CKUSDT_AMOUNT=$(echo "scale=0; ${CKBTC_AMOUNT} * ${CKBTC_CKUSDT_PRICE} / ${CKBTC_CKUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${CKBTC_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKBTC_AMOUNT} + ${CKBTC_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDT_AMOUNT} + ${CKUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${CKBTC_CHAIN}.${CKBTC_LEDGER}\";
    amount_0 = ${CKBTC_AMOUNT};
    token_1 = \"${CKUSDT_CHAIN}.${CKUSDT_LEDGER}\";
    amount_1 = ${CKUSDT_AMOUNT};
    on_kong = opt true;
})" | jq

# 4. Add ckETH/ckUSDT pool
CKETH_SYMBOL="ckETH"
CKETH_CKUSDT_PRICE=2_450
CKETH_CKUSDT_PRICE=${CKETH_CKUSDT_PRICE//_/}        # remove underscore
CKETH_AMOUNT=20_000_000_000_000_000_000 # 20 ckETH
CKETH_AMOUNT=${CKETH_AMOUNT//_/}        # remove underscore
CKETH_CHAIN="IC"
CKETH_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${CKETH_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
CKETH_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKETH_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
CKETH_DECIMALS=$(echo "10^${CKETH_DECIMALS}" | bc)
CKETH_CKUSDT_DECIMALS=$(echo "${CKETH_DECIMALS} / ${CKUSDT_DECIMALS}" | bc -l) # convert ckETH to ckUSDT precision
CKETH_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${CKETH_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
CKETH_FEE=${CKETH_FEE//_/}
CKUSDT_AMOUNT=$(echo "scale=0; ${CKETH_AMOUNT} * ${CKETH_CKUSDT_PRICE} / ${CKETH_CKUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${CKETH_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKETH_AMOUNT} + ${CKETH_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDT_AMOUNT} + ${CKUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${CKETH_CHAIN}.${CKETH_LEDGER}\";
    amount_0 = ${CKETH_AMOUNT};
    token_1 = \"${CKUSDT_CHAIN}.${CKUSDT_LEDGER}\";
    amount_1 = ${CKUSDT_AMOUNT};
    on_kong = opt true;
})" | jq

# 5. Add KONG/ckUSDT pool
KONG_SYMBOL="KONG"
KONG_CKUSDT_PRICE=0.01
KONG_CKUSDT_PRICE=${KONG_CKUSDT_PRICE//_/}        # remove underscore
KONG_AMOUNT=100_000_000_000_000        # 1,000,000 KONG
KONG_AMOUNT=${KONG_AMOUNT//_/}        # remove underscore
KONG_CHAIN="IC"
KONG_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KONG_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KONG_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KONG_DECIMALS=$(echo "10^${KONG_DECIMALS}" | bc)
KONG_CKUSDT_DECIMALS=$(echo "${KONG_DECIMALS} / ${CKUSDT_DECIMALS}" | bc -l) # convert KONG to ckUSDT precision
KONG_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
CKUSDT_AMOUNT=$(echo "scale=0; ${KONG_AMOUNT} * ${KONG_CKUSDT_PRICE} / ${KONG_CKUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KONG_AMOUNT} + ${KONG_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${CKUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${CKUSDT_AMOUNT} + ${CKUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${KONG_CHAIN}.${KONG_LEDGER}\";
    amount_0 = ${KONG_AMOUNT};
    token_1 = \"${CKUSDT_CHAIN}.${CKUSDT_LEDGER}\";
    amount_1 = ${CKUSDT_AMOUNT};
    on_kong = opt true;
})" | jq

# 6. Add KONG/ICP pool
KONG_SYMBOL="KONG"
KONG_ICP_PRICE=0.001333
KONG_ICP_PRICE=${KONG_ICP_PRICE//_/}  # remove underscore
KONG_AMOUNT=100_000_000_000_000        # 1,000,000 KONG
KONG_AMOUNT=${KONG_AMOUNT//_/}        # remove underscore
KONG_CHAIN="IC"
KONG_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KONG_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KONG_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KONG_DECIMALS=$(echo "10^${KONG_DECIMALS}" | bc)
KONG_ICP_DECIMALS=$(echo "${KONG_DECIMALS} / ${ICP_DECIMALS}" | bc -l) # convert KONG to ICP precision
KONG_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
ICP_AMOUNT=$(echo "scale=0; ${KONG_AMOUNT} * ${KONG_ICP_PRICE} / ${KONG_ICP_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KONG_AMOUNT} + ${KONG_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${ICP_LEDGER} icrc2_approve "(record {
    amount = $(echo "${ICP_AMOUNT} + ${ICP_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${KONG_CHAIN}.${KONG_LEDGER}\";
    amount_0 = ${KONG_AMOUNT};
    token_1 = \"${ICP_CHAIN}.${ICP_LEDGER}\";
    amount_1 = ${ICP_AMOUNT};
    on_kong = opt true;
})" | jq
