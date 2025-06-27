import { get } from "svelte/store";
import { getUserPendingClaims, getMarketsByCreator } from "$lib/api/predictionMarket";
import { auth } from "$lib/stores/auth";

export function useUserMarketData() {
  let userClaims = $state<any[]>([]);
  let userUnresolvedMarkets = $state<any[]>([]);
  let loadingClaims = $state(false);
  let loadingUserMarkets = $state(false);
  let lastLoadedPrincipal = $state<string | null>(null);

  async function loadUserClaims() {
    const authState = get(auth);
    if (!authState.isConnected || !authState.account?.owner || loadingClaims) return;
    
    try {
      loadingClaims = true;
      userClaims = await getUserPendingClaims(authState.account.owner);
    } catch (e) {
      console.error("Failed to load user claims:", e);
      userClaims = [];
    } finally {
      loadingClaims = false;
    }
  }

  async function loadUserUnresolvedMarkets() {
    const authState = get(auth);
    if (!authState.isConnected || !authState.account?.owner || loadingUserMarkets) return;
    
    try {
      loadingUserMarkets = true;
      const result = await getMarketsByCreator(authState.account.owner, {
        start: 0,
        length: 100,
        sortByCreationTime: true
      });
      
      userUnresolvedMarkets = result.markets.filter(market => {
        const isExpiredUnresolved = 'ExpiredUnresolved' in market.status;
        
        // Only show ExpiredUnresolved markets that were actually activated (have bets)
        // This excludes markets that somehow ended up as ExpiredUnresolved without being activated
        return isExpiredUnresolved && market.total_pool > 0n;
      });
    } catch (e) {
      console.error("Failed to load user's unresolved markets:", e);
      userUnresolvedMarkets = [];
    } finally {
      loadingUserMarkets = false;
    }
  }

  function loadUserData() {
    const authState = get(auth);
    if (authState.isConnected && authState.account?.owner) {
      const currentPrincipal = authState.account.owner;
      
      if (currentPrincipal !== lastLoadedPrincipal) {
        lastLoadedPrincipal = currentPrincipal;
        loadUserClaims();
        loadUserUnresolvedMarkets();
      }
    } else {
      userClaims = [];
      userUnresolvedMarkets = [];
      lastLoadedPrincipal = null;
    }
  }

  return {
    get userClaims() { return userClaims; },
    get userUnresolvedMarkets() { return userUnresolvedMarkets; },
    get loadingClaims() { return loadingClaims; },
    get loadingUserMarkets() { return loadingUserMarkets; },
    loadUserData,
    loadUserClaims,
    loadUserUnresolvedMarkets
  };
}