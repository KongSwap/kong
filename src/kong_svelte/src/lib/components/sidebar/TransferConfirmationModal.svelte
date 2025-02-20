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
  export let toPrincipal: string;

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
  title="Confirm Your Transfer"
  width="min(420px, 92vw)"
  height="auto"
  target="body"
>
  <div class="confirm-box pb-4">
    <!-- Keep original header -->
    <section class="transfer-summary" aria-label="Transfer Amount Summary">
      <div class="token-container flex items-center gap-4">
        <div class="token-logo-container">
          <div class="shine-effect" />
          <img 
            src={token.logo_url} 
            alt={`${token.symbol} token logo`}
            class="token-image" 
            loading="lazy"
          />
        </div>
        <div class="flex flex-col items-end justify-end !text-kong-text-primary">
          <span class="text-2xl">{token.name}</span>
          <span class="text-sm text-kong-text-accent-blue">{token.symbol}</span>
        </div>
      </div>
    </section>

    <!-- New receipt-style transaction details -->
    <section class="receipt-details">
      <div class="receipt-row">
        <span class="row-label">Amount</span>
        <div class="amount-info">
          <span>{new BigNumber(amount).toString()} {token.symbol}</span>
        </div>
      </div>

      <div class="receipt-row">
        <span class="row-label">Network Fee</span>
        <span class="fee-amount">{formattedFee} {token.symbol}</span>
      </div>

      <div class="h-0.5 bg-gradient-to-r from-transparent via-kong-text-primary/15 to-transparent" />

      <div class="receipt-row total">
        <span class="row-label">Total</span>
        <div class="total-amount flex items-end flex-col">
        {totalAmount} {token.symbol}
        <span class="usd-value">${new BigNumber(totalAmount).multipliedBy(token.metrics.price).toFixed(3)}</span>
        </div>
      </div>

      <div class="receipt-divider" />

      <div class="destination-section">
        <span class="section-label">Destination Wallet</span>
        <span class="wallet-address">{toPrincipal}</span>
      </div>
    </section>

    <footer class="confirm-actions">
      <button type="button" class="cancel-btn" on:click={onClose}>
        Cancel
      </button>
      <button
        type="button"
        class="confirm-btn"
        class:loading={isValidating}
        on:click={onConfirm}
        disabled={isValidating}
      >
        {#if isValidating}
          <span class="loading-spinner" />
          Processing...
        {:else}
          Confirm Transfer
        {/if}
      </button>
    </footer>
  </div>
</Modal>

<style lang="postcss">
  /* Keep original header styles */
  .token-container {
    @apply relative flex justify-center;
    --scale: 1;
    transform: scale(var(--scale));
    transition: transform 0.3s ease;
  }

  .token-logo-container {
    @apply relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden;
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

  /* New receipt styles */
  .receipt-details {
    @apply bg-kong-bg-dark/20 rounded-xl p-4 space-y-3 mt-4;
  }

  .receipt-row {
    @apply flex justify-between items-baseline;
  }

  .row-label {
    @apply text-sm text-kong-text-primary/70;
  }

  .amount-info {
    @apply flex flex-col items-end;
  }

  .usd-value {
    @apply text-xs text-kong-text-secondary;
  }

  .fee-amount {
    @apply text-sm text-kong-accent-red;
  }

  .total {
    @apply font-medium text-base;
  }

  .receipt-divider {
    @apply my-4 border-t border-kong-border/10;
  }

  .destination-section {
    @apply flex flex-col gap-2;
  }

  .section-label {
    @apply text-sm text-kong-text-primary/70;
  }

  .wallet-address {
    @apply text-xs font-mono text-kong-text-primary bg-kong-bg-light/30 p-2 rounded-lg break-all;
  }

  /* Keep existing animations */
  @keyframes shine-diagonal {
    from { transform: rotate(45deg) translateX(-100%); }
    to { transform: rotate(45deg) translateX(100%); }
  }

  /* Keep existing button styles */
  .confirm-actions {
    @apply flex gap-2 mt-4;
  }

  .cancel-btn {
    @apply flex-1 py-2.5 px-4 rounded-lg bg-kong-bg-light hover:bg-kong-bg-light/80 
           text-kong-text-primary/90 text-sm font-medium transition-colors;
  }

  .confirm-btn {
    @apply flex-1 py-2.5 px-4 rounded-lg bg-kong-primary hover:bg-kong-accent-green 
           text-white text-sm font-medium transition-colors
           disabled:opacity-50 disabled:cursor-not-allowed
           flex items-center justify-center gap-2;
  }

  .loading-spinner {
    @apply w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin;
  }
</style> 