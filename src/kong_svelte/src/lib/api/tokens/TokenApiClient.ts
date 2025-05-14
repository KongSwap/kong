// Import the API_URL from '../index';
import { IcrcTokenSerializer } from '$lib/serializers/tokens/IcrcTokenSerializer';
import type { 
  TokensParams, 
  TokensResponse, 
  ProcessedTokensResponse,
  TokensByCanisterRequest,
  TokensByCanisterResponse,
  RawTokenData
} from './types';
import { ApiClient } from '../base/ApiClient';
import { API_URL } from '../index';
import { browser } from '$app/environment';
import { auth, faucetActor } from '$lib/stores/auth';
import { toastStore } from '$lib/stores/toastStore';
import { userTokens } from '$lib/stores/userTokens';
import { get } from 'svelte/store';
import { canisters, type CanisterType } from '$lib/config/auth.config';
import { icrcActor } from '$lib/stores/auth';

// Lazy initialization of API client to prevent SSR issues
const getApiClient = () => {
  return new ApiClient(API_URL);
};

/**
 * Fetches tokens with optional filtering and pagination
 */
export const fetchTokens = async (params?: TokensParams): Promise<ProcessedTokensResponse> => {
  try {
    // Ensure we're in a browser environment
    if (!browser) {
      throw new Error("API calls can only be made in the browser");
    }
    
    const apiClient = getApiClient();
    
    // Convert params to string values for URLSearchParams
    const queryParams: Record<string, string> = {};
    if (params) {
      if (params.page !== undefined) queryParams.page = params.page.toString();
      if (params.limit !== undefined) queryParams.limit = params.limit.toString();
      if (params.search) queryParams.search = params.search;
      if (params.canister_id) queryParams.canister_id = params.canister_id;
    }

    // Make the API request using the base client
    const data = await apiClient.get<TokensResponse | RawTokenData[]>('/api/tokens', queryParams);
    
    // Handle different response formats
    let tokens: RawTokenData[];
    let page = params?.page || 1;
    let limit = params?.limit || 150;
    let total_count = 0;
    let total_pages = 1;
    
    if (Array.isArray(data)) {
      // Handle array response
      tokens = data;
      total_count = tokens.length;
    } else {
      // Handle paginated response
      tokens = data.items || [];
      page = data.page || page;
      limit = data.limit || limit;
      total_count = data.total_count || tokens.length;
      total_pages = data.total_pages || Math.ceil(total_count / limit);
    }
    
    // Serialize the tokens
    const serializedTokens = IcrcTokenSerializer.serializeTokens(tokens);

    // Return the processed response
    return {
      tokens: serializedTokens,
      total_count,
      page,
      limit,
      total_pages
    };
  } catch (error) {
    console.error('Error fetching tokens:', error);
    throw error;
  }
};

/**
 * Fetches all tokens with pagination handling
 * Use this when you need all tokens regardless of pagination limits
 */
export const fetchAllTokens = async (params?: Omit<TokensParams, 'page' | 'limit'>): Promise<Kong.Token[]> => {
  try {
    // Ensure we're in a browser environment
    if (!browser) {
      throw new Error("API calls can only be made in the browser");
    }
    
    const apiClient = getApiClient();

    // First request to get total count and pages
    const initialResponse = await fetchTokens({
      ...params,
      page: 1,
      limit: 150
    });
    
    // If only one page or no data, return immediately
    if (initialResponse.total_pages <= 1 || initialResponse.total_count === 0) {
      return initialResponse.tokens;
    }
    
    // Prepare requests for remaining pages
    const pageRequests = Array.from(
      { length: initialResponse.total_pages - 1 },
      (_, i) => fetchTokens({
        ...params,
        page: i + 2,
        limit: 150
      })
    );
    
    // Execute all requests in parallel
    const responses = await Promise.all(pageRequests);
    
    // Combine all tokens
    return [
      ...initialResponse.tokens,
      ...responses.flatMap(response => response.tokens)
    ];
  } catch (error) {
    console.error('Error fetching all tokens:', error);
    throw error;
  }
};

/**
 * Fetches tokens by canister IDs
 */
export const fetchTokensByCanisterId = async (canisterIds: string[]): Promise<Kong.Token[]> => {
  try {
    // Ensure we're in a browser environment
    if (!browser) {
      throw new Error("API calls can only be made in the browser");
    }
    
    const apiClient = getApiClient();
    
    // Validate input
    const validCanisterIds = canisterIds.filter(id => typeof id === 'string');
    
    if (validCanisterIds.length === 0) {
      return [];
    }
    
    // Prepare request body
    const requestBody: TokensByCanisterRequest = {
      canister_ids: validCanisterIds
    };
    
    // Make the API request using the base client
    const data = await apiClient.post<TokensByCanisterResponse | RawTokenData[]>(
      '/api/tokens/by_canister', 
      requestBody
    );
    
    // Handle different response formats
    const tokens = Array.isArray(data) ? data : data.items || [];
    
    // Serialize the tokens
    return IcrcTokenSerializer.serializeTokens(tokens);
  } catch (error) {
    console.error('Error fetching tokens by canister ID:', error);
    throw error;
  }
};

/**
 * Adds a new token by canister ID
 */
export const addToken = async (canisterId: string): Promise<any> => {
  try {
    // Ensure we're in a browser environment
    if (!browser) {
      throw new Error("API calls can only be made in the browser");
    }
    
    const apiClient = getApiClient();
    
    // Make the API request using the base client
    const data = await apiClient.post('/api/tokens/add', { canister_id: canisterId });
    return data;
  } catch (error) {
    console.error('Error adding token:', error);
    throw error;
  }
};

/**
 * Claims tokens from the faucet
 */
export const faucetClaim = async (): Promise<void> => {
  const actor = faucetActor({anon: false, requiresSigning: false});
  const result = await actor.claim();

  if ('Ok' in result) {
    toastStore.success("Tokens minted successfully");
  } else {
    console.error("Error minting tokens:", result.Err);
    toastStore.error("Error minting tokens");
  }
}

/**
 * Fetches token metadata from a canister
 */
export const fetchTokenMetadata = async (canisterId: string): Promise<Kong.Token | null> => {
  try {
    // Ensure we're in a browser environment
    if (!browser) {
      throw new Error("API calls can only be made in the browser");
    }

    const actor = icrcActor({canisterId, anon: true});
    if (!actor) {
      throw new Error('Failed to create token actor');
    }

    // Fetch token data from the canister
    const tokenData = await fetchTokenDataFromCanister(actor);
    const tokens = get(userTokens).tokens;
    const tokenId = tokens.length + 1000;

    // Create raw token data
    const rawTokenData = createRawTokenData(canisterId, tokenData, tokenId);

    // Use the TokenSerializer to process the token data
    return IcrcTokenSerializer.serializeTokenMetadata(rawTokenData);
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    toastStore.error('Error fetching token metadata');
    return null;
  }
};

/**
 * Fetches token data from a canister
 * @private
 */
const fetchTokenDataFromCanister = async (actor: any): Promise<any> => {
  const [name, symbol, decimals, fee, supportedStandards, metadata, totalSupply] = await Promise.all([
    actor.icrc1_name(),
    actor.icrc1_symbol(),
    actor.icrc1_decimals(),
    actor.icrc1_fee(),
    actor.icrc1_supported_standards(),
    actor.icrc1_metadata(),
    actor.icrc1_total_supply()
  ]);

  return { name, symbol, decimals, fee, supportedStandards, metadata, totalSupply };
};

/**
 * Creates raw token data object
 * @private
 */
const createRawTokenData = (canisterId: string, tokenData: any, tokenId: number): any => {
  const { name, symbol, decimals, fee, supportedStandards, metadata, totalSupply } = tokenData;

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
    logo_url: IcrcTokenSerializer.extractLogoFromMetadata(metadata as Array<[string, any]>),
    token_type: "IC",
    token_id: tokenId,
    chain: "IC",
    total_24h_volume: "0"
  };
};
