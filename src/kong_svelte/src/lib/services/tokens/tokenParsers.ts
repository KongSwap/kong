import { INDEXER_URL } from "$lib/constants/canisterConstants";
import { DEFAULT_LOGOS } from "./tokenLogos";
import { kongDB } from "$lib/services/db";

// For default logos, we don't need the INDEXER_URL prefix
const STATIC_ASSETS_URL = `${INDEXER_URL}`;

export const parseTokens = async (
  data: FE.Token[],
): Promise<FE.Token[]> => {
  try {
    const icTokens: FE.Token[] = await Promise.all(data.map(async (token) => {
      // Get existing token data from Dexie
      const existingToken = await kongDB.tokens
        .where('canister_id')
        .equals(token.canister_id)
        .first();

      let logoUrl: string;

      if (token.canister_id in DEFAULT_LOGOS) {
        // For default logos, use the path directly without the INDEXER_URL prefix
        logoUrl = DEFAULT_LOGOS[token.canister_id as keyof typeof DEFAULT_LOGOS];
      } else if (token?.logo_url) {
        // For dynamic logos from the indexer, use the INDEXER_URL prefix
        const originalUrl = token.logo_url;
        logoUrl = originalUrl.startsWith('http') ? originalUrl : `${STATIC_ASSETS_URL}${originalUrl.startsWith('/') ? '' : '/'}${originalUrl}`;
      } else {
        // For the default fallback logo, use the path directly
        logoUrl = DEFAULT_LOGOS.DEFAULT;
      }

      const result: FE.Token = {
        canister_id: token.canister_id,
        address: token.address || token.canister_id,
        name: token.name,
        symbol: token.symbol,
        fee: Number(token.fee),
        fee_fixed: BigInt(token.fee_fixed.replaceAll("_", "")).toString(),
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
          // Prefer existing price data from Dexie over API data
          price: existingToken?.metrics?.price || token.metrics?.price || "0",
          price_change_24h: existingToken?.metrics?.price_change_24h || token.metrics?.price_change_24h || "0",
          volume_24h: token.metrics?.volume_24h || "0",
          market_cap: token.metrics?.market_cap || "0",
          updated_at: token.metrics?.updated_at || "",
        },
        logo_url: logoUrl,
        total_24h_volume: token.metrics?.volume_24h || "0",
        // Use existing price from Dexie if available
        price: existingToken ? Number(existingToken.metrics?.price || 0) : Number(token.metrics?.price || 0),
        tvl: 0,
        balance: "0",
      };
      return result;
    }));

    return icTokens;
  } catch (error) {
    console.error('Error parsing tokens:', error);
    return [];
  }
};
