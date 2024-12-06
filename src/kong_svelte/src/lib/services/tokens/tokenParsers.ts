import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID, INDEXER_URL } from "$lib/constants/canisterConstants";
import { DEFAULT_LOGOS } from "./tokenLogos";

export const parseTokens = (
  data: FE.Token[],
): FE.Token[] => {

  try {
    // Extract IC tokens and map them to FE.Token[]
    const icTokens: FE.Token[] = data.map((token) => {
      const logoUrl = token?.logo_url ? INDEXER_URL.replace("/api", "") + token.logo_url : "/tokens/not_verified.webp";

      const result = {
        canister_id: token.canister_id,
        address: token.canister_id,
        name: token.name,
        symbol: token.symbol,
        fee: Number(token.fee_fixed.replace("_", "")),
        fee_fixed: token.fee_fixed.replace("_", ""),
        decimals: token.decimals,
        token: token.token,
        token_id: token.token_id,
        chain: token.chain,
        icrc1: token.icrc1,
        icrc2: token.icrc2,
        icrc3: token.icrc3,
        on_kong: token.on_kong,
        pool_symbol: token.pool_symbol ?? "Pool not found",
        pools: [],
        metrics: {
          total_supply: token.metrics?.total_supply?.toString() || "0",
          price: token.metrics?.price || "0",
          volume_24h: token.metrics?.volume_24h || "0",
          market_cap: token.metrics?.market_cap || "0",
          updated_at: token?.metrics?.updated_at,
        },
        // Set default logo, will be updated by fetchTokenLogos
        logo_url: token.canister_id === ICP_CANISTER_ID ? DEFAULT_LOGOS[ICP_CANISTER_ID] : logoUrl,
        total_24h_volume: token.metrics?.volume_24h || 0n,
        price: 0,
        tvl: 0,
        balance: 0n,
      } as FE.Token;
      return result;
    });

    return icTokens;
  } catch (error) {
    console.error('Error parsing tokens:', error);

  }
};
