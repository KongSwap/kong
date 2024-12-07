import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID, INDEXER_URL } from "$lib/constants/canisterConstants";
import { DEFAULT_LOGOS } from "./tokenLogos";

const STATIC_ASSETS_URL = `${INDEXER_URL}`;

export const parseTokens = (
  data: FE.Token[],
): FE.Token[] => {

  try {
    // Extract IC tokens and map them to FE.Token[]
    const icTokens: FE.Token[] = data.map((token) => {
      const logoUrl = token?.logo_url 
        ? `${STATIC_ASSETS_URL}${token.logo_url}`
        : "/tokens/not_verified.webp";

      const result: FE.Token = {
        canister_id: token.canister_id,
        address: token.address || token.canister_id,
        name: token.name,
        symbol: token.symbol,
        fee: token.fee,
        fee_fixed: token.fee_fixed.replace("_", ""),
        decimals: token.decimals,
        token: token.token_type || '',
        token_type: token.token_type || '',
        token_id: token.token_id,
        chain: token.token_type === 'IC' ? 'ICP' : token.chain || '',
        icrc1: token.icrc1,
        icrc2: token.icrc2,
        icrc3: token.icrc3,
        on_kong: token.on_kong,
        pool_symbol: token.pool_symbol ?? "Pool not found",
        pools: [],
        metrics: {
          total_supply: token.metrics?.total_supply?.toString() || "0",
          price: token.metrics?.price || "0",
          price_change_24h: token.metrics?.price_change_24h || "0",
          volume_24h: "0",
          market_cap: token.metrics?.market_cap || "0",
          updated_at: token.metrics?.updated_at || "",
        },
        logo_url: token.canister_id === ICP_CANISTER_ID ? DEFAULT_LOGOS[ICP_CANISTER_ID] : logoUrl,
        total_24h_volume: "0",
        price: Number(token.metrics?.price || 0),
        tvl: 0,
        balance: "0",
      };
      return result;
    });

    return icTokens;
  } catch (error) {
    console.error('Error parsing tokens:', error);

  }
};
