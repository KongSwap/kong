import { INDEXER_URL } from "$lib/constants/canisterConstants";
import { DEFAULT_LOGOS } from "./tokenLogos";
import { kongDB } from "../db";
// For default logos, we don't need the INDEXER_URL prefix
const STATIC_ASSETS_URL = `${INDEXER_URL}`;

export const parseTokens = async (
  data: FE.Token[],
): Promise<FE.Token[]> => {
  try {
    const existingTokens = await kongDB.tokens.toArray();

    const icTokens: FE.Token[] = await Promise.all(
      data.map(async (token) => {
        const existingToken = existingTokens.find(
          (t) => t.canister_id === token.canister_id
        );

        // → Use existing token's price if fresh data doesn't include one
        const freshPrice = token.metrics?.price;
        const oldPrice = existingToken?.metrics?.price;

        const mergedPrice =
          freshPrice && Number(freshPrice) !== 0
            ? freshPrice
            : oldPrice || "0";

        if (!existingToken) {
          // For brand-new tokens, you can still set price to "0" *ONLY* if
          // nothing else is available
          return {
            ...token,
            metrics: {
              ...token.metrics,
              price: mergedPrice, // preserve existing if we already had something
              price_change_24h: "0",
              volume_24h: "0",
              market_cap: "0",
              tvl: "0",
            },
            logo_url: DEFAULT_LOGOS[token.canister_id] || 
              (token?.logo_url
                ? token.logo_url.startsWith('http')
                  ? token.logo_url
                  : `${STATIC_ASSETS_URL}${token.logo_url.startsWith('/') ? '' : '/'}${token.logo_url}`
                : DEFAULT_LOGOS.DEFAULT),
            address: token.address || token.canister_id,
            fee: Number(token.fee),
            fee_fixed: BigInt(token.fee_fixed.replaceAll("_", "")).toString(),
            token: token.token_type || '',
            token_type: token.token_type || '',
            chain: token.token_type === 'IC' ? 'ICP' : token.chain || '',
            pool_symbol: token.pool_symbol ?? "Pool not found",
            pools: [],
          };
        } else {
          // Merge existing metrics when possible
          return {
            ...existingToken,
            logo_url: DEFAULT_LOGOS[token.canister_id] || 
              (token?.logo_url
                ? token.logo_url.startsWith('http')
                  ? token.logo_url
                  : `${STATIC_ASSETS_URL}${token.logo_url.startsWith('/') ? '' : '/'}${token.logo_url}`
                : DEFAULT_LOGOS.DEFAULT),
            fee: Number(token.fee),
            fee_fixed: BigInt(token.fee_fixed.replaceAll("_", "")).toString(),
            token: token.token_type || '',
            token_type: token.token_type || '',
            chain: token.token_type === 'IC' ? 'ICP' : token.chain || '',
            pool_symbol: token.pool_symbol ?? "Pool not found",
            metrics: {
              ...existingToken.metrics,
              // keep other fields from whichever is newer
            },
            total_24h_volume: existingToken?.metrics?.volume_24h || "0",
            balance: existingToken?.balance || "0",
          };
        }
      })
    );

    return icTokens;
  } catch (error) {
    console.error("Error parsing tokens:", error);
    return [];
  }
};
