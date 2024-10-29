import { getTokenDecimals } from '$lib/utils/formatNumberCustom';
import { formatNumberCustom } from '$lib/utils/formatNumberCustom';

export function parseValue(value: any): any {
  if (typeof value === 'string') {
    value = value.replace(/[$%,]/g, '');
    if (value.includes('%')) {
      return parseFloat(value);
    }
    return isNaN(parseFloat(value)) ? value : parseFloat(value);
  }
  return value;
}

export function sortPools(pools: any[], column: string, direction: 'asc' | 'desc'): any[] {
  return pools.slice().sort((a, b) => {
    let aValue = parseValue(a[column]);
    let bValue = parseValue(b[column]);

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });
}

export function formatPoolData(pools: any[], tokens: any): any[] {
  if (pools.length === 0 || !tokens) return pools;

  const decimals1 = getTokenDecimals(pools[0]?.symbol_1) || 6;

  return pools.map((pool) => {
    const balance = Number(pool.balance || 0);
    const apy = formatNumberCustom(Number(pool.rolling_24h_apy || 0), 2);
    const roll24hVolume = formatNumberCustom(
      Number(pool.rolling_24h_volume || 0) / 10 ** decimals1,
      0,
    );
    const tvl = formatNumberCustom(balance / 10 ** decimals1, 0);

    return {
      ...pool,
      apy,
      roll24hVolume,
      tvl,
    };
  });
}

export function filterPools(pools: any[], query: string): any[] {
  if (!query) return pools;
  const lowerQuery = query.toLowerCase();
  return pools.filter((pool) =>
    `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase().includes(lowerQuery),
  );
}