#!/usr/bin/env bash

if [ -z "$1" ]
	then
		NETWORK=""
	else
		NETWORK="--network $1"
fi
IDENTITY="--identity kong_user1"	# cannot be mint account

KONG_CANISTER=$(dfx canister id ${NETWORK} kong_backend)

# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ICP", 200_000_000, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ICP", 425_500, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckUSDT", 0, "ICP")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckUSDT", 600_000_000, "ICP")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckBTC", 0, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckBTC", 155_200, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckUSDT", 0, "ckBTC")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckUSDT", 1_500_000_000, "ckBTC")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckETH", 0, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckETH", 32_467_532_467_532_500, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckUSDT", 0, "ckETH")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckUSDT", 850_000_000, "ckETH")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ICP", 0, "ckBTC")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ICP", 15_000_000, "ckBTC")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckBTC", 0, "ICP")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckBTC", 130_000, "ICP")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ICP", 0, "ckETH")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ICP", 15_000_000, "ckETH")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckETH", 0, "ICP")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckETH", 130_000_000_000_000_000, "ICP")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckBTC", 0, "ckETH")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckBTC", 250_000, "ckETH")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckETH", 0, "ckBTC")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckETH", 734_234_134_000_000_000, "ckBTC")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("IC.zw6xu-taaaa-aaaar-qaicq-cai", 1, "IC.zdzgz-siaaa-aaaar-qaiba-cai")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("IC.jzo46-yaaaa-aaaam-adlpq-cai", 100_000, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("IC.mfvg3-tiaaa-aaaam-adlqa-cai", 100_000, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ALPACALB", 500_000_000, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("KONG1", 50_000_000_000, "ICP")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ICP", 100_000_000, "KONG1")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("KONG1", 50_000_000_000, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckUSDT", 5_000_000, "KONG1")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("KONG1", 50_000_000_000, "ckUSDC")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("KONG1", 50_000_000_000, "ckBTC")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckUSDC", 5_000_000, "KONG1")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckBTC", 50_000, "KONG1")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("KONG2", 50_000_000_000, "ICP")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ICP", 100_000_000, "KONG2")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("KONG2", 50_000_000_000, "ckUSDT")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckUSDT", 5_000_000, "KONG2")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("KONG2", 50_000_000_000, "ckUSDC")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckUSDC", 5_000_000, "KONG2")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("KONG2", 50_000_000_000, "ckBTC")'
# dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("ckBTC", 50_000, "KONG2")'
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("KONG1", 50_000_000, "KONG2")'
dfx canister call ${NETWORK} ${IDENTITY} ${KONG_CANISTER} swap_amounts '("KONG2", 50_000_000, "KONG1")'