import { writable, get } from 'svelte/store';
import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
import { Principal } from "@dfinity/principal";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { formatBalance } from "$lib/utils/numberFormatUtils";
import { walletPoolListStore } from '$lib/stores/walletPoolListStore';

// Define types
export interface TokenBalance {
  in_tokens: bigint;
  in_usd: string;
}

export interface WalletData {
  tokens: FE.Token[];
  balances: Record<string, TokenBalance>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  currentWallet: string | null;
}

// Create stores
const initialState: WalletData = {
  tokens: [],
  balances: {},
  isLoading: false,
  error: null,
  lastUpdated: null,
  currentWallet: null,
};

// Create the store
export const walletDataStore = writable<WalletData>(initialState);

// Track initialization to prevent concurrent requests
let initializationInProgress = false;
let lastInitializedWallet: string | null = null;
let initializationPromise: Promise<void> | null = null;

// Token cache to avoid reloading tokens for every wallet
let tokenCache: {
  tokens: FE.Token[];
  lastUpdated: number | null;
} = {
  tokens: [],
  lastUpdated: null
};

// Helper function for delay
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Cache expiration time in milliseconds (1 hour)
const TOKEN_CACHE_EXPIRY = 60 * 1000;

/**
 * WalletDataService - Centralized service for managing wallet token data
 * 
 * This service consolidates the token fetching logic that was previously
 * duplicated across multiple files. It provides methods for loading tokens,
 * balances, and managing the wallet data state.
 */
export class WalletDataService {
  /**
   * Initialize wallet data for a specific principal ID
   * This loads both tokens and balances if available
   */
  public static async initializeWallet(principalId: string): Promise<void> {
    if (!principalId || principalId === "anonymous") {
      console.log('No principal ID or anonymous user');
      walletDataStore.update(state => ({
        ...state,
        tokens: [],
        balances: {},
        currentWallet: null,
        isLoading: false,
        error: null
      }));
      return;
    }

    // If the wallet has changed, reset the store first
    const currentState = get(walletDataStore);
    if (currentState.currentWallet && currentState.currentWallet !== principalId) {
      console.log(`Wallet changed from ${currentState.currentWallet} to ${principalId}, resetting wallet data`);
      this.reset();
      
      // Also reset the wallet pool list store
      walletPoolListStore.reset();
    }

    // If initialization for this wallet is already in progress, return the existing promise
    if (initializationInProgress && lastInitializedWallet === principalId && initializationPromise) {
      console.log(`Initialization already in progress for wallet ${principalId}, returning existing promise`);
      return initializationPromise;
    }
    
    // Prevent starting a new initialization if we're already loading for this wallet
    if (currentState.isLoading && currentState.currentWallet === principalId) {
      console.log(`Already loading wallet data for ${principalId}, skipping redundant initialization`);
      return;
    }

    // Set initialization flags
    initializationInProgress = true;
    lastInitializedWallet = principalId;
    
    // Update store to indicate loading
    walletDataStore.update(state => ({
      ...state,
      isLoading: true,
      error: null,
      currentWallet: principalId, // Set current wallet immediately
      // Preserve tokens if available, clear balances
      tokens: state.tokens.length > 0 ? state.tokens : [],
      balances: {}
    }));

    // Create a promise for this initialization
    initializationPromise = new Promise<void>(async (resolve) => {
      try {
        console.log(`Starting initialization for wallet ${principalId}`);

        // Load tokens first - use cache if available and not expired
        let tokens: FE.Token[] = [];
        
        if (
          tokenCache.tokens.length > 0 && 
          tokenCache.lastUpdated && 
          Date.now() - tokenCache.lastUpdated < TOKEN_CACHE_EXPIRY
        ) {
          console.log('Using cached tokens');
          tokens = tokenCache.tokens;
        } else {
          console.log('Token cache expired or empty, loading fresh tokens');
          tokens = await this.loadAllTokens();
          // Update the token cache
          tokenCache = {
            tokens,
            lastUpdated: Date.now()
          };
        }
        
        // Update store with tokens
        walletDataStore.update(state => ({
          ...state,
          tokens,
          lastUpdated: Date.now()
        }));

        // Always attempt to fetch balances regardless of auth state
        if (tokens.length > 0) {
          try {
            const balances = await this.loadWalletBalances(principalId, tokens);
            
            // Update store with balances
            walletDataStore.update(state => ({
              ...state,
              balances,
              lastUpdated: Date.now()
            }));
          } catch (balanceError) {
            console.warn("Error loading balances, but continuing with tokens:", balanceError);
            
            // Set a more specific error for balances, but don't fail completely
            walletDataStore.update(state => ({
              ...state,
              error: balanceError instanceof Error 
                ? `Balance loading error: ${balanceError.message}` 
                : "Failed to load token balances"
            }));
          }
        }

        // Load liquidity positions in parallel but don't wait for it
        this.loadLiquidityPositions(principalId).catch(error => {
          console.warn("Error loading liquidity positions, but continuing:", error);
        });

        // Update store to indicate completion
        walletDataStore.update(state => ({
          ...state,
          isLoading: false
        }));
        
        console.log(`Successfully initialized wallet data for ${principalId}`);
      } catch (error) {
        console.error("Error initializing wallet data:", error);
        
        // Update store with more specific error
        const errorMessage = error instanceof Error 
          ? `Wallet initialization failed: ${error.message}` 
          : "Failed to initialize wallet data";
          
        walletDataStore.update(state => ({
          ...state,
          isLoading: false,
          error: errorMessage
        }));
      } finally {
        // Reset initialization flags
        initializationInProgress = false;
        initializationPromise = null;
        resolve();
      }
    });

    return initializationPromise;
  }

  /**
   * Refresh only the balances for the current wallet without reloading tokens
   * This is useful for updating balances after transactions
   */
  public static async refreshBalances(forceRefresh = false): Promise<void> {
    const currentState = get(walletDataStore);
    const principalId = currentState.currentWallet;
    
    if (!principalId || principalId === "anonymous") {
      console.log('No wallet to refresh balances for');
      return;
    }
    
    if (currentState.isLoading) {
      console.log('Already loading data, skipping balance refresh');
      return;
    }
    
    try {
      // Update loading state
      walletDataStore.update(state => ({
        ...state,
        isLoading: true,
        error: null
      }));
      
      console.log(`Refreshing balances for wallet ${principalId}`);
      
      // Use existing tokens from the store
      const tokens = currentState.tokens;
      
      if (tokens.length > 0) {
        const balances = await this.loadWalletBalances(
          principalId, 
          tokens, 
          { forceRefresh }
        );
        
        // Update store with new balances
        walletDataStore.update(state => ({
          ...state,
          balances,
          lastUpdated: Date.now(),
          isLoading: false
        }));
        
        console.log(`Successfully refreshed balances for ${principalId}`);
      } else {
        // If no tokens, we need to initialize completely
        console.log('No tokens available, initializing wallet data');
        await this.initializeWallet(principalId);
      }
    } catch (error) {
      console.error("Error refreshing balances:", error);
      
      // Update store with error
      walletDataStore.update(state => ({
        ...state,
        isLoading: false,
        error: error instanceof Error 
          ? `Balance refresh failed: ${error.message}` 
          : "Failed to refresh balances"
      }));
    }
  }

  /**
   * Load liquidity positions for a wallet
   * This is called during wallet initialization to ensure liquidity data is loaded
   */
  public static async loadLiquidityPositions(principalId: string): Promise<void> {
    if (!principalId || principalId === "anonymous") {
      console.log(`Skipping liquidity positions load for anonymous or empty principal`);
      return;
    }

    // Check if we already have pools for this principal
    const currentStore = get(walletPoolListStore);
    console.log(`Checking liquidity positions for ${principalId}:`, {
      currentWalletId: currentStore.walletId,
      poolsCount: currentStore.processedPools.length,
      isLoading: currentStore.loading
    });
    
    if (currentStore.walletId === principalId && 
        currentStore.processedPools.length > 0) {
      console.log(`Already have liquidity positions for ${principalId}, no need to reload`);
      return;
    }

    try {
      console.log(`Loading liquidity positions for ${principalId}`);
      await walletPoolListStore.fetchPoolsForWallet(principalId);
      
      // Verify the data was loaded correctly
      const updatedStore = get(walletPoolListStore);
      console.log(`Liquidity positions load result for ${principalId}:`, {
        walletId: updatedStore.walletId,
        poolsCount: updatedStore.processedPools.length,
        error: updatedStore.error
      });
      
      if (updatedStore.processedPools.length > 0) {
        console.log(`Successfully loaded ${updatedStore.processedPools.length} liquidity positions for ${principalId}`);
      } else if (updatedStore.error) {
        console.error(`Error loading liquidity positions: ${updatedStore.error}`);
      } else {
        console.log(`No liquidity positions found for ${principalId}`);
      }
    } catch (error) {
      console.error("Error loading liquidity positions:", error);
      throw error;
    }
  }

  /**
   * Force refresh the token cache
   * This is useful when new tokens are added to the system
   */
  public static async refreshTokenCache(): Promise<FE.Token[]> {
    console.log('Force refreshing token cache');
    try {
      const tokens = await this.loadAllTokens();
      
      // Update the token cache
      tokenCache = {
        tokens,
        lastUpdated: Date.now()
      };
      
      // Update store with new tokens
      walletDataStore.update(state => ({
        ...state,
        tokens,
        lastUpdated: Date.now()
      }));
      
      return tokens;
    } catch (error) {
      console.error("Failed to refresh token cache:", error);
      throw error;
    }
  }

  /**
   * Load all tokens with pagination and retry logic
   */
  public static async loadAllTokens(): Promise<FE.Token[]> {
    let allTokens: FE.Token[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    const pageLimit = 75;
    const maxRetries = 1;
    
    // Paginate through all tokens with delay between requests
    while (hasMorePages) {
      console.log(`Fetching tokens page ${currentPage}`);
      
      let retryCount = 0;
      let success = false;
      
      while (retryCount < maxRetries && !success) {
        try {
          const tokensResponse = await fetchTokens({
            page: currentPage,
            limit: pageLimit
          });
          
          if (tokensResponse.tokens && tokensResponse.tokens.length > 0) {
            allTokens = [...allTokens, ...tokensResponse.tokens];
            
            // Determine if we need to fetch more pages based on total_count
            hasMorePages = tokensResponse.tokens.length === pageLimit && 
                         allTokens.length < tokensResponse.total_count;
            currentPage++;
            
            // Add delay between requests to prevent 503 errors
            if (hasMorePages) {
              await delay(200);
            }
            
            success = true;
          } else {
            hasMorePages = false;
            success = true;
          }
        } catch (error) {
          retryCount++;
          console.error(`Error fetching tokens page ${currentPage} (attempt ${retryCount}/${maxRetries}):`, error);
          
          if (retryCount >= maxRetries) {
            console.error(`Max retries reached for page ${currentPage}, continuing with tokens collected so far`);
            hasMorePages = false;
            break;
          }
          
          // Exponential backoff
          await delay(1000 * Math.pow(2, retryCount - 1));
        }
      }
    }
    
    console.log(`Fetched ${allTokens.length} tokens in total`);
    return allTokens;
  }

  /**
   * Load wallet balances for a specific principal ID and tokens
   * This implementation directly uses IcrcService instead of TokenService
   */
  public static async loadWalletBalances(
    principalId: string,
    tokens: FE.Token[],
    options = { forceRefresh: false }
  ): Promise<Record<string, TokenBalance>> {
    if (!principalId || principalId === "anonymous") {
      console.log('No wallet ID or anonymous user');
      return {};
    }

    if (!tokens || tokens.length === 0) {
      console.log('No tokens provided');
      return {};
    }

    try {
      console.log(`Attempting to load balances for wallet ${principalId} with ${tokens.length} tokens`);
      
      // Convert principal to Principal type if it's a string
      const principal = typeof principalId === "string" 
        ? Principal.fromText(principalId) 
        : principalId;

      // Process tokens in smaller batches to prevent 503 errors
      const BATCH_SIZE = 50;
      let allBalances: Record<string, TokenBalance> = {};
      
      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const tokenBatch = tokens.slice(i, i + BATCH_SIZE);
        
        try {          
          // Use IcrcService directly to get balances
          const batchBalances = await IcrcService.batchGetBalances(
            // Add timestamp to make each request unique if forcing refresh
            options.forceRefresh 
              ? tokenBatch.map(t => ({ ...t, timestamp: Date.now() }))
              : tokenBatch,
            principal
          );
          
          // Process the balances
          for (const [canisterId, balance] of batchBalances.entries()) {
            if (balance !== undefined && balance !== null) {
              const token = tokens.find(t => t.canister_id === canisterId);
              if (token) {
                const price = token?.metrics?.price || 0;
                const tokenAmount = formatBalance(balance.toString(), token.decimals).replace(/,/g, '');
                const usdValue = parseFloat(tokenAmount) * Number(price);

                if (!isNaN(usdValue)) {
                  allBalances[canisterId] = {
                    in_tokens: balance,
                    in_usd: usdValue.toString(),
                  };
                }
              }
            }
          }
          
          // Add delay between batches
          if (i + BATCH_SIZE < tokens.length) {
            await delay(100);
          }
        } catch (error) {
          console.error(`Error fetching balances for batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
          await delay(500); // Wait longer on error
        }
      }
      
      // Filter out zero balances
      const nonZeroBalances = Object.entries(allBalances)
        .filter(([_, balance]) => {
          const hasValidBalance = balance.in_tokens !== undefined && 
                                balance.in_usd !== undefined &&
                                balance.in_tokens > BigInt(0);
          return hasValidBalance;
        })
        .reduce((acc, [canisterId, balance]) => {
          acc[canisterId] = balance;
          return acc;
        }, {} as Record<string, TokenBalance>);
      
      return nonZeroBalances;
    } catch (error) {
      console.error("Error loading wallet balances:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to load wallet balances");
    }
  }

  /**
   * Load only token metadata without balances
   */
  public static async loadTokensOnly(principalId: string): Promise<FE.Token[]> {
    try {
      // Update store to indicate loading
      walletDataStore.update(state => ({
        ...state,
        isLoading: true,
        error: null,
        currentWallet: principalId
      }));
      
      console.log('Starting token metadata load for', principalId);
      
      // Check if we have tokens in the cache
      let tokens: FE.Token[] = [];
      
      if (
        tokenCache.tokens.length > 0 && 
        tokenCache.lastUpdated && 
        Date.now() - tokenCache.lastUpdated < TOKEN_CACHE_EXPIRY
      ) {
        console.log('Using cached tokens for metadata-only load');
        tokens = tokenCache.tokens;
      } else {
        console.log('Token cache expired or empty, loading fresh tokens for metadata-only load');
        tokens = await this.loadAllTokens();
        
        // Update the token cache
        tokenCache = {
          tokens,
          lastUpdated: Date.now()
        };
      }
      
      // Update store with tokens
      walletDataStore.update(state => ({
        ...state,
        tokens,
        isLoading: false,
        lastUpdated: Date.now()
      }));
      
      return tokens;
    } catch (error) {
      console.error("Failed to load token metadata:", error);
      
      // Update store with error
      walletDataStore.update(state => ({
        ...state,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load token metadata"
      }));
      
      return [];
    }
  }

  /**
   * Reset the wallet data store
   */
  public static reset(): void {
    walletDataStore.set(initialState);
    walletPoolListStore.reset();
    initializationInProgress = false;
    lastInitializedWallet = null;
    initializationPromise = null;
    
    // Note: We don't reset the token cache here to avoid unnecessary reloading
  }

  /**
   * Get the current wallet data
   */
  public static getWalletData(): WalletData {
    return get(walletDataStore);
  }
} 