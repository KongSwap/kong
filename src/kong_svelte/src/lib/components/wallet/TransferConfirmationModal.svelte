<script lang="ts">
  import { onMount } from 'svelte';
  import BigNumber from "bignumber.js";
  import Modal from "$lib/components/common/Modal.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { ArrowRight, Check, AlertTriangle } from "lucide-svelte";
  import { fly, fade } from 'svelte/transition';

  // Props type definition
  type TransferConfirmationModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    amount: string;
    token: FE.Token;
    tokenFee: bigint;
    isValidating?: boolean;
    toPrincipal: string;
  };

  // Destructure props with defaults
  let { 
    isOpen = false,
    onClose = () => {},
    onConfirm = () => {},
    amount,
    token,
    tokenFee,
    isValidating = false,
    toPrincipal
  }: TransferConfirmationModalProps = $props();

  // Derived values using Svelte 5 syntax
  let receiverAmount = $state<string>("");
  let totalAmount = $state<string>("");
  let formattedFee = $state<string>("");
  let usdValue = $state<string>("0.00");
  let truncatedAddress = $state<string>("");
  
  // Compute derived values when inputs change
  $effect(() => {
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
  });

  // Animation state
  let showSuccess = $state(false);
  
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
  <div class="flex flex-col gap-3 px-3 py-2" in:fade={{ duration: 200 }}>
    <!-- Transfer Header -->
    <div class="flex flex-col gap-3 items-center justify-center p-3 bg-kong-surface-dark/80 rounded-lg border border-kong-border/30">
      <div class="flex items-center gap-2">
        <div class="w-10 h-10 rounded-full overflow-hidden bg-kong-bg-light p-1 border border-kong-border/20 flex items-center justify-center sm:w-12 sm:h-12">
          <img 
            src={token.logo_url} 
            alt={token.symbol}
            class="w-8 h-8 rounded-full object-contain sm:w-10 sm:h-10" 
            loading="lazy"
          />
        </div>
        <div class="flex flex-col">
          <span class="text-kong-text-primary font-medium">{token.name}</span>
          <span class="text-sm text-kong-text-secondary">{token.symbol}</span>
        </div>
      </div>
      
      <div class="flex flex-col items-center">
        <span class="text-2xl font-medium text-kong-text-primary">{amount} {token.symbol}</span>
        {#if usdValue !== "0.00"}
          <span class="text-sm text-kong-text-secondary">≈ ${usdValue} USD</span>
        {/if}
      </div>
    </div>
    
    <!-- Transfer Details -->
    <div class="flex flex-col gap-4">
      <div class="bg-kong-surface-dark/50 rounded-lg p-3 border border-kong-border/20 sm:p-4">
        <div class="text-sm font-medium text-kong-text-primary/90 mb-2 sm:mb-3">
          <span>Transaction Details</span>
        </div>
        
        <div class="flex flex-col gap-2">
          <div class="flex justify-between items-center">
            <span class="text-sm text-kong-text-secondary">You're sending</span>
            <span class="text-sm text-kong-text-primary">{amount} {token.symbol}</span>
          </div>
          
          <div class="flex justify-between items-center">
            <span class="text-sm text-kong-text-secondary">Network fee</span>
            <span class="text-sm text-kong-text-secondary">{formattedFee} {token.symbol}</span>
          </div>
          
          <div class="flex justify-between items-center mt-2 pt-2 border-t border-kong-border/10 font-medium text-kong-text-primary">
            <span class="text-sm text-kong-text-secondary">Total amount</span>
            <span class="text-sm text-kong-text-primary">{totalAmount} {token.symbol}</span>
          </div>
        </div>
      </div>
      
      <div class="bg-kong-surface-dark/50 rounded-lg p-3 border border-kong-border/20 sm:p-4">
        <div class="text-sm font-medium text-kong-text-primary/90 mb-2 sm:mb-3">
          <span>Recipient</span>
        </div>
        
        <div class="flex flex-col gap-2">
          <div class="bg-kong-bg-light/50 rounded-lg p-3 border border-kong-border/30">
            <span class="text-xs font-mono text-kong-text-primary break-all" title={toPrincipal}>{truncatedAddress}</span>
          </div>
          <div class="text-xs text-kong-text-secondary mt-1 px-1">
            {toPrincipal.length === 64 ? 'Account ID' : 'Principal ID'}
          </div>
        </div>
      </div>
      
      <!-- Warning Section -->
      <div class="flex items-start gap-2 p-2.5 rounded-lg bg-kong-accent-yellow/10 border border-kong-accent-yellow/20 text-xs text-kong-text-primary/80 sm:p-3">
        <AlertTriangle size={16} class="text-kong-accent-yellow flex-shrink-0 mt-0.5" />
        <span class="">Transfers are irreversible. Please verify all details before confirming.</span>
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div class="grid grid-cols-2 gap-2 mt-2 sm:gap-3">
      <button 
        type="button" 
        class="h-10 rounded-lg font-medium bg-kong-bg-light/80 text-kong-text-primary/80 hover:bg-kong-bg-light hover:text-kong-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 sm:h-12" 
        on:click={onClose}
        disabled={isValidating || showSuccess}
      >
        Cancel
      </button>
      
      <button
        type="button"
        class="h-10 rounded-lg font-medium flex items-center justify-center gap-2 bg-kong-primary text-white hover:bg-kong-primary-hover disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 sm:h-12 {isValidating ? 'bg-kong-primary/90' : ''} {showSuccess ? 'bg-kong-accent-green' : ''}"
        on:click={handleConfirm}
        disabled={isValidating || showSuccess}
      >
        {#if showSuccess}
          <div class="flex items-center justify-center kong-success-icon">
            <Check size={18} />
          </div>
          Confirmed!
        {:else if isValidating}
          <div class="w-5 h-5 border-2 border-t-transparent border-white rounded-full kong-spinner"></div>
          Processing...
        {:else}
          <ArrowRight size={18} />
          Confirm
        {/if}
      </button>
    </div>
  </div>
</Modal>

<style scoped lang="postcss">
  /* Removed @apply directives as they are now inlined */
  
  /* Keyframe animations */
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
  
  /* Apply animations */
  .kong-spinner {
    animation: spin 0.8s linear infinite;
  }
  
  .kong-success-icon {
    animation: pop 0.3s ease-out;
  }
</style> 