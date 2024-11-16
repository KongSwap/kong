export const parseTokens = (
  data: Result<BE.Token[]>,
): Result<FE.Token[]> => {
  if (data.Err) return { Err: data.Err };
  try {
    // Extract IC tokens and map them to FE.Token[]
    const icTokens: FE.Token[] = data.Ok.filter(
      (token): token is { IC: BE.ICToken } => token.IC !== undefined,
    ).map((token) => {
      const icToken = token.IC;
      return {
        canister_id: icToken.canister_id,
        name: icToken.name,
        symbol: icToken.symbol,
        fee: icToken.fee,
        decimals: icToken.decimals,
        token: icToken.token,
        token_id: icToken.token_id,
        chain: icToken.chain,
        icrc1: icToken.icrc1,
        icrc2: icToken.icrc2,
        icrc3: icToken.icrc3,
        on_kong: icToken.on_kong,
        pool_symbol: icToken.pool_symbol ?? "Pool not found",
        pools: [],
        // Optional fields
        logo: "/tokens/not_verified.webp",
        total_24h_volume: 0n,
        price: 0,
        tvl: 0,
        balance: 0n,
      } as FE.Token;
    });

    return { Ok: icTokens };
  } catch (error) {
    return {
      Err: error instanceof Error ? error.message : "Failed to serialize token",
    };
  }
};
