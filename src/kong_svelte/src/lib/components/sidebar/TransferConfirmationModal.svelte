<script lang="ts">
  import { onMount } from 'svelte';
  import BigNumber from "bignumber.js";
  import Modal from "$lib/components/common/Modal.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";

  // Props
  export let isOpen = false;
  export let onClose: () => void;
  export let onConfirm: () => void;
  export let amount: string;
  export let token: FE.Token;
  export let tokenFee: bigint;
  export let isValidating = false;

  // Memoized computed values using stores or let variables
  let receiverAmount: string;
  let totalAmount: string;
  let formattedFee: string;

  $: {
    try {
      receiverAmount = new BigNumber(amount).toString();
      totalAmount = new BigNumber(amount)
        .plus(new BigNumber(token.fee_fixed).dividedBy(10 ** token.decimals))
        .toString();
      formattedFee = formatBalance(tokenFee?.toString() || "10000", token.decimals);
    } catch (error) {
      console.error('Error calculating amounts:', error);
      receiverAmount = amount;
      totalAmount = amount;
      formattedFee = '0';
    }
  }

  // Improve performance by using CSS custom properties
  onMount(() => {
    const container = document.querySelector('.token-logo-container');
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
  title="Confirm Your Transfer"
  width="min(420px, 92vw)"
  height="auto"
  target="body"
>
  <div class="confirm-box pb-6">
    <section class="transfer-summary" aria-label="Transfer Amount Summary">
      <div class="token-container">
        <div class="token-logo-container">
          <div class="shine-effect" />
          <img 
            src={token.logo_url} 
            alt={`${token.symbol} token logo`}
            class="token-image" 
            loading="lazy"
          />
        </div>
      </div>

      <div class="amount-display">
        <span class="amount">{new BigNumber(amount).plus(new BigNumber(token.fee_fixed).dividedBy(10 ** token.decimals)).toString()}</span>
        <span class="symbol">{token.symbol}</span>
      </div>
    </section>

    <section class="details-grid" aria-label="Transfer Details">
      <div class="detail-item send">
        <div class="detail-label">
          <span>You Send</span>
          <span class="detail-hint">Amount being sent</span>
        </div>
        <span class="detail-value">{new BigNumber(amount).toString()} {token.symbol}</span>
      </div>
      <div class="detail-item fee">
        <div class="detail-label">
          <span>Network Fee</span>
          <span class="detail-hint">Transaction cost</span>
        </div>
        <span class="detail-value">
          {formattedFee} {token.symbol}
        </span>
      </div>
      <div class="detail-item receive">
        <div class="detail-label">
          <span>Receiver Gets</span>
          <span class="detail-hint">Final amount received</span>
        </div>
        <span class="detail-value">
          {receiverAmount} {token.symbol}
        </span>
      </div>
      <div class="detail-item total">
        <div class="detail-label">
          <span>Total Amount</span>
          <span class="detail-hint">Including network fee</span>
        </div>
        <span class="detail-value">
          {totalAmount} {token.symbol}
        </span>
      </div>
    </section>

    <footer class="confirm-actions">
      <button 
        type="button" 
        class="cancel-btn" 
        on:click={onClose}
        aria-label="Cancel transfer"
      >
        Cancel
      </button>
      <button
        type="button"
        class="confirm-btn"
        class:loading={isValidating}
        on:click={onConfirm}
        disabled={isValidating}
        aria-label={isValidating ? 'Processing transfer' : 'Confirm transfer'}
      >
        {#if isValidating}
          <span class="loading-spinner" aria-hidden="true" />
          Processing...
        {:else}
          Confirm Transfer
        {/if}
      </button>
    </footer>
  </div>
</Modal>

<style scoped lang="postcss">
  /* Use CSS custom properties for better performance */
  .token-container {
    @apply relative flex justify-center;
    --scale: 1;
    transform: scale(var(--scale));
    transition: transform 0.3s ease;
  }

  .token-logo-container {
    @apply relative w-16 h-16 md:w-24 md:h-24 rounded-full overflow-hidden;
    will-change: transform;
  }

  .token-image {
    @apply w-full h-full rounded-full relative z-10;
    transform: translateZ(0);
  }

  .shine-effect {
    @apply absolute inset-0 w-[250%] h-[250%] z-20 -top-[50%] -left-[50%];
    background: linear-gradient(
      45deg,
      transparent 0%,
      rgba(255, 255, 255, 0.1) 45%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 55%,
      transparent 100%
    );
    animation: shine-diagonal 3s infinite linear;
    will-change: transform;
  }

  .details-grid {
    @apply space-y-2 md:space-y-3 mb-4 md:mb-6 bg-kong-bg-dark/20 p-3 md:p-4 rounded-xl;
  }

  .detail-item {
    @apply flex justify-between items-start p-2.5 md:p-3 rounded-lg bg-kong-bg-light/30 hover:bg-kong-bg-light/40 transition-colors duration-200;
  }

  .detail-label {
    @apply flex flex-col gap-0.5 md:gap-1;
  }

  .detail-label span:first-child {
    @apply text-xs md:text-sm font-medium text-kong-text-primary;
  }

  .detail-hint {
    @apply text-[10px] md:text-xs text-kong-text-primary/40;
  }

  .detail-value {
    @apply font-medium text-right max-w-[50%] break-all;
  }

  /* Specific colors for different types */
  .detail-item.send .detail-value {
    @apply text-kong-text-primary text-sm;
  }

  .detail-item.fee .detail-value {
    @apply text-kong-accent-red text-sm;
  }

  .detail-item.receive .detail-value {
    @apply text-kong-accent-green text-sm;
  }

  .detail-item.total {
    @apply mt-3 md:mt-4 border-t border-kong-border/10 pt-3 md:pt-4 bg-kong-bg-light/50;
  }

  .detail-item.total .detail-value {
    @apply font-bold text-sm md:text-base text-kong-text-primary;
  }

  .detail-item.total .detail-label span:first-child {
    @apply font-bold;
  }

  .confirm-actions {
    @apply flex gap-2 md:gap-3 pt-3 md:pt-4 border-t border-kong-border/10;
  }

  .confirm-actions button {
    @apply flex-1 py-2.5 md:py-3 px-2 md:px-3 rounded-lg text-sm md:text-base font-medium text-center justify-center items-center gap-1.5 md:gap-2 transition-colors duration-200;
  }

  .loading-spinner {
    @apply inline-block h-3 w-3 md:h-4 md:w-4 border-2 border-kong-border/30 border-t-kong-border rounded-full;
    animation: spin 1s linear infinite;
    will-change: transform;
  }

  @keyframes shine-diagonal {
    from { transform: rotate(45deg) translateX(-100%); }
    to { transform: rotate(45deg) translateX(100%); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .confirm-box {
    @apply px-3 md:px-6;
  }

  .transfer-summary {
    @apply mb-4 md:mb-6 text-center;
  }

  .amount-display {
    @apply flex items-baseline justify-center gap-1.5 md:gap-2 mt-3 md:mt-4;
  }

  .amount {
    @apply text-2xl md:text-3xl font-bold text-kong-text-primary break-all;
  }

  .symbol {
    @apply text-base md:text-lg text-kong-text-primary/70;
  }

  /* Add button styles back */
  .cancel-btn {
    @apply bg-kong-bg-light hover:bg-kong-bg-light/80 text-kong-text-primary/90;
  }

  .confirm-btn {
    @apply bg-kong-primary hover:bg-kong-accent-green text-white disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .confirm-btn.loading {
    @apply bg-kong-primary/50;
  }
</style> 