<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import Panel from '$lib/components/common/Panel.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { formatNumberCustom } from '$lib/utils/formatNumberCustom';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  
  export let payToken: string;
  export let payAmount: string;
  export let receiveToken: string;
  export let receiveAmount: string;
  export let price: string;
  export let gasFee: string;
  export let lpFee: string;
  export let slippage: number;
  export let onConfirm: () => void;
  export let onClose: () => void;

  const exchangeRate = Number(price);
  
  const animatedSlippage = tweened(slippage, {
    duration: 400,
    easing: cubicOut
  });

  $: animatedSlippage.set(slippage);
</script>

<div class="modal-backdrop" transition:fade={{ duration: 200 }}>
  <div class="modal-container" transition:scale={{ duration: 200, start: 0.95 }}>
    <Panel variant="green" type="s">
      <div class="confirmation-content">
        <header>
          <h2>Confirm Swap</h2>
          <button class="close-button" on:click={onClose}>×</button>
        </header>

        <section class="swap-summary">
          <div class="token-panel">
            <span class="label">You Pay</span>
            <div class="token-info">
              <img src="/tokens/{payToken}.svg" alt={payToken} />
              <span class="amount">{formatNumberCustom(payAmount, 6)}</span>
              <span class="symbol">{payToken}</span>
            </div>
          </div>

          <div class="divider">
            <svg viewBox="0 0 24 24" class="arrow-icon">
              <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" />
            </svg>
          </div>

          <div class="token-panel">
            <span class="label">You Receive</span>
            <div class="token-info">
              <img src="/tokens/{receiveToken}.svg" alt={receiveToken} />
              <span class="amount">{formatNumberCustom(receiveAmount, 6)}</span>
              <span class="symbol">{receiveToken}</span>
            </div>
          </div>
        </section>

        <section class="details">
          <div class="detail-row">
            <span>Exchange Rate</span>
            <span class="value">1 {payToken} = {exchangeRate.toFixed(6)} {receiveToken}</span>
          </div>
          <div class="detail-row">
            <span>Network Fee</span>
            <span class="value">{gasFee} {receiveToken}</span>
          </div>
          <div class="detail-row">
            <span>LP Fee</span>
            <span class="value">{lpFee} {receiveToken}</span>
          </div>
          <div class="detail-row">
            <span>Slippage Tolerance</span>
            <span class="slippage" class:high={$animatedSlippage > 2}>
              {$animatedSlippage.toFixed(2)}%
            </span>
          </div>
        </section>

        <footer>
          <Button
            variant="yellow"
            text="Confirm Swap"
            onClick={onConfirm}
            className="confirm-btn"
          />
          <Button
            variant="blue"
            text="Cancel"
            onClick={onClose}
            className="cancel-btn"
          />
        </footer>
      </div>
    </Panel>
  </div>
</div>

<style lang="postcss">
  .modal-backdrop {
    @apply fixed inset-0 flex items-center justify-center p-4 z-50;
  }

  .modal-container {
    @apply w-full max-w-lg mx-auto;
  }

  .confirmation-content {
    @apply flex flex-col gap-8 p-8;
  }

  header {
    @apply flex justify-between items-center pb-6 border-b border-white/10;
  }

  h2 {
    @apply text-3xl font-bold text-white tracking-tight m-0;
    text-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  .close-button {
    @apply w-10 h-10 flex items-center justify-center text-white/70 hover:text-white
           bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300
           border-none cursor-pointer text-2xl;
  }

  .swap-summary {
    @apply flex flex-col gap-6;
  }

  .token-panel {
    @apply bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 
           hover:border-white/20 transition-all duration-300 shadow-lg;
  }

  .label {
    @apply text-white/60 text-sm font-medium mb-3 block uppercase tracking-wider;
  }

  .token-info {
    @apply flex items-center gap-4;
  }

  .token-info img {
    @apply w-12 h-12 rounded-full shadow-lg;
  }

  .amount {
    @apply text-4xl text-white font-bold tracking-tight;
    text-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  .symbol {
    @apply text-white/80 text-2xl font-medium;
  }

  .divider {
    @apply flex justify-center py-2;
  }

  .arrow-icon {
    @apply w-8 h-8 text-white/40 fill-current;
  }

  .details {
    @apply bg-white/5 backdrop-blur-lg rounded-2xl p-6 flex flex-col gap-4 
           border border-white/10 shadow-lg;
  }

  .detail-row {
    @apply flex justify-between items-center text-base text-white/70 font-medium;
  }

  .value {
    @apply text-white font-semibold;
  }

  .slippage {
    @apply text-emerald-400 font-semibold;
  }

  .slippage.high {
    @apply text-red-400;
  }

  footer {
    @apply flex gap-4 mt-4;
  }

  :global(.confirm-btn) {
    @apply flex-[2] py-4 text-lg font-semibold tracking-wide;
  }

  :global(.cancel-btn) {
    @apply flex-1 py-4 text-lg font-semibold tracking-wide;
  }

  @media (max-width: 640px) {
    .confirmation-content {
      @apply p-6 gap-6;
    }

    .token-panel {
      @apply p-4;
    }

    .amount {
      @apply text-2xl;
    }

    .symbol {
      @apply text-lg;
    }

    .token-info img {
      @apply w-8 h-8;
    }
  }
</style>
