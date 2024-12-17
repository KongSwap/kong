#!/usr/bin/env bash

bash create_canister_id.sh $1
NETWORK="--network $1"
KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

# 1. Add ckUSDT token
# only controller (kong) can add token
IDENTITY="--identity kong"

KSUSDT_SYMBOL="ckUSDT"
KSUSDT_CHAIN="IC"
KSUSDT_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KSUSDT_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KSUSDT_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSUSDT_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KSUSDT_DECIMALS=$(echo "10^${KSUSDT_DECIMALS}" | bc)
KSUSDT_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSUSDT_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KSUSDT_FEE=${KSUSDT_FEE//_/}

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_token --output json "(record {
    token = \"${KSUSDT_CHAIN}.${KSUSDT_LEDGER}\";
    on_kong = opt true;
})" | jq

# 2. Add ICP/ckUSDT pool
IDENTITY="--identity kong_user1"

KSICP_SYMBOL="ICP"
KSICP_KSUSDT_PRICE=7.50
KSICP_KSUSDT_PRICE=${KSICP_KSUSDT_PRICE//_/}        # remove underscore
KSICP_AMOUNT=500_000_000_000            # 5,000 ICP
KSICP_AMOUNT=${KSICP_AMOUNT//_/}        # remove underscore
KSICP_CHAIN="IC"
KSICP_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KSICP_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KSICP_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSICP_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KSICP_DECIMALS=$(echo "10^${KSICP_DECIMALS}" | bc)
KSICP_KSUSDT_DECIMALS=$(echo "${KSICP_DECIMALS} / ${KSUSDT_DECIMALS}" | bc -l) # convert ICP to ckUSDT precision
KSICP_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSICP_LEDGER} transfer_fee "(record {})" | awk -F'=' '{print $3}' | awk '{print $1}')
KSICP_FEE=${KSICP_FEE//_/}
KSUSDT_AMOUNT=$(echo "scale=0; ${KSICP_AMOUNT} * ${KSICP_KSUSDT_PRICE} / ${KSICP_KSUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${KSICP_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KSICP_AMOUNT} + ${KSICP_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KSUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KSUSDT_AMOUNT} + ${KSUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${KSICP_CHAIN}.${KSICP_LEDGER}\";
    amount_0 = ${KSICP_AMOUNT};
    token_1 = \"${KSUSDT_CHAIN}.${KSUSDT_LEDGER}\";
    amount_1 = ${KSUSDT_AMOUNT};
})" | jq

# 3. Add ckBTC/ckUSDT pool
KSBTC_SYMBOL="ckBTC"
KSBTC_KSUSDT_PRICE=58_000
KSBTC_KSUSDT_PRICE=${KSBTC_KSUSDT_PRICE//_/}        # remove underscore
KSBTC_AMOUNT=100_000_000                # 1 ckBTC
KSBTC_AMOUNT=${KSBTC_AMOUNT//_/}        # remove underscore
KSBTC_CHAIN="IC"
KSBTC_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KSBTC_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KSBTC_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSBTC_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KSBTC_DECIMALS=$(echo "10^${KSBTC_DECIMALS}" | bc)
KSBTC_KSUSDT_DECIMALS=$(echo "${KSBTC_DECIMALS} / ${KSUSDT_DECIMALS}" | bc -l) # convert ckBTC to ckUSDT precision
KSBTC_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSBTC_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KSBTC_FEE=${KSBTC_FEE//_/}
KSUSDT_AMOUNT=$(echo "scale=0; ${KSBTC_AMOUNT} * ${KSBTC_KSUSDT_PRICE} / ${KSBTC_KSUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${KSBTC_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KSBTC_AMOUNT} + ${KSBTC_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KSUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KSUSDT_AMOUNT} + ${KSUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${KSBTC_CHAIN}.${KSBTC_LEDGER}\";
    amount_0 = ${KSBTC_AMOUNT};
    token_1 = \"${KSUSDT_CHAIN}.${KSUSDT_LEDGER}\";
    amount_1 = ${KSUSDT_AMOUNT};
})" | jq

# 4. Add ckETH/ckUSDT pool
KSETH_SYMBOL="ckETH"
KSETH_KSUSDT_PRICE=2_450
KSETH_KSUSDT_PRICE=${KSETH_KSUSDT_PRICE//_/}        # remove underscore
KSETH_AMOUNT=20_000_000_000_000_000_000 # 20 ckETH
KSETH_AMOUNT=${KSETH_AMOUNT//_/}        # remove underscore
KSETH_CHAIN="IC"
KSETH_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KSETH_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KSETH_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSETH_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KSETH_DECIMALS=$(echo "10^${KSETH_DECIMALS}" | bc)
KSETH_KSUSDT_DECIMALS=$(echo "${KSETH_DECIMALS} / ${KSUSDT_DECIMALS}" | bc -l) # convert ckETH to ckUSDT precision
KSETH_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSETH_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KSETH_FEE=${KSETH_FEE//_/}
KSUSDT_AMOUNT=$(echo "scale=0; ${KSETH_AMOUNT} * ${KSETH_KSUSDT_PRICE} / ${KSETH_KSUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${KSETH_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KSETH_AMOUNT} + ${KSETH_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KSUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KSUSDT_AMOUNT} + ${KSUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${KSETH_CHAIN}.${KSETH_LEDGER}\";
    amount_0 = ${KSETH_AMOUNT};
    token_1 = \"${KSUSDT_CHAIN}.${KSUSDT_LEDGER}\";
    amount_1 = ${KSUSDT_AMOUNT};
})" | jq

# 5. Add KONG/ckUSDT pool
KSKONG_SYMBOL="KONG"
KSKONG_KSUSDT_PRICE=0.01
KSKONG_KSUSDT_PRICE=${KSKONG_KSUSDT_PRICE//_/}        # remove underscore
KSKONG_AMOUNT=100_000_000_000_000        # 1,000,000 KONG
KSKONG_AMOUNT=${KSKONG_AMOUNT//_/}        # remove underscore
KSKONG_CHAIN="IC"
KSKONG_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KSKONG_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KSKONG_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSKONG_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KSKONG_DECIMALS=$(echo "10^${KSKONG_DECIMALS}" | bc)
KSKONG_KSUSDT_DECIMALS=$(echo "${KSKONG_DECIMALS} / ${KSUSDT_DECIMALS}" | bc -l) # convert KONG to ckUSDT precision
KSKONG_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSKONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KSKONG_FEE=${KSKONG_FEE//_/}
KSUSDT_AMOUNT=$(echo "scale=0; ${KSKONG_AMOUNT} * ${KSKONG_KSUSDT_PRICE} / ${KSKONG_KSUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${KSKONG_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KSKONG_AMOUNT} + ${KSKONG_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KSUSDT_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KSUSDT_AMOUNT} + ${KSUSDT_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${KSKONG_CHAIN}.${KSKONG_LEDGER}\";
    amount_0 = ${KSKONG_AMOUNT};
    token_1 = \"${KSUSDT_CHAIN}.${KSUSDT_LEDGER}\";
    amount_1 = ${KSUSDT_AMOUNT};
})" | jq

# 6. Add KONG/ICP pool
KSKONG_SYMBOL="KONG"
KSKONG_KSICP_PRICE=0.001333
KSKONG_KSICP_PRICE=${KSKONG_KSICP_PRICE//_/}  # remove underscore
KSKONG_AMOUNT=100_000_000_000_000        # 1,000,000 KONG
KSKONG_AMOUNT=${KSKONG_AMOUNT//_/}        # remove underscore
KSKONG_CHAIN="IC"
KSKONG_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KSKONG_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KSKONG_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSKONG_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KSKONG_DECIMALS=$(echo "10^${KSKONG_DECIMALS}" | bc)
KSKONG_KSICP_DECIMALS=$(echo "${KSKONG_DECIMALS} / ${KSICP_DECIMALS}" | bc -l) # convert KONG to ICP precision
KSKONG_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSKONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KSKONG_FEE=${KSKONG_FEE//_/}
KSICP_AMOUNT=$(echo "scale=0; ${KSKONG_AMOUNT} * ${KSKONG_KSICP_PRICE} / ${KSKONG_KSICP_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${KSKONG_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KSKONG_AMOUNT} + ${KSKONG_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KSICP_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KSICP_AMOUNT} + ${KSICP_FEE}" | bc);
    expires_at = opt ${EXPIRES_AT};
    spender = record {
        owner = principal \"${KONG_CANISTER}\";
    };
})"

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool --output json "(record {
    token_0 = \"${KSKONG_CHAIN}.${KSKONG_LEDGER}\";
    amount_0 = ${KSKONG_AMOUNT};
    token_1 = \"${KSICP_CHAIN}.${KSICP_LEDGER}\";
    amount_1 = ${KSICP_AMOUNT};
})" | jq

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool_on_kong --output json '("'${KSICP_SYMBOL}_${KSUSDT_SYMBOL}'", true)' | jq
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool_on_kong --output json '("'${KSBTC_SYMBOL}_${KSUSDT_SYMBOL}'", true)' | jq
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool_on_kong --output json '("'${KSETH_SYMBOL}_${KSUSDT_SYMBOL}'", true)' | jq
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool_on_kong --output json '("'${KSKONG_SYMBOL}_${KSUSDT_SYMBOL}'", true)' | jq
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} add_pool_on_kong --output json '("'${KSKONG_SYMBOL}_${KSICP_SYMBOL}'", true)' | jq
