import { API_URL } from "$lib/api/index";
import { KONG_BACKEND_CANISTER_ID } from "$lib/constants/canisterConstants";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import {canisterIDLs } from "$lib/services/auth";

export const fetchPools = async (params?: any): Promise<{pools: BE.Pool[], total_count: number, total_pages: number, page: number, limit: number}> => {
  try {
    const { page = 1, limit = 50, canisterIds, search = '' } = params || {};
    
    // Build query string for pagination and filters
    const queryParams: Record<string, string> = {
      page: page.toString(),
      limit: limit.toString(),
      t: Date.now().toString() // Cache busting
    };
    
    // Add search if provided
    if (search) {
      queryParams.search = search;
    }
    
    // Add canister_id if provided
    if (canisterIds && canisterIds.length > 0) {
      queryParams.canister_id = canisterIds[0];
    }
    
    const queryString = new URLSearchParams(queryParams).toString();

    // Strictly use GET method with no request body
    console.log(`Requesting: GET ${API_URL}/api/pools?${queryString}`);
    
    const response = await fetch(
      `${API_URL}/api/pools?${queryString}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    );
   
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error response: ${errorText}`);
      throw new Error(`Failed to fetch pools: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.items) {
      throw new Error("Invalid API response");
    }

    // Log response for debugging
    console.log(`API response received:`, data);

    // Helper function: Remove underscores and convert to a numeric value.
    const parseNumericString = (value: string | number): number => {
      if (typeof value === 'number') {
        return value;
      }
      return parseFloat(value.replace(/_/g, ''));
    };

    // Helper function: Parse a single pool data item.
    const parsePoolData = (item: any): BE.Pool => {
      const pool = item.pool;

      // If a StablePool raw_json exists, then parse its numeric fields.
      if (pool.raw_json && pool.raw_json.StablePool) {
        const stablePool = pool.raw_json.StablePool;
        const numericFields = [
          'balance_0',
          'balance_1',
          'lp_fee_0',
          'lp_fee_1',
          'rolling_24h_volume',
          'rolling_24h_lp_fee',
          'rolling_24h_num_swaps',
          'tvl',
          'kong_fee_0',
          'kong_fee_1'
        ];
        numericFields.forEach(field => {
          if (stablePool[field] !== undefined && typeof stablePool[field] === 'string') {
            stablePool[field] = parseNumericString(stablePool[field]);
          }
        });
        pool.raw_json.StablePool = stablePool;
      }

      // Return a flat structure combining pool data with token details.
      return {
        ...pool,
        symbol_0: item.token0?.symbol,
        address_0: item.token0?.canister_id,
        symbol_1: item.token1?.symbol,
        address_1: item.token1?.canister_id,
        token0: item.token0,
        token1: item.token1
      } as BE.Pool;
    };

    const transformedItems = data.items.map(parsePoolData);

    // Compute pagination info
    const currentPage = page;
    const currentLimit = limit;
    const total_count = data.total_count || transformedItems.length;
    const total_pages = data.total_pages || Math.ceil(total_count / currentLimit);

    return {
      pools: transformedItems,
      total_count,
      total_pages,
      page: currentPage,
      limit: currentLimit
    };
  } catch (error) {
    console.error('Error fetching pools:', error);
    throw error;
  }
};

export const fetchPoolBalanceHistory = async (poolId: string | number): Promise<any> => {
  try {
    // Use the exact endpoint without any query parameters
    const endpoint = `${API_URL}/api/pools/${poolId}/balance-history`;
    console.log('Calling pool balance history endpoint:', endpoint);
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Try to get more information about the error
      let errorInfo = '';
      try {
        const errorData = await response.text();
        errorInfo = errorData ? ` - ${errorData}` : '';
      } catch (e) {
        // Ignore error parsing error
      }
      
      throw new Error(`Failed to fetch pool balance history: ${response.status} ${response.statusText}${errorInfo}`);
    }
    
    const data = await response.json();
    
    // Log the first item to help debug
    if (Array.isArray(data) && data.length > 0) {
      console.log('Sample balance history item:', data[0]);
    } else {
      console.log('Empty or unexpected response format:', data);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching pool balance history:', error);
    throw error;
  }
};

export const fetchPoolTotals = async (): Promise<{total_volume_24h: number, total_tvl: number, total_fees_24h: number}> => {
  try {
    const response = await fetch(`${API_URL}/api/pools/totals`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching pool totals:', error);
    throw error;
  }
}


  /**
   * Calculate required amounts for adding liquidity
   */
  export async function calculateLiquidityAmounts(
    token0Symbol: string,
    amount0: bigint,
    token1Symbol: string,
  ): Promise<any> {
    try {
      const actor = createAnonymousActorHelper(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
      );
      const result = await actor.add_liquidity_amounts(
        "IC." + token0Symbol,
        amount0,
        "IC." + token1Symbol,
      );

      if (!result.Ok) {
        throw new Error(result.Err || "Failed to calculate liquidity amounts");
      }

      return result;
    } catch (error) {
      console.error("Error calculating liquidity amounts:", error);
      throw error;
    }
  }
