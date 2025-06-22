import { writable, derived, get } from 'svelte/store';
import type { LeaderboardEntry } from '$lib/api/leaderboard';
import { fetchVolumeLeaderboard } from '$lib/api/leaderboard';
import { fetchTokensByCanisterId } from '$lib/api/tokens/TokenApiClient';
import { fetchUsers } from '$lib/api/users';
import type { Period } from '$lib/types';

// Type definitions for store state
interface UserDetails {
  fee_level: number;
}

// Define the full response structure we need
interface FullLeaderboardResponse {
  items: LeaderboardEntry[];
  limit: number;
  page: number;
  total_count: number;
  total_pages: number;
}

interface LeaderboardState {
  leaderboardData: LeaderboardEntry[];
  expandedRowIndex: number | null;
  tradedTokens: Record<number, Kong.Token[]>;
  loadingTokens: Record<number, boolean>;
  tokenErrors: Record<number, string | null>;
  userDetails: Record<number, UserDetails | null>;
  loadingUserDetails: Record<number, boolean>;
  userDetailsErrors: Record<number, string | null>;
  isLoading: boolean;
  error: string | null;
  selectedPeriod: Period;
  totalTraders: number;
  totalVolume: number;
}

// Create initial state
const initialState: LeaderboardState = {
  leaderboardData: [],
  expandedRowIndex: null,
  tradedTokens: {},
  loadingTokens: {},
  tokenErrors: {},
  userDetails: {},
  loadingUserDetails: {},
  userDetailsErrors: {},
  isLoading: true,
  error: null,
  selectedPeriod: 'day',
  totalTraders: 0,
  totalVolume: 0
};

// Create the writable store
const createLeaderboardStore = () => {
  const { subscribe, set, update } = writable<LeaderboardState>(initialState);

  return {
    subscribe,
    
    // Change period and load new data
    setPeriod: async (period: Period) => {
      update(state => ({ ...state, selectedPeriod: period }));
      await loadLeaderboard(period);
    },
    
    // Toggle expanded row
    toggleRowExpansion: async (index: number) => {
      // First update the expanded row index
      update(state => {
        // If already expanded, collapse it
        if (state.expandedRowIndex === index) {
          return { ...state, expandedRowIndex: null };
        }
        
        // Otherwise expand this row
        return { ...state, expandedRowIndex: index };
      });
      
      // Get the current state to check if we need to load additional data
      const currentState = get(leaderboardStore);
      
      // If a row is expanded, load additional data if needed
      if (currentState.expandedRowIndex !== null) {
        const idx = currentState.expandedRowIndex;
        const user = currentState.leaderboardData[idx];
        
        // Load tokens if needed
        if (user.traded_token_canister_ids?.length && !currentState.tradedTokens[idx]) {
          await loadTokensForRow(idx);
        }
        
        // Load user details if needed
        if (!currentState.userDetails[idx]) {
          await loadUserDetailsForRow(idx);
        }
      }
    },
    
    // Load leaderboard data
    loadLeaderboard: async (period: Period) => {
      await loadLeaderboard(period);
    },
    
    // Reset store to initial state
    reset: () => set(initialState)
  };
  
  // Helper function to load leaderboard data
  async function loadLeaderboard(period: Period) {
    update(state => ({
      ...state,
      expandedRowIndex: null,
      tradedTokens: {},
      loadingTokens: {},
      tokenErrors: {},
      userDetails: {},
      loadingUserDetails: {},
      userDetailsErrors: {},
      isLoading: true,
      error: null
    }));
    
    try {
      if (!period) {
        throw new Error("Period not specified");
      }
      
      const response = await fetchVolumeLeaderboard(period);
      let leaderboardItems: LeaderboardEntry[] = [];
      let totalTraders = 0;
      
      // Handle the two possible return types
      if (Array.isArray(response)) {
        // Handle case where response is LeaderboardEntry[]
        leaderboardItems = response;
        totalTraders = leaderboardItems.length;
      } else if (response && 'items' in response) {
        // Handle case where response is VolumeLeaderboardResponse
        const typedResponse = response as unknown as FullLeaderboardResponse;
        leaderboardItems = typedResponse.items;
        totalTraders = typedResponse.total_count;
      } else {
        throw new Error("Invalid response format");
      }
      
      const totalVolume = leaderboardItems.reduce((sum, entry) => sum + entry.total_volume_usd, 0);
      
      update(state => ({
        ...state,
        leaderboardData: leaderboardItems,
        totalTraders,
        totalVolume,
        isLoading: false
      }));
      
      // Auto-load tokens for all users after leaderboard data is loaded
      for (let i = 0; i < leaderboardItems.length; i++) {
        const user = leaderboardItems[i];
        if (user.traded_token_canister_ids?.length) {
          await loadTokensForRow(i);
        }
      }
      
    } catch (err) {
      update(state => ({
        ...state,
        error: err instanceof Error ? err.message : 'Failed to load leaderboard',
        leaderboardData: [],
        totalTraders: 0,
        totalVolume: 0,
        isLoading: false
      }));
      console.error('Error loading leaderboard:', err);
    }
  }
  
  // Helper function to load tokens for a specific row
  async function loadTokensForRow(index: number) {
    const currentState = get(leaderboardStore);
    const user = currentState.leaderboardData[index];
    
    if (!user.traded_token_canister_ids?.length) {
      return;
    }
    
    update(current => ({
      ...current,
      loadingTokens: { ...current.loadingTokens, [index]: true },
      tokenErrors: { ...current.tokenErrors, [index]: null }
    }));
    
    try {
      const tokens = await fetchTokensByCanisterId(user.traded_token_canister_ids);
      
      update(current => ({
        ...current,
        tradedTokens: { ...current.tradedTokens, [index]: tokens },
        loadingTokens: { ...current.loadingTokens, [index]: false }
      }));
    } catch (err) {
      console.error('Failed to load token data:', err);
      
      update(current => ({
        ...current,
        tokenErrors: { 
          ...current.tokenErrors, 
          [index]: err instanceof Error ? err.message : 'Failed to load token data' 
        },
        loadingTokens: { ...current.loadingTokens, [index]: false }
      }));
    }
  }
  
  // Helper function to load user details for a specific row
  async function loadUserDetailsForRow(index: number) {
    const currentState = get(leaderboardStore);
    const user = currentState.leaderboardData[index];
    
    update(current => ({
      ...current,
      loadingUserDetails: { ...current.loadingUserDetails, [index]: true },
      userDetailsErrors: { ...current.userDetailsErrors, [index]: null }
    }));
    
    try {
      const response = await fetchUsers(user.principal_id);
      
      if (response.items && response.items.length > 0) {
        const userData = response.items[0];
        
        update(current => ({
          ...current,
          userDetails: { 
            ...current.userDetails, 
            [index]: {
              fee_level: userData.fee_level
            }
          },
          loadingUserDetails: { ...current.loadingUserDetails, [index]: false }
        }));
      } else {
        update(current => ({
          ...current,
          userDetails: { ...current.userDetails, [index]: null },
          loadingUserDetails: { ...current.loadingUserDetails, [index]: false }
        }));
      }
    } catch (err) {
      console.error('Failed to load user details:', err);
      
      update(current => ({
        ...current,
        userDetailsErrors: { 
          ...current.userDetailsErrors, 
          [index]: err instanceof Error ? err.message : 'Failed to load user details' 
        },
        loadingUserDetails: { ...current.loadingUserDetails, [index]: false }
      }));
    }
  }
};

// Create and export the store
export const leaderboardStore = createLeaderboardStore();

// Create derived stores for specific pieces of state if needed
export const isLoading = derived(leaderboardStore, $store => $store.isLoading);
export const error = derived(leaderboardStore, $store => $store.error);
export const leaderboardData = derived(leaderboardStore, $store => $store.leaderboardData);
export const totalVolume = derived(leaderboardStore, $store => $store.totalVolume);
export const totalTraders = derived(leaderboardStore, $store => $store.totalTraders); 