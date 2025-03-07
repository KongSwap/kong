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
  let token0: FE.Token = null;
  let token1: FE.Token = null;
  let pool: BE.Pool = null;
  let poolExists: boolean = null;
  let token0Balance = "0";
  let token1Balance = "0";
  let initialLoadComplete = false;
  let authInitialized = false;
  let showConfirmModal = false;

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

  const safeExec = async (fn: () => Promise<any>, errorMsg: string) => {
    try {
      return await fn();
    } catch (error) {
      console.error(`${errorMsg}:`, error);
      toastStore.error(error.message || errorMsg);
      return null;
    }
  };

  // Consolidated function to handle loading balances and updating the store
  async function loadBalancesAndUpdateStore(tokens, owner, forceRefresh = true) {
    const balances = await safeExec(
      () => loadBalances(tokens, owner, forceRefresh),
      "Error loading balances"
    ) || {};
    
    const currentBalances = { ...$currentUserBalancesStore, ...balances };
    currentUserBalancesStore.set(currentBalances);
    
    // Update local token balance variables
    token0?.canister_id && (token0Balance = currentBalances[token0.canister_id]?.in_tokens?.toString() || "0");
    token1?.canister_id && (token1Balance = currentBalances[token1.canister_id]?.in_tokens?.toString() || "0");
    
    return balances;
  }

  // Load initial tokens from URL or defaults
  async function loadInitialTokens() {
    const urlToken0 = $page.url.searchParams.get("token0");
    const urlToken1 = $page.url.searchParams.get("token1");
    const tokensFromUrl = await fetchTokensByCanisterId([urlToken0, urlToken1]);
    
    liquidityStore.setToken(0, 
      tokensFromUrl.find(token => token.canister_id === urlToken0) || 
      $userTokens.tokens.find(token => token.canister_id === ICP_CANISTER_ID) || 
      null
    );
    
    liquidityStore.setToken(1, 
      tokensFromUrl.find(token => token.canister_id === urlToken1) || 
      $userTokens.tokens.find(token => token.canister_id === CKUSDT_CANISTER_ID) || 
      null
    );
    
    initialLoadComplete = true;
  }

  // Component lifecycle management
  onMount(() => {
    const unsubscribe = auth.subscribe(authState => {
      if (authState.isInitialized && !authInitialized) {
        authInitialized = true;
        if ($userTokens.tokens.length > 0) {
          loadInitialTokens();
          authState.account?.owner && loadBalancesAndUpdateStore(
            $userTokens.tokens, 
            authState.account.owner.toString(), 
            true
          );
        }
      }
    });
    return unsubscribe;
  });

  // Reactive statements for managing component state
  $: $userTokens.tokens.length > 0 && !initialLoadComplete && loadInitialTokens();
  
  $: $auth?.isInitialized && $auth?.account?.owner && $userTokens.tokens.length > 0 &&
     loadBalancesAndUpdateStore($userTokens.tokens, $auth.account.owner.toString(), true);
  
  $: {
    // Update tokens and related state
    token0 = $liquidityStore.token0;
    token1 = $liquidityStore.token1;
    poolExists = token0 && token1 ? doesPoolExist(token0, token1, $livePools) : null;
    
    // Find matching pool
    pool = poolExists ? $livePools.find(p => 
      p.address_0 === token0?.address && 
      p.address_1 === token1?.address
    ) : null;
    
    // Load token-specific balances
    token0?.canister_id && token1?.canister_id && $auth?.isInitialized && $auth?.account?.owner &&
      loadBalancesAndUpdateStore([token0, token1], $auth.account.owner.toString(), true);
    
    // Update local balance variables from store
    token0?.canister_id && (token0Balance = $currentUserBalancesStore[token0.canister_id]?.in_tokens?.toString() || "0");
    token1?.canister_id && (token1Balance = $currentUserBalancesStore[token1.canister_id]?.in_tokens?.toString() || "0");
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
    updateQueryParams(
      index === 0 ? result.newToken?.canister_id : $liquidityStore.token0?.canister_id,
      index === 1 ? result.newToken?.canister_id : $liquidityStore.token1?.canister_id
    );
  }

  // Handle price input changes
  function handlePriceChange(value: string) {
    if (poolExists === false || pool?.balance_0 === 0n) {
      liquidityStore.setInitialPrice(value);
      liquidityStore.setAmount(1, calculateToken1FromPrice($liquidityStore.amount0, value));
    }
  }

  // Handle amount input changes
  async function handleAmountChange(index: 0 | 1, value: string) {
    const sanitizedValue = value.replace(/,/g, '');
    liquidityStore.setAmount(index, sanitizedValue);
    
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
          onAmountChange={handleAmountChange}
          onPercentageClick={handlePercentageClick(0)}
          onToken1PercentageClick={handlePercentageClick(1)}
        />
      </div>

      {#if token0 && token1}
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
