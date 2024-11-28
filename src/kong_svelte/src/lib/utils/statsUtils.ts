import { tokenStore } from '$lib/services/tokens/tokenStore';
import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
import { get } from 'svelte/store';
import BigNumber from 'bignumber.js';

type Token = {
  symbol: string;
  name: string;
  canister_id: string;
  decimals: number;
  [key: string]: any;
};

/**
 * Parses a value by removing unwanted characters and converting to a number if applicable.
 * @param value - The value to parse.
 * @returns The parsed value.
 */
export function parseValue(value: any): any {
  if (typeof value === 'string') {
    value = value.replace(/[$%,]/g, '');
    return value.includes('%') ? parseFloat(value) : parseFloat(value) || value;
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
export function sortTableData<T extends Record<string, any>>(
  data: T[],
  column: string,
  direction: 'asc' | 'desc'
): T[] {
  if (!Array.isArray(data)) {
    console.error('sortTableData expects an array, but received:', data);
    return [];
  }

  return [...data].sort((a, b) => {
    let aValue = a[column];
    let bValue = b[column];

    // Handle special cases for different columns
    switch (column) {
      case 'total_24h_volume':
      case 'rolling_24h_volume':
        // Convert BigInt to number
        aValue = Number(aValue || 0n);
        bValue = Number(bValue || 0n);
        break;

      case 'formattedUsdValue':
      case 'price':
      case 'tvl':
        // Remove $ and , from string numbers and convert to float
        aValue = parseFloat(String(aValue || '0').replace(/[$,]/g, ''));
        bValue = parseFloat(String(bValue || '0').replace(/[$,]/g, ''));
        break;

      case 'rolling_24h_apy':
        // Remove % and convert to float
        aValue = parseFloat(String(aValue || '0').replace(/%/g, ''));
        bValue = parseFloat(String(bValue || '0').replace(/%/g, ''));
        break;

      case 'symbol':
      case 'name':
        // Case-insensitive string comparison
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
        break;

      default:
        // Handle compound columns (like pool names)
        if (column === 'poolName') {
          aValue = `${a.symbol_0}/${a.symbol_1}`.toLowerCase();
          bValue = `${b.symbol_0}/${b.symbol_1}`.toLowerCase();
        }
    }

    // Perform the comparison
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Formats pool data by calculating APY, 24h Volume, TVL, and adding a unique ID.
 * @param pools - The array of pools to format.
 * @returns A new array of formatted pools.
 */
export function formatPoolData(pools: BE.Pool[]): BE.Pool[] {
  if (pools.length === 0) return pools;
  const store = get(tokenStore);

  return pools.map((pool, index) => {
    const token = store.tokens.find(t => t.canister_id === pool.address_1);
    const decimals1 = 6;
    const balance = pool.balance || 0;
    const apy = formatToNonZeroDecimal(pool.rolling_24h_apy);
    console.log("formatPoolData", {
      symbol: token?.symbol,
      decimals: decimals1,
      balance,
    });
    const tvl = new BigNumber(balance.toString()).div(10 ** decimals1);

    return {
      ...pool,
      id: `${pool.symbol_0}-${pool.symbol_1}-${index}`,
      apy,
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
export function filterPools(pools: BE.Pool[], query: string): BE.Pool[] {
  if (!query) return pools;
  const lowerQuery = query.toLowerCase();
  return pools.filter(pool =>
    `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Filters tokens based on a search query.
 * @param tokens - The array of tokens to filter.
 * @param searchQuery - The search query.
 * @returns A new array of filtered tokens.
 */
export function filterTokens(tokens: Token[], searchQuery: string): Token[] {
  if (!searchQuery) return tokens;
  const lowerCaseQuery = searchQuery.toLowerCase();
  return tokens.filter(token =>
    token.symbol.toLowerCase().includes(lowerCaseQuery) ||
    token.name.toLowerCase().includes(lowerCaseQuery)
  );
}
