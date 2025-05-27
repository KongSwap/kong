<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import TokenSelectionPanel from "./TokenSelectionPanel.svelte";
  import AmountInputs from "./AmountInputs.svelte";
  import InitialPriceInput from "./InitialPriceInput.svelte";
  import PoolWarning from "./PoolWarning.svelte";
  import ConfirmLiquidityModal from "$lib/components/liquidity/modals/ConfirmLiquidityModal.svelte";
  
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { loadBalances } from "$lib/stores/balancesStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { page } from "$app/stores";
  import { auth } from "$lib/stores/auth";
  import { livePools } from "$lib/stores/poolStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  
  import { onDestroy, onMount } from "svelte";
  import { BigNumber } from "bignumber.js";
  import { get } from 'svelte/store';
  
  import {
    CKUSDT_CANISTER_ID,
    ICP_CANISTER_ID,
  } from "$lib/constants/canisterConstants";
  
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";
  import { calculateLiquidityAmounts } from "$lib/api/pools";
  
  import {
    validateTokenSelect,
    updateQueryParams,
  } from "$lib/utils/poolCreationUtils";
  
  import { 
    calculateToken1FromPrice, 
    calculateToken0FromPrice,
    calculateToken1FromPoolRatio,
    calculateToken0FromPoolRatio,
    calculateAmountFromPercentage,
  } from "$lib/utils/liquidityUtils";
  
  import { debounce } from "$lib/utils/debounce";
  import { useLiquidityPanel } from "./composables/useLiquidityPanel";

  // Constants
  const ALLOWED_TOKEN_SYMBOLS = ["ICP", "ckUSDT"];
  const DEFAULT_TOKEN = "ICP";
  const SECONDARY_TOKEN_IDS = [ICP_CANISTER_ID, CKUSDT_CANISTER_ID];

  // Core state
  let showConfirmModal = false;
  let isLoading = true;

  // Use composables for cleaner logic separation
  const liquidityPanel = useLiquidityPanel();
  
  // Extract stores from composable
  const { 
    token0: token0Store, 
    token1: token1Store, 
    pool: poolStore, 
    poolExists: poolExistsStore,
    token0Balance: token0BalanceStore,
    token1Balance: token1BalanceStore,
    buttonText: buttonTextStore,
    buttonTheme: buttonThemeStore,
    initializeTokens,
    updatePoolState
  } = liquidityPanel;
  
  // Subscribe to reactive values
  $: token0 = $token0Store;
  $: token1 = $token1Store;
  $: pool = $poolStore;
  $: poolExists = $poolExistsStore;
  $: token0Balance = $token0BalanceStore;
  $: token1Balance = $token1BalanceStore;
  $: buttonText = $buttonTextStore;
  $: buttonTheme = $buttonThemeStore;
  
  // Debounced handlers
  const debouncedPriceChange = debounce((value: string) => {
    const currentPoolExists = get(poolExistsStore);
    const currentPool = get(poolStore);
    
    if (currentPoolExists === false || currentPool?.balance_0 === 0n) {
      liquidityStore.setAmount(1, calculateToken1FromPrice($liquidityStore.amount0, value));
    }
  }, 150);

  const debouncedAmountChange = debounce(async (index: 0 | 1, value: string) => {
    const currentPoolExists = get(poolExistsStore);
    const currentPool = get(poolStore);
    const currentToken0 = get(token0Store);
    const currentToken1 = get(token1Store);
    
    if (currentPoolExists === false || currentPool?.balance_0 === 0n) {
      if ($liquidityStore.initialPrice) {
        const otherIndex = index === 0 ? 1 : 0;
        const amount = index === 0 
          ? calculateToken1FromPrice(value, $liquidityStore.initialPrice) 
          : calculateToken0FromPrice(value, $liquidityStore.initialPrice);
        liquidityStore.setAmount(otherIndex, amount || "0");
      }
    } else if (currentPoolExists === true && currentPool && currentToken0 && currentToken1) {
      try {
        const otherIndex = index === 0 ? 1 : 0;
        const calcFn = index === 0 ? calculateToken1FromPoolRatio : calculateToken0FromPoolRatio;
        liquidityStore.setAmount(otherIndex, await calcFn(value, currentToken0, currentToken1, currentPool));
      } catch (error) {
        console.error("Failed to calculate amounts:", error);
      }
    }
  }, 150);

  // Initialize component
  onMount(async () => {
    try {
      await initializeTokens($page.url.searchParams, $userTokens.tokens);
      
      if ($auth?.account?.owner && $liquidityStore.token0 && $liquidityStore.token1) {
        await loadBalances([$liquidityStore.token0, $liquidityStore.token1], $auth.account.owner);
      }
    } catch (error) {
      console.error("Error during initialization:", error);
    } finally {
      isLoading = false;
    }
  });

  // Update pool state when tokens or pools change
  $: if ($liquidityStore.token0 && $liquidityStore.token1 && $livePools.length > 0) {
    updatePoolState($liquidityStore.token0, $liquidityStore.token1, $livePools);
  }

  // Update balances reactively
  $: if ($liquidityStore.token0 && $liquidityStore.token1 && $auth?.account?.owner && !isLoading) {
    loadBalances([$liquidityStore.token0, $liquidityStore.token1], $auth.account.owner);
  }

  // Token selection handler
  async function handleTokenSelect(index: 0 | 1, token: Kong.Token) {
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

    // Reset state
    liquidityStore.resetAmounts();
    liquidityStore.setInitialPrice("");
    
    // Update store and URL
    liquidityStore.setToken(index, result.newToken);
    updateQueryParams(
      index === 0 ? result.newToken?.address : $liquidityStore.token0?.address,
      index === 1 ? result.newToken?.address : $liquidityStore.token1?.address
    );

    // Load new balances
    if ($auth?.account?.owner && result.newToken) {
      const tokensToLoad = index === 0 
        ? [result.newToken, token1].filter(Boolean)
        : [token0, result.newToken].filter(Boolean);
      
      if (tokensToLoad.length === 2) {
        await loadBalances(tokensToLoad as Kong.Token[], $auth.account.owner);
      }
    }
  }

  // Handle input changes
  function handlePriceChange(value: string) {
    liquidityStore.setInitialPrice(value);
    debouncedPriceChange(value);
  }

  function handleAmountChange(index: 0 | 1, value: string) {
    const sanitizedValue = value.replace(/,/g, '');
    liquidityStore.setAmount(index, sanitizedValue);
    debouncedAmountChange(index, sanitizedValue);
  }

  // Handle percentage clicks
  const handlePercentageClick = (index: 0 | 1) => async (percentage: number) => {
    const token = index === 0 ? token0 : token1;
    const balance = index === 0 ? token0Balance : token1Balance;
    
    if (!token || !balance) return;
    
    try {
      const amount = calculateAmountFromPercentage(token, balance, percentage);
      handleAmountChange(index, amount);
    } catch (error) {
      toastStore.error("Failed to calculate amount");
    }
  };

  // Action handlers
  async function handleCreatePool() {
    if (!token0 || !token1) return;
    
    const amount0Str = $liquidityStore.amount0 || "0";
    const amount1Str = $liquidityStore.amount1 || "0";
    
    try {
      if (new BigNumber(amount0Str).lte(0) || new BigNumber(amount1Str).lte(0)) {
        throw new Error("Amounts must be greater than zero.");
      }
      
      const amount0 = parseTokenAmount(amount0Str, token0.decimals);
      const amount1 = parseTokenAmount(amount1Str, token1.decimals);
      
      if (!amount0 || !amount1) throw new Error("Invalid amounts");
      
      showConfirmModal = true;
    } catch (error) {
      toastStore.error(error.message || "Failed to create pool");
    }
  }

  async function handleAddLiquidity() {
    if (!token0 || !token1) return;
    
    const amount0Str = $liquidityStore.amount0 || "0";
    const amount1Str = $liquidityStore.amount1 || "0";

    try {
      if (new BigNumber(amount0Str).lte(0) || new BigNumber(amount1Str).lte(0)) {
        throw new Error("Both amounts must be greater than zero.");
      }
      
      const amount0 = parseTokenAmount(amount0Str, token0.decimals);
      if (!amount0) throw new Error(`Invalid amount for ${token0.symbol}`);

      // For existing pools, recalculate amounts
      if (poolExists === true && pool?.balance_0 !== 0n) {
        const result = await calculateLiquidityAmounts(token0.symbol, amount0, token1.symbol);
        if ('Err' in result) throw new Error(result.Err || "Failed to calculate liquidity amounts");
        
        const calculatedAmount1 = new BigNumber(result.Ok.amount_1.toString())
          .div(new BigNumber(10).pow(token1.decimals));
        
        liquidityStore.setAmount(1, calculatedAmount1.toString());
      }

      showConfirmModal = true;
    } catch (error) {
      toastStore.error(error.message || "Failed to add liquidity");
    }
  }

  onDestroy(() => {
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

        {#if token0 && token1 && (poolExists === false || pool?.balance_0 === 0n)}
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
              {poolExists === false || pool?.balance_0 === 0n ? "Initial Deposits" : "Deposit Amounts"}
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
