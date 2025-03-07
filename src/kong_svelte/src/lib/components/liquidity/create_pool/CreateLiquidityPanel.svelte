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

  // State variables
  let token0: FE.Token | null = null;
  let token1: FE.Token | null = null;
  let pool: BE.Pool | null = null;
  let poolExists: boolean | null = null;
  let token0Balance: string = "0";
  let token1Balance: string = "0";
  let initialLoadComplete = false;
  let authInitialized = false;
  let showConfirmModal = false;

  // Helper to safely convert value to BigNumber
  function toBigNumber(value: any): BigNumber {
    if (!value) return new BigNumber(0);
    try {
      return new BigNumber(value.toString());
    } catch (error) {
      console.error("Error converting to BigNumber:", error);
      return new BigNumber(0);
    }
  }

  // Consolidated function to handle loading balances and updating the store
  async function loadBalancesAndUpdateStore(tokensToLoad, owner, forceRefresh = true) {
    try {
      const balances = await loadBalances(tokensToLoad, owner, forceRefresh);
      const currentBalances = { ...$currentUserBalancesStore, ...balances };
      currentUserBalancesStore.set(currentBalances);
      
      // Update local token balance variables
      updateLocalTokenBalances(currentBalances);
      return balances;
    } catch (err) {
      console.error("Error loading balances:", err);
      return {};
    }
  }

  // Helper to update local token balance variables
  function updateLocalTokenBalances(balances) {
    if (token0?.canister_id) {
      token0Balance = balances[token0.canister_id]?.in_tokens?.toString() || "0";
    }
    if (token1?.canister_id) {
      token1Balance = balances[token1.canister_id]?.in_tokens?.toString() || "0";
    }
  }

  // Load initial tokens from URL or defaults
  async function loadInitialTokens() {
    const urlToken0 = $page.url.searchParams.get("token0");
    const urlToken1 = $page.url.searchParams.get("token1");

    const tokensFromUrl = await fetchTokensByCanisterId([urlToken0, urlToken1]);
    const token0FromUrl = tokensFromUrl.find(token => token.canister_id === urlToken0);
    const token1FromUrl = tokensFromUrl.find(token => token.canister_id === urlToken1);

    const defaultToken0 = $userTokens.tokens.find(token => token.canister_id === ICP_CANISTER_ID);
    const defaultToken1 = $userTokens.tokens.find(token => token.canister_id === CKUSDT_CANISTER_ID);

    liquidityStore.setToken(0, token0FromUrl || defaultToken0 || null);
    liquidityStore.setToken(1, token1FromUrl || defaultToken1 || null);
    initialLoadComplete = true;
  }

  // Component lifecycle management
  onMount(() => {
    const unsubscribe = auth.subscribe(authState => {
      if (authState.isInitialized && !authInitialized) {
        authInitialized = true;
        if ($userTokens.tokens.length > 0) {
          loadInitialTokens();
          if (authState.account?.owner) {
            loadBalancesAndUpdateStore(
              $userTokens.tokens, 
              authState.account.owner.toString(), 
              true
            );
          }
        }
      }
    });
    return unsubscribe;
  });

  // Reactive statements for managing component state
  $: if ($userTokens.tokens.length > 0 && !initialLoadComplete) loadInitialTokens();

  $: if ($auth?.isInitialized && $auth?.account?.owner && $userTokens.tokens.length > 0) {
    loadBalancesAndUpdateStore($userTokens.tokens, $auth.account.owner.toString(), true);
  }

  // Token updates and balance loading
  $: {
    token0 = $liquidityStore.token0;
    token1 = $liquidityStore.token1;
    
    // Update pool existence
    poolExists = token0 && token1 ? doesPoolExist(token0, token1, $livePools) : null;
    
    // Load token-specific balances
    if (token0?.canister_id && token1?.canister_id && $auth?.isInitialized && $auth?.account?.owner) {
      loadBalancesAndUpdateStore([token0, token1], $auth.account.owner.toString(), true);
    }
    
    // Update local balance variables from store
    updateLocalTokenBalances($currentUserBalancesStore);
  }

  // Find matching pool
  $: if (poolExists) {
    pool = $livePools.find(
      pool => pool.address_0 === token0?.address && pool.address_1 === token1?.address
    );
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

    // Update store and URL
    liquidityStore.setToken(index, result.newToken);
    const newToken0 = index === 0 ? result.newToken : $liquidityStore.token0;
    const newToken1 = index === 1 ? result.newToken : $liquidityStore.token1;
    updateQueryParams(newToken0?.canister_id, newToken1?.canister_id);
  }

  // Handle price input changes
  function handlePriceChange(value: string) {
    if (poolExists === false || pool?.balance_0 === 0n) {
      liquidityStore.setInitialPrice(value);
      const amount1 = calculateToken1FromPrice($liquidityStore.amount0, value);
      liquidityStore.setAmount(1, amount1);
    }
  }

  // Handle amount input changes
  async function handleAmountChange(index: 0 | 1, value: string) {
    // Sanitize input
    const sanitizedValue = value.replace(/,/g, '');
    liquidityStore.setAmount(index, sanitizedValue);
    
    // For new pools or pools with zero balance
    if (poolExists === false || (poolExists === true && pool?.balance_0 === 0n)) {
      if (index === 0 && $liquidityStore.initialPrice) {
        liquidityStore.setAmount(1, calculateToken1FromPrice(sanitizedValue, $liquidityStore.initialPrice) || "0");
      } else if (index === 1 && $liquidityStore.initialPrice) {
        liquidityStore.setAmount(0, calculateToken0FromPrice(sanitizedValue, $liquidityStore.initialPrice));
      }
    } 
    // For existing pools with non-zero balance
    else if (poolExists === true && pool && token0 && token1) {
      try {
        if (index === 0) {
          liquidityStore.setAmount(1, await calculateToken1FromPoolRatio(sanitizedValue, token0, token1, pool));
        } else {
          liquidityStore.setAmount(0, await calculateToken0FromPoolRatio(sanitizedValue, token0, token1, pool));
        }
      } catch (error) {
        console.error("Error calculating liquidity amounts:", error);
        toastStore.error("Failed to calculate amounts");
      }
    }
  }

  // Handle percentage click to set token amount based on percentage of balance
  function handlePercentageClick(percentage: number) {
    if (!token0 || !token0Balance) return;
    try {
      const amount = calculateAmountFromPercentage(token0, token0Balance, percentage);
      handleAmountChange(0, amount);
    } catch (error) {
      console.error("Error calculating percentage amount:", error);
      toastStore.error("Failed to calculate amount");
    }
  }

  function handleToken1PercentageClick(percentage: number) {
    if (!token1 || !token1Balance) return;
    try {
      const amount = calculateAmountFromPercentage(token1, token1Balance, percentage);
      handleAmountChange(1, amount);
    } catch (error) {
      console.error("Error calculating percentage amount:", error);
      toastStore.error("Failed to calculate amount");
    }
  }

  // Actions to create pool or add liquidity
  async function handleCreatePool() {
    if (!token0 || !token1) return;
    try {
      const amount0 = parseTokenAmount($liquidityStore.amount0, token0.decimals);
      const amount1 = parseTokenAmount($liquidityStore.amount1, token1.decimals);
      if (!amount0 || !amount1) throw new Error("Invalid amounts");
      showConfirmModal = true;
    } catch (error) {
      console.error("Error creating pool:", error);
      toastStore.error(error.message || "Failed to create pool");
    }
  }

  async function handleAddLiquidity() {
    if (!token0 || !token1) return;
    try {
      const amount0 = parseTokenAmount($liquidityStore.amount0, token0.decimals);
      if (!amount0) throw new Error("Invalid amount for " + token0.symbol);

      if (poolExists === true && pool?.balance_0 !== 0n) {
        const result = await calculateLiquidityAmounts(token0.symbol, amount0, token1.symbol);
        if (!result.Ok) throw new Error("Failed to calculate liquidity amounts");
        
        const calculatedAmount = toBigNumber(result.Ok.amount_1)
          .div(new BigNumber(10).pow(token1.decimals))
          .toString();
        
        liquidityStore.setAmount(1, calculatedAmount);
      }
      showConfirmModal = true;
    } catch (error) {
      console.error("Error adding liquidity:", error);
      toastStore.error(error.message || "Failed to add liquidity");
    }
  }

  onDestroy(() => {
    // Only reset amounts on destroy, keep the tokens
    liquidityStore.resetAmounts();
  });
</script>

<Panel variant="transparent" width="auto" className="!p-0">
  <div class="flex flex-col min-h-[165px] box-border relative rounded-lg">
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

      <div class="mt-2">
        <h3 class="text-kong-text-primary/90 text-sm font-medium uppercase mb-2">
          {#if poolExists === false || pool?.balance_0 === 0n}
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
          onAmountChange={(index, value) => handleAmountChange(index, value)}
          onPercentageClick={handlePercentageClick}
          onToken1PercentageClick={handleToken1PercentageClick}
        />
      </div>

      {#if token0 && token1 && poolExists === false}
        <div class="mt-6">
          <ButtonV2
            variant="solid"
            theme="accent-green"
            size="lg"
            fullWidth={true}
            on:click={handleCreatePool}
            isDisabled={!$liquidityStore.amount0 ||
              !$liquidityStore.amount1 ||
              !$liquidityStore.initialPrice}
          >
            Create Pool
          </ButtonV2>
        </div>
      {:else if token0 && token1 && poolExists === true}
        <div class="mt-6">
          <ButtonV2
            variant="solid"
            theme="accent-green"
            size="lg"
            fullWidth={true}
            on:click={handleAddLiquidity}
            isDisabled={!$liquidityStore.amount0 || !$liquidityStore.amount1}
          >
            Add Liquidity
          </ButtonV2>
        </div>
      {:else}
        <div class="text-center text-kong-text-primary/70 py-8">
          Select both tokens to create a new liquidity pool
        </div>
      {/if}
    </div>
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
