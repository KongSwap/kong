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

# 2. Add ksICP/ksUSDT pool
IDENTITY="--identity kong_user1"

KSICP_SYMBOL="ksICP"
KSICP_KSUSDT_PRICE=7.50
KSICP_KSUSDT_PRICE=${KSICP_KSUSDT_PRICE//_/}        # remove underscore
KSICP_AMOUNT=500_000_000_000            # 5,000 ksICP
KSICP_AMOUNT=${KSICP_AMOUNT//_/}        # remove underscore
KSICP_CHAIN="IC"
KSICP_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KSICP_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KSICP_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KSICP_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KSICP_DECIMALS=$(echo "10^${KSICP_DECIMALS}" | bc)
KSICP_KSUSDT_DECIMALS=$(echo "${KSICP_DECIMALS} / ${KSUSDT_DECIMALS}" | bc -l) # convert ksICP to ksUSDT precision
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

# 6. Add KONG/ksICP pool
KONG_SYMBOL="KONG"
KONG_KSICP_PRICE=0.001333
KONG_KSICP_PRICE=${KONG_KSICP_PRICE//_/}  # remove underscore
KONG_AMOUNT=100_000_000_000_000        # 1,000,000 KONG
KONG_AMOUNT=${KONG_AMOUNT//_/}        # remove underscore
KONG_CHAIN="IC"
KONG_LEDGER=$(dfx canister id ${NETWORK} ${IDENTITY} $(echo ${KONG_SYMBOL} | tr '[:upper:]' '[:lower:]')_ledger)
KONG_DECIMALS=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc1_decimals '()' | awk -F"[^0-9]*" '{print $2}')
KONG_DECIMALS=$(echo "10^${KONG_DECIMALS}" | bc)
KONG_KSICP_DECIMALS=$(echo "${KONG_DECIMALS} / ${KSICP_DECIMALS}" | bc -l) # convert KONG to ksICP precision
KONG_FEE=$(dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc1_fee "()" | awk -F'[:]+' '{print $1}' | awk '{gsub(/\(/, ""); print}')
KONG_FEE=${KONG_FEE//_/}
KSICP_AMOUNT=$(echo "scale=0; ${KONG_AMOUNT} * ${KONG_KSICP_PRICE} / ${KONG_KSICP_DECIMALS}" | bc -l)
EXPIRES_AT=$(echo "$(date +%s)*1000000000 + 60000000000" | bc)  # 60 seconds from now

dfx canister call ${NETWORK} ${IDENTITY} ${KONG_LEDGER} icrc2_approve "(record {
    amount = $(echo "${KONG_AMOUNT} + ${KONG_FEE}" | bc);
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
    token_0 = \"${KONG_CHAIN}.${KONG_LEDGER}\";
    amount_0 = ${KONG_AMOUNT};
    token_1 = \"${KSICP_CHAIN}.${KSICP_LEDGER}\";
    amount_1 = ${KSICP_AMOUNT};
    on_kong = opt true;
})" | jq
