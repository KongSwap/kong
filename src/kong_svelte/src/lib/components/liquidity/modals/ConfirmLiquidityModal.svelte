<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import {
    formatToNonZeroDecimal,
    parseTokenAmount,
  } from "$lib/utils/numberFormatUtils";
  import { onDestroy, createEventDispatcher } from "svelte";
  import { createPool, addLiquidity, pollRequestStatus } from "$lib/api/pools";
  import { toastStore } from "$lib/stores/toastStore";
  import { loadBalance } from "$lib/stores/balancesStore";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";

  const dispatch = createEventDispatcher();

  export let isCreatingPool: boolean = false;
  export let show: boolean;
  export let onClose: () => void;
  export let modalKey: string = `confirm-liquidity-${Date.now()}`;
  export let target: string = "#portal-target";

  // Get values directly from the store
  $: token0 = $liquidityStore.token0;
  $: token1 = $liquidityStore.token1;
  $: amount0 = $liquidityStore.amount0;
  $: amount1 = $liquidityStore.amount1;

  let isLoading = false;
  let error: string | null = null;
  let mounted = true;

  onDestroy(() => {
    mounted = false;
  });

  // Calculated values
  $: token0Value = token0?.metrics?.price
    ? (Number(amount0) * Number(token0.metrics.price)).toFixed(2)
    : "0";
  $: token1Value = token1?.metrics?.price
    ? (Number(amount1) * Number(token1.metrics.price)).toFixed(2)
    : "0";
  $: totalValue = (Number(token0Value) + Number(token1Value)).toFixed(2);
  $: exchangeRate =
    !isCreatingPool && amount0 && amount1
      ? formatToNonZeroDecimal(Number(amount1) / Number(amount0))
      : $liquidityStore.initialPrice;

  async function handleConfirm() {
    if (isLoading || !token0 || !token1) return;

    isLoading = true;
    error = null;

    try {
      if (isCreatingPool) {
        // Create pool logic
        const amount0 = parseTokenAmount(
          $liquidityStore.amount0,
          token0.decimals,
        );
        const amount1 = parseTokenAmount(
          $liquidityStore.amount1,
          token1.decimals,
        );

        const params = {
          token_0: token0,
          amount_0: amount0,
          token_1: token1,
          amount_1: amount1,
          initial_price: parseFloat($liquidityStore.initialPrice),
        };

        toastStore.info(
          `Adding liquidity to ${token0.symbol}/${token1.symbol} pool...`,
        );
        const result = await createPool(params);

        if (result) {
          toastStore.success("Pool created successfully!");
          
          // Reload balances and pool list after successful pool creation
          await Promise.all([
            loadBalance(token0.address, true),
            loadBalance(token1.address, true),
            currentUserPoolsStore.initialize(),
          ]);
          
          // Dispatch liquidityAdded event
          dispatch("liquidityAdded");
          
          onClose();
        }
      } else {
        // Add liquidity logic
        const amount0 = parseTokenAmount(
          $liquidityStore.amount0,
          token0.decimals,
        );
        const amount1 = parseTokenAmount(
          $liquidityStore.amount1,
          token1.decimals,
        );

        const params = {
          token_0: token0,
          amount_0: amount0,
          token_1: token1,
          amount_1: amount1,
        };

        const addLiquidityResult = await addLiquidity(params);

        if (addLiquidityResult) {
          await pollRequestStatus(
            addLiquidityResult, 
            "Successfully added liquidity",
            "Failed to add liquidity",
            token0?.symbol,
            token1?.symbol
          );
          
          // Reload balances and pool list after successful liquidity addition
          await Promise.all([
            loadBalance(token0.address, true),
            loadBalance(token1.address, true),
            currentUserPoolsStore.initialize(),
          ]);
          
          // Dispatch liquidityAdded event
          dispatch("liquidityAdded");
          
          onClose();
        }
      }
    } catch (err) {
      console.error("Error in confirmation:", err);
      if (mounted) {
        error =
          err instanceof Error ? err.message : "Failed to process transaction";
        isLoading = false;
      }
    }
  }

  function handleCancel() {
    show = false;
    onClose();
  }
</script>

<Modal
  title={isCreatingPool ? "Create Pool" : "Add Liquidity"}
  onClose={handleCancel}
  isOpen={show}
  variant="solid"
  width="460px"
  height="auto"
  {modalKey}
  {target}
>
  <div class="flex flex-col min-h-[400px] px-4 pb-4">
    {#if error}
      <div class="mb-4 text-kong-text-accent-red text-center p-4 bg-red-400/20 rounded-xl">
        {error}
      </div>
    {/if}

    <div class="flex-1">
      <div class="text-kong-text-primary/90 mb-1">You will provide</div>

      <div class="bg-white/5 rounded-xl p-4 space-y-4">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <img
              src={token0?.logo_url}
              alt={token0?.symbol}
              class="w-8 h-8 rounded-full bg-white"
            />
            <div class="flex flex-col">
              <span class="text-kong-text-primary text-lg">{token0?.symbol}</span>
            </div>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-kong-text-primary text-xl">{amount0}</span>
            <span class="text-kong-text-secondary text-sm">${token0Value}</span>
          </div>
        </div>

        <div class="text-kong-text-secondary text-xl text-center">+</div>

        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <img
              src={token1?.logo_url}
              alt={token1?.symbol}
              class="w-8 h-8 rounded-full bg-white"
            />
            <div class="flex flex-col">
              <span class="text-kong-text-primary text-lg">{token1?.symbol}</span>
            </div>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-kong-text-primary text-xl">{amount1}</span>
            <span class="text-kong-text-secondary text-sm">${token1Value}</span>
          </div>
        </div>
      </div>

      <div class="mt-4 bg-white/5 rounded-xl p-4 space-y-3">
        <div class="flex justify-between text-kong-text-primary/80 text-sm">
          <span>Total Value:</span>
          <span>${totalValue}</span>
        </div>
        <div class="flex justify-between text-kong-text-primary/80 text-sm">
          <span>Exchange Rate:</span>
          <span>1 {token0?.symbol} = {exchangeRate} {token1?.symbol}</span>
        </div>
      </div>

      {#if isCreatingPool}
        <div
          class="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
        >
          <div class="text-kong-text-accent-yellow text-sm">
            You are the first liquidity provider.
            <br />
            The ratio of tokens you add will set the price of this pool.
          </div>
        </div>
      {/if}
    </div>

    <div class="mt-6 flex gap-4">
      <ButtonV2
        variant="outline"
        theme="accent-green"
        size="lg"
        fullWidth={true}
        onclick={handleCancel}
        isDisabled={isLoading}
      >
        Cancel
      </ButtonV2>
      <ButtonV2
        variant="solid"
        theme="accent-green"
        size="lg"
        fullWidth={true}
        onclick={handleConfirm}
        isDisabled={isLoading}
      >
        <div class="flex items-center justify-center gap-2">
          <span>{isLoading ? "Confirming..." : "Confirm"}</span>
          {#if isLoading}
            <div
              class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"
            />
          {/if}
        </div>
      </ButtonV2>
    </div>
  </div>
</Modal>

<style>
  img {
    background: white;
  }
</style>
