import { INDEXER_URL } from "./index";
import { DEFAULT_LOGOS } from "$lib/services/tokens/tokenLogos";


interface TokensParams {
  page?: number;
  limit?: number;
  search?: string;
  canisterIds?: string[];
}

const parseTokenData = (token: any): FE.Token => {
  return {
    ...token,
    metrics: {
      ...token.metrics,
      price: token?.metrics?.price,
      volume_24h: token?.metrics?.volume_24h,
      total_supply: token?.metrics?.total_supply,
      market_cap: token?.metrics?.market_cap,
      tvl: token?.metrics?.tvl,
      updated_at: token?.metrics?.updated_at,
      price_change_24h: token?.metrics?.price_change_24h
    },
    logo_url: token?.logo_url || DEFAULT_LOGOS[token.canister_id],
    address: token.address || token.canister_id,
    fee: Number(token.fee || 0),
    fee_fixed: BigInt(token?.fee_fixed?.replaceAll("_", "") || "0").toString(),
    token: token.token_type || '',
    token_type: token.token_type || '',
    chain: token.token_type === 'IC' ? 'ICP' : token.chain || '',
    pool_symbol: token.pool_symbol ?? "Pool not found",
    pools: [],
  };
};

export const fetchTokens = async (params?: TokensParams): Promise<{tokens: FE.Token[], total_count: number}> => {
  try {
    const { page = 1, limit = 150, canisterIds } = params || {};
    
    // Build query string for pagination
    const queryString = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      search: params?.search || '',
      t: Date.now().toString() // Use valid parameter name
    }).toString();

    // Determine if we need to make a GET or POST request
    const options: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    };

    if (canisterIds && canisterIds.length > 0) {
      options.method = 'POST';
      options.body = JSON.stringify({ canister_ids: canisterIds });
    } else {
      options.method = 'GET';
    }

    const response = await fetch(
      `${INDEXER_URL}/api/tokens?${queryString}`,
      options
    );
   
    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tokens = data?.items || data;    
    const updatedTokens = tokens.map(parseTokenData);

    return {
      tokens: updatedTokens,
      total_count: data.total_count || tokens.length
    };
  } catch (error) {
    console.error('Error fetching tokens:', error);
    throw error;
  }
};

export const fetchTokensByCanisterId = async (canisterIds: string[]): Promise<FE.Token[]> => {
  const response = await fetch(`${INDEXER_URL}/api/tokens/by_canister`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ canister_ids: canisterIds })
  });
  const data = await response.json();
  return data.items.map(parseTokenData);
};
