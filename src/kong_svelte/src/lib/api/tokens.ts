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
  console.log("addToken API function called with:", token);
  try {
    // Format the token canister ID if needed
    const formattedToken = token.startsWith("IC.") ? token : `IC.${token}`;
    console.log("Formatted token for API call:", formattedToken);
    
    // Import auth dynamically to avoid circular dependencies
    const { auth } = await import("$lib/services/auth");
    console.log("Auth store imported:", auth);
    
    // Check if user is connected
    if (!auth.pnp.isWalletConnected()) {
      console.error("User is not connected to a wallet");
      throw new Error("You must be connected to a wallet to add a token");
    }
    
    // Get the actor for the kong_backend canister
    console.log("Getting actor for kong_backend canister");
    const actor = await auth.pnp.getActor(
      KONG_BACKEND_CANISTER_ID,
      canisterIDLs.kong_backend,
      { requiresSigning: false }
    );
    
    if (!actor) {
      console.error("Failed to get actor for kong_backend canister");
      throw new Error("Failed to get actor for kong_backend canister");
    }
    
    console.log("Actor obtained successfully, calling add_token method");
    
    // Call the add_token method with the token canister ID
    const result = await actor.add_token({ token: formattedToken });
    console.log("add_token result:", result);
    
    if ('Err' in result) {
      console.error("Error in add_token result:", result.Err);
      throw new Error(typeof result.Err === 'string' ? result.Err : JSON.stringify(result.Err));
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
    
    const processedResult = processResponse(result.Ok);
    console.log("Processed result:", processedResult);
    return processedResult;
  } catch (error) {
    console.error('Error adding token:', error);
    throw error;
  }
};

/**
 * Fetches metadata for a token by its canister ID
 * @param canisterId The canister ID of the token
 * @returns The token metadata or null if not found
 */
export const fetchTokenMetadata = async (canisterId: string): Promise<FE.Token | null> => {
  try {
    const { createAnonymousActorHelper } = await import("$lib/utils/actorUtils");
    const { canisterIDLs } = await import("$lib/services/auth");
    const { userTokens } = await import("$lib/stores/userTokens");
    const { get } = await import("svelte/store");
    const { toastStore } = await import("$lib/stores/toastStore");
    
    const actor = await createAnonymousActorHelper(canisterId, canisterIDLs.icrc2);
    if (!actor) {
      throw new Error('Failed to create token actor');
    }

    const [name, symbol, decimals, fee, supportedStandards, metadata, totalSupply] = await Promise.all([
      actor.icrc1_name(),
      actor.icrc1_symbol(),
      actor.icrc1_decimals(),
      actor.icrc1_fee(),
      actor.icrc1_supported_standards(),
      actor.icrc1_metadata(),
      actor.icrc1_total_supply()
    ]);

    const getLogo = (metadata: Array<[string, any]>): string => {
      for (const [key, value] of metadata) {
        if (key === 'icrc1:logo' || key === 'icrc1_logo' || key === 'icrc1:icrc1_logo') {
          // The value is an object that contains the logo data
          if (typeof value === 'object' && value !== null) {
            // Access the Text value inside the object
            const logoValue = Object.values(value)[0];
            return typeof logoValue === 'string' ? logoValue : '';
          }
        }
      }
      return '';
    };

    const tokens = get(userTokens).tokens;
    const tokenId = tokens.length + 1000;

    return {
      canister_id: canisterId,
      name: name.toString(),
      symbol: symbol.toString(),
      decimals: Number(decimals),
      address: canisterId,
      fee: fee.toString(),
      fee_fixed: fee.toString(),
      token: canisterId,
      icrc1: Object.values(supportedStandards).find((standard: any) => standard.name === "ICRC-1") ? true : false,
      icrc2: Object.values(supportedStandards).find((standard: any) => standard.name === "ICRC-2") ? true : false,
      icrc3: Object.values(supportedStandards).find((standard: any) => standard.name === "ICRC-3") ? true : false,
      pool_symbol: "",
      pools: [],
      timestamp: Date.now(),
      metrics: {
        price: "0",
        volume_24h: "0",
        total_supply: totalSupply.toString(),
        market_cap: "0",
        tvl: "0",
        updated_at: new Date().toISOString(),
        price_change_24h: "0"
      },
      balance: "0",
      logo_url: getLogo(metadata as Array<[string, any]>),
      token_type: "IC",
      token_id: tokenId,
      chain: "IC",
      total_24h_volume: "0"
    };
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    throw error;
  }
};

