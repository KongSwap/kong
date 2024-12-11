import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID, INDEXER_URL } from "$lib/constants/canisterConstants";
import { DEFAULT_LOGOS } from "./tokenLogos";

// For default logos, we don't need the INDEXER_URL prefix
const STATIC_ASSETS_URL = `${INDEXER_URL}`;

export const parseTokens = (
  data: FE.Token[],
): FE.Token[] => {
  try {
    const icTokens: FE.Token[] = data.map((token) => {
      let logoUrl: string;

      if (token.canister_id in DEFAULT_LOGOS) {
        // For default logos, use the path directly without the INDEXER_URL prefix
        logoUrl = DEFAULT_LOGOS[token.canister_id as keyof typeof DEFAULT_LOGOS];
        console.log(`Using default logo for ${token.symbol} (${token.canister_id}):`, logoUrl);
      } else if (token?.logo_url) {
        // For dynamic logos from the indexer, use the INDEXER_URL prefix
        const originalUrl = token.logo_url;
        logoUrl = originalUrl.startsWith('http') ? originalUrl : `${STATIC_ASSETS_URL}${originalUrl.startsWith('/') ? '' : '/'}${originalUrl}`;
      } else {
        // For the default fallback logo, use the path directly
        logoUrl = DEFAULT_LOGOS.DEFAULT;
        console.log(`Using fallback logo for ${token.symbol} (${token.canister_id}):`, logoUrl);
      }

      const result: FE.Token = {
        canister_id: token.canister_id,
        address: token.address || token.canister_id,
        name: token.name,
        symbol: token.symbol,
        fee: Number(token.fee.toString().replace("_", "")),
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
        logo_url: logoUrl,
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
    return [];
  }
};
