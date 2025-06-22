import { derived, writable } from 'svelte/store';
import { liquidityStore } from '$lib/stores/liquidityStore';
import { currentUserBalancesStore } from '$lib/stores/balancesStore';
import { BigNumber } from 'bignumber.js';
import { 
  ICP_CANISTER_ID, 
  CKUSDT_CANISTER_ID 
} from '$lib/constants/canisterConstants';
import { fetchTokensByCanisterId } from '$lib/api/tokens/index';
import { doesPoolExist } from '$lib/utils/poolCreationUtils';
import { getButtonText, hasInsufficientBalance } from '$lib/utils/liquidityUtils';

export function useLiquidityPanel() {
  // Local state
  const token0 = writable<Kong.Token | null>(null);
  const token1 = writable<Kong.Token | null>(null);
  const pool = writable<BE.Pool | null>(null);
  const poolExists = writable<boolean | null>(null);

  // Subscribe to liquidity store
  liquidityStore.subscribe(store => {
    token0.set(store.token0);
    token1.set(store.token1);
  });

  // Derived balances
  const token0Balance = derived(
    [token0, currentUserBalancesStore],
    ([$token0, $balances]) => {
      if (!$token0?.address) return "0";
      return $balances[$token0.address]?.in_tokens?.toString() || "0";
    }
  );

  const token1Balance = derived(
    [token1, currentUserBalancesStore],
    ([$token1, $balances]) => {
      if (!$token1?.address) return "0";
      return $balances[$token1.address]?.in_tokens?.toString() || "0";
    }
  );

  // Derived button state
  const buttonState = derived(
    [token0, token1, poolExists, liquidityStore],
    ([$token0, $token1, $poolExists, $liquidityStore]) => {
      const hasAmounts = $liquidityStore.amount0 && $liquidityStore.amount1 && 
                        new BigNumber($liquidityStore.amount0 || '0').gt(0) && 
                        new BigNumber($liquidityStore.amount1 || '0').gt(0);
                        
      const insufficientBalance = hasAmounts && $token0 && $token1 && 
                                hasInsufficientBalance(
                                  $liquidityStore.amount0, 
                                  $liquidityStore.amount1, 
                                  $token0, 
                                  $token1
                                );
      
      const buttonText = getButtonText(
        $token0,
        $token1,
        $poolExists === false,
        insufficientBalance,
        $liquidityStore.amount0,
        $liquidityStore.amount1,
        false,
        "Loading..."
      );

      const buttonTheme: "accent-red" | "accent-green" = 
        buttonText === "Insufficient Balance" ? "accent-red" : "accent-green";

      return { buttonText, buttonTheme };
    }
  );

  // Initialize tokens from URL or defaults
  async function initializeTokens(searchParams: URLSearchParams, userTokens: Kong.Token[]) {
    const urlToken0 = searchParams.get("token0");
    const urlToken1 = searchParams.get("token1");
    
    const tokensToFetch = [urlToken0, urlToken1].filter(Boolean) as string[];
    
    let tokensFromUrl: Kong.Token[] = [];
    if (tokensToFetch.length > 0) {
      try {
        tokensFromUrl = await fetchTokensByCanisterId(tokensToFetch);
      } catch (error) {
        console.error("Error fetching tokens:", error);
      }
    }
    
    // Get default tokens as fallbacks
    const defaultToken0 = userTokens.find(token => token.address === ICP_CANISTER_ID) || null;
    const defaultToken1 = userTokens.find(token => token.address === CKUSDT_CANISTER_ID) || null;
    
    // Set tokens with proper fallbacks
    liquidityStore.setToken(0, 
      tokensFromUrl.find(token => token.address === urlToken0) || defaultToken0
    );
    
    liquidityStore.setToken(1, 
      tokensFromUrl.find(token => token.address === urlToken1) || defaultToken1
    );
  }

  // Update pool state based on selected tokens
  function updatePoolState(t0: Kong.Token, t1: Kong.Token, livePools: BE.Pool[]) {
    const currentPoolExists = doesPoolExist(t0, t1, livePools);
    poolExists.set(currentPoolExists);
    
    if (currentPoolExists) {
      const foundPool = livePools.find(p => 
        (p.address_0 === t0.address && p.address_1 === t1.address) ||
        (p.address_0 === t1.address && p.address_1 === t0.address)
      );
      pool.set(foundPool || null);
    } else {
      pool.set(null);
    }
  }

  return {
    token0,
    token1,
    pool,
    poolExists,
    token0Balance,
    token1Balance,
    buttonText: derived(buttonState, $state => $state.buttonText),
    buttonTheme: derived(buttonState, $state => $state.buttonTheme),
    initializeTokens,
    updatePoolState
  };
} 