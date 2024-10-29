import { writable } from 'svelte/store';
import { backendService } from '$lib/services/backendService';
import { isEqual } from 'lodash-es';
import { formatPoolData } from '$lib/utils/statsUtils';
import { type Pool } from '$lib/types/backend';

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

/**
 * Fetches pools data from the backend, formats them, and updates the stores.
 */
export async function fetchPools() {
  try {
    const liquidityPools = await backendService.getPools();
    console.log('Fetched liquidityPools:', liquidityPools);

    if (!liquidityPools || !liquidityPools.pools) {
      console.error('Invalid liquidityPools structure:', liquidityPools);
      return;
    }

    if (!Array.isArray(liquidityPools.pools)) {
      console.error('liquidityPools.pools is not an array:', liquidityPools.pools);
      return;
    }

    if (!isEqual(previousPoolBalances, liquidityPools.pools)) {
      const formattedPools = formatPoolData(liquidityPools.pools);
      poolsInfo.set(formattedPools);
      previousPoolBalances = liquidityPools.pools;

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

      console.log('Updated poolsInfo and poolsTotals:', formattedPools, liquidityPools);
    }
  } catch (error) {
    console.error('Error fetching pool balances:', error);
  }
} 