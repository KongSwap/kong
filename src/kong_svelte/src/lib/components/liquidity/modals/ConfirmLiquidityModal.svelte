<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import {
    formatToNonZeroDecimal,
    parseTokenAmount,
  } from "$lib/utils/numberFormatUtils";
  import { onDestroy } from "svelte";
  import { createPool, addLiquidity, pollRequestStatus } from "$lib/api/pools";
  import { toastStore } from "$lib/stores/toastStore";
  import { loadBalance } from "$lib/stores/balancesStore";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  import { canisters } from "$lib/config/auth.config";
  import { auth } from "$lib/stores/auth";


  interface Props {
    isCreatingPool: boolean;
    show: boolean;
    onClose: () => void;
    modalKey: string;
    target: string;
    token0: Kong.Token | null;
    token1: Kong.Token | null;
    liquidityState: {
      amount0: string;
      amount1: string;
      initialPrice: string;
      needsAllowance0: boolean;
      needsAllowance1: boolean;
    };
  }

  let {
    isCreatingPool,
    show,
    onClose,
    modalKey,
    target,
    token0,
    token1,
    liquidityState,
  }: Props = $props();

  let isLoading = $state(false);
  let error: string | null = $state(null);
  let mounted = $state(true);

  onDestroy(() => {
    mounted = false;
  });

  // Calculated values
  let token0Value = $derived(
    token0?.metrics?.price
      ? (
          Number(liquidityState.amount0) * Number(token0.metrics.price)
        ).toFixed(2)
      : "0",
  );
  let token1Value = $derived(
    token1?.metrics?.price
      ? (
          Number(liquidityState.amount1) * Number(token1.metrics.price)
        ).toFixed(2)
      : "0",
  );
  let totalValue = $derived(
    (Number(token0Value) + Number(token1Value)).toFixed(2),
  );
  let exchangeRate = $derived(
    !isCreatingPool && liquidityState.amount0 && liquidityState.amount1
      ? formatToNonZeroDecimal(
          Number(liquidityState.amount1) / Number(liquidityState.amount0),
        )
      : liquidityState.initialPrice,
  );

  async function handleConfirm() {
    if (isLoading || !token0 || !token1) return;

    isLoading = true;
    error = null;

    try {
      const amount0Parsed = parseTokenAmount(
        liquidityState.amount0,
        token0.decimals,
      );
      const amount1Parsed = parseTokenAmount(
        liquidityState.amount1,
        token1.decimals,
      );

      // For ICRC-2 tokens, request allowances right before the transaction
      // This follows the same pattern as SwapService.ts
      if (token0.standards?.includes("ICRC-2") && liquidityState.needsAllowance0) {
        await IcrcService.requestIcrc2Allowance(
          token0,
          amount0Parsed,
          canisters.kongBackend.canisterId,
        );
      }

      if (token1.standards?.includes("ICRC-2") && liquidityState.needsAllowance1) {
        await IcrcService.requestIcrc2Allowance(
          token1,
          amount1Parsed,
          canisters.kongBackend.canisterId,
        );
      }

      const params = {
        token_0: token0,
        amount_0: amount0Parsed,
        token_1: token1,
        amount_1: amount1Parsed,
      };

      if (isCreatingPool) {
        // Create pool logic
        toastStore.info(
          `Creating ${token0.symbol}/${token1.symbol} pool...`,
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
          onClose();
        }
      } else {
        // Add liquidity logic
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
  width="460px"
  isPadded={true}
  height="auto"
  {modalKey}
  {target}
>
  <div class="flex flex-col min-h-[400px] p-4">
    {#if error}
      <div class="mb-4 text-kong-text-accent-red text-center p-4 bg-red-400/20 rounded-xl">
        {error}
      </div>
    {/if}

    <div class="flex-1">
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
            <span class="text-kong-text-primary text-xl">{liquidityState.amount0}</span>
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
            <span class="text-kong-text-primary text-xl">{liquidityState.amount1}</span>
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
