<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { sendLpTokens } from "$lib/api/pools";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils"; 
  import { fade, fly } from "svelte/transition";
  import { auth } from "$lib/stores/auth";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { calculateRemoveLiquidityAmounts } from "$lib/api/pools";
  import { calculateTokenUsdValue } from "$lib/utils/numberFormatUtils";

  const dispatch = createEventDispatcher();
  
  export let pool: any;
  export let token0: any;
  export let token1: any;

  let amount = "";
  let recipientAddress = "";
  let isLoading = false;
  let errorMessage = "";
  let isCalculating = false;
  let estimatedAmounts = { amount0: "0", amount1: "0" };

  // LP token information
  let tokenId = "";
  let lpTokenBalance = 0;

  onMount(async () => {
    // Set the balance from the pool data
    lpTokenBalance = parseFloat(pool.balance) || 0;
    
    // Construct token ID - this should be adapted to match your application's LP token ID format
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
      
      // Let parent component know tokens were sent
      dispatch('tokensSent');
    } catch (error) {
      console.error("Error sending tokens:", error);
      errorMessage = error.message || "Failed to send tokens";
    } finally {
      isLoading = false;
    }
  }
  
  function setMaxAmount() {
    amount = lpTokenBalance.toString();
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

      const [amount0, amount1] = await calculateRemoveLiquidityAmounts(
        pool.address_0,
        pool.address_1,
        numericAmount
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
      console.error("Error calculating token amounts:", err);
      errorMessage = err.message;
      estimatedAmounts = { amount0: "0", amount1: "0" };
    } finally {
      isCalculating = false;
    }
  }

  // Calculate total USD value of tokens
  function calculateTotalUsdValue(): string {
    const amount0Usd = Number(
      calculateTokenUsdValue(estimatedAmounts.amount0, token0)
    );
    const amount1Usd = Number(
      calculateTokenUsdValue(estimatedAmounts.amount1, token1)
    );
    if (isNaN(amount0Usd) || isNaN(amount1Usd)) {
      return "0.00";
    }
    return (amount0Usd + amount1Usd).toFixed(2);
  }
</script>

<div in:fade={{ duration: 100 }} class="tab-content">
  <p class="intro-text">
    Send your LP tokens to another address. This will transfer your position in the pool.
  </p>
  
  <div class="form-group">
    <div class="input-group">
      <div class="input-header">
        <label for="amount" class="input-label">Amount</label>
        <div class="balance-display">
          <span class="balance-label">Balance:</span>
          <span class="balance-value">{formatToNonZeroDecimal(lpTokenBalance)}</span>
        </div>
      </div>
      <div class="amount-input">
        <input
          id="amount"
          type="text"
          placeholder="0.0" 
          bind:value={amount}
          inputmode="decimal"
          class="input-field"
          on:input={calculateEstimatedAmounts}
        />
        <div class="max-button-wrapper">
          <ButtonV2
            theme="primary"
            variant="solid"
            size="xs"
            className="max-button"
            on:click={setMaxAmount}
          >
            MAX
          </ButtonV2>
        </div>
      </div>
    </div>
    
    <div class="input-group mb-0">
      <label for="recipient" class="input-label">Recipient Address</label>
      <input
        id="recipient"
        type="text"
        placeholder="Enter recipient principal or account ID"
        bind:value={recipientAddress}
        class="input-field"
      />
    </div>
  </div>

  {#if amount && parseFloat(amount) > 0}
    <div class="token-preview">
      <div class="token-row">
        <div class="token-col">
          <div class="token-item">
            <TokenImages tokens={[token0]} size={20} />
            <span class="token-symbol">{pool.symbol_0}</span>
          </div>
          <div class="token-value">
            {#if isCalculating}
              <span class="loading-pulse">Loading...</span>
            {:else}
              <span>{Number(estimatedAmounts.amount0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}</span>
              <span class="usd-value">${calculateTokenUsdValue(estimatedAmounts.amount0, token0)}</span>
            {/if}
          </div>
        </div>
        <div class="token-col">
          <div class="token-item">
            <TokenImages tokens={[token1]} size={20} />
            <span class="token-symbol">{pool.symbol_1}</span>
          </div>
          <div class="token-value">
            {#if isCalculating}
              <span class="loading-pulse">Loading...</span>
            {:else}
              <span>{Number(estimatedAmounts.amount1).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}</span>
              <span class="usd-value">${calculateTokenUsdValue(estimatedAmounts.amount1, token1)}</span>
            {/if}
          </div>
        </div>
      </div>
      <div class="total-value">
        <span>Total Value:</span>
        <span class="total-value-amount">${calculateTotalUsdValue()}</span>
      </div>
    </div>
  {/if}
  
  {#if errorMessage}
    <div class="error-message">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="error-icon">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
      </svg>
      {errorMessage}
    </div>
  {/if}

  <div class="modal-footer">
    <div class="action-buttons">
      <ButtonV2
        theme="primary"
        variant="solid"
        size="md"
        isDisabled={isLoading || !$auth.isConnected || isCalculating}
        fullWidth={true}
        on:click={handleSendTokens}
      >
        {#if isLoading}
          <div class="button-content">
            <div class="loading-spinner"></div>
            <span>Sending...</span>
          </div>
        {:else}
          <span>Send LP Tokens</span>
        {/if}
      </ButtonV2>
    </div>
    
    {#if !$auth.isConnected}
      <div class="mt-2 text-center text-xs text-kong-text-secondary">
        Please connect your wallet to send tokens
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .tab-content {
    @apply flex flex-col gap-2;
  }
  
  .intro-text {
    @apply text-xs text-kong-text-primary/70 mb-2;
  }
  
  .form-group {
    @apply rounded-lg bg-kong-bg-secondary/50 border border-kong-border/10 p-3 shadow-sm;
  }
  
  .input-group {
    @apply mb-3;
  }
  
  .input-header {
    @apply flex justify-between items-center mb-1;
  }
  
  .input-label {
    @apply text-xs text-kong-text-primary/70 font-medium;
  }
  
  .balance-display {
    @apply flex items-center gap-1 text-xs;
  }
  
  .balance-label {
    @apply text-kong-text-primary/50;
  }
  
  .balance-value {
    @apply font-medium text-kong-text-primary/80;
  }
  
  .amount-input {
    @apply relative;
  }
  
  .input-field {
    @apply w-full p-2 rounded-lg bg-kong-bg-primary/80 border border-kong-border/20
           text-kong-text-primary placeholder:text-kong-text-primary/40
           focus:outline-none focus:ring-1 focus:ring-kong-primary
           transition-all duration-200 hover:bg-kong-bg-primary pr-16;
  }
  
  .max-button-wrapper {
    @apply absolute right-2 top-1/2 -translate-y-1/2 z-10;
  }
  
  .max-button {
    @apply !px-2 !py-0.5 !text-xs;
  }
  
  .error-message {
    @apply flex items-center gap-1.5 text-xs text-kong-error py-1.5 px-3
           bg-kong-error/10 rounded-md border border-kong-error/20;
  }
  
  .error-icon {
    @apply w-3.5 h-3.5 flex-shrink-0;
  }
  
  .modal-footer {
    @apply border-t border-kong-border/10 mt-2 pt-3 bg-kong-bg-primary/90 
           backdrop-blur-md w-full;
  }

  .action-buttons {
    @apply flex gap-2 w-full;
  }

  .loading-spinner {
    @apply w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2;
  }

  .button-content {
    @apply flex items-center justify-center;
  }

  .token-preview {
    @apply p-2.5 rounded-lg bg-white/[0.02] backdrop-blur-md 
           border border-white/[0.04];
  }

  .token-row {
    @apply flex gap-2;
  }

  .token-col {
    @apply flex-1 p-2 rounded bg-white/[0.01];
  }

  .token-item {
    @apply flex items-center gap-1.5 mb-1;
  }

  .token-symbol {
    @apply text-xs text-kong-text-primary/70 font-medium;
  }

  .token-value {
    @apply flex flex-col text-sm font-medium text-kong-text-primary;
  }

  .loading-pulse {
    @apply animate-pulse bg-white/[0.03] rounded px-2 text-xs;
  }

  .usd-value {
    @apply text-xs text-kong-text-primary/60 tabular-nums;
  }

  .total-value {
    @apply flex justify-between items-center text-xs py-1.5 px-2 mt-2
           border-t border-white/[0.04];
  }

  .total-value-amount {
    @apply font-medium text-kong-text-primary;
  }
</style> 