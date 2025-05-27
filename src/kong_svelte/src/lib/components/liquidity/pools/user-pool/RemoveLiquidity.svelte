<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { fade, fly } from "svelte/transition";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { loadBalance } from "$lib/stores/balancesStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { calculateTokenUsdValue } from "$lib/utils/numberFormatUtils";
  import { calculateRemoveLiquidityAmounts, removeLiquidity, pollRequestStatus } from "$lib/api/pools";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { BigNumber } from "bignumber.js";
  
  const dispatch = createEventDispatcher();

  export let pool: any;
  export let token0: any;
  export let token1: any;

  let removeLiquidityAmount = "";
  let estimatedAmounts = { amount0: "0", amount1: "0" };
  let isRemoving = false;
  let error: string | null = null;
  let isCalculating = false;

  function setPercentage(percent: number) {
    const maxAmount = parseFloat(pool.balance);
    const amount = (maxAmount * percent) / 100;
    removeLiquidityAmount = amount > 0 ? amount.toString() : "0";
    handleInputChange();
  }

  async function handleInputChange() {
    if (!removeLiquidityAmount || isNaN(parseFloat(removeLiquidityAmount))) {
      estimatedAmounts = { amount0: "0", amount1: "0" };
      return;
    }

    try {
      error = null;
      isCalculating = true;
      const numericAmount = parseFloat(removeLiquidityAmount);

      // Add validation
      if (numericAmount <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      if (numericAmount > Number(pool.balance)) {
        throw new Error("Amount exceeds balance");
      }

      const result =
        await calculateRemoveLiquidityAmounts(
          pool.address_0,
          pool.address_1,
          numericAmount,
        );

      const [amount0, amount1] = [result.amount_0 + result.lp_fee_0, result.amount_1 + result.lp_fee_1];

      // Get token decimals from fetched token data
      const token0Decimals = token0?.decimals || 8;
      const token1Decimals = token1?.decimals || 8;

      // First adjust for decimals, then store as string
      estimatedAmounts = {
        amount0: (new BigNumber(amount0.toString()).div(new BigNumber(10).pow(token0Decimals))).toString(),
        amount1: (new BigNumber(amount1.toString()).div(new BigNumber(10).pow(token1Decimals))).toString(),
      };
    } catch (err) {
      console.error("Error calculating removal amounts:", err);
      error = err.message;
      estimatedAmounts = { amount0: "0", amount1: "0" };
    } finally {
      isCalculating = false;
    }
  }

  async function handleRemoveLiquidity() {
    if (!removeLiquidityAmount || isNaN(parseFloat(removeLiquidityAmount))) {
      error = "Please enter a valid amount";
      return;
    }

    try {
      error = null;
      isRemoving = true;
      toastStore.info("Removing liquidity...");
      const numericAmount = parseFloat(removeLiquidityAmount);
      const lpTokenBigInt = BigInt(Math.floor(numericAmount * 1e8));
      const requestId = await removeLiquidity({
        token0: pool.address_0,
        token1: pool.address_1,
        lpTokenAmount: lpTokenBigInt,
      });

      // Poll for request completion
      let isComplete = false;
      let attempts = 0;
      const maxAttempts = 50; // 50 seconds timeout

      while (!isComplete && attempts < maxAttempts) {
        const requestStatus = await pollRequestStatus(
          BigInt(requestId),
          "Successfully removed liquidity",
          "Failed to remove liquidity",
          token0?.symbol,
          token1?.symbol,
        );

        // Check for the complete success sequence or a final failed state
        const isSuccess = requestStatus.statuses.includes("Success");
        const isFailed = requestStatus.statuses.some(s => s.includes("Failed"));

        if (isSuccess) {
          isComplete = true;
          // Toast is handled within pollRequestStatus now
          await Promise.all([
            loadBalance(token0.address, true),
            loadBalance(token1.address, true),
            currentUserPoolsStore.reset(),
            new Promise(resolve => setTimeout(resolve, 100)),
            currentUserPoolsStore.initialize(),
          ]);
        } else if (isFailed) {
          // Toast is handled within pollRequestStatus
          const failureMessage = requestStatus.statuses.find(s => s.includes("Failed"));
          throw new Error(failureMessage || "Transaction failed");
        } else {
          // No need for explicit delay here as pollRequestStatus handles polling interval
          attempts++;
        }
      }

      if (!isComplete && attempts >= maxAttempts) {
        // Timeout condition is handled by pollRequestStatus throwing an error
        // This block might not be strictly necessary if pollRequestStatus always throws on timeout
        throw new Error("Operation timed out after polling");
      }

      // Close modal and reset state only on success
      if (isComplete) {
           dispatch("close");
           isRemoving = false;
           error = null;
           removeLiquidityAmount = "";
           estimatedAmounts = { amount0: "0", amount1: "0" };
           dispatch("liquidityRemoved");
      }
    } catch (err) {
      // Error handling remains largely the same, but rely on pollRequestStatus for toast errors
      await Promise.all([
        currentUserPoolsStore.initialize(), // Refresh pool data
        loadBalance(token0?.address, true), // Refresh balances
        loadBalance(token1?.address, true),
      ]);
      console.error("Error removing liquidity:", err);
      // Update local error state if not already handled by a toast
      if (!err.message.includes("timed out") && !err.message.includes("Operation failed")) {
          error = err.message;
      }
      isRemoving = false;
    }
  }

  // Calculate total USD value of tokens to receive
  function calculateTotalUsdValue(): string {
    const amount0Usd = Number(
      calculateTokenUsdValue(estimatedAmounts.amount0, token0),
    );
    const amount1Usd = Number(
      calculateTokenUsdValue(estimatedAmounts.amount1, token1),
    );
    if (isNaN(amount0Usd) || isNaN(amount1Usd)) {
      return "0";
    }
    return (amount0Usd + amount1Usd).toFixed(2);
  }
</script>

<div in:fade={{ duration: 200 }}>
  <div class="remove-liquidity-container">
    <div class="input-container">
      <div class="input-header">
        <span class="input-label">Amount (LP Tokens)</span>
        <div class="balance-display">
          <span class="balance-label">Balance:</span>
          <span class="balance-value">{Number(pool.balance).toFixed(8)}</span>
        </div>
      </div>

      <div class="input-wrapper">
        <input
          type="number"
          bind:value={removeLiquidityAmount}
          on:input={handleInputChange}
          class="amount-input"
          placeholder="0.0"
          max={pool.balance}
        />
        <div class="input-decoration">LP</div>
      </div>

      <div class="percentage-row">
        {#each [25, 50, 75, 100] as percent}
          <ButtonV2
            theme="muted"
            variant="transparent"
            size="xs"
            className="percent-btn-v2"
            on:click={() => setPercentage(percent)}
          >
            {percent}%
          </ButtonV2>
        {/each}
      </div>
    </div>

    <div class="output-preview">
      <h3 class="section-title">You will receive</h3>
      <div class="token-preview-list">
        <div class="token-preview-item">
          <TokenImages tokens={[token0]} size={28} />
          <div class="token-preview-details">
            <span class="token-name">{pool.symbol_0}</span>
            <div class="token-amount-wrapper">
              <span class="token-amount">
                {#if isCalculating}
                  <span class="loading-pulse">Loading...</span>
                {:else}
                  {new BigNumber(estimatedAmounts.amount0)}
                {/if}
              </span>
              <span class="usd-value"
                >${calculateTokenUsdValue(
                  estimatedAmounts.amount0,
                  token0,
                )}</span
              >
            </div>
          </div>
        </div>

        <div class="token-preview-item">
          <TokenImages tokens={[token1]} size={28} />
          <div class="token-preview-details">
            <span class="token-name">{pool.symbol_1}</span>
            <div class="token-amount-wrapper">
              <span class="token-amount">
                {#if isCalculating}
                  <span class="loading-pulse">Loading...</span>
                {:else}
                  {Number(estimatedAmounts.amount1).toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    },
                  )}
                {/if}
              </span>
              <span class="usd-value"
                >${calculateTokenUsdValue(
                  estimatedAmounts.amount1,
                  token1,
                )}</span
              >
            </div>
          </div>
        </div>
      </div>

      <div class="total-value">
        <span>Total Value:</span>
        <span class="total-value-amount"
          >${calculateTotalUsdValue()}</span
        >
      </div>
    </div>

    {#if error}
      <div class="error-message" in:fly={{ y: 10, duration: 200 }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="error-icon"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        {error}
      </div>
    {/if}
  </div>

  <div class="modal-footer">
    <div class="action-buttons">
      <ButtonV2
        theme="accent-red"
        variant="solid"
        size="md"
        isDisabled={!removeLiquidityAmount || isRemoving || isCalculating}
        fullWidth={true}
        on:click={handleRemoveLiquidity}
      >
        {#if isRemoving}
          <div class="button-content">
            <div class="loading-spinner"></div>
            <span>Removing...</span>
          </div>
        {:else if isCalculating}
          <div class="button-content">
            <div class="loading-spinner"></div>
            <span>Calculating...</span>
          </div>
        {:else}
          <span>Remove Liquidity</span>
        {/if}
      </ButtonV2>
    </div>
  </div>
</div>

<style lang="postcss">
  .remove-liquidity-container {
    @apply flex flex-col gap-3;
  }

  .input-container {
    @apply bg-white/[0.02] rounded-xl p-3;
    @apply border border-white/[0.04] backdrop-blur-md;
    @apply transition-all duration-200;
    @apply hover:border-white/[0.06] hover:bg-white/[0.03];
  }

  .input-header {
    @apply flex justify-between items-center mb-2;
  }

  .input-label {
    @apply text-xs text-kong-text-primary/70 font-medium;
  }

  .balance-display {
    @apply flex flex-col items-end text-xs;
  }

  .balance-label {
    @apply text-kong-text-primary/40;
  }

  .balance-value {
    @apply font-medium text-kong-text-primary/80;
  }

  .input-wrapper {
    @apply relative mb-2;
  }

  .amount-input {
    @apply w-full bg-transparent border border-white/[0.04] rounded-lg p-3 pr-10
           text-[clamp(1.2rem,3vw,1.8rem)] font-medium tracking-tight
           focus:outline-none focus:ring-1 focus:ring-kong-primary/20
           transition-all duration-200 hover:border-white/[0.08];
  }

  .input-decoration {
    @apply absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium
           text-kong-text-primary/60;
  }

  .percentage-row {
    @apply flex justify-between gap-2;
  }

  .percent-btn-v2 {
    @apply flex-1 !py-1 text-xs active:scale-95;
  }

  .output-preview {
    @apply p-4 rounded-xl bg-white/[0.02] backdrop-blur-md 
           border border-white/[0.04] space-y-3;
  }

  .section-title {
    @apply text-xs text-kong-text-primary/70 font-medium mb-2;
  }

  .token-preview-list {
    @apply space-y-2;
  }

  .token-preview-item {
    @apply flex items-center gap-3 p-2 rounded-md bg-white/[0.02]
           transition-all duration-200 hover:bg-white/[0.04];
  }

  .token-preview-details {
    @apply flex items-center justify-between flex-1;
  }

  .token-name {
    @apply text-xs text-kong-text-primary/70 font-medium;
  }

  .token-amount-wrapper {
    @apply flex flex-col items-end;
  }

  .token-amount {
    @apply text-sm font-medium text-kong-text-primary;
  }

  .usd-value {
    @apply text-xs text-kong-text-primary/60 tabular-nums;
  }

  .total-value {
    @apply flex justify-between items-center text-xs pt-2 
           border-t border-white/[0.04];
  }

  .total-value-amount {
    @apply font-medium text-kong-text-primary;
  }

  .modal-footer {
    @apply border-t border-kong-border/10 mt-4 bg-kong-bg-primary/90 
           backdrop-blur-md w-full;
  }

  .action-buttons {
    @apply flex gap-2 w-full;
  }

  .button-content {
    @apply flex items-center justify-center;
  }

  .loading-pulse {
    @apply animate-pulse bg-white/[0.03] rounded px-2;
  }

  .loading-spinner {
    @apply w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2;
  }

  .error-message {
    @apply p-3 rounded-lg bg-kong-error/10 border border-kong-error/20 
           text-kong-error text-xs backdrop-blur-sm flex items-center gap-2;
  }

  .error-icon {
    @apply w-4 h-4 flex-shrink-0;
  }
</style> 