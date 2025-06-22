<script lang="ts">
  import { onMount } from 'svelte';
  import BigNumber from "bignumber.js";
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { AlertTriangle, Check } from "lucide-svelte";
  import { fade } from 'svelte/transition';

  // Format USD value with commas for thousands
  function formatUsdValue(value: string | number): string {
    try {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Number(value));
    } catch (e) {
      return value.toString();
    }
  }

  // Props type definition
  type TransferConfirmationModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    amount: string;
    token: Kong.Token;
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
  let isMobile = $state(false);
  
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
  
  // Handle confirm action
  function handleConfirm() {
    onConfirm();
  }

  // Check if we're on mobile
  onMount(() => {
    // Set up responsive checks
    const updateLayout = () => {
      isMobile = window.innerWidth < 640;
    };
    
    updateLayout();
    window.addEventListener('resize', updateLayout);
    
    return () => {
      window.removeEventListener('resize', updateLayout);
    };
  });
</script>

<Modal
  {isOpen}
  variant="transparent"
  {onClose}
  title={`Confirm ${token.symbol} Transfer`}
  width="min(480px, 92vw)"
  height="auto"
  target="body"
  isPadded={true}
>
  <div class="flex flex-col gap-4 sm:gap-6 w-full mx-auto" in:fade={{ duration: 200 }}>
    <!-- Transfer Header -->
    <div class="flex flex-col gap-3 sm:gap-4 items-center justify-center sm:p-4 bg-kong-bg-tertiary rounded-xl border border-kong-border/30 shadow-sm">
      <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-kong-bg-secondary p-1.5 border border-kong-border/20 flex items-center justify-center shadow-inner-white">
        <TokenImages tokens={[token]} size={isMobile ? 44 : 56} showSymbolFallback={true} />
      </div>
      
      <div class="flex flex-col items-center gap-1">
        <span class="text-xl sm:text-3xl font-medium text-kong-text-primary">Sending {amount} {token.symbol}</span>
        {#if usdValue !== "0.00"}
          <div class="flex items-center gap-1.5 bg-kong-primary/5 py-1 px-3 mt-1 rounded-full text-kong-text-primary">
            <span class="font-medium text-kong-primary/90">${formatUsdValue(usdValue)}</span>
            <span class="text-xs text-kong-text-secondary">USD</span>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Warning Section - Moved to top for better visibility -->
    <div class="flex items-start gap-2 p-3 rounded-lg bg-kong-accent-yellow/10 border border-kong-accent-yellow/20 text-xs text-kong-text-primary/90">
      <AlertTriangle size={14} class="text-kong-accent-yellow flex-shrink-0 mt-0.5" />
      <span>Transfers are irreversible. Please verify all details before confirming.</span>
    </div>
    
    <!-- Transfer Details -->
    <div class="flex flex-col gap-3 sm:gap-4">
      <div class="bg-kong-bg-tertiary/70 rounded-xl p-3 sm:p-4 border border-kong-border/20">
        <div class="text-xs sm:text-sm font-medium text-kong-text-primary/90 mb-2 sm:mb-3">
          <span>Transaction Details</span>
        </div>
        
        <div class="flex flex-col gap-2 sm:gap-3">
          <div class="flex justify-between items-center">
            <span class="text-xs sm:text-sm text-kong-text-secondary">You're sending</span>
            <span class="text-xs sm:text-sm text-kong-text-primary font-medium">{amount} {token.symbol}</span>
          </div>
          
          <div class="flex justify-between items-center">
            <span class="text-xs sm:text-sm text-kong-text-secondary">Network fee</span>
            <span class="text-xs sm:text-sm text-kong-text-secondary">{formattedFee} {token.symbol}</span>
          </div>
          
          <div class="flex justify-between items-center mt-1 pt-2 sm:pt-3 border-t border-kong-border/10 font-medium">
            <span class="text-xs sm:text-sm text-kong-text-secondary">Total amount</span>
            <span class="text-xs sm:text-sm text-kong-text-primary">{totalAmount} {token.symbol}</span>
          </div>
        </div>
      </div>
      
      <div class="bg-kong-bg-tertiary/70 rounded-xl p-3 sm:p-4 border border-kong-border/20">
        <div class="text-xs sm:text-sm font-medium text-kong-text-primary/90 mb-2 sm:mb-3">
          <span>Recipient</span>
        </div>
        
        <div class="flex flex-col">
          <div class="bg-kong-bg-secondary/50 rounded-lg p-2 sm:p-3 border border-kong-border/30">
            <span class="text-xs sm:text-sm font-mono text-kong-text-primary break-all" title={toPrincipal}>{truncatedAddress}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div class="grid grid-cols-2 gap-3 mt-1">
      <ButtonV2
        theme="secondary"
        variant="solid"
        size={isMobile ? "md" : "lg"}
        fullWidth={true}
        isDisabled={isValidating}
        onclick={onClose}
      >
        Cancel
      </ButtonV2>
      
      <ButtonV2
        theme="primary"
        variant="solid"
        size={isMobile ? "md" : "lg"}
        fullWidth={true}
        isDisabled={isValidating}
        onclick={handleConfirm}
      >
        <div class="flex items-center justify-center gap-2">
          {#if isValidating}
            <div class="w-4 h-4 sm:w-5 sm:h-5 border-2 border-t-transparent border-kong-primary rounded-full animate-spin"></div>
            <span>Processing...</span>
          {:else}
            <Check size={isMobile ? 14 : 16} />
            <span>Confirm</span>
          {/if}
        </div>
      </ButtonV2>
    </div>
  </div>
</Modal>

<style lang="postcss">
  /* Keyframe animations */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  /* Apply animations */
  .animate-spin {
    animation: spin 0.8s linear infinite;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    :global(.modal-content) {
      padding: 0.5rem;
    }
    
    :global(.modal-title) {
      font-size: 1rem;
    }
    
    /* Create more compact layout on mobile */
    .rounded-xl {
      border-radius: 0.5rem;
    }
    
    /* Ensure that modal doesn't take up too much vertical space */
    .p-3 {
      padding: 0.75rem;
    }
    
    .gap-3 {
      gap: 0.5rem;
    }
  }
</style> 