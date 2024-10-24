NETWORK="--network ic"
IDENTITY="--identity jlee"
KONG_PRINCIPAL_ID=$(dfx identity ${NETWORK} --identity kong get-principal)

# 100_000_000 for gas fee
dfx cycles transfer ${NETWORK} ${IDENTITY} ${KONG_PRINCIPAL_ID} 1_399_500_000_000