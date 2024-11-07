import { tokenStore } from '$lib/stores/tokenStore';
import { formatTokenAmount } from '$lib/utils/numberFormatUtils';
import { get } from 'svelte/store';

/**
 * Parses a value by removing unwanted characters and converting to a number if applicable.
 * @param value - The value to parse.
 * @returns The parsed value.
 */
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

/**
 * Sorts an array of pools based on a specified column and direction.
 * @param pools - The array of pools to sort.
 * @param column - The column to sort by.
 * @param direction - The sort direction ('asc' or 'desc').
 * @returns A new sorted array of pools.
 */
export function sortTableData(pools: any[], column: string, direction: 'asc' | 'desc'): any[] {
  if (!Array.isArray(pools)) {
    console.error('sortTableData expects an array, but received:', pools);
    return [];
  }

  return pools.slice().sort((a, b) => {
    // Special handling for pool name
    if (column === 'poolName') {
      const aName = `${a.symbol_0}/${a.symbol_1}`.toLowerCase();
      const bName = `${b.symbol_0}/${b.symbol_1}`.toLowerCase();
      return direction === 'asc' 
        ? aName.localeCompare(bName)
        : bName.localeCompare(aName);
    }

    let aValue = parseValue(a[column]);
    let bValue = parseValue(b[column]);

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
      return direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });
}

/**
 * Formats pool data by calculating APY, 24h Volume, TVL, and adding a unique ID.
 * @param pools - The array of pools to format.
 * @returns A new array of formatted pools.
 */
export function formatPoolData(pools: any[]): any[] {
  if (pools.length === 0) return pools;
  const store = get(tokenStore)


  return pools.map((pool, index) => {
    const decimals1 = store.tokens.find(t => t.canister_id === pool.address_1)?.decimals || 6;
    const balance = Number(pool.balance || 0);
    const apy = formatTokenAmount(Number(pool.rolling_24h_apy || 0), 2);
    const roll24hVolume = formatTokenAmount(
      Number(pool.rolling_24h_volume || 0) / 10 ** decimals1,
      0,
    );
    const tvl = formatTokenAmount(balance / 10 ** decimals1, 0);

    return {
      ...pool,
      id: `${pool.symbol_0}-${pool.symbol_1}-${index}`, // Unique ID
      apy,
      roll24hVolume,
      tvl,
    };
  });
}

/**
 * Filters pools based on a search query.
 * @param pools - The array of pools to filter.
 * @param query - The search query.
 * @returns A new array of filtered pools.
 */
export function filterPools(pools: any[], query: string): any[] {
  if (!query) return pools;
  const lowerQuery = query.toLowerCase();
  return pools.filter((pool) =>
    `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase().includes(lowerQuery),
  );
}

  // $lib/utils/statsUtils.ts
  export function filterTokens(tokens: any[], searchQuery: string): any[] {
    if (!searchQuery) {
      return tokens;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return tokens.filter(token =>
      token.symbol.toLowerCase().includes(lowerCaseQuery) ||
      token.name.toLowerCase().includes(lowerCaseQuery)
    );
  }
