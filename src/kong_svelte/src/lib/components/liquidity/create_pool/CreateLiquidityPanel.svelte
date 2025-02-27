<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import TokenSelectionPanel from "./TokenSelectionPanel.svelte";
  import AmountInputs from "./AmountInputs.svelte";
  import InitialPriceInput from "./InitialPriceInput.svelte";
  import PoolWarning from "./PoolWarning.svelte";
  import { liquidityStore } from "$lib/services/liquidity/liquidityStore";
  import {
    loadBalances,
    currentUserBalancesStore,
  } from "$lib/services/tokens/tokenStore";
  import {
    calculateAmount1FromPrice,
    validateTokenSelect,
    updateQueryParams,
    doesPoolExist,
  } from "$lib/utils/poolCreationUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import { page } from "$app/stores";
  import { auth } from "$lib/services/auth";
  import { livePools } from "$lib/services/pools/poolStore";
  import { onDestroy, onMount } from "svelte";
  import {
    CKUSDT_CANISTER_ID,
    ICP_CANISTER_ID,
  } from "$lib/constants/canisterConstants";
  import { PoolService } from "$lib/services/pools/PoolService";
  import { parseTokenAmount } from "$lib/utils/numberFormatUtils";
  import ConfirmLiquidityModal from "$lib/components/liquidity/modals/ConfirmLiquidityModal.svelte";
  import PositionDisplay from "$lib/components/liquidity/create_pool/PositionDisplay.svelte";
  import { BigNumber } from "bignumber.js";
  import { userTokens } from "$lib/stores/userTokens";
  import { fetchTokensByCanisterId } from "$lib/api/tokens"
  import { userPoolListStore } from "$lib/stores/userPoolListStore";

  const ALLOWED_TOKEN_SYMBOLS = ["ICP", "ckUSDT"];
  const DEFAULT_TOKEN = "ICP";
  const SECONDARY_TOKEN_IDS = [ICP_CANISTER_ID, CKUSDT_CANISTER_ID];

  let token0: FE.Token | null = null;
  let token1: FE.Token | null = null;
  let pool: BE.Pool | null = null;
  let poolExists: boolean | null = null;

  // Track if initial load has happened
  let initialLoadComplete = false;

  // Initial token loading from URL or defaults
  onMount(() => {
    if ($userTokens.tokens.length > 0) {
      loadInitialTokens();
      loadBalances(auth?.pnp?.account?.owner?.toString(), { 
        forceRefresh: true 
      });
    }
  });

  // Watch for userTokens.tokens to be available
  $: if ($userTokens.tokens.length > 0 && !initialLoadComplete) {
    loadInitialTokens();
  }

  async function loadInitialTokens() {
    const urlToken0 = $page.url.searchParams.get("token0");
    const urlToken1 = $page.url.searchParams.get("token1");

    const tokensFromUrl = await fetchTokensByCanisterId([urlToken0, urlToken1]);
    const token0FromUrl = tokensFromUrl.find((token) => token.canister_id === urlToken0);
    const token1FromUrl = tokensFromUrl.find((token) => token.canister_id === urlToken1);

    const defaultToken0 = $userTokens.tokens.find(
      (token) => token.canister_id === ICP_CANISTER_ID,
    );
    const defaultToken1 = $userTokens.tokens.find(
      (token) => token.canister_id === CKUSDT_CANISTER_ID,
    );

    liquidityStore.setToken(0, token0FromUrl || defaultToken0 || null);
    liquidityStore.setToken(1, token1FromUrl || defaultToken1 || null);

    initialLoadComplete = true;
  }

  // Token updates
  $: {
    token0 = $liquidityStore.token0;
    token1 = $liquidityStore.token1;
    // Only load balances if both tokens are set and valid
    if (token0?.canister_id && token1?.canister_id) {
      loadBalances(auth.pnp.account?.owner?.toString(), {
        tokens: [token0, token1],
        forceRefresh: true,
      });
    }
  }
  $: poolExists =
    token0 && token1 ? doesPoolExist(token0, token1, $livePools) : null;
  $: if (poolExists) {
    pool = $livePools.find(
      (pool) =>
        pool.address_0 === token0?.address &&
        pool.address_1 === token1?.address,
    );
  }
  $: token0Balance =
    $currentUserBalancesStore[token0?.canister_id]?.in_tokens?.toString() || "0";
  $: token1Balance =
    $currentUserBalancesStore[token1?.canister_id]?.in_tokens?.toString() || "0";

  function handleTokenSelect(index: 0 | 1, token: FE.Token) {
    const otherToken = index === 0 ? token1 : token0;
    const result = validateTokenSelect(
      token,
      otherToken,
      ALLOWED_TOKEN_SYMBOLS,
      DEFAULT_TOKEN,
      $userTokens.tokens,
    );

    if (!result.isValid) {
      toastStore.error(result.error);
      return;
    }

    // Update store
    if (index === 0) {
      liquidityStore.setToken(0, result.newToken);
    } else {
      liquidityStore.setToken(1, result.newToken);
    }

    // Update URL after store update
    const newToken0 = index === 0 ? result.newToken : $liquidityStore.token0;
    const newToken1 = index === 1 ? result.newToken : $liquidityStore.token1;
    updateQueryParams(newToken0?.canister_id, newToken1?.canister_id);
  }

  function handlePriceChange(value: string) {
    if (poolExists === false || pool.balance_0 === 0n) {
      liquidityStore.setInitialPrice(value);
      liquidityStore.setAmount(
        1,
        calculateAmount1FromPrice($liquidityStore.amount0, value),
      );
    }
  }

  async function handleAmountChange(index: 0 | 1, value: string) {
    if (
      (poolExists === false ||
        (poolExists === true && pool?.balance_0 === 0n)) &&
      index === 0
    ) {
      liquidityStore.setAmount(index, value);
      const amount1 = calculateAmount1FromPrice(
        value,
        $liquidityStore.initialPrice,
      );
      liquidityStore.setAmount(1, amount1 || "0");
    } else if (poolExists === true && index === 0) {
      // For existing pools, calculate the other amount based on pool ratio
      liquidityStore.setAmount(0, value);
      try {
        if (!token0 || !token1) return;

        const amount0 = parseTokenAmount(value, token0.decimals);
        if (!amount0) return;

        const result = await PoolService.calculateLiquidityAmounts(
          token0.canister_id,
          amount0,
          token1.canister_id,
        );

        if (result.Ok) {
          // Convert the BigInt amount to display format
          const amount1Display = (
            Number(result.Ok.amount_1) / Math.pow(10, token1.decimals)
          ).toString();
          liquidityStore.setAmount(1, amount1Display);
        }
      } catch (error) {
        console.error("Error calculating liquidity amounts:", error);
        toastStore.error("Failed to calculate amounts");
      }
    } else {
      liquidityStore.setAmount(index, value);
    }
  }

  let showConfirmModal = false;

  async function handleCreatePool() {
    if (!token0 || !token1) return;

    try {
      const amount0 = parseTokenAmount(
        $liquidityStore.amount0,
        token0.decimals,
      );
      const amount1 = parseTokenAmount(
        $liquidityStore.amount1,
        token1.decimals,
      );

      if (!amount0 || !amount1) {
        throw new Error("Invalid amounts");
      }

      showConfirmModal = true;
    } catch (error) {
      console.error("Error creating pool:", error);
      toastStore.error(error.message || "Failed to create pool");
    }
  }

  async function handleAddLiquidity() {
    if (!token0 || !token1) return;

    try {
      const amount0 = parseTokenAmount(
        $liquidityStore.amount0,
        token0.decimals,
      );
      if (!amount0) {
        throw new Error("Invalid amount for " + token0.symbol);
      }

      if (poolExists === true && pool?.balance_0 !== 0n) {
        const result = await PoolService.calculateLiquidityAmounts(
          token0.symbol,
          amount0,
          token1.symbol,
        );
        if (!result.Ok) {
        throw new Error("Failed to calculate liquidity amounts");
      }
      

      // Update store with calculated amount
      liquidityStore.setAmount(
        1,
        (Number(result.Ok.amount_1) / Math.pow(10, token1.decimals)).toString(),
      );
    }
    showConfirmModal = true;
  } catch (error) {
      console.error("Error adding liquidity:", error);
      toastStore.error(error.message || "Failed to add liquidity");
    }
  }

  function handlePercentageClick(percentage: number) {
    if (!token0 || !token0Balance) return;

    try {
      const balance = new BigNumber(token0Balance).div(
        new BigNumber(10).pow(token0.decimals),
      );
      if (!balance.isFinite() || balance.isLessThanOrEqualTo(0)) return;

      // If it's 100% (MAX), subtract both the token fee and transaction fee
      const adjustedBalance =
        percentage === 100
          ? balance.minus(new BigNumber(token0.fee * 2))
          : balance.times(percentage).div(100);

      // Format to avoid excessive decimals (use token's decimal places)

      handleAmountChange(
        0,
        adjustedBalance.gt(0)
          ? adjustedBalance.toFormat(token0.decimals, BigNumber.ROUND_DOWN)
          : "0",
      );
    } catch (error) {
      console.error("Error calculating percentage amount:", error);
      toastStore.error("Failed to calculate amount");
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
        <h3 class="text-kong-text-primary/90 text-sm font-medium mb-2">
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

      {#if token0 && token1 && (poolExists === false || pool.balance_0 === 0n)}
        <div class="flex flex-col gap-4">
          <PoolWarning {token0} {token1} />
          <div>
            <h3 class="text-kong-text-primary/90 text-sm font-medium mb-2">
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
        <h3 class="text-kong-text-primary/90 text-sm font-medium mb-2">
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
      userPoolListStore.initialize();
    }}
  />
{/if}
