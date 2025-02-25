<script lang="ts">
  import { onMount } from 'svelte';
  import BigNumber from "bignumber.js";
  import Modal from "$lib/components/common/Modal.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { ArrowRight, Check, AlertTriangle } from "lucide-svelte";
  import { fly, fade } from 'svelte/transition';

  // Props
  export let isOpen = false;
  export let onClose: () => void;
  export let onConfirm: () => void;
  export let amount: string;
  export let token: FE.Token;
  export let tokenFee: bigint;
  export let isValidating = false;
  export let toPrincipal: string;

  // Memoized computed values using stores or let variables
  let receiverAmount: string;
  let totalAmount: string;
  let formattedFee: string;
  let usdValue: string = "0.00";
  let truncatedAddress: string;

  $: {
    try {
      receiverAmount = new BigNumber(amount).toString();
      totalAmount = new BigNumber(amount)
        .plus(new BigNumber(tokenFee?.toString() || "10000").dividedBy(10 ** token.decimals))
        .toString();
      formattedFee = formatBalance(tokenFee?.toString() || "10000", token.decimals);
      
      // Calculate USD value if price is available
      if (token.metrics?.price) {
        usdValue = new BigNumber(amount).multipliedBy(token.metrics.price).toFixed(2);
      }
      
      // Create truncated address for display
      if (toPrincipal && toPrincipal.length > 16) {
        truncatedAddress = `${toPrincipal.substring(0, 8)}...${toPrincipal.substring(toPrincipal.length - 8)}`;
      } else {
        truncatedAddress = toPrincipal;
      }
    } catch (error) {
      console.error('Error calculating amounts:', error);
      receiverAmount = amount;
      totalAmount = amount;
      formattedFee = '0';
    }
  }

  // Animation timing
  let showSuccess = false;
  
  function handleConfirm() {
    showSuccess = true;
    setTimeout(() => {
      onConfirm();
      showSuccess = false;
    }, 800);
  }

  // Improve performance by using CSS custom properties
  onMount(() => {
    const container = document.querySelector('.token-logo-container') as HTMLElement;
    if (container) {
      const handleMouseOver = () => {
        container.style.setProperty('--scale', '1.1');
      };
      const handleMouseOut = () => {
        container.style.setProperty('--scale', '1');
      };
      
      container.addEventListener('mouseover', handleMouseOver);
      container.addEventListener('mouseout', handleMouseOut);
      
      return () => {
        container.removeEventListener('mouseover', handleMouseOver);
        container.removeEventListener('mouseout', handleMouseOut);
      };
    }
  });
</script>

<Modal
  {isOpen}
  variant="transparent"
  {onClose}
  title="Confirm Transfer"
  width="min(450px, 92vw)"
  height="auto"
  target="body"
  isPadded={false}
>
  <div class="confirm-container" in:fade={{ duration: 200 }}>
    <!-- Transfer Header -->
    <div class="transfer-header">
      <div class="token-info">
        <div class="token-logo">
          <img 
            src={token.logo_url} 
            alt={token.symbol}
            class="token-image" 
            loading="lazy"
          />
        </div>
        <div class="token-details">
          <span class="token-name">{token.name}</span>
          <span class="token-symbol">{token.symbol}</span>
        </div>
      </div>
      
      <div class="transfer-amount">
        <span class="amount-value">{amount} {token.symbol}</span>
        {#if usdValue !== "0.00"}
          <span class="usd-value">≈ ${usdValue} USD</span>
        {/if}
      </div>
    </div>
    
    <!-- Transfer Details -->
    <div class="transfer-details">
      <div class="detail-section">
        <div class="section-title">
          <span>Transaction Details</span>
        </div>
        
        <div class="detail-rows">
          <div class="detail-row">
            <span class="detail-label">You're sending</span>
            <span class="detail-value">{amount} {token.symbol}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Network fee</span>
            <span class="detail-value fee">{formattedFee} {token.symbol}</span>
          </div>
          
          <div class="detail-row total">
            <span class="detail-label">Total amount</span>
            <span class="detail-value">{totalAmount} {token.symbol}</span>
          </div>
        </div>
      </div>
      
      <div class="detail-section">
        <div class="section-title">
          <span>Recipient</span>
        </div>
        
        <div class="recipient-address">
          <div class="address-display">
            <span class="address-value" title={toPrincipal}>{truncatedAddress}</span>
          </div>
          <div class="address-type">
            {toPrincipal.length === 64 ? 'Account ID' : 'Principal ID'}
          </div>
        </div>
      </div>
      
      <!-- Warning Section -->
      <div class="warning-section">
        <AlertTriangle size={16} class="warning-icon" />
        <span class="warning-text">Transfers are irreversible. Please verify all details before confirming.</span>
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div class="action-buttons">
      <button 
        type="button" 
        class="cancel-button" 
        on:click={onClose}
        disabled={isValidating || showSuccess}
      >
        Cancel
      </button>
      
      <button
        type="button"
        class="confirm-button"
        class:loading={isValidating}
        class:success={showSuccess}
        on:click={handleConfirm}
        disabled={isValidating || showSuccess}
      >
        {#if showSuccess}
          <div class="success-icon">
            <Check size={18} />
          </div>
          Confirmed!
        {:else if isValidating}
          <div class="spinner"></div>
          Processing...
        {:else}
          <ArrowRight size={18} />
          Confirm Transfer
        {/if}
      </button>
    </div>
  </div>
</Modal>

<style scoped lang="postcss">
  .confirm-container {
    @apply flex flex-col gap-5 px-4 py-2;
  }
  
  /* Transfer Header Styles */
  .transfer-header {
    @apply flex flex-col gap-4 items-center justify-center p-4 
           bg-kong-surface-dark/80 rounded-lg border border-kong-border/30;
  }
  
  .token-info {
    @apply flex items-center gap-3;
  }
  
  .token-logo {
    @apply w-12 h-12 rounded-full overflow-hidden 
           bg-kong-bg-light p-1 border border-kong-border/20
           flex items-center justify-center;
  }
  
  .token-image {
    @apply w-10 h-10 rounded-full object-contain;
  }
  
  .token-details {
    @apply flex flex-col;
  }
  
  .token-name {
    @apply text-kong-text-primary font-medium;
  }
  
  .token-symbol {
    @apply text-sm text-kong-text-secondary;
  }
  
  .transfer-amount {
    @apply flex flex-col items-center;
  }
  
  .amount-value {
    @apply text-2xl font-medium text-kong-text-primary;
  }
  
  .usd-value {
    @apply text-sm text-kong-text-secondary;
  }
  
  /* Transfer Details Styles */
  .transfer-details {
    @apply flex flex-col gap-4;
  }
  
  .detail-section {
    @apply bg-kong-surface-dark/50 rounded-lg p-4 
           border border-kong-border/20;
  }
  
  .section-title {
    @apply text-sm font-medium text-kong-text-primary/90 mb-3;
  }
  
  .detail-rows {
    @apply flex flex-col gap-2;
  }
  
  .detail-row {
    @apply flex justify-between items-center;
    
    &.total {
      @apply mt-2 pt-2 border-t border-kong-border/10 
             font-medium text-kong-text-primary;
    }
  }
  
  .detail-label {
    @apply text-sm text-kong-text-secondary;
  }
  
  .detail-value {
    @apply text-sm text-kong-text-primary;
    
    &.fee {
      @apply text-kong-text-secondary;
    }
  }
  
  .recipient-address {
    @apply flex flex-col gap-2;
  }
  
  .address-display {
    @apply bg-kong-bg-light/50 rounded-lg p-3 
           border border-kong-border/30;
  }
  
  .address-value {
    @apply text-xs font-mono text-kong-text-primary break-all;
  }
  
  .address-type {
    @apply text-xs text-kong-text-secondary mt-1 px-1;
  }
  
  .warning-section {
    @apply flex items-start gap-2 p-3 rounded-lg
           bg-kong-accent-yellow/10 border border-kong-accent-yellow/20
           text-xs text-kong-text-primary/80;
  }
  
  .warning-icon {
    @apply text-kong-accent-yellow flex-shrink-0 mt-0.5;
  }
  
  /* Action Buttons */
  .action-buttons {
    @apply grid grid-cols-2 gap-3 mt-2;
  }
  
  .cancel-button {
    @apply h-12 rounded-lg font-medium
           bg-kong-bg-light/80 text-kong-text-primary/80
           hover:bg-kong-bg-light hover:text-kong-text-primary
           disabled:opacity-50 disabled:cursor-not-allowed
           transition-all duration-200;
  }
  
  .confirm-button {
    @apply h-12 rounded-lg font-medium
           flex items-center justify-center gap-2
           bg-kong-primary text-white
           hover:bg-kong-primary-hover
           disabled:opacity-70 disabled:cursor-not-allowed
           transition-all duration-200;
    
    &.loading {
      @apply bg-kong-primary/90;
    }
    
    &.success {
      @apply bg-kong-accent-green;
    }
  }
  
  .spinner {
    @apply w-5 h-5 border-2 border-t-transparent border-white rounded-full;
    animation: spin 0.8s linear infinite;
  }
  
  .success-icon {
    @apply flex items-center justify-center;
    animation: pop 0.3s ease-out;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  @keyframes pop {
    0% {
      transform: scale(0.5);
      opacity: 0;
    }
    70% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
</style> 