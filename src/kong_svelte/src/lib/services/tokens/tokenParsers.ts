import { INDEXER_URL } from "$lib/constants/canisterConstants";
import { DEFAULT_LOGOS } from "./tokenLogos";
import { kongDB } from "../db";
// For default logos, we don't need the INDEXER_URL prefix
const STATIC_ASSETS_URL = `${INDEXER_URL}`;

export const parseTokens = async (
  data: {tokens: FE.Token[], total: number},
): Promise<FE.Token[]> => {
  try {
    const existingTokens = await kongDB.tokens.toArray();
    const icTokens: FE.Token[] = await Promise.all(data.tokens.map(async (token) => {
      const logoUrl = DEFAULT_LOGOS[token.canister_id] || 
        (token?.logo_url
          ? token.logo_url.startsWith('http')
            ? token.logo_url
            : `${STATIC_ASSETS_URL}${token.logo_url.startsWith('/') ? '' : '/'}${token.logo_url}`
          : DEFAULT_LOGOS.DEFAULT);

      const existingToken = existingTokens.find(t => t.canister_id === token.canister_id);
      let result: FE.Token;
      if (!existingToken) {
        result = {
          ...token,
          metrics: {
            ...token.metrics,
            price: "0",
            tvl: "0",
            price_change_24h: "0",
            volume_24h: "0",
            market_cap: "0",
          },
          logo_url: logoUrl,
          address: token.address || token.canister_id,
          fee: Number(token.fee),
          fee_fixed: BigInt(token.fee_fixed.replaceAll("_", "")).toString(),
          token: token.token_type || '',
          token_type: token.token_type || '',
          chain: token.token_type === 'IC' ? 'ICP' : token.chain || '',
          pool_symbol: token.pool_symbol ?? "Pool not found",
          pools: [],
        };
        return result;
      } else {
        result = {
          ...existingToken,
          logo_url: logoUrl,
          fee: Number(token.fee),
          fee_fixed: BigInt(token.fee_fixed.replaceAll("_", "")).toString(),
          token: token.token_type || '',
          token_type: token.token_type || '',
          chain: token.token_type === 'IC' ? 'ICP' : token.chain || '',
          pool_symbol: token.pool_symbol ?? "Pool not found",
          metrics: {
            total_supply: token.metrics?.total_supply?.toString() || "0",
            price: existingToken?.metrics?.price || "0",
            tvl: existingToken?.metrics?.tvl || "0",
            price_change_24h: existingToken?.metrics?.price_change_24h || "0",
            volume_24h: existingToken?.metrics?.volume_24h || "0",
            market_cap: existingToken?.metrics?.market_cap || "0",
            updated_at: existingToken?.metrics?.updated_at || Date.now().toString(),
          },
          total_24h_volume: existingToken?.metrics?.volume_24h || "0",
          balance: existingToken?.balance || "0",
        };
        return result;
      }
    }));
    return icTokens;
  } catch (error) {
    console.error('Error parsing tokens:', error);
    return [];
  }
};
