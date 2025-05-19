<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import TokenSelectionPanel from "./TokenSelectionPanel.svelte";
  import AmountInputs from "./AmountInputs.svelte";
  import InitialPriceInput from "./InitialPriceInput.svelte";
  import PoolWarning from "./PoolWarning.svelte";
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import {
    loadBalances,
    currentUserBalancesStore,
  } from "$lib/stores/balancesStore";
  import {
    validateTokenSelect,
    updateQueryParams,
    doesPoolExist,
  } from "$lib/utils/poolCreationUtils";
  import { 
    calculateToken1FromPrice, 
    calculateToken0FromPrice,
    calculateToken1FromPoolRatio,
    calculateToken0FromPoolRatio,
    calculateAmountFromPercentage,
    getButtonText,
    hasInsufficientBalance
  } from "$lib/utils/liquidityUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import { page } from "$app/stores";
  import { auth } from "$lib/stores/auth";
  import { livePools } from "$lib/stores/poolStore";
  import { onDestroy, onMount } from "svelte";
  import {
    CKUSDT_CANISTER_ID,
    ICP_CANISTER_ID,
  } from "$lib/constants/canisterConstants";
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";
  import ConfirmLiquidityModal from "$lib/components/liquidity/modals/ConfirmLiquidityModal.svelte";
  import PositionDisplay from "$lib/components/liquidity/create_pool/PositionDisplay.svelte";
  import { BigNumber } from "bignumber.js";
  import { userTokens } from "$lib/stores/userTokens";
  import { fetchTokensByCanisterId } from "$lib/api/tokens/index";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { calculateLiquidityAmounts } from "$lib/api/pools";

  const ALLOWED_TOKEN_SYMBOLS = ["ICP", "ckUSDT"];
  const DEFAULT_TOKEN = "ICP";
  const SECONDARY_TOKEN_IDS = [ICP_CANISTER_ID, CKUSDT_CANISTER_ID];
  const DEBOUNCE_DELAY = 150; // Reduce from 300ms to improve responsiveness
  const MAX_BALANCE_LOAD_ATTEMPTS = 3; // Maximum number of times to try loading balances
  const MIN_BALANCE_LOAD_INTERVAL = 2000; // Minimum time (ms) between balance loads

  // State variables
  let token0: Kong.Token = null;
  let token1: Kong.Token = null;
  let pool: BE.Pool = null;
  let poolExists: boolean = null;
  let token0Balance = "0";
  let token1Balance = "0";
  let initialLoadComplete = false;
  let authInitialized = false;
  let showConfirmModal = false; 
  let isLoading = true; // Add loading state to prevent rendering before data is ready
  let isLoadingBalances = false; // Track balance loading state
  let lastBalanceLoadTime = 0; // Track when balances were last loaded
  let balanceLoadAttempts = 0; // Track number of balance load attempts
  let lastLoadedTokenPair = ""; // Track the last token pair that was loaded
  let buttonText = ""; // Button text state
  let buttonTheme: "accent-red" | "accent-green" = "accent-green"; // Typed button theme
  
  // Get button text reactively
  $: {
    // Only check for insufficient balance when we have valid amounts and tokens
    const hasAmounts = $liquidityStore.amount0 && $liquidityStore.amount1 && 
                      new BigNumber($liquidityStore.amount0 || '0').gt(0) && 
                      new BigNumber($liquidityStore.amount1 || '0').gt(0);
                      
    const insufficientBalance = hasAmounts && token0 && token1 && 
                              hasInsufficientBalance(
                                $liquidityStore.amount0, 
                                $liquidityStore.amount1, 
                                token0, 
                                token1
                              );
    
    buttonText = getButtonText(
      token0,
      token1,
      poolExists === false,
      insufficientBalance,
      $liquidityStore.amount0,
      $liquidityStore.amount1,
      isLoading,
      "Loading..."
    );
  }
  
  // Determine button theme based on button text
  $: buttonTheme = (buttonText === "Insufficient Balance") 
    ? "accent-red" 
    : "accent-green";
  
  // Debounce timers
  let amountDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let priceDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let balanceLoadingTimer: ReturnType<typeof setTimeout> | null = null;

  // Reactive statement for button text
  $: buttonText = getButtonText(
    token0,
    token1,
    poolExists === false,
    hasInsufficientBalance($liquidityStore.amount0, $liquidityStore.amount1, token0, token1),
    $liquidityStore.amount0,
    $liquidityStore.amount1,
    isLoading,
    "Loading..."
  );

  // Helper to safely convert value to BigNumber
  const toBigNumber = (value: any): BigNumber => {
    if (!value) return new BigNumber(0);
    try {
      return new BigNumber(value.toString());
    } catch (error) {
      console.error("Error converting to BigNumber:", error);
      return new BigNumber(0);
    }
  };

  // Debounce function to limit function calls
  function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number,
    timerRef: { current: ReturnType<typeof setTimeout> | null }
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        fn(...args);
        timerRef.current = null;
      }, delay);
    };
  }

  const safeExec = async (fn: () => Promise<any>, errorMsg: string) => {
    try {
      return await fn();
    } catch (error) {
      console.error(`${errorMsg}:`, error);
      toastStore.error(error.message || errorMsg);
      return null;
    }
  };

  // Improved function to handle loading balances and updating the store
  async function loadBalancesIfNecessary(tokens: (Kong.Token | null)[], owner: string, forceRefresh = false) {
    const validTokens = tokens.filter((t): t is Kong.Token => t !== null);
    if (validTokens.length < 2 || !owner) return; // Need two valid tokens and owner

    const currentTime = Date.now();
    const tokenPairKey = validTokens.map(t => t.address).sort().join('-');

    // Prevent loading the same token pair repeatedly in a short time window or too many attempts
    if (tokenPairKey === lastLoadedTokenPair &&
        (currentTime - lastBalanceLoadTime < MIN_BALANCE_LOAD_INTERVAL ||
         (balanceLoadAttempts >= MAX_BALANCE_LOAD_ATTEMPTS && !forceRefresh))) {
        console.log("Throttling balance load - conditions met");
        return;
    }

    // Return early if already loading to prevent race conditions
    if (isLoadingBalances) {
      console.log("Skipping balance load - already in progress");
      return;
    }

    try {
      isLoadingBalances = true;
      if (tokenPairKey !== lastLoadedTokenPair) {
        balanceLoadAttempts = 0; // Reset attempts for new pair
      }
      lastLoadedTokenPair = tokenPairKey;
      lastBalanceLoadTime = currentTime;
      balanceLoadAttempts++;

      // Call the imported loadBalances - it handles fetching and updating the store
      await loadBalances(validTokens, owner, forceRefresh);
    } catch (error) {
      console.error("Error triggering balance load:", error);
      toastStore.error("Failed to load token balances.");
    } finally {
      isLoadingBalances = false;
    }
  }

  // Improved function to load initial tokens from URL or defaults
  async function loadInitialTokens() {
    try {
      isLoading = true;
      const urlToken0 = $page.url.searchParams.get("token0");
      const urlToken1 = $page.url.searchParams.get("token1");
            
      // Only fetch tokens if we have valid IDs
      const tokensToFetch = [];
      if (urlToken0) tokensToFetch.push(urlToken0);
      if (urlToken1) tokensToFetch.push(urlToken1);
      
      // Only make the API call if we have tokens to fetch
      let tokensFromUrl = [];
      if (tokensToFetch.length > 0) {
        try {
          tokensFromUrl = await fetchTokensByCanisterId(tokensToFetch);
        } catch (fetchError) {
          console.error("Error fetching tokens:", fetchError);
          // Set default tokens if API call fails but URL params exist
          // Fallback logic below will handle cases where defaults are needed
          tokensFromUrl = [];
        }
      }
      
      // Get default tokens as fallbacks
      const defaultToken0 = $userTokens.tokens.find(token => token.address === ICP_CANISTER_ID) || null;
      const defaultToken1 = $userTokens.tokens.find(token => token.address === CKUSDT_CANISTER_ID) || null;
      
      // Set tokens with proper fallbacks
      liquidityStore.setToken(0, 
        tokensFromUrl.find(token => token.address === urlToken0) || 
        defaultToken0
      );
      
      liquidityStore.setToken(1, 
        tokensFromUrl.find(token => token.address === urlToken1) || 
        defaultToken1
      );
      
      initialLoadComplete = true;
    } catch (error) {
      console.error("Error loading initial tokens:", error);
      // Set default tokens if error occurs
      try {
        const defaultToken0 = $userTokens.tokens.find(token => token.address === ICP_CANISTER_ID) || null;
        const defaultToken1 = $userTokens.tokens.find(token => token.address === CKUSDT_CANISTER_ID) || null;
        
        liquidityStore.setToken(0, defaultToken0);
        liquidityStore.setToken(1, defaultToken1);
      } catch (fallbackError) {
        console.error("Error setting fallback tokens:", fallbackError);
      }
    } finally {
      console.log("Finished loadInitialTokens, setting isLoading to false");
      isLoading = false;
    }
  }

  // Improved component lifecycle management
  onMount(() => {    
    const unsubscribe = auth.subscribe(async authState => {
      if (authState.isInitialized && !authInitialized) {
        authInitialized = true;
        
        try {
          // Wait for user tokens to be available
          if ($userTokens.tokens.length > 0) {
            await loadInitialTokens();
            
            if (authState.account?.owner) {
              // Use the new function to load balances after initial tokens are set
              // Ensure tokens are actually set before calling
              const currentToken0 = $liquidityStore.token0;
              const currentToken1 = $liquidityStore.token1;
              if (currentToken0 && currentToken1) {
                await loadBalancesIfNecessary(
                  [currentToken0, currentToken1],
                  authState.account.owner,
                  true // Force refresh on initial load
                );
              }
            }
          }
        } catch (error) {
          console.error("Error during initialization:", error);
        } finally {
          // Always set isLoading to false when done, regardless of success/failure
          console.log("Setting isLoading to false");
          isLoading = false;
        }
      }
    });
    
    // Safety timeout to prevent infinite loading
    setTimeout(() => {
      if (isLoading) {
        console.log("Safety timeout triggered, forcing isLoading to false");
        isLoading = false;
      }
    }, 5000);
    
    return unsubscribe;
  });

  // Simplified and more robust reactive statements
  $: if ($userTokens.tokens.length > 0 && !initialLoadComplete && !isLoading) {
    loadInitialTokens();
  }
  
  $: if ($auth?.isInitialized && $auth?.account?.owner && $userTokens.tokens.length > 0 && !isLoading) {
    loadBalancesIfNecessary($userTokens.tokens, $auth.account.owner, true);
  }
  
  // Use effect instead of reactive blocks for complex logic
  let lastReactiveState = {
    isLoading: null,
    token0Id: null,
    token1Id: null,
    livePools: null,
    currentUserBalancesTimestamp: 0,
    authOwner: null
  };
  
  $: {
    const token0Id = $liquidityStore.token0?.address;
    const token1Id = $liquidityStore.token1?.address;
    const livePoolsLength = $livePools.length;
    
    // Safely get a timestamp, falling back to the current time
    const balancesTimestamp = typeof $currentUserBalancesStore.lastUpdated === 'number' 
      ? $currentUserBalancesStore.lastUpdated 
      : Date.now();
      
    const authOwner = $auth?.account?.owner;
    
    // Check if anything meaningful has changed to avoid unnecessary executions
    const hasChanged = 
      isLoading !== lastReactiveState.isLoading ||
      token0Id !== lastReactiveState.token0Id ||
      token1Id !== lastReactiveState.token1Id ||
      livePoolsLength !== lastReactiveState.livePools ||
      authOwner !== lastReactiveState.authOwner;
    
    if (hasChanged) {
      // Update memoization state
      lastReactiveState = {
        isLoading,
        token0Id,
        token1Id,
        livePools: livePoolsLength,
        currentUserBalancesTimestamp: balancesTimestamp,
        authOwner
      };
      
      if (!isLoading) {
        // Update tokens safely
        token0 = $liquidityStore.token0;
        token1 = $liquidityStore.token1;
        
        // Only check poolExists if both tokens are available
        if (token0 && token1) {
          const currentPoolExists = doesPoolExist(token0, token1, $livePools);
          
          if (poolExists !== currentPoolExists) {
            poolExists = currentPoolExists;
          
            pool = poolExists ? $livePools.find(p => 
              (p.address_0 === token0?.address && p.address_1 === token1?.address) ||
              (p.address_0 === token1?.address && p.address_1 === token0?.address) // Handle swapped order
            ) : null;
            
            // Reset balance load attempts when pool status changes or tokens change
            balanceLoadAttempts = 0;
            lastLoadedTokenPair = ""; // Allow immediate loading for new pair/status
            console.log("Pool status or tokens changed, resetting balance load attempts.");
          }
          
          // Trigger balance loading if necessary
          // This logic decides WHEN to call the load function
          if ($auth?.isInitialized && $auth?.account?.owner) {
            const owner = $auth.account.owner;
            const currentToken0Balance = $currentUserBalancesStore[token0.address]?.in_tokens?.toString();
            const currentToken1Balance = $currentUserBalancesStore[token1.address]?.in_tokens?.toString();

            const needBalances = !currentToken0Balance || !currentToken1Balance || currentToken0Balance === "0" || currentToken1Balance === "0";

            if (needBalances && !isLoadingBalances) {
              // Check throttling before scheduling the load
              const tokenPairKey = [token0.address, token1.address].sort().join('-');
              const currentTime = Date.now();
              const canLoadAgain =
                tokenPairKey !== lastLoadedTokenPair ||
                currentTime - lastBalanceLoadTime >= MIN_BALANCE_LOAD_INTERVAL ||
                balanceLoadAttempts < MAX_BALANCE_LOAD_ATTEMPTS;

              if (canLoadAgain) {
                console.log("Scheduling balance update via reactive block");

                // Clear any existing timer
                if (balanceLoadingTimer) {
                  clearTimeout(balanceLoadingTimer);
                }

                // Debounce the balance loading trigger
                balanceLoadingTimer = setTimeout(() => {
                  if (token0 && token1 && $auth.account?.owner && !isLoadingBalances) { // Re-check state
                    console.log("Executing debounced balance load from reactive block");
                    // Pass false for forceRefresh, let throttling handle repeats
                    loadBalancesIfNecessary([token0, token1], $auth.account.owner, false);
                  }
                  balanceLoadingTimer = null;
                }, 150); // Slightly longer debounce for reactive triggers
              } else {
                 console.log("Skipping balance update trigger - throttled");
              }
            }
          }
        } else {
          // If tokens are not set, reset pool state
          poolExists = null;
          pool = null;
        }
      }
    }
  }

  // Reactive block to update local balance variables from the store
  $: {
    if (token0?.address) {
      token0Balance = $currentUserBalancesStore[token0.address]?.in_tokens?.toString() || "0";
    } else {
      token0Balance = "0";
    }
    if (token1?.address) {
      token1Balance = $currentUserBalancesStore[token1.address]?.in_tokens?.toString() || "0";
    } else {
      token1Balance = "0";
    }
  }

  // Token selection handler
  function handleTokenSelect(index: 0 | 1, token: Kong.Token) {
    const otherToken = index === 0 ? token1 : token0;
    const result = validateTokenSelect(
      token,
      otherToken,
      ALLOWED_TOKEN_SYMBOLS,
      DEFAULT_TOKEN,
      $userTokens.tokens
    );

    if (!result.isValid) {
      toastStore.error(result.error);
      return;
    }

    // Clear any existing balance loading timer to prevent stale updates
    if (balanceLoadingTimer) {
      clearTimeout(balanceLoadingTimer);
      balanceLoadingTimer = null;
    }

    // Reset balance tracking data when tokens change
    lastLoadedTokenPair = "";
    balanceLoadAttempts = 0;
    lastBalanceLoadTime = 0;

    // Reset pool-related state immediately
    poolExists = null;
    pool = null;
    liquidityStore.resetAmounts(); // Reset amounts when tokens change
    liquidityStore.setInitialPrice(""); // Reset price when tokens change by setting to empty string

    // Update store and URL
    liquidityStore.setToken(index, result.newToken);
    updateQueryParams(
      index === 0 ? result.newToken?.address : $liquidityStore.token0?.address,
      index === 1 ? result.newToken?.address : $liquidityStore.token1?.address
    );
    
    // Don't manually reset local token balances to "0" here.
    // The reactive block depending on $currentUserBalancesStore will update them.

    // Immediately update local tokens
    token0 = $liquidityStore.token0;
    token1 = $liquidityStore.token1;

    // Immediately check if pool exists if both tokens are available
    if (token0 && token1) {
      const currentPoolExists = doesPoolExist(token0, token1, $livePools);
      poolExists = currentPoolExists; // Update state right away

      if (poolExists) {
        pool = $livePools.find(p =>
            (p.address_0 === token0?.address && p.address_1 === token1?.address) ||
            (p.address_0 === token1?.address && p.address_1 === token0?.address)
        );
        console.log("Pool found immediately after token change:", pool);
        // If pool exists, set price based on pool ratio (if applicable)
        // This might require recalculating amounts based on the existing pool's ratio
        // For now, let's rely on the user potentially adjusting amounts or price
      } else {
         pool = null; // Ensure pool is null if it doesn't exist
      }

      // Trigger balance load for the new pair if needed
      if ($auth?.isInitialized && $auth?.account?.owner) {
          console.log("Triggering balance load after token select");
          // Force refresh might be desired here, or rely on throttling logic
          loadBalancesIfNecessary([token0, token1], $auth.account.owner, true);
      }
    }
  }

  // Handle price input changes with debouncing
  function handlePriceChange(value: string) {
    // Update price immediately for responsiveness
    liquidityStore.setInitialPrice(value);
    
    // Clear any existing timer
    if (priceDebounceTimer) {
      clearTimeout(priceDebounceTimer);
    }
    
    // Skip expensive logging during typing
    
    // Debounce the expensive calculation
    priceDebounceTimer = setTimeout(() => {
      if (poolExists === false || (
          pool && (pool.balance_0 === 0n || 
                  pool.balance_0?.toString() === "0" || 
                  Number(pool.balance_0) === 0))
      ) {
        liquidityStore.setAmount(1, calculateToken1FromPrice($liquidityStore.amount0, value));
      }
      priceDebounceTimer = null;
    }, DEBOUNCE_DELAY);
  }

  // Handle amount input changes with debouncing
  async function handleAmountChange(index: 0 | 1, value: string) {
    const sanitizedValue = value.replace(/,/g, '');
    
    // Update the amount immediately for responsiveness
    liquidityStore.setAmount(index, sanitizedValue);
    
    // Clear any existing timer
    if (amountDebounceTimer) {
      clearTimeout(amountDebounceTimer);
    }
    
    // Skip expensive logging during typing
    
    // Debounce the expensive calculations and API calls
    amountDebounceTimer = setTimeout(async () => {
      // For new pools or pools with zero balance
      if (poolExists === false || (poolExists === true && (pool?.balance_0 === 0n || pool?.balance_0?.toString() === "0"))) {
        if ($liquidityStore.initialPrice) {
          const otherIndex = index === 0 ? 1 : 0;
          const amount = index === 0 
            ? calculateToken1FromPrice(sanitizedValue, $liquidityStore.initialPrice) 
            : calculateToken0FromPrice(sanitizedValue, $liquidityStore.initialPrice);
          liquidityStore.setAmount(otherIndex, amount || "0");
        }
      } 
      // For existing pools with non-zero balance
      else if (poolExists === true && pool && token0 && token1) {
        safeExec(async () => {
          const otherIndex = index === 0 ? 1 : 0;
          const calcFn = index === 0 ? calculateToken1FromPoolRatio : calculateToken0FromPoolRatio;
          liquidityStore.setAmount(otherIndex, await calcFn(sanitizedValue, token0, token1, pool));
        }, "Failed to calculate amounts");
      }
      amountDebounceTimer = null;
    }, DEBOUNCE_DELAY);
  }

  // Handle percentage click to set token amount based on percentage of balance
  const handlePercentageClick = (index: 0 | 1) => (percentage: number) => {
    const token = index === 0 ? token0 : token1;
    const balance = index === 0 ? token0Balance : token1Balance;
    
    if (!token || !balance) return;
    
    safeExec(async () => {
      const amount = calculateAmountFromPercentage(token, balance, percentage);
      handleAmountChange(index, amount);
    }, "Failed to calculate amount");
  };

  // Actions to create pool or add liquidity
  async function handleCreatePool() {
    if (!token0 || !token1) return;
    
    // Ensure amounts are valid BigNumbers before parsing
    const amount0Str = $liquidityStore.amount0 || "0";
    const amount1Str = $liquidityStore.amount1 || "0";
    
    safeExec(async () => {
      // Validate amounts are positive
      if (new BigNumber(amount0Str).lte(0) || new BigNumber(amount1Str).lte(0)) {
          throw new Error("Amounts must be greater than zero.");
      }
      const amount0 = parseTokenAmount(amount0Str, token0.decimals);
      const amount1 = parseTokenAmount(amount1Str, token1.decimals);
      if (!amount0 || !amount1) throw new Error("Invalid amounts");
      showConfirmModal = true;
    }, "Failed to create pool");
  }

  async function handleAddLiquidity() {
    if (!token0 || !token1) return;
    
    const amount0Str = $liquidityStore.amount0 || "0";
    const amount1Str = $liquidityStore.amount1 || "0"; // Get amount1 as well

    safeExec(async () => {
      // Validate amounts are positive
      if (new BigNumber(amount0Str).lte(0)) { // Primary amount must be positive
        throw new Error(`Amount for ${token0.symbol} must be greater than zero.`);
      }
      if (new BigNumber(amount1Str).lte(0)) { // Derived amount must also be positive
        throw new Error(`Amount for ${token1.symbol} must be greater than zero.`);
      }
      
      const amount0 = parseTokenAmount(amount0Str, token0.decimals);
      if (!amount0) throw new Error("Invalid amount for " + token0.symbol);

      // For existing pools with non-zero balance, re-calculate expected token1 amount based on token0 input
      if (poolExists === true && !hasZeroBalance(pool)) {
        const result = await calculateLiquidityAmounts(token0.symbol, amount0, token1.symbol);
        if (!result.Ok) throw new Error(result.Err || "Failed to calculate liquidity amounts");
        
        const calculatedAmount1 = toBigNumber(result.Ok.amount_1)
            .div(new BigNumber(10).pow(token1.decimals));
            
        // Compare calculated amount with current input amount1 for safety check (optional)
        const inputAmount1 = new BigNumber(amount1Str);
        if (!inputAmount1.isEqualTo(calculatedAmount1)) {
             console.warn(`Input amount1 (${inputAmount1.toString()}) differs from calculated amount1 (${calculatedAmount1.toString()}) based on pool ratio. Using calculated amount.`);
             // Update the store to reflect the calculated amount before showing modal
             liquidityStore.setAmount(1, calculatedAmount1.toString());
        }
        // Ensure amount1 is also parsed correctly for the modal/confirmation step
        const amount1 = parseTokenAmount(calculatedAmount1.toString(), token1.decimals);
        if (!amount1) throw new Error("Invalid calculated amount for " + token1.symbol);

      }
      // For new pools or pools with zero balance, we use the amounts derived from the initial price
      else if (poolExists === false || hasZeroBalance(pool)) {
        if (!$liquidityStore.initialPrice) {
          throw new Error("Initial price is required for new pools or pools with zero balance");
        }
        // Ensure amount1 is parsed correctly
        const amount1 = parseTokenAmount(amount1Str, token1.decimals);
        if (!amount1) throw new Error("Invalid amount for " + token1.symbol);
      }

      showConfirmModal = true;
    }, "Failed to add liquidity");
  }

  // Helper function to detect zero balance pools consistently
  function hasZeroBalance(poolToCheck: BE.Pool | null): boolean {
    if (!poolToCheck) return true; // No pool is like a zero balance pool for UI purposes
    if (typeof poolToCheck.balance_0 === 'undefined' || typeof poolToCheck.balance_1 === 'undefined') return true; // Missing balance info

    // Check both balances are zero
    const bal0_is_zero = (typeof poolToCheck.balance_0 === 'number' && poolToCheck.balance_0 === 0) ||
                         (typeof poolToCheck.balance_0 === 'bigint' && poolToCheck.balance_0 === 0n) ||
                         poolToCheck.balance_0?.toString() === "0";

    const bal1_is_zero = (typeof poolToCheck.balance_1 === 'number' && poolToCheck.balance_1 === 0) ||
                         (typeof poolToCheck.balance_1 === 'bigint' && poolToCheck.balance_1 === 0n) ||
                         poolToCheck.balance_1?.toString() === "0";

    return bal0_is_zero && bal1_is_zero;
  }

  onDestroy(() => {
    // Clear any pending timers
    if (amountDebounceTimer) clearTimeout(amountDebounceTimer);
    if (priceDebounceTimer) clearTimeout(priceDebounceTimer);
    if (balanceLoadingTimer) clearTimeout(balanceLoadingTimer);
    
    // Only reset amounts on destroy, keep the tokens
    liquidityStore.resetAmounts();
  });
</script>

<Panel variant="transparent" width="auto" className="!p-0">
  <div class="flex flex-col min-h-[165px] box-border relative rounded-lg">
    {#if isLoading}
      <div class="flex items-center justify-center h-64">
        <div class="spinner w-10 h-10 border-4 border-t-4 border-t-kong-primary rounded-full animate-spin"></div>
      </div>
    {:else}
      <div class="relative space-y-6 p-4">
        <div class="mb-2">
          <h3 class="text-kong-text-primary/90 text-sm font-medium uppercase mb-2">
            Select Tokens
          </h3>
          <TokenSelectionPanel
            {token0}
            {token1}
            onTokenSelect={handleTokenSelect}
            secondaryTokenIds={SECONDARY_TOKEN_IDS}
          />
        </div>

        {#if token0 && token1}
          <PositionDisplay
            token0={$liquidityStore.token0}
            token1={$liquidityStore.token1}
            layout="horizontal"
          />
        {/if}

        {#if token0 && token1 && (poolExists === false || hasZeroBalance(pool))}
          <div class="flex flex-col gap-4">
            <PoolWarning {token0} {token1} />
            <div>
              <h3 class="text-kong-text-primary/90 text-sm font-medium uppercase mb-2">
                Set Initial Price
              </h3>
              <InitialPriceInput
                {token0}
                {token1}
                onPriceChange={handlePriceChange}
              />
            </div>
          </div>
        {/if}

        {#if token0 && token1}
          <div class="mt-2">
            <h3 class="text-kong-text-primary/90 text-sm font-medium uppercase mb-2">
              {#if poolExists === false || hasZeroBalance(pool)}
                Initial Deposits
              {:else}
                Deposit Amounts
              {/if}
            </h3>
            <AmountInputs
              {token0}
              {token1}
              amount0={$liquidityStore.amount0}
              amount1={$liquidityStore.amount1}
              {token0Balance}
              {token1Balance}
              onAmountChange={handleAmountChange}
              onPercentageClick={handlePercentageClick(0)}
              onToken1PercentageClick={handlePercentageClick(1)}
            />
          </div>

          <div class="mt-6">
            <ButtonV2
              variant="solid"
              theme={buttonTheme}
              size="lg"
              fullWidth={true}
              on:click={poolExists === false ? handleCreatePool : handleAddLiquidity}
              isDisabled={buttonText !== "Review Transaction"}
            >
              {buttonText}
            </ButtonV2>
          </div>
        {:else}
          <div class="text-center text-kong-text-primary/70 py-8">
            Select both tokens to create a new liquidity pool
          </div>
        {/if}
      </div>
    {/if}
  </div>
</Panel>

{#if showConfirmModal}
  <ConfirmLiquidityModal
    isCreatingPool={poolExists === false}
    show={showConfirmModal}
    onClose={() => {
      liquidityStore.resetAmounts();
      showConfirmModal = false;
      currentUserPoolsStore.initialize();
    }}
  />
{/if}

<style>
  .spinner {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
