<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { sendLpTokens } from "$lib/api/pools";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils"; 
  import { fade, fly } from "svelte/transition";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { calculateRemoveLiquidityAmounts } from "$lib/api/pools";
  import { calculateTokenUsdValue } from "$lib/utils/numberFormatUtils";

  const dispatch = createEventDispatcher();
  
  interface Props {
    pool: any;
    token0: any;
    token1: any;
  }

  let { pool, token0, token1 }: Props = $props();

  let amount = $state("");
  let recipientAddress = $state("");
  let isLoading = $state(false);
  let errorMessage = $state("");
  let isCalculating = $state(false);
  let estimatedAmounts = $state({ amount0: "0", amount1: "0" });

  // LP token information
  let tokenId = $state("");
  let lpTokenBalance = $state(0);

  $effect(() => {
    // Set the balance from the pool data
    lpTokenBalance = parseFloat(pool.balance) || 0;
    
    // Construct token ID
    tokenId = "LP." + pool.symbol;
  });

  function validateFields() {
    if (!amount) {
      errorMessage = "Please enter an amount";
      return false;
    }
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      errorMessage = "Please enter a valid amount";
      return false;
    }
    
    if (amountNum > lpTokenBalance) {
      errorMessage = "Insufficient LP token balance";
      return false;
    }
    
    if (!recipientAddress) {
      errorMessage = "Please enter a recipient address";
      return false;
    }
    
    return true;
  }

  async function handleSendTokens() {
    errorMessage = "";
    
    if (!validateFields()) {
      return;
    }
    
    isLoading = true;
    
    try {
      await sendLpTokens({
        token: tokenId,
        toAddress: recipientAddress,
        amount: parseFloat(amount)
      });
      
      // Reset form
      amount = "";
      recipientAddress = "";
      estimatedAmounts = { amount0: "0", amount1: "0" };
      
      // Let parent component know tokens were sent
      dispatch('tokensSent');
    } catch (error) {
      console.error("Error sending tokens:", error);
      errorMessage = error.message || "Failed to send tokens";
    } finally {
      isLoading = false;
    }
  }
  
  function setPercentage(percent: number) {
    const maxAmount = lpTokenBalance;
    const calculatedAmount = (maxAmount * percent) / 100;
    amount = calculatedAmount > 0 ? calculatedAmount.toString() : "0";
    calculateEstimatedAmounts();
  }

  async function calculateEstimatedAmounts() {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      estimatedAmounts = { amount0: "0", amount1: "0" };
      return;
    }

    try {
      errorMessage = "";
      isCalculating = true;
      const numericAmount = parseFloat(amount);

      if (numericAmount > lpTokenBalance) {
        throw new Error("Amount exceeds balance");
      }

      const result = await calculateRemoveLiquidityAmounts(
        pool.address_0,
        pool.address_1,
        numericAmount
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
      };
    } catch (err) {
      console.error("Error calculating token amounts:", err);
      estimatedAmounts = { amount0: "0", amount1: "0" };
    } finally {
      isCalculating = false;
    }
  }

</script>

<div in:fade={{ duration: 200 }}>
  <div class="send-tokens-container">
    <!-- Amount Input -->
    <div class="input-container">
      <div class="input-wrapper">
        <input
          type="number"
          bind:value={amount}
          oninput={calculateEstimatedAmounts}
          class="amount-input"
          placeholder="0"
          max={lpTokenBalance}
        />
        <div class="input-decoration">{pool.symbol}</div>
      </div>

      <div class="balance-info">
        <div class="available-balance">
          <span class="balance-label">Available:</span>
          <span class="balance-amount">
            {formatToNonZeroDecimal(lpTokenBalance)} {pool.symbol}
          </span>
        </div>
        <div class="percentage-buttons">
          {#each [25, 50, 75, 100] as percent}
            <button
              class="{amount && Math.abs(parseFloat(amount) - (lpTokenBalance * percent) / 100) < 0.00000001 ? 'active' : ''}"
              onclick={() => setPercentage(percent)}
              type="button"
            >
              {percent === 100 ? 'MAX' : `${percent}%`}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Recipient Address Input -->
    <div class="recipient-container">
      <div class="recipient-label">Recipient Address</div>
      <input
        type="text"
        placeholder="Enter principal ID or account identifier"
        bind:value={recipientAddress}
        class="recipient-input"
      />
    </div>

    {#if amount && parseFloat(amount) > 0}
      <div class="output-preview" in:fade={{ duration: 200 }}>
        <div class="output-header">
          <span class="output-title">Position value to transfer</span>
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
                  {formatToNonZeroDecimal(estimatedAmounts.amount0)}
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
                  {formatToNonZeroDecimal(estimatedAmounts.amount1)}
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

    {#if errorMessage}
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
        {errorMessage}
      </div>
    {/if}
  </div>

  <div class="modal-footer">
    <div class="action-buttons">
      <ButtonV2
        theme="primary"
        variant="solid"
        size="lg"
        isDisabled={!amount || !recipientAddress || isLoading || isCalculating}
        fullWidth={true}
        onclick={handleSendTokens}
      >
        {#if isLoading}
          <div class="button-content">
            <div class="loading-spinner"></div>
            <span>Sending...</span>
          </div>
        {:else if isCalculating}
          <div class="button-content">
            <div class="loading-spinner"></div>
            <span>Calculating...</span>
          </div>
        {:else}
          <span>Transfer LP Tokens</span>
        {/if}
      </ButtonV2>
    </div>
  </div>
</div>

<style lang="postcss">
  .send-tokens-container {
    @apply flex flex-col gap-3;
  }

  .input-container {
    @apply bg-white/[0.02] rounded-xl p-3;
    @apply border border-white/[0.04] backdrop-blur-md;
    @apply transition-all duration-200;
    @apply hover:border-white/[0.06] hover:bg-white/[0.03];
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

  .percentage-buttons {
    @apply flex flex-wrap gap-1;
  }

  .percentage-buttons button {
    @apply px-1.5 py-0.5 text-xs rounded-md bg-white/[0.03] text-kong-text-primary/70
           hover:bg-white/[0.06] hover:text-kong-text-primary transition-all duration-200
           border border-white/[0.04];
  }

  .percentage-buttons button.active {
    @apply bg-kong-primary/10 text-kong-primary border-kong-primary/20
           hover:bg-kong-primary/15;
  }

  .recipient-container {
    @apply bg-white/[0.02] rounded-xl p-3;
    @apply border border-white/[0.04] backdrop-blur-md;
    @apply transition-all duration-200;
    @apply hover:border-white/[0.06] hover:bg-white/[0.03];
  }

  .recipient-label {
    @apply text-xs text-kong-text-primary/70 font-medium mb-2;
  }

  .recipient-input {
    @apply w-full bg-transparent border-none
           text-sm font-mono
           relative z-10 p-0
           opacity-100 focus:outline-none focus:text-kong-text-primary
           placeholder:text-kong-text-primary/30;
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
    @apply p-3 rounded-lg bg-kong-accent-red/10 border border-kong-accent-red/20 
           text-kong-accent-red text-xs backdrop-blur-sm flex items-center gap-2;
  }

  .error-icon {
    @apply w-4 h-4 flex-shrink-0;
  }
</style>