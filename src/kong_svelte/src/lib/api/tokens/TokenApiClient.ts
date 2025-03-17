// Import the API_URL from '../index';
import { TokenSerializer } from '$lib/serializers/TokenSerializer';
import type { 
  TokensParams, 
  TokensResponse, 
  ProcessedTokensResponse,
  TokensByCanisterRequest,
  TokensByCanisterResponse,
  RawTokenData
} from './types';

// Create a single instance of the base API client for HTTP operations
import { ApiClient } from '../base/ApiClient';
import { API_URL } from '../index';
import { browser } from '$app/environment';

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
    const serializedTokens = TokenSerializer.serializeTokens(tokens);

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
export const fetchAllTokens = async (params?: Omit<TokensParams, 'page' | 'limit'>): Promise<FE.Token[]> => {
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
export const fetchTokensByCanisterId = async (canisterIds: string[]): Promise<FE.Token[]> => {
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
    return TokenSerializer.serializeTokens(tokens);
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