import { writable } from 'svelte/store';
import { backendService } from '$lib/services/backendService';
import { isEqual } from 'lodash-es';
import { sortPools } from '$lib/utils/poolUtils';

export type PoolsTotals = {
  totalTvl: number | string;
  totalVolume: number | string;
  totalFees: number | string;
};

export const poolsInfo = writable([]);
export const poolsTotals = writable<PoolsTotals>({
  totalTvl: 0,
  totalVolume: 0,
  totalFees: 0,
});

let previousPoolBalances: any = null;

export async function fetchPools(sortColumn = 'tvl', sortDirection: 'asc' | 'desc' = 'desc') {
  try {
    const liquidityPools = await backendService.getPools();

    if (!isEqual(previousPoolBalances, liquidityPools)) {
      poolsInfo.set(sortPools(liquidityPools, sortColumn, sortDirection));
      previousPoolBalances = liquidityPools;

      const decimals = 6;
      const formatBigInt = (value: bigint | number) => {
        if (typeof value === 'bigint') {
          return Number(value) / 10 ** decimals;
        }
        return value;
      };

      poolsTotals.set({
        totalTvl: formatBigInt(liquidityPools?.total_tvl || 0),
        totalVolume: formatBigInt(liquidityPools?.total_24h_volume || 0),
        totalFees: formatBigInt(liquidityPools?.total_24h_lp_fee || 0),
      });
    }
  } catch (error) {
    console.error('Error fetching pool balances:', error);
    // Retry logic is handled in the service
  }
} 