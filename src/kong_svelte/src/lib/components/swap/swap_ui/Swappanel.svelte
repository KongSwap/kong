<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatNumberCustom } from "$lib/utils/formatNumberCustom";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import { t } from "$lib/locales/translations";
  export let title: string;
  export let token: string;
  export let amount: string;
  export let balance: string;
  export let onTokenSelect: () => void;
  export let onAmountChange: (event: Event) => void;
  export let disabled = false;
  export let showPrice = false;
  export let usdValue = "0";
  export let slippage = 0;

  const animatedUsdValue = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });

  const animatedAmount = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });

  const animatedSlippage = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });

  $: {
    animatedUsdValue.set(parseFloat(usdValue));
    animatedAmount.set(parseFloat(amount || "0"));
    animatedSlippage.set(slippage);
  }

  let inputFocused = false;
  let showSlippageTooltip = false;
</script>

<Panel variant="green" width="600px" height="305px" className="token-panel">
  <div class="panel-content" class:input-focused={inputFocused}>
    <header class="panel-header">
      <div class="title-container">
        <h2 class="text-4xl font-bold">{title}</h2>
      </div>
      {#if showPrice && amount && amount !== "0" && slippage > 0}
        <div
          class="slippage-text"
          class:high-slippage={$animatedSlippage > 3}
          transition:fade
          on:mouseenter={() => (showSlippageTooltip = true)}
          on:mouseleave={() => (showSlippageTooltip = false)}
        >
          {$animatedSlippage.toFixed(2)}%
          {#if showSlippageTooltip}
            <div class="tooltip" transition:fade>
              Price impact for this trade
            </div>
          {/if}
        </div>
      {/if}
    </header>

    <div class="input-section flex flex-col justify-center" class:disabled>
      <div class="amount-container">
        {#if disabled}
          <div class="amount-input animated-amount">
            {$animatedAmount.toFixed(6)}
          </div>
        {:else}
          <input
            type="text"
            value={amount}
            on:input={onAmountChange}
            on:focus={() => (inputFocused = true)}
            on:blur={() => (inputFocused = false)}
            placeholder="0.00"
            class="amount-input"
            {disabled}
            aria-label="Token amount"
          />
        {/if}
        <div class="token-selector">
          <button
            class="token-button"
            on:click={onTokenSelect}
            type="button"
            {disabled}
          >
            <span class="token-text">{token}</span>
            <span class="chevron">▼</span>
          </button>
        </div>
      </div>
    </div>

    {#if showPrice}
      <div class="usd-value" transition:fly={{ y: -20, duration: 400 }}>
        <span class="dollar-sign">≈ $</span>{$animatedUsdValue.toFixed(2)}
      </div>
    {/if}

    <footer class="balance-display">
      <div class="balance-text">
        <span>{$t('swap.available')}</span>
        <span class="balance-amount"
          >{formatNumberCustom(balance || "0", 6)} {token}</span
        >
      </div>
    </footer>
  </div>
</Panel>

<style>
  * {
    font-family: "Alumni Sans", sans-serif;
  }

  .panel-content > *:not(.balance-display *) {
    text-shadow:
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000;
  }

  .panel-content {
    transition: transform 0.3s ease;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
    position: relative;
  }

  .title-container {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .usd-value {
    @apply font-alumni text-outline-1;
    font-size: 1.25rem;
    color: #ffcd1f;
    font-weight: 500;
    display: block !important;
    visibility: visible !important;
  }

  .dollar-sign {
    opacity: 0.8;
    margin-right: 2px;
  }

  .input-section {
    position: relative;
    margin: 0.5rem 0;
    flex-grow: 1;
  }

  .amount-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    padding: 0.5rem 0.75rem;
    transition: all 0.3s ease;
  }

  .amount-input,
  .animated-amount {
    background: transparent;
    border: none;
    font-size: 4rem;
    color: white;
    width: 100%;
    padding: 0;
    font-weight: 300;
    text-overflow: ellipsis;
  }

  .amount-input:focus {
    outline: none;
  }

  .amount-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .token-selector {
    min-width: 120px;
  }

  .token-button {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.05rem 0.75rem;
    color: white;
    font-size: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.3s ease;
    cursor: pointer;
    width: 100%;
  }

  .token-text {
    margin-right: auto;
  }

  .token-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }

  .chevron {
    font-size: 0.7rem;
    opacity: 0.6;
    transition: transform 0.3s ease;
  }

  .token-button:hover .chevron {
    transform: translateY(1px);
  }

  .balance-display {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .balance-text {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1rem;
  }

  .balance-amount {
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
  }

  .slippage-text {
    position: absolute;
    right: 0;
    top: 0;
    color: #d1f052;
    font-size: 1.25rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    transition: all 0.3s ease;
    cursor: help;
    position: relative;
    text-shadow:
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000;
    margin-top: 0.25rem;
  }

  .slippage-text.high-slippage {
    color: #e74c3c;
  }

  .tooltip {
    position: absolute;
    bottom: calc(100% + 10px);
    right: 0;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.875rem;
    white-space: nowrap;
    pointer-events: none;
  }

  .tooltip::after {
    content: "";
    position: absolute;
    top: 100%;
    right: 15px;
    border: 5px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.9);
  }

  .disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
