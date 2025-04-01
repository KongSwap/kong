import { browser } from '$app/environment';
import { fetchTokensByCanisterId } from '$lib/api/tokens';
import { DEFAULT_TOKENS } from '$lib/constants/canisterConstants';
import { writable, get, derived } from 'svelte/store';
import { STORAGE_KEYS, createNamespacedStore } from '$lib/config/localForage.config';
import { syncTokens as analyzeTokens, applyTokenChanges } from '$lib/utils/tokenSyncUtils';
import { debounce } from '$lib/utils/debounce';

// Define types for sync operations
interface SyncTokensResult {
  tokensToAdd: FE.Token[];
  tokensToRemove: FE.Token[];
  syncStatus: { added: number; removed: number } | null;
}

// Define updated state interface using Set for enabled tokens
interface UserTokensState {
  enabledTokens: Set<string>;
  tokens: FE.Token[];
  tokenData: Map<string, FE.Token>;
  isAuthenticated: boolean;
  lastUpdated: number;
}

// Keys for storage
const STORAGE_KEY_PREFIX = STORAGE_KEYS.USER_TOKENS;
const CURRENT_PRINCIPAL_KEY = 'current_principal';

// Create namespaced localForage instances
const userTokensStorage = createNamespacedStore(STORAGE_KEY_PREFIX);
const principalStorage = createNamespacedStore('principals');

// Cache for token details to avoid redundant fetches
const tokenDetailsCache = new Map<string, FE.Token>();

// Memoization utility
function memoize<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
  const cache = new Map<string, T>();
  return (...args: any[]): T => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

// Helper function to safely convert BigInt values to strings for JSON serialization
function safeStringify(value: any): any {
  if (typeof value === 'bigint') {
    return value.toString();
  } else if (Array.isArray(value)) {
    return value.map(safeStringify);
  } else if (value !== null && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const key in value) {
      result[key] = safeStringify(value[key]);
    }
    return result;
  }
  return value;
}

// Serialize state for storage
function serializeState(state: UserTokensState): any {
  return {
    enabledTokens: Array.from(state.enabledTokens),
    tokenData: Array.from(state.tokenData.values()),
    isAuthenticated: state.isAuthenticated,
    lastUpdated: state.lastUpdated,
  };
}

// Deserialize state from storage
function deserializeState(serialized: any): UserTokensState {
  if (!serialized) {
    return {
      enabledTokens: new Set<string>(),
      tokenData: new Map<string, FE.Token>(),
      tokens: [],
      isAuthenticated: false,
      lastUpdated: Date.now(),
    };
  }

  const enabledTokens = new Set<string>(serialized.enabledTokens || []);
  const tokenData = new Map<string, FE.Token>();

  // Add tokens to tokenData Map
  if (Array.isArray(serialized.tokenData)) {
    serialized.tokenData.forEach((token: FE.Token) => {
      if (token && token.canister_id) {
        tokenData.set(token.canister_id, token);
      }
    });
  }

  return {
    enabledTokens,
    tokenData,
    tokens: Array.from(tokenData.values()),
    isAuthenticated: !!serialized.isAuthenticated,
    lastUpdated: serialized.lastUpdated || Date.now(),
  };
}

function createUserTokensStore() {
  // Current principal will be loaded asynchronously
  let currentPrincipal: string | null = null;
  
  // Default initial state
  const defaultState: UserTokensState = {
    enabledTokens: new Set<string>(),
    tokenData: new Map<string, FE.Token>(),
    tokens: [],
    isAuthenticated: false,
    lastUpdated: Date.now(),
  };
  
  // Create the main state store
  const state = writable<UserTokensState>(defaultState);
  
  // Create derived stores for specific aspects of the state
  const enabledTokens = derived(state, $state => $state.enabledTokens);
  const tokens = derived(state, $state => Array.from($state.tokenData.values()));
  const isAuthenticated = derived(state, $state => $state.isAuthenticated);
  
  // Storage key helper
  const getStorageKey = (principal?: string) => {
    const id = principal || currentPrincipal || 'default';
    return `${id}`;
  };
  
  // Debounced storage update
  const debouncedUpdateStorage = debounce(async (newState: UserTokensState, principal?: string) => {
    if (!browser) return;
    
    try {
      const key = getStorageKey(principal);
      const serialized = safeStringify(serializeState(newState));
      await userTokensStorage.setItem(key, serialized);
    } catch (error) {
      console.error('[UserTokens] Error updating storage:', error);
    }
  }, 300);

  // Helper function to load state from storage
  const loadFromStorage = async (principal?: string): Promise<UserTokensState> => {
    if (!browser) return defaultState;
    
    try {
      const key = getStorageKey(principal);
      const storedData = await userTokensStorage.getItem<any>(key);
      
      // Otherwise deserialize using the new format
      return deserializeState(storedData);
    } catch (error) {
      console.error('[UserTokens] Error loading from storage:', error);
      return defaultState;
    }
  };
  
  // Helper function to check if principal has saved tokens
  const hasSavedTokens = async (principalId: string): Promise<boolean> => {
    if (!browser) return false;
    
    try {
      const state = await loadFromStorage(principalId);
      return state.enabledTokens.size > 0;
    } catch (error) {
      console.error('[UserTokens] Error checking if principal has saved tokens:', error);
      return false;
    }
  };
  
  // Load default tokens if none are found
  const loadDefaultTokensIfNeeded = async (principalId?: string): Promise<UserTokensState> => {
    try {
      // Check if we have saved tokens for this principal
      const hasSaved = await hasSavedTokens(principalId || currentPrincipal || 'default');
      
      // If no saved tokens, load defaults
      if (!hasSaved) {
        console.log('[UserTokens] No saved tokens found, loading defaults');
        const defaultTokensList = await fetchTokensByCanisterId(Object.values(DEFAULT_TOKENS));
        
        // Create new state with defaults
        const enabledTokensSet = new Set<string>();
        const tokenDataMap = new Map<string, FE.Token>();
        
        defaultTokensList.forEach(token => {
          enabledTokensSet.add(token.canister_id);
          tokenDataMap.set(token.canister_id, token);
          // Update cache
          tokenDetailsCache.set(token.canister_id, token);
        });
        
        const newState: UserTokensState = {
          enabledTokens: enabledTokensSet,
          tokens: Array.from(tokenDataMap.values()),
          tokenData: tokenDataMap,
          isAuthenticated: !!principalId,
          lastUpdated: Date.now(),
        };
        
        // Save to storage if we have a principal
        if (principalId || currentPrincipal) {
          await debouncedUpdateStorage(newState, principalId);
        }
        
        return newState;
      }
      
      // If we have saved tokens, load them
      const savedState = await loadFromStorage(principalId);
      
      // Update cache from loaded state
      savedState.tokenData.forEach((token, id) => {
        tokenDetailsCache.set(id, token);
      });
      
      return {
        ...savedState,
        isAuthenticated: !!principalId,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error('[UserTokens] Error loading default tokens:', error);
      return {
        ...defaultState,
        isAuthenticated: !!principalId,
        lastUpdated: Date.now(),
      };
    }
  };
  
  // Initialize current principal
  const initializePrincipal = async () => {
    if (!browser) return;
    
    try {
      currentPrincipal = await principalStorage.getItem<string>(CURRENT_PRINCIPAL_KEY);
      
      // Load state for current principal, including default tokens if needed
      if (currentPrincipal) {
        const loadedState = await loadDefaultTokensIfNeeded(currentPrincipal);
        state.set(loadedState);
      } else {
        // Load default tokens even when no principal is available
        const defaultTokensState = await loadDefaultTokensIfNeeded();
        state.set(defaultTokensState);
      }
    } catch (error) {
      console.error('[UserTokens] Error initializing principal:', error);
      // Fallback to default tokens on error
      const defaultTokensState = await loadDefaultTokensIfNeeded();
      state.set(defaultTokensState);
    }
  };
  
  // Initialize on store creation
  if (browser) {
    initializePrincipal();
  }

  // Optimized token filtering logic with search index
  const createSearchIndex = memoize((tokens: FE.Token[]) => {
    return tokens.reduce<Record<string, string>>((acc, token) => {
      if (token && token.canister_id) {
        const searchTerms = `${token.symbol || ''} ${token.name || ''} ${token.canister_id}`.toLowerCase();
        acc[token.canister_id] = searchTerms;
      }
      return acc;
    }, {});
  });

  // Memoized search function using the search index
  const searchTokens = memoize((query: string, tokens: FE.Token[]): FE.Token[] => {
    if (!query) return tokens;
    
    const searchIndex = createSearchIndex(tokens);
    const lowerQuery = query.toLowerCase();
    
    return tokens.filter(token => {
      const terms = searchIndex[token.canister_id];
      return terms && terms.includes(lowerQuery);
    });
  });

  // Lazy load token details
  const getTokenDetails = async (canisterId: string): Promise<FE.Token | null> => {
    // Check cache first
    if (tokenDetailsCache.has(canisterId)) {
      return tokenDetailsCache.get(canisterId) || null;
    }
    
    // Check local store
    const currentState = get(state);
    if (currentState.tokenData.has(canisterId)) {
      const token = currentState.tokenData.get(canisterId);
      if (token) {
        tokenDetailsCache.set(canisterId, token);
        return token;
      }
    }
    
    // Fetch from API as last resort
    try {
      const [token] = await fetchTokensByCanisterId([canisterId]);
      if (token) {
        tokenDetailsCache.set(canisterId, token);
        
        // Update store with this token
        state.update(state => {
          const newTokenData = new Map(state.tokenData);
          newTokenData.set(canisterId, token);
          const newState = {
            ...state,
            tokenData: newTokenData,
            lastUpdated: Date.now(),
          };
          debouncedUpdateStorage(newState);
          return newState;
        });
        
        return token;
      }
    } catch (error) {
      console.error(`[UserTokens] Error fetching token details for ${canisterId}:`, error);
    }
    
    return null;
  };

  // Load visible tokens with priority queue
  const loadVisibleTokens = async (visibleTokenIds: string[]): Promise<void> => {
    // Skip if no visible tokens
    if (!visibleTokenIds.length) return;
    
    // Create a copy of the array for our queue
    const queue = [...visibleTokenIds];
    const batchSize = 5;
    
    // Function to load a batch of tokens
    const loadBatch = async () => {
      if (queue.length === 0) return;
      
      const batch = queue.splice(0, batchSize);
      const tokenPromises = batch.map(id => getTokenDetails(id));
      
      try {
        await Promise.all(tokenPromises);
        
        // If there are more tokens to load, schedule the next batch
        if (queue.length > 0) {
          setTimeout(loadBatch, 100);
        }
      } catch (error) {
        console.error('[UserTokens] Error loading token batch:', error);
      }
    };
    
    // Start loading the first batch
    await loadBatch();
  };

  // Refresh token data
  const refreshTokenData = async () => {
    const currentState = get(state);
    const canisterIds = Array.from(currentState.enabledTokens);
    
    if (canisterIds.length === 0) return;
    
    try {
      const tokens = await fetchTokensByCanisterId(canisterIds);
      
      state.update(state => {
        const newTokenData = new Map(state.tokenData);
        
        tokens.forEach(token => {
          if (token && token.canister_id) {
            newTokenData.set(token.canister_id, token);
            tokenDetailsCache.set(token.canister_id, token);
          }
        });
        
        const newState = {
          ...state,
          tokenData: newTokenData,
          lastUpdated: Date.now(),
        };
        
        debouncedUpdateStorage(newState);
        return newState;
      });
    } catch (error) {
      console.error('[UserTokens] Error refreshing token data:', error);
    }
  };

  return {
    subscribe: state.subscribe,
    
    // Provide derived stores for specific parts of the state
    enabledTokens: { subscribe: enabledTokens.subscribe },
    tokens: { subscribe: tokens.subscribe },
    isAuthenticated: { subscribe: isAuthenticated.subscribe },
    
    reset: () => {
      const newState = {
        enabledTokens: new Set<string>(),
        tokenData: new Map<string, FE.Token>(),
        tokens: [],
        isAuthenticated: false,
        lastUpdated: Date.now(),
      };
      state.set(newState);
      debouncedUpdateStorage(newState);
      return Promise.resolve();
    },
    
    setPrincipal: (principalId: string | null) => {
      return new Promise<void>((resolve, reject) => {
        try {
          if (browser && principalId) {
            principalStorage.setItem(CURRENT_PRINCIPAL_KEY, principalId)
              .then(() => {
                currentPrincipal = principalId;
                return loadDefaultTokensIfNeeded(principalId);
              })
              .then((loadedState) => {
                state.set({...loadedState, isAuthenticated: true});
                resolve();
              })
              .catch(reject);
          } else if (browser && principalId === null) {
            principalStorage.removeItem(CURRENT_PRINCIPAL_KEY)
              .then(() => {
                currentPrincipal = null;
                return loadDefaultTokensIfNeeded();
              })
              .then((loadedState) => {
                state.set({...loadedState, isAuthenticated: false});
                resolve();
              })
              .catch(reject);
          } else {
            resolve();
          }
        } catch (error) {
          console.error('[UserTokens] Error setting principal:', error);
          reject(error);
        }
      });
    },
    
    enableToken: async (token: FE.Token) => {
      if (!token || !token.canister_id) return;
      
      state.update(state => {
        // Create copies of current state
        const newEnabledTokens = new Set(state.enabledTokens);
        const newTokenData = new Map(state.tokenData);
        
        // Update state
        newEnabledTokens.add(token.canister_id);
        newTokenData.set(token.canister_id, token);
        
        // Update cache
        tokenDetailsCache.set(token.canister_id, token);
        
        const newState = {
          ...state,
          enabledTokens: newEnabledTokens,
          tokenData: newTokenData,
          lastUpdated: Date.now(),
        };
        
        debouncedUpdateStorage(newState);
        return newState;
      });
    },
    
    enableTokens: async (tokens: FE.Token[]) => {
      if (!tokens.length) return;
      
      state.update(state => {
        // Create copies of current state
        const newEnabledTokens = new Set(state.enabledTokens);
        const newTokenData = new Map(state.tokenData);
        
        // Update state with batch operations
        tokens.forEach(token => {
          if (token && token.canister_id) {
            newEnabledTokens.add(token.canister_id);
            newTokenData.set(token.canister_id, token);
            tokenDetailsCache.set(token.canister_id, token);
          }
        });
        
        const newState = {
          ...state,
          enabledTokens: newEnabledTokens,
          tokenData: newTokenData,
          lastUpdated: Date.now(),
        };
        
        debouncedUpdateStorage(newState);
        return newState;
      });
    },
    
    disableToken: (canisterId: string) => {
      state.update(state => {
        // Create copies of current state
        const newEnabledTokens = new Set(state.enabledTokens);
        const newTokenData = new Map(state.tokenData);
        
        // Update state - only remove from enabledTokens, keep in tokenData
        newEnabledTokens.delete(canisterId);
        // Don't remove from tokenData: newTokenData.delete(canisterId);
        
        const newState = {
          ...state,
          enabledTokens: newEnabledTokens,
          tokenData: newTokenData,
          lastUpdated: Date.now(),
        };
        
        debouncedUpdateStorage(newState);
        return newState;
      });
    },
    
    isTokenEnabled: (canisterId: string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        if (!browser) {
          resolve(true); // Default to enabled if not in browser
          return;
        }
        
        const currentState = get(state);
        resolve(currentState.enabledTokens.has(canisterId));
      });
    },
    
    refreshTokenData,
    isDefaultToken: (canisterId: string) => Object.values(DEFAULT_TOKENS).includes(canisterId),
    hasSavedTokens,
    loadDefaultTokensIfNeeded,
    
    // New search utility with memoization
    searchTokens: (query: string) => {
      const currentState = get(state);
      const allTokens = Array.from(currentState.tokenData.values());
      return searchTokens(query, allTokens);
    },
    
    // Load visible tokens with priority queue
    loadVisibleTokens,
    
    // Get token details with caching
    getTokenDetails,
    
    // Sync methods
    analyzeUserTokens: async (principalId: string): Promise<SyncTokensResult> => {
      try {
        // Get token candidates
        const syncResults = await analyzeTokens(principalId);
        
        // Find the full token objects for tokens to remove
        const currentState = get(state);
        const tokensToRemoveObjects = syncResults.tokensToRemove
          .map(canisterId => currentState.tokenData.get(canisterId))
          .filter((token): token is FE.Token => token !== undefined);
        
        return {
          tokensToAdd: syncResults.tokensToAdd,
          tokensToRemove: tokensToRemoveObjects,
          syncStatus: syncResults.stats
        };
      } catch (error) {
        console.error("Error analyzing user tokens:", error);
        return {
          tokensToAdd: [],
          tokensToRemove: [],
          syncStatus: { added: 0, removed: 0 }
        };
      }
    },
    
    applyTokenSync: async (tokensToAdd: FE.Token[], tokensToRemove: FE.Token[]): Promise<{ added: number; removed: number }> => {
      try {
        // Extract canister IDs from tokensToRemove for the API call
        const tokensToRemoveIds = tokensToRemove.map(token => token.canister_id);
        
        // Apply the changes via API
        const result = await applyTokenChanges(tokensToAdd, tokensToRemoveIds);
        
        // Also update local state
        state.update(state => {
          const newEnabledTokens = new Set(state.enabledTokens);
          const newTokenData = new Map(state.tokenData);
          
          // Add new tokens
          tokensToAdd.forEach(token => {
            if (token && token.canister_id) {
              newEnabledTokens.add(token.canister_id);
              newTokenData.set(token.canister_id, token);
              tokenDetailsCache.set(token.canister_id, token);
            }
          });
          
          // Remove tokens
          tokensToRemoveIds.forEach(id => {
            newEnabledTokens.delete(id);
            newTokenData.delete(id);
          });
          
          const newState = {
            ...state,
            enabledTokens: newEnabledTokens,
            tokenData: newTokenData,
            lastUpdated: Date.now(),
          };
          
          debouncedUpdateStorage(newState);
          return newState;
        });
        
        return result;
      } catch (error) {
        console.error("Error applying token changes:", error);
        return { added: 0, removed: 0 };
      }
    }
  };
}

export const userTokens = createUserTokensStore();