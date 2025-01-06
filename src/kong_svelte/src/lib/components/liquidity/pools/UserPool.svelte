<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { liveTokens, loadBalance } from "$lib/services/tokens/tokenStore";
  import { PoolService } from "$lib/services/pools";
  import { livePools } from "$lib/services/pools/poolStore";
  import { toastStore } from "$lib/stores/toastStore";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { goto } from "$app/navigation";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { BigNumber } from 'bignumber.js';

  const dispatch = createEventDispatcher();

  export let pool: any;
  export let showModal = false;

  // Calculate USD value for tokens using proper price lookup
  function calculateTokenUsdValue(amount: string, tokenSymbol: string): string {
    // Find token to get its canister_id
    const token = $liveTokens.find((t) => t.symbol === tokenSymbol);

    if (!token?.canister_id || !amount) {
      console.log("Missing token data:", { token, amount });
      return "0";
    }

    // Get price from prices object using canister_id
    const price = token.metrics.price;

    if (!price) {
      return "0";
    }

    // Calculate USD value
    const usdValue = Number(amount) * Number(price);
    return formatToNonZeroDecimal(usdValue);
  }

  let removeLiquidityAmount = "";
  let estimatedAmounts = { amount0: "0", amount1: "0" };
  let isRemoving = false;
  let error: string | null = null;
  let showConfirmation = false;
  let isCalculating = false;

  // Get token objects for images
  $: token0 = $liveTokens.find((t) => t.symbol === pool.symbol_0);
  $: token1 = $liveTokens.find((t) => t.symbol === pool.symbol_1);
  $: actualPool = $livePools.find(
    (p) => p.symbol_0 === pool.symbol_0 && p.symbol_1 === pool.symbol_1,
  );

  // Reset state when modal opens/closes
  $: if (!showModal) {
    resetState();
    dispatch('liquidityRemoved');
  }

  function resetState() {
    removeLiquidityAmount = "";
    estimatedAmounts = { amount0: "0", amount1: "0" };
    error = null;
    showConfirmation = false;
    isRemoving = false;
    isCalculating = false;
  }

  function setPercentage(percent: number) {
    const maxAmount = new BigNumber(pool.balance);
    const percentage = new BigNumber(percent).dividedBy(100);
    // Calculate amount with BigNumber and format to token decimals
    const amount = maxAmount
      .multipliedBy(percentage)
      .decimalPlaces(token0.decimals, BigNumber.ROUND_DOWN)
    
      removeLiquidityAmount = amount.gt(0) ? amount.toString() : "0"
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
          pool.symbol_0,
          pool.symbol_1,
          numericAmount,
        );

      // Get token decimals from tokenStore
      const token0Decimals =
        $liveTokens.find((t) => t.symbol === pool.symbol_0)?.decimals || 8;
      const token1Decimals =
        $liveTokens.find((t) => t.symbol === pool.symbol_1)?.decimals || 8;

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
        token0: pool.symbol_0,
        token1: pool.symbol_1,
        lpTokenAmount: lpTokenBigInt,
      });

      showModal = false;

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
            PoolService.fetchUserPoolBalances(true),
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
      showModal = false;
      isRemoving = false;
      error = null;
      removeLiquidityAmount = "";
      estimatedAmounts = { amount0: "0", amount1: "0" };
      dispatch("liquidityRemoved");
    } catch (err) {
      // Ensure we still refresh balances even on error
      await Promise.all([
        PoolService.fetchUserPoolBalances(true),
        loadBalance(token0.canister_id, true),
        loadBalance(token1.canister_id, true),
      ]);
      console.error("Error removing liquidity:", err);
      error = err.message;
      isRemoving = false;
    }
  }

  let activeTab: "earnings" | "remove" = "earnings";

  // Calculate earnings based on APY
  function calculateEarnings(timeframe: number): string {
    // Use APY from the actual pool
    if (!actualPool?.rolling_24h_apy || !pool.usd_balance) {
      console.log("Missing data for earnings calc:", {
        apy: actualPool?.rolling_24h_apy,
        balance: pool.usd_balance,
      });
      return "0";
    }

    // Convert APY to daily rate and calculate linear projection
    const apyDecimal = actualPool.rolling_24h_apy / 100; // rolling_24h_apy is already a number
    const dailyRate = apyDecimal / 365;
    const earnings = parseFloat(pool.usd_balance) * dailyRate * timeframe;

    return formatToNonZeroDecimal(earnings);
  }

  // Calculate total USD value of tokens to receive
  function calculateTotalUsdValue(): string {
    const amount0Usd = Number(
      calculateTokenUsdValue(estimatedAmounts.amount0, pool.symbol_0),
    );
    const amount1Usd = Number(
      calculateTokenUsdValue(estimatedAmounts.amount1, pool.symbol_1),
    );
    if (isNaN(amount0Usd) || isNaN(amount1Usd)) {
      return "0";
    }
    return formatToNonZeroDecimal(amount0Usd + amount1Usd);
  }

  // Add function to generate add liquidity URL
  function getAddLiquidityUrl(): string {
    if (!token0?.canister_id || !token1?.canister_id) return "/pools/add";
    return `/pools/add?token0=${token0.canister_id}&token1=${token1.canister_id}`;
  }

  async function handleAddMoreLiquidity() {
    showModal = false;
    await sidebarStore.collapse();
    await goto(getAddLiquidityUrl());
  }
</script>

<Modal
  bind:isOpen={showModal}
  onClose={() => {
    showModal = false;
    dispatch('liquidityRemoved');
  }}
  variant="solid"
  width="min(420px, 95vw)"
  height="auto"
  className="!p-0 !flex !flex-col !rounded-md !overflow-hidden"
>
  <div slot="title" class="flex items-center gap-3">
    <TokenImages tokens={[token0, token1]} size={24} overlap={true} />
    <h2 class="text-lg font-medium">{pool.symbol_0}/{pool.symbol_1}</h2>
  </div>

  <div class="pool-details">
    <div class="pool-header">
      {#if activeTab === "earnings"}
      <div class="stats-wrapper">
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Total Value</span>
            <span class="stat-value !text-kong-text-primary"
              >${formatToNonZeroDecimal(pool.usd_balance)}</span
            >
          </div>
          <div class="stat-item">
            <span class="stat-label">APY</span>
            <span class="stat-value">{actualPool?.rolling_24h_apy}%</span>
          </div>
        </div>
      </div>
    {/if}
      <div class="token-amounts">
        <div class="token-row">
          <TokenImages tokens={[token0]} size={20} />
          <div class="token-details">
            <div class="token-info">
              <span class="amount">
                {#if isCalculating}
                  <span class="loading-pulse">Loading...</span>
                {:else}
                  {Number(pool.amount_0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}
                {/if}
                <span class="symbol">{pool.symbol_0}</span>
              </span>
            </div>
            <span class="usd-value">
              ${calculateTokenUsdValue(pool.amount_0, pool.symbol_0)}
            </span>
          </div>
        </div>
        <div class="token-row">
          <TokenImages tokens={[token1]} size={20} />
          <div class="token-details">
            <div class="token-info">
              <span class="amount">
                {Number(pool.amount_1).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })}
                <span class="symbol">{pool.symbol_1}</span>
              </span>
            </div>
            <span class="usd-value">
              ${calculateTokenUsdValue(pool.amount_1, pool.symbol_1)}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="content-section">
      {#if activeTab === "remove"}
        <div class="remove-liquidity-container">
          <div class="input-section">
            <div class="input-header">
              <span>Amount (LP Tokens)</span>
              <span class="balance">Balance: {Number(pool.balance).toFixed(8)}</span>
            </div>
            <input
              type="number"
              bind:value={removeLiquidityAmount}
              on:input={handleInputChange}
              class="amount-input"
              placeholder="0.0"
              max={pool.balance}
            />
            <div class="percentage-buttons">
              {#each [25, 50, 75, 100] as percent}
                <button class="percent-btn" on:click={() => setPercentage(percent)}>
                  {percent}%
                </button>
              {/each}
            </div>
          </div>

          <div class="output-preview">
            <h3 class="section-title">You will receive</h3>
            <div class="token-preview-list">
              <div class="token-preview-item">
                <TokenImages tokens={[token0]} size={20} />
                <div class="token-preview-details">
                  <span class="amount">{Number(estimatedAmounts.amount0).toLocaleString()}</span>
                  <span class="symbol">{pool.symbol_0}</span>
                </div>
                <span class="usd-value">${calculateTokenUsdValue(estimatedAmounts.amount0, pool.symbol_0)}</span>
              </div>
              <div class="token-preview-item">
                <TokenImages tokens={[token1]} size={20} />
                <div class="token-preview-details">
                  <span class="amount">{Number(estimatedAmounts.amount1).toLocaleString()}</span>
                  <span class="symbol">{pool.symbol_1}</span>
                </div>
                <span class="usd-value">${calculateTokenUsdValue(estimatedAmounts.amount1, pool.symbol_1)}</span>
              </div>
            </div>
            <div class="total-value">Total Value: ${calculateTotalUsdValue()}</div>
          </div>

          {#if error}
            <div class="error-message">{error}</div>
          {/if}
        </div>
      {:else}
        <div class="earnings-container">
          <h3 class="section-title">Estimated Earnings</h3>
          <div class="earnings-grid">
            {#each [{ label: "Daily", days: 1 }, { label: "Weekly", days: 7 }, { label: "Monthly", days: 30 }, { label: "Yearly", days: 365 }] as period}
              <div class="earnings-card">
                <span class="earnings-label">{period.label}</span>
                <span class="earnings-value"
                  >${calculateEarnings(period.days)}</span
                >
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <div class="action-buttons">
        {#if activeTab === "remove"}
          <ButtonV2
            on:click={() => (activeTab = "earnings")}
            theme="primary"
            variant="transparent"
            className="action-button !text-kong-text-primary/60"
          >
            Back
          </ButtonV2>
          <ButtonV2
            on:click={handleRemoveLiquidity}
            theme="error"
            variant="transparent"
            className="action-button !text-kong-accent-red"
            disabled={!removeLiquidityAmount || isRemoving || isCalculating}
          >
            {isRemoving
              ? "Removing..."
              : isCalculating
                ? "Calculating..."
                : "Remove Liquidity"}
          </ButtonV2>
        {:else}
          <ButtonV2
            on:click={() => (activeTab = "remove")}
            theme="error"
            variant="transparent"
            className="action-button !text-kong-accent-red"
          >
            Remove Liquidity
          </ButtonV2>
          <ButtonV2
            on:click={handleAddMoreLiquidity}
            theme="accent-green"
            variant="transparent"
            className="action-button !text-kong-text-accent-green"
          >
            Add Liquidity
          </ButtonV2>
        {/if}
      </div>
    </div>
  </div>
</Modal>

<style lang="postcss">
  .pool-details {
    @apply flex flex-col h-full;
  }

  .pool-header {
    @apply px-6 pt-2 pb-6 flex flex-col gap-4;
  }

  .token-amounts {
    @apply flex flex-col gap-2;
  }

  .token-row {
    @apply flex items-center gap-3 p-3.5 rounded-xl bg-kong-bg-light
           backdrop-blur-sm transition-all duration-200 hover:bg-kong-bg-light;
  }

  .token-details {
    @apply flex items-center justify-between flex-1;
  }

  .token-info {
    @apply flex items-center gap-2;
  }

  .amount {
    @apply text-base font-medium flex items-center gap-1.5;
  }

  .symbol {
    @apply text-sm text-kong-text-primary/60;
  }

  .usd-value {
    @apply text-sm text-kong-text-primary/60 tabular-nums;
  }

  .stats-grid {
    @apply grid grid-cols-2 gap-3 px-4 py-2 rounded-xl bg-kong-bg-light
           backdrop-blur-sm border border-kong-border/5;
  }

  .stat-item {
    @apply flex flex-col gap-1 p-3 rounded-lg transition-all duration-200
           hover:bg-white/5 items-center justify-center;
  }

  .stat-label {
    @apply text-xs text-kong-text-primary/60 font-medium uppercase tracking-wide;
  }

  .stat-value {
    @apply text-lg font-medium tabular-nums text-kong-accent-green;
  }

  .content-section {
    @apply flex-1 px-6 pb-6 overflow-y-auto;
  }

  .remove-liquidity-container {
    @apply flex flex-col gap-4;
  }

  .input-section {
    @apply space-y-3;
  }

  .input-header {
    @apply flex justify-between items-center text-sm text-kong-text-primary/60;
  }

  .balance {
    @apply font-medium;
  }

  .amount-input {
    @apply w-full bg-kong-bg-light border border-kong-border rounded-xl p-4
           text-base focus:outline-none focus:ring-2 focus:ring-kong-primary/20
           transition-all duration-200 hover:bg-kong-bg-light;
  }

  .percentage-buttons {
    @apply grid grid-cols-4 gap-2;
  }

  .percent-btn {
    @apply px-3 py-2 text-sm bg-kong-bg-light rounded-lg border border-kong-border
           hover:bg-kong-bg-light hover:border-kong-border/20 transition-all duration-200
           active:scale-95;
  }

  .output-preview {
    @apply p-4 rounded-xl bg-kong-bg-light border border-kong-border/5 space-y-3;
  }

  .section-title {
    @apply text-sm text-kong-text-primary/60 font-medium;
  }

  .token-preview-list {
    @apply space-y-2;
  }

  .token-preview-item {
    @apply flex items-center gap-3 p-3 rounded-lg bg-kong-bg-light
           transition-all duration-200 hover:bg-kong-bg-light/30;
  }

  .token-preview-details {
    @apply flex items-center gap-2 flex-1;
  }

  .total-value {
    @apply text-sm text-kong-text-primary/60 text-right pt-2 
           border-t border-kong-border/5;
  }

  .earnings-container {
    @apply space-y-2;
  }

  .earnings-grid {
    @apply grid grid-cols-2 gap-3;
  }

  .earnings-card {
    @apply p-4 rounded-xl bg-kong-bg-light border border-kong-border/5
           flex flex-col items-center gap-1 transition-all duration-200 
           hover:bg-kong-bg-light hover:border-kong-border;
  }

  .earnings-label {
    @apply text-xs  text-kong-text-primary/60 font-medium;
  }

  .earnings-value {
    @apply text-lg font-medium;
  }

  .modal-footer {
    @apply mt-auto border-t border-kong-border/5 bg-kong-bg-dark/90 
           backdrop-blur-md w-full overflow-hidden;
  }

  .action-buttons {
    @apply grid grid-cols-2 w-full;
  }

  :global(.action-button) {
    @apply !h-14 transition-all duration-200
           font-medium tracking-wide text-center flex items-center justify-center
           w-full !rounded-none;
  }

  .action-buttons :global(.action-button:first-child) {
    @apply !border-r border-kong-border/5;
  }

  .loading-pulse {
    @apply animate-pulse bg-kong-bg-light rounded px-2;
  }

  .error-message {
    @apply p-4 rounded-xl bg-red-500/10 border border-red-500/20 
           text-red-400 text-sm backdrop-blur-sm;
  }

  @media (max-width: 640px) {
    .pool-header {
      @apply gap-4;
    }

    .stats-grid {
      @apply gap-3;
    }

    .stat-value {
      @apply text-lg;
    }
  }
</style>
