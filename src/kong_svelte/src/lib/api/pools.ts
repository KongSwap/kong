import { INDEXER_URL } from "./index";


export const fetchPools = async (params?: any): Promise<{pools: BE.Pool[], total_count: number, total_pages: number, page: number, limit: number}> => {
  try {
    const { page = 1, limit = 50, canisterIds, search = '' } = params || {};
    
    // Build query string for pagination
    const queryString = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      search: search,
      t: Date.now().toString() // Use valid parameter name
    }).toString();

    // Determine if we need to make a GET or POST request
    const options: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (canisterIds && canisterIds.length > 0) {
      options.method = 'POST';
      options.body = JSON.stringify({ canister_ids: canisterIds });
    } else {
      options.method = 'GET';
    }

    const response = await fetch(
      `${INDEXER_URL}/api/pools?${queryString}`,
      options
    );
   
    if (!response.ok) {
      throw new Error(`Failed to fetch pools: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.items) {
      throw new Error("Invalid API response");
    }

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

export const fetchPoolTotals = async (): Promise<{total_volume_24h: number, total_tvl: number, total_fees_24h: number}> => {
  try {
    const response = await fetch(`${INDEXER_URL}/api/pools/totals`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching pool totals:', error);
    throw error;
  }
}