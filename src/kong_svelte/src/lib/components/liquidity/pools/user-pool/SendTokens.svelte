<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import Button from "$lib/components/common/Button.svelte";
  import { sendLpTokens } from "$lib/api/pools";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils"; 
  import { fade } from "svelte/transition";
  import { auth } from "$lib/stores/auth";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";

  const dispatch = createEventDispatcher();
  
  export let pool: any;
  export let token0: any;
  export let token1: any;

  let amount = "";
  let recipientAddress = "";
  let isLoading = false;
  let errorMessage = "";

  // LP token information
  let tokenId = "";
  let lpTokenBalance = 0;

  onMount(async () => {
    console.log("pool", $currentUserPoolsStore);
    // Set the balance from the pool data
    lpTokenBalance = parseFloat(pool.balance) || 0;
    console.log("lpTokenBalance", pool);
    
    // Construct token ID - this should be adapted to match your application's LP token ID format
    tokenId = pool.lp_token_id;
    console.log("tokenId", tokenId);
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
        token: `${tokenId}`,
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
  }
</script>

<div in:fade={{ duration: 100 }} class="send-tokens-container">
  <div class="intro-text">
    Send your LP tokens to another address. This will transfer your position in the pool.
  </div>
  
  <div class="form-container">
    <div class="balance-info">
      <span class="balance-label">Your LP Balance:</span>
      <span class="balance-value">{formatToNonZeroDecimal(lpTokenBalance)}</span>
    </div>
    
    <div class="input-group">
      <label for="amount" class="input-label">Amount</label>
      <div class="amount-input">
        <input
          id="amount"
          type="text"
          placeholder="0.0" 
          bind:value={amount}
          inputmode="decimal"
          class="input-field"
        />
        <button 
          class="max-button" 
          on:click={setMaxAmount}
          title="Use maximum balance"
        >
          MAX
        </button>
      </div>
    </div>
    
    <div class="input-group">
      <label for="recipient" class="input-label">Recipient Address</label>
      <input
        id="recipient"
        type="text"
        placeholder="Enter recipient principal or account ID"
        bind:value={recipientAddress}
        class="input-field"
      />
    </div>
    
    {#if errorMessage}
      <div class="error-message">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="error-icon">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
        </svg>
        {errorMessage}
      </div>
    {/if}
    
    <div class="mt-6">
      <Button 
        variant="blue"
        state={isLoading ? "disabled" : "default"}
        disabled={isLoading || !$auth.isConnected}
        className="w-full font-medium"
        text={isLoading ? "Sending..." : "Send LP Tokens"}
        onClick={handleSendTokens}
      />
      
      {#if !$auth.isConnected}
        <div class="mt-2 text-center text-xs text-kong-text-secondary">
          Please connect your wallet to send tokens
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="postcss">
  .send-tokens-container {
    @apply flex flex-col gap-4;
  }
  
  .intro-text {
    @apply text-sm text-kong-text-primary/70 mb-3 leading-relaxed;
  }
  
  .form-container {
    @apply rounded-lg bg-kong-bg-light/50 border border-kong-border/10 p-4 shadow-sm;
  }
  
  .balance-info {
    @apply flex justify-between items-center mb-4 py-2 px-3 rounded-md bg-kong-bg-dark/30;
  }
  
  .balance-label {
    @apply text-xs text-kong-text-primary/70 font-medium;
  }
  
  .balance-value {
    @apply text-sm font-medium text-kong-text-primary tabular-nums;
  }
  
  .input-group {
    @apply mb-4;
  }
  
  .input-label {
    @apply block text-xs text-kong-text-primary/70 font-medium mb-1.5;
  }
  
  .amount-input {
    @apply relative;
  }
  
  .input-field {
    @apply w-full p-3 rounded-lg bg-kong-bg-dark/80 border border-kong-border/20
           text-kong-text-primary placeholder:text-kong-text-primary/40
           focus:outline-none focus:ring-1 focus:ring-kong-primary
           transition-all duration-200 hover:bg-kong-bg-dark;
  }
  
  .max-button {
    @apply absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-kong-primary/80 
           text-white px-2 py-0.5 rounded font-medium hover:bg-kong-primary 
           transition-colors shadow-sm focus:outline-none focus:ring-1;
  }
  
  .error-message {
    @apply flex items-center gap-1.5 text-sm text-kong-error mt-2 py-2 px-3
           bg-kong-error/10 rounded-md border border-kong-error/20;
  }
  
  .error-icon {
    @apply w-4 h-4 flex-shrink-0;
  }
</style> 