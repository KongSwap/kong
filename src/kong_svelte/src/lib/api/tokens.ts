import { API_URL } from "$lib/api/index";
import { DEFAULT_LOGOS } from "$lib/services/tokens/tokenLogos";
import { auth } from "$lib/services/auth";
import { KONG_BACKEND_CANISTER_ID } from "$lib/constants/canisterConstants";
import { canisterIDLs } from "$lib/services/auth";


interface TokensParams {
  page?: number;
  limit?: number;
  search?: string;
  canister_id?: string;
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
    const { page = 1, limit = 150, canister_id } = params || {};
    
    // Build query string for pagination
    const queryString = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      search: params?.search || '',
      canister_id: canister_id || ''
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


    options.method = 'GET';

    const response = await fetch(
      `${API_URL}/api/tokens?${queryString}`,
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
  const validCanisterIds = canisterIds.filter(id => typeof id === 'string');
  const response = await fetch(`${API_URL}/api/tokens/by_canister`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ canister_ids: validCanisterIds })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error fetching tokens:', errorText);
    throw new Error(errorText);
  }
  const data = await response.json();
  return data.items.map(parseTokenData);
};

/**
 * Adds a token to the Kong backend
 * @param token The token canister ID to add (e.g. "IC.ryjl3-tyaaa-aaaaa-aaaba-cai")
 * @returns The result of the add_token operation
 */
export const addToken = async (token: string): Promise<any> => {
  try {
    // Get the actor for the kong_backend canister
    const actor = await auth.getActor(
      KONG_BACKEND_CANISTER_ID,
      canisterIDLs.kong_backend
    );
    
    // Format the token canister ID if needed
    const formattedToken = token.startsWith("IC.") ? token : `IC.${token}`;
    
    // Call the add_token method with the token canister ID
    const result = await actor.add_token({ token: formattedToken });
    
    if ('Err' in result) {
      throw new Error(result.Err);
    }
    
    // Process the response to handle any BigInt values
    const processResponse = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      
      if (typeof obj === 'bigint') {
        return obj.toString();
      }
      
      if (Array.isArray(obj)) {
        return obj.map(processResponse);
      }
      
      if (typeof obj === 'object') {
        const newObj: Record<string, any> = {};
        for (const key in obj) {
          newObj[key] = processResponse(obj[key]);
        }
        return newObj;
      }
      
      return obj;
    };
    
    return processResponse(result.Ok);
  } catch (error) {
    console.error('Error adding token:', error);
    throw error;
  }
};

