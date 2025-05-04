#!/usr/bin/env bash

bash create_canister_id.sh $1
NETWORK="--network $1"
KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

# 1. Add ksUSDT token
# only controller (kong) can add token
IDENTITY="--identity kong"

KSUSDT_SYMBOL="ksUSDT"
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

# 2. Add ICP/ksUSDT pool
IDENTITY="--identity kong_user1"

ICP_SYMBOL="ICP"
ICP_KSUSDT_PRICE=7.50
ICP_KSUSDT_PRICE=${ICP_KSUSDT_PRICE//_/}        # remove underscore
ICP_AMOUNT=500_000_000_000            # 5,000 ICP
ICP_AMOUNT=${ICP_AMOUNT//_/}        # remove underscore
ICP_CHAIN="IC"
ICP_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${ICP_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
ICP_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${ICP_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
ICP_DECIMALS=$(echo "10^${ICP_DECIMALS}" | bc)
ICP_KSUSDT_DECIMALS=$(echo "${ICP_DECIMALS} / ${KSUSDT_DECIMALS}" | bc -l) # convert ICP to ksUSDT precision
ICP_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${ICP_LEDGER} transfer_fee "(record {})" | awk -F'=' '{print $3}' | awk '{print $1}')
ICP_FEE=${ICP_FEE//_/}
KSUSDT_AMOUNT=$(echo "scale=0; ${ICP_AMOUNT} * ${ICP_KSUSDT_PRICE} / ${ICP_KSUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${ICP_LEDGER} icrc2_approve "(record {
    amount = $(echo "${ICP_AMOUNT} + ${ICP_FEE}" | bc);
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
    token_0 = \"${ICP_CHAIN}.${ICP_LEDGER}\";
    amount_0 = ${ICP_AMOUNT};
    token_1 = \"${KSUSDT_CHAIN}.${KSUSDT_LEDGER}\";
    amount_1 = ${KSUSDT_AMOUNT};
    on_kong = opt true;
})" | jq

# 3. Add ksBTC/ksUSDT pool
KSBTC_SYMBOL="ksBTC"
KSBTC_KSUSDT_PRICE=58_000
KSBTC_KSUSDT_PRICE=${KSBTC_KSUSDT_PRICE//_/}        # remove underscore
KSBTC_AMOUNT=100_000_000                # 1 ksBTC
KSBTC_AMOUNT=${KSBTC_AMOUNT//_/}        # remove underscore
KSBTC_CHAIN="IC"
KSBTC_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KSBTC_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KSBTC_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSBTC_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KSBTC_DECIMALS=$(echo "10^${KSBTC_DECIMALS}" | bc)
KSBTC_KSUSDT_DECIMALS=$(echo "${KSBTC_DECIMALS} / ${KSUSDT_DECIMALS}" | bc -l) # convert ksBTC to ksUSDT precision
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
    on_kong = opt true;
})" | jq

# 4. Add ksETH/ksUSDT pool
KSETH_SYMBOL="ksETH"
KSETH_KSUSDT_PRICE=2_450
KSETH_KSUSDT_PRICE=${KSETH_KSUSDT_PRICE//_/}        # remove underscore
KSETH_AMOUNT=20_000_000_000_000_000_000 # 20 ksETH
KSETH_AMOUNT=${KSETH_AMOUNT//_/}        # remove underscore
KSETH_CHAIN="IC"
KSETH_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KSETH_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KSETH_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSETH_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KSETH_DECIMALS=$(echo "10^${KSETH_DECIMALS}" | bc)
KSETH_KSUSDT_DECIMALS=$(echo "${KSETH_DECIMALS} / ${KSUSDT_DECIMALS}" | bc -l) # convert ksETH to ksUSDT precision
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
    on_kong = opt true;
})" | jq

# 5. Add KONG/ksUSDT pool
KONG_SYMBOL="KONG"
KONG_KSUSDT_PRICE=0.01
KONG_KSUSDT_PRICE=${KONG_KSUSDT_PRICE//_/}        # remove underscore
KONG_AMOUNT=100_000_000_000_000        # 1,000,000 KONG
KONG_AMOUNT=${KONG_AMOUNT//_/}        # remove underscore
KONG_CHAIN="IC"
KONG_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KONG_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KONG_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KONG_DECIMALS=$(echo "10^${KONG_DECIMALS}" | bc)
KONG_KSUSDT_DECIMALS=$(echo "${KONG_DECIMALS} / ${KSUSDT_DECIMALS}" | bc -l) # convert KONG to ksUSDT precision
KONG_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
KSUSDT_AMOUNT=$(echo "scale=0; ${KONG_AMOUNT} * ${KONG_KSUSDT_PRICE} / ${KONG_KSUSDT_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KONG_AMOUNT} + ${KONG_FEE}" | bc);
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
    token_0 = \"${KONG_CHAIN}.${KONG_LEDGER}\";
    amount_0 = ${KONG_AMOUNT};
    token_1 = \"${KSUSDT_CHAIN}.${KSUSDT_LEDGER}\";
    amount_1 = ${KSUSDT_AMOUNT};
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
