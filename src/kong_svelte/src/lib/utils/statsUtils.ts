import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
import { userTokens } from '$lib/stores/userTokens';
import { get } from 'svelte/store';
import BigNumber from 'bignumber.js';

export type EnhancedToken = FE.Token & {
  marketCapRank?: number;
  volumeRank?: number;
  isHot?: boolean;
};

export function getPriceChangeClass(token: FE.Token): string {
  if (!token?.metrics?.price_change_24h) return '';
  const change = Number(token?.metrics?.price_change_24h);
  if (change > 0) return 'text-kong-accent-green';
  if (change < 0) return 'text-kong-accent-red';
  return '';
}

export async function formatPoolData(pools: BE.Pool[]): Promise<BE.Pool[]> {
  if (pools.length === 0) return pools;
  const poolsMap = await Promise.all(pools.map(async (pool, index) => {
    const apy = formatToNonZeroDecimal(pool.rolling_24h_apy);
    const userTokensStore = get(userTokens);
    const baseToken = userTokensStore.tokens.find(t => t.canister_id === pool.address_1);
    return {
      ...pool,
      price_usd: (Number(pool.price) * Number(baseToken?.metrics.price)).toString(),
      id: `${pool.symbol_0}-${pool.symbol_1}-${index}`,
      apy,
    };
  }));
  return poolsMap;
}

export function filterPools(pools: BE.Pool[], query: string): BE.Pool[] {
  if (!query) return pools;
  const lowerQuery = query.toLowerCase();
  return pools.filter(pool =>
    `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase().includes(lowerQuery),
  );
}

export function filterTokens(tokens: FE.Token[], searchQuery: string): FE.Token[] {
  if (!searchQuery) return tokens;
  const lowerCaseQuery = searchQuery.toLowerCase();
  return tokens.filter(token =>
    token.symbol.toLowerCase().includes(lowerCaseQuery) ||
    token.name.toLowerCase().includes(lowerCaseQuery)
  );
}

export function getPoolPriceUsd(pool: BE.Pool): number {
  if (!pool) return 0;
  let balance0 = new BigNumber(pool.balance_0.toString());
  let balance1 = new BigNumber(pool.balance_1.toString());
  let lpFee0 = new BigNumber(pool.lp_fee_0.toString());
  let lpFee1 = new BigNumber(pool.lp_fee_1.toString());
  let poolPrice = new BigNumber((balance1.plus(lpFee1)).div(balance0.plus(lpFee0)));
  return poolPrice.toNumber();
}
