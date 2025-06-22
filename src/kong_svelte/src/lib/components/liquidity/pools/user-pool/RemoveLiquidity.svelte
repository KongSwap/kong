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
  
  const dispatch = createEventDispatcher();

  interface Props {
    pool: any;
    token0: any;
    token1: any;
  }

  let { pool, token0, token1 }: Props = $props();

  let removeLiquidityAmount = $state("");
  let estimatedAmounts = $state({ amount0: "0", amount1: "0", lpFee0: "0", lpFee1: "0" });
  let isRemoving = $state(false);
  let error = $state<string | null>(null);
  let isCalculating = $state(false);

  function setPercentage(percent: number) {
    const maxAmount = parseFloat(pool.balance);
    const amount = (maxAmount * percent) / 100;
    removeLiquidityAmount = amount > 0 ? amount.toString() : "0";
    handleInputChange();
  }

  async function handleInputChange() {
    if (!removeLiquidityAmount || isNaN(parseFloat(removeLiquidityAmount))) {
      estimatedAmounts = { amount0: "0", amount1: "0", lpFee0: "0", lpFee1: "0" };
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

      const result = await calculateRemoveLiquidityAmounts(
        pool.address_0,
        pool.address_1,
        numericAmount,
      );


      // Get token decimals from fetched token data
      const token0Decimals = token0?.decimals || 8;
      const token1Decimals = token1?.decimals || 8;

      // First adjust for decimals, then store as string
      // Include fees in the total amounts
      const amount0WithFees = Number(result.amount0) + Number(result.lpFee0);
      const amount1WithFees = Number(result.amount1) + Number(result.lpFee1);
      
      estimatedAmounts = {
        amount0: (amount0WithFees / Math.pow(10, token0Decimals)).toString(),
        amount1: (amount1WithFees / Math.pow(10, token1Decimals)).toString(),
        lpFee0: (Number(result.lpFee0) / Math.pow(10, token0Decimals)).toString(),
        lpFee1: (Number(result.lpFee1) / Math.pow(10, token1Decimals)).toString(),
      };
    } catch (err) {
      console.error("Error calculating removal amounts:", err);
      error = err.message;
      estimatedAmounts = { amount0: "0", amount1: "0", lpFee0: "0", lpFee1: "0" };
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
        const isFailed = requestStatus.statuses.some((s: string) => s.includes("Failed"));

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
          const failureMessage = requestStatus.statuses.find((s: string) => s.includes("Failed"));
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
           isRemoving = false;
           error = null;
           removeLiquidityAmount = "";
           estimatedAmounts = { amount0: "0", amount1: "0", lpFee0: "0", lpFee1: "0" };
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

</script>

<div in:fade={{ duration: 200 }}>
  <div class="remove-liquidity-container">
    <div class="input-container">
      <div class="input-wrapper">
        <input
          type="number"
          bind:value={removeLiquidityAmount}
          oninput={handleInputChange}
          class="amount-input"
          placeholder="0"
          max={pool.balance}
        />
        <div class="input-decoration">{pool.symbol}</div>
      </div>

      <div class="balance-info">
        <div class="available-balance">
          <span class="balance-label">Available:</span>
          <span class="balance-amount">
            {Number(pool.balance).toFixed(8)} {pool.symbol}
          </span>
        </div>
        <div class="percentage-buttons">
          {#each [25, 50, 75, 100] as percent}
            <button
              class="{removeLiquidityAmount && Math.abs(parseFloat(removeLiquidityAmount) - (parseFloat(pool.balance) * percent) / 100) < 0.00000001 ? 'active' : ''}"
              onclick={() => setPercentage(percent)}
              type="button"
            >
              {percent === 100 ? 'MAX' : `${percent}%`}
            </button>
          {/each}
        </div>
      </div>
    </div>

    {#if removeLiquidityAmount && parseFloat(removeLiquidityAmount) > 0}
      <div class="output-preview" in:fade={{ duration: 200 }}>
        <div class="output-header">
          <span class="output-title">You will receive</span>
        </div>
        
        <div class="token-outputs">
          <div class="token-output">
            <div class="token-info">
              <TokenImages tokens={[token0]} size={24} />
              <span class="token-symbol">{pool.symbol_0}</span>
            </div>
            <div class="amount-info">
              {#if isCalculating}
                <span class="amount-skeleton"></span>
              {:else}
                <span class="token-amount">
                  {Number(estimatedAmounts.amount0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                </span>
              {/if}
              <span class="usd-amount">
                ${calculateTokenUsdValue(estimatedAmounts.amount0, token0)}
              </span>
            </div>
          </div>
          
          <div class="token-output">
            <div class="token-info">
              <TokenImages tokens={[token1]} size={24} />
              <span class="token-symbol">{pool.symbol_1}</span>
            </div>
            <div class="amount-info">
              {#if isCalculating}
                <span class="amount-skeleton"></span>
              {:else}
                <span class="token-amount">
                  {Number(estimatedAmounts.amount1).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                </span>
              {/if}
              <span class="usd-amount">
                ${calculateTokenUsdValue(estimatedAmounts.amount1, token1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    {/if}

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
        size="lg"
        isDisabled={!removeLiquidityAmount || isRemoving || isCalculating}
        fullWidth={true}
        onclick={handleRemoveLiquidity}
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


  .balance-info {
    @apply flex justify-between items-center mt-2;
  }

  .available-balance {
    @apply flex flex-col text-kong-text-primary/50;
    @apply text-[clamp(0.75rem,2vw,0.875rem)];
  }

  .balance-label {
    @apply text-xs text-kong-text-primary/40;
  }

  .balance-amount {
    @apply font-medium;
  }

  .input-wrapper {
    @apply relative flex items-center gap-3;
  }

  .amount-input {
    @apply w-full min-w-0 bg-transparent border-none
           text-[clamp(1.2rem,3vw,1.8rem)] font-medium tracking-tight
           relative z-10 p-0
           opacity-100 focus:outline-none focus:text-kong-text-primary
           placeholder:text-kong-text-primary/30;
  }

  .input-decoration {
    @apply text-sm font-medium text-kong-text-primary/60 flex-shrink-0;
  }

  .percentage-buttons {
    @apply flex flex-wrap gap-1;
  }

  .percentage-buttons button {
    @apply px-1.5 py-0.5 text-xs rounded-md bg-white/[0.03] text-kong-text-primary/70
           hover:bg-white/[0.06] hover:text-kong-text-primary transition-all duration-200
           border border-white/[0.04];
  }

  .percentage-buttons button.active {
    @apply bg-kong-accent-red/10 text-kong-accent-red border-kong-accent-red/20
           hover:bg-kong-accent-red/15;
  }

  .output-preview {
    @apply rounded-lg bg-kong-bg-light/50 backdrop-blur-sm 
           border border-kong-border/10 p-3 mt-3;
  }

  .output-header {
    @apply flex justify-between items-center mb-3;
  }

  .output-title {
    @apply text-xs text-kong-text-primary/50 font-medium;
  }

  .token-outputs {
    @apply space-y-2;
  }

  .token-output {
    @apply flex items-center justify-between;
  }

  .token-info {
    @apply flex items-center gap-2;
  }

  .token-symbol {
    @apply text-sm font-medium text-kong-text-primary;
  }

  .amount-info {
    @apply flex flex-col items-end;
  }

  .token-amount {
    @apply text-sm font-medium text-kong-text-primary tabular-nums;
  }

  .usd-amount {
    @apply text-xs text-kong-text-primary/50 tabular-nums;
  }

  .amount-skeleton {
    @apply inline-block w-16 h-4 bg-white/[0.03] rounded animate-pulse;
  }

  .modal-footer {
    @apply border-t border-kong-border/10 mt-4 w-full;
  }

  .action-buttons {
    @apply flex gap-2 w-full;
  }

  .button-content {
    @apply flex items-center justify-center;
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