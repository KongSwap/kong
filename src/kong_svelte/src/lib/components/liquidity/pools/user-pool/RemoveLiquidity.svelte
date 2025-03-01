<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { fade, fly } from "svelte/transition";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { loadBalance } from "$lib/services/tokens/tokenStore";
  import { PoolService } from "$lib/services/pools";
  import { toastStore } from "$lib/stores/toastStore";
  import { userPoolListStore } from "$lib/stores/userPoolListStore";

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

      const [amount0, amount1] =
        await PoolService.calculateRemoveLiquidityAmounts(
          pool.address_0,
          pool.address_1,
          numericAmount,
        );

      // Get token decimals from fetched token data
      const token0Decimals = token0?.decimals || 8;
      const token1Decimals = token1?.decimals || 8;

      // First adjust for decimals, then store as string
      estimatedAmounts = {
        amount0: (Number(amount0) / Math.pow(10, token0Decimals)).toString(),
        amount1: (Number(amount1) / Math.pow(10, token1Decimals)).toString(),
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
      const requestId = await PoolService.removeLiquidity({
        token0: pool.address_0,
        token1: pool.address_1,
        lpTokenAmount: lpTokenBigInt,
      });

      // Poll for request completion
      let isComplete = false;
      let attempts = 0;
      const maxAttempts = 50; // 50 seconds timeout

      while (!isComplete && attempts < maxAttempts) {
        const requestStatus = await PoolService.pollRequestStatus(
          BigInt(requestId),
        );

        // Check for the complete success sequence
        const expectedStatuses = [
          "Started",
          "Updating user LP token amount",
          "User LP token amount updated",
          "Updating liquidity pool",
          "Liquidity pool updated",
          "Receiving token 0",
          "Token 0 received",
          "Receiving token 1",
          "Token 1 received",
          "Success",
        ];

        // Check if all expected statuses are present in order
        const hasAllStatuses = expectedStatuses.every(
          (status, index) => requestStatus.statuses[index] === status,
        );

        if (hasAllStatuses) {
          isComplete = true;
          toastStore.success("Successfully removed liquidity from the pool");
          await Promise.all([
            loadBalance(token0.canister_id, true),
            loadBalance(token1.canister_id, true),
            userPoolListStore.initialize(),
          ]);
        } else if (requestStatus.reply?.Failed) {
          throw new Error(requestStatus.reply.Failed || "Transaction failed");
        } else {
          await new Promise((resolve) => setTimeout(resolve, 400));
          attempts++;
        }
      }

      if (!isComplete) {
        throw new Error("Operation timed out");
      }

      // Close modal and reset state
      dispatch("close");
      isRemoving = false;
      error = null;
      removeLiquidityAmount = "";
      estimatedAmounts = { amount0: "0", amount1: "0" };
      dispatch("liquidityRemoved");
    } catch (err) {
      // Ensure we still refresh balances even on error
      await Promise.all([
        userPoolListStore.initialize(),
        loadBalance(token0.canister_id, true),
        loadBalance(token1.canister_id, true),
      ]);
      console.error("Error removing liquidity:", err);
      error = err.message;
      isRemoving = false;
    }
  }

  // Calculate USD value for tokens using proper price lookup
  function calculateTokenUsdValue(amount: string, token: any): string {
    // Find token to get its canister_id
    if (!token?.canister_id || !amount) {
      return "0";
    }

    const price = token.metrics.price;

    if (!price) {
      return "0";
    }

    // Calculate USD value
    const usdValue = Number(amount) * Number(price);
    return formatToNonZeroDecimal(usdValue);
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
    return formatToNonZeroDecimal(amount0Usd + amount1Usd);
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
          <button
            class="percent-btn"
            on:click={() => setPercentage(percent)}
          >
            {percent}%
          </button>
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
                  {Number(estimatedAmounts.amount0).toLocaleString(
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
      <button
        on:click={handleRemoveLiquidity}
        class="action-button remove-button"
        disabled={!removeLiquidityAmount || isRemoving || isCalculating}
      >
        {#if isRemoving}
          <div class="loading-spinner"></div>
          <span>Removing...</span>
        {:else if isCalculating}
          <div class="loading-spinner"></div>
          <span>Calculating...</span>
        {:else}
          <span>Remove Liquidity</span>
        {/if}
      </button>
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

  .percent-btn {
    @apply flex-1 py-1.5 text-xs bg-white/[0.03] rounded-md border border-white/[0.04]
           hover:bg-white/[0.06] hover:text-kong-text-primary transition-all duration-200
           active:scale-95 font-medium text-kong-text-primary/70;
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
    @apply border-t border-kong-border/10 mt-4 bg-kong-bg-dark/90 
           backdrop-blur-md w-full;
  }

  .action-buttons {
    @apply flex gap-2 w-full;
  }

  :global(.action-button) {
    @apply !h-10 transition-all duration-200
           font-medium tracking-wide text-center flex items-center justify-center
           w-full !rounded-lg;
  }

  .remove-button {
    @apply bg-kong-accent-red text-white hover:bg-kong-accent-red-hover;
  }

  .loading-pulse {
    @apply animate-pulse bg-white/[0.03] rounded px-2;
  }

  .loading-spinner {
    @apply w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2;
  }

  .error-message {
    @apply p-3 rounded-lg bg-kong-accent-red/10 border border-kong-accent-red/20 
           text-kong-accent-red text-xs backdrop-blur-sm flex items-center gap-2;
  }

  .error-icon {
    @apply w-4 h-4 flex-shrink-0;
  }
</style> 