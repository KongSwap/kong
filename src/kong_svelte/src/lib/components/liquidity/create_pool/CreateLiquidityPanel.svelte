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
  } from "$lib/stores/tokenStore";
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
    calculateAmountFromPercentage
  } from "$lib/utils/liquidityUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import { page } from "$app/stores";
  import { auth } from "$lib/services/auth";
  import { livePools } from "$lib/services/pools/poolStore";
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
  const DEBOUNCE_DELAY = 300; // 300ms debounce delay

  // State variables
  let token0: FE.Token = null;
  let token1: FE.Token = null;
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
  const MAX_BALANCE_LOAD_ATTEMPTS = 3; // Maximum number of times to try loading balances
  const MIN_BALANCE_LOAD_INTERVAL = 2000; // Minimum time (ms) between balance loads
  
  // Debounce timers
  let amountDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let priceDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let balanceLoadingTimer: ReturnType<typeof setTimeout> | null = null;

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
  async function loadBalancesAndUpdateStore(tokens, owner, forceRefresh = true) {
    const currentTime = Date.now();
    const tokenPairKey = tokens.map(t => t.canister_id).sort().join('-');
    
    // Prevent loading the same token pair repeatedly in a short time window
    if (tokenPairKey === lastLoadedTokenPair && 
        currentTime - lastBalanceLoadTime < MIN_BALANCE_LOAD_INTERVAL) {
      console.log("Throttling balance load - too frequent for the same tokens");
      return null;
    }
    
    // Return early if already loading to prevent race conditions
    if (isLoadingBalances) {
      console.log("Skipping balance load - already in progress");
      return null;
    }
    
    // Limit maximum attempts to prevent infinite loops
    if (tokenPairKey === lastLoadedTokenPair && balanceLoadAttempts >= MAX_BALANCE_LOAD_ATTEMPTS) {
      console.log(`Max balance load attempts (${MAX_BALANCE_LOAD_ATTEMPTS}) reached for these tokens, stopping`);
      return null;
    }
    
    try {
      isLoadingBalances = true;
      lastLoadedTokenPair = tokenPairKey;
      lastBalanceLoadTime = currentTime;
      balanceLoadAttempts++;
      
      console.log(`Loading balances attempt ${balanceLoadAttempts}/${MAX_BALANCE_LOAD_ATTEMPTS} for`, tokens.map(t => t.symbol).join(", "));
      
      const balances = await safeExec(
        () => loadBalances(tokens, owner, forceRefresh),
        "Error loading balances"
      ) || {};
      
      // Only update if the component is still mounted and tokens haven't changed
      if (token0?.canister_id && token1?.canister_id) {
        const tokensMatch = tokens.some(t => t.canister_id === token0?.canister_id) && 
                           tokens.some(t => t.canister_id === token1?.canister_id);
        
        if (tokensMatch) {
          console.log("Updating balances store with new values");
          const currentBalances = { ...$currentUserBalancesStore, ...balances };
          currentUserBalancesStore.set(currentBalances);
          
          // Update local token balance variables safely
          const newToken0Balance = currentBalances[token0.canister_id]?.in_tokens?.toString() || "0";
          const newToken1Balance = currentBalances[token1.canister_id]?.in_tokens?.toString() || "0";
          
          // Only update if balances have changed
          if (token0Balance !== newToken0Balance || token1Balance !== newToken1Balance) {
            token0Balance = newToken0Balance;
            token1Balance = newToken1Balance;
            console.log("Updated balances:", token0.symbol, token0Balance, token1.symbol, token1Balance);
          } else {
            console.log("Balances unchanged, skipping further loads");
            // Reset attempts since balances are now stable
            balanceLoadAttempts = MAX_BALANCE_LOAD_ATTEMPTS;
          }
        } else {
          console.log("Tokens changed during balance loading, skipping update");
        }
      }
      
      return balances;
    } catch (error) {
      console.error("Error loading balances:", error);
      return {};
    } finally {
      isLoadingBalances = false;
    }
  }

  // Improved function to load initial tokens from URL or defaults
  async function loadInitialTokens() {
    console.log("loadInitialTokens called");
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
          tokensFromUrl = [];
        }
      }
      
      // Get default tokens as fallbacks
      const defaultToken0 = $userTokens.tokens.find(token => token.canister_id === ICP_CANISTER_ID) || null;
      const defaultToken1 = $userTokens.tokens.find(token => token.canister_id === CKUSDT_CANISTER_ID) || null;
      
      // Set tokens with proper fallbacks
      liquidityStore.setToken(0, 
        tokensFromUrl.find(token => token.canister_id === urlToken0) || 
        defaultToken0
      );
      
      liquidityStore.setToken(1, 
        tokensFromUrl.find(token => token.canister_id === urlToken1) || 
        defaultToken1
      );
      
      initialLoadComplete = true;
    } catch (error) {
      console.error("Error loading initial tokens:", error);
      // Set default tokens if error occurs
      try {
        const defaultToken0 = $userTokens.tokens.find(token => token.canister_id === ICP_CANISTER_ID) || null;
        const defaultToken1 = $userTokens.tokens.find(token => token.canister_id === CKUSDT_CANISTER_ID) || null;
        
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
      console.log("Auth state changed:", authState.isInitialized, authInitialized);
      if (authState.isInitialized && !authInitialized) {
        authInitialized = true;
        
        try {
          // Wait for user tokens to be available
          if ($userTokens.tokens.length > 0) {
            await loadInitialTokens();
            
            if (authState.account?.owner) {
              await loadBalancesAndUpdateStore(
                $userTokens.tokens, 
                authState.account.owner.toString(), 
                true
              );
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
    loadBalancesAndUpdateStore($userTokens.tokens, $auth.account.owner.toString(), true);
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
    const token0Id = $liquidityStore.token0?.canister_id;
    const token1Id = $liquidityStore.token1?.canister_id;
    const livePoolsLength = $livePools.length;
    
    // Safely get a timestamp, falling back to the current time
    const balancesTimestamp = typeof $currentUserBalancesStore.lastUpdated === 'number' 
      ? $currentUserBalancesStore.lastUpdated 
      : Date.now();
      
    const authOwner = $auth?.account?.owner?.toString();
    
    // Check if anything meaningful has changed to avoid unnecessary executions
    const hasChanged = 
      isLoading !== lastReactiveState.isLoading ||
      token0Id !== lastReactiveState.token0Id ||
      token1Id !== lastReactiveState.token1Id ||
      livePoolsLength !== lastReactiveState.livePools ||
      balancesTimestamp !== lastReactiveState.currentUserBalancesTimestamp ||
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
          // Create a key to check if we need to update
          const tokenKey = `${token0.canister_id}-${token1.canister_id}`;
          const currentPoolExists = doesPoolExist(token0, token1, $livePools);
          
          // Only update if there's a change in poolExists
          if (poolExists !== currentPoolExists) {
            console.log("Pool exists changed:", poolExists, "->", currentPoolExists);
            poolExists = currentPoolExists;
          
            // Only find pool if poolExists is true
            pool = poolExists ? $livePools.find(p => 
              p.address_0 === token0?.address && 
              p.address_1 === token1?.address
            ) : null;
  
            // Reset balance load attempts when pool status changes
            balanceLoadAttempts = 0;
          }
          
          // Only load balances if both tokens are available and we need to
          if (token0?.canister_id && token1?.canister_id && $auth?.isInitialized && $auth?.account?.owner) {
            // Avoid unnecessary balance updates
            const shouldUpdateBalances = 
              (token0Balance === "0" || 
              token1Balance === "0" || 
              !$currentUserBalancesStore[token0.canister_id] || 
              !$currentUserBalancesStore[token1.canister_id]) &&
              balanceLoadAttempts < MAX_BALANCE_LOAD_ATTEMPTS;
              
            if (shouldUpdateBalances && !isLoadingBalances) {
              // Check if we've loaded this token pair recently
              const tokenPairKey = [token0.canister_id, token1.canister_id].sort().join('-');
              const currentTime = Date.now();
              const canLoadAgain = 
                tokenPairKey !== lastLoadedTokenPair || 
                currentTime - lastBalanceLoadTime >= MIN_BALANCE_LOAD_INTERVAL;
              
              if (canLoadAgain) {
                console.log("Scheduling balance update");
                
                // Clear any existing timer
                if (balanceLoadingTimer) {
                  clearTimeout(balanceLoadingTimer);
                }
                
                // Debounce the balance loading to prevent rapid consecutive calls
                balanceLoadingTimer = setTimeout(() => {
                  if (!isLoadingBalances) {
                    console.log("Executing debounced balance load");
                    loadBalancesAndUpdateStore([token0, token1], $auth.account.owner.toString(), false);
                  }
                  balanceLoadingTimer = null;
                }, 100); // Short debounce for balance loading
              } else {
                console.log("Skipping balance update - tokens were loaded recently");
              }
            } else if (!shouldUpdateBalances && balanceLoadAttempts < MAX_BALANCE_LOAD_ATTEMPTS) {
              // Update local balance variables safely without API call
              token0Balance = $currentUserBalancesStore[token0.canister_id]?.in_tokens?.toString() || "0";
              token1Balance = $currentUserBalancesStore[token1.canister_id]?.in_tokens?.toString() || "0";
            }
          }
        }
      }
    }
  }

  // Token selection handler
  function handleTokenSelect(index: 0 | 1, token: FE.Token) {
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

    // Update store and URL
    liquidityStore.setToken(index, result.newToken);
    updateQueryParams(
      index === 0 ? result.newToken?.canister_id : $liquidityStore.token0?.canister_id,
      index === 1 ? result.newToken?.canister_id : $liquidityStore.token1?.canister_id
    );
    
    // Reset the balance for the updated token to trigger a new balance load
    if (index === 0) {
      token0Balance = "0";
    } else {
      token1Balance = "0";
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
    
    // Debounce the expensive calculation
    priceDebounceTimer = setTimeout(() => {
      if (poolExists === false || pool?.balance_0 === 0n) {
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
    
    // Debounce the expensive calculations and API calls
    amountDebounceTimer = setTimeout(async () => {
      // For new pools or pools with zero balance
      if (poolExists === false || (poolExists === true && pool?.balance_0 === 0n)) {
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
    
    safeExec(async () => {
      const amount0 = parseTokenAmount($liquidityStore.amount0, token0.decimals);
      const amount1 = parseTokenAmount($liquidityStore.amount1, token1.decimals);
      if (!amount0 || !amount1) throw new Error("Invalid amounts");
      showConfirmModal = true;
    }, "Failed to create pool");
  }

  async function handleAddLiquidity() {
    if (!token0 || !token1) return;
    
    safeExec(async () => {
      const amount0 = parseTokenAmount($liquidityStore.amount0, token0.decimals);
      if (!amount0) throw new Error("Invalid amount for " + token0.symbol);

      if (poolExists === true && pool?.balance_0 !== 0n) {
        const result = await calculateLiquidityAmounts(token0.symbol, amount0, token1.symbol);
        if (!result.Ok) throw new Error("Failed to calculate liquidity amounts");
        
        liquidityStore.setAmount(1, toBigNumber(result.Ok.amount_1)
          .div(new BigNumber(10).pow(token1.decimals))
          .toString()
        );
      }
      showConfirmModal = true;
    }, "Failed to add liquidity");
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

        {#if token0 && token1 && (poolExists === false || (pool && pool.balance_0 === 0n))}
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
              {#if poolExists === false || (pool && pool.balance_0 === 0n)}
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
              theme="accent-green"
              size="lg"
              fullWidth={true}
              on:click={poolExists === false ? handleCreatePool : handleAddLiquidity}
              isDisabled={!$liquidityStore.amount0 || !$liquidityStore.amount1 || 
                          (poolExists === false && !$liquidityStore.initialPrice)}
            >
              {poolExists === false ? 'Create Pool' : 'Add Liquidity'}
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
