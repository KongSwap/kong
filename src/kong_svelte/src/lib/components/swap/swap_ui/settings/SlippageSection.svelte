<script lang="ts">
  export let userMaxSlippage: number;
  export let onSlippageChange: (value: number) => void;

  const slippageOptions = [0.5, 1, 2, 3, 10];
  let customSlippage: string = '';
  let inputFocused = false;

  $: {
    if (userMaxSlippage && !slippageOptions.includes(userMaxSlippage)) {
      customSlippage = userMaxSlippage.toString();
    }
  }

  function handleCustomSlippage(event: Event) {
    const input = (event.target as HTMLInputElement).value;
    
    // Allow empty input
    if (!input) {
      customSlippage = '';
      return;
    }

    // Remove any non-numeric characters except decimal point 
    const sanitizedInput = input.replace(/[^\d.]/g, '');
    const value = parseFloat(sanitizedInput);

    if (!isNaN(value)) {
      // Limit to 1 decimal place
      customSlippage = Math.min(value, 100).toFixed(1);
      if (value > 0 && value <= 100) {
        onSlippageChange(value);
      }
    }
  }

  function handleSlippageSelect(value: number) {
    customSlippage = '';
    onSlippageChange(value);
  }

  function handleInputFocus() {
    inputFocused = true;
  }

  function handleInputBlur() {
    inputFocused = false;
    if (customSlippage) {
      const value = parseFloat(customSlippage);
      if (value < 0.1) {
        customSlippage = '0.1';
        onSlippageChange(0.1);
      } else if (value > 100) {
        customSlippage = '100';
        onSlippageChange(100);
      }
    }
  }

  $: slippageValue = customSlippage ? parseFloat(customSlippage) : userMaxSlippage;
  $: warningLevel = getWarningLevel(slippageValue);

  function getWarningLevel(value: number): 'none' | 'low' | 'high' {
    if (value < 0.1) return 'low';
    if (value > 5) return 'high';
    return 'none';
  }
</script>

<div class="slippage-section">
  <div class="section-header">
    <div class="title-row">
      <h3>Slippage Tolerance</h3>
      <div class="info-tooltip">
        <span class="tooltip-trigger">?</span>
        <div class="tooltip-content">
          <p>Your transaction will revert if the price changes unfavorably by more than this percentage.</p>
          <div class="tooltip-tips">
            <p>🎯 Recommended: 0.5% - 2%</p>
            <p>⚠️ High slippage increases risk of price impact</p>
            <p>⚠️ Too low may cause failed transactions</p>
          </div>
        </div>
      </div>
    </div>
    {#if warningLevel !== 'none'}
      <div class="warning-badge" class:high={warningLevel === 'high'} class:low={warningLevel === 'low'}>
        {warningLevel === 'high' ? '⚠️ High slippage risk' : '⚠️ May cause failed trades'}
      </div>
    {/if}
  </div>

  <div class="controls-container">
    <div class="preset-buttons">
      {#each slippageOptions as option}
        <button
          class="preset-button"
          class:active={userMaxSlippage === option && !customSlippage}
          on:click={() => handleSlippageSelect(option)}
        >
          {option}%
        </button>
      {/each}
    </div>

    <div class="custom-input-container" class:focused={inputFocused} class:active={customSlippage}>
      <input
        type="text"
        class="custom-input"
        placeholder="Custom"
        bind:value={customSlippage}
        on:input={handleCustomSlippage}
        on:focus={handleInputFocus}
        on:blur={handleInputBlur}
        maxlength="5"
      />
      <span class="percentage">%</span>
    </div>
  </div>
</div>

<style lang="postcss">
  .slippage-section {
    @apply space-y-3 bg-black/20 rounded-xl p-4;
  }

  .section-header {
    @apply space-y-2;
  }

  .title-row {
    @apply flex items-center gap-2;
  }

  .title-row h3 {
    @apply text-lg font-medium text-white m-0;
  }

  .controls-container {
    @apply flex flex-wrap items-center gap-2;
  }

  .preset-buttons {
    @apply flex gap-2;
  }

  .preset-button {
    @apply px-4 py-2 rounded-lg bg-white/10 border border-white/20
           hover:bg-white/15 transition-all duration-200
           text-white font-medium;
  }

  .preset-button.active {
    @apply bg-[#ffcd1f] border-[#ffcd1f] text-black;
  }

  .custom-input-container {
    @apply relative w-24;
  }

  .custom-input-container.active .custom-input,
  .custom-input-container.focused .custom-input {
    @apply bg-[#ffcd1f] border-[#ffcd1f] text-black;
  }

  .custom-input-container.active .percentage,
  .custom-input-container.focused .percentage {
    @apply text-black;
  }

  .custom-input {
    @apply w-full px-3 py-2 pr-7 rounded-lg bg-white/10
           border border-white/20 text-white
           transition-all duration-200
           focus:outline-none focus:border-[#ffcd1f];
  }

  .percentage {
    @apply absolute right-3 top-1/2 -translate-y-1/2
           text-white/80 transition-colors duration-200;
  }

  .info-tooltip {
    @apply relative;
  }

  .tooltip-trigger {
    @apply flex items-center justify-center w-5 h-5
           rounded-full bg-white/20 text-white/80
           text-sm cursor-help;
  }

  .tooltip-content {
    @apply invisible absolute bottom-full left-1/2 -translate-x-1/2 mb-2
           w-64 p-3 rounded-lg bg-black/95 border border-white/20
           text-sm text-white opacity-0 transition-all duration-200
           z-10;
  }

  .tooltip-tips {
    @apply mt-2 space-y-1 text-sm;
  }

  .info-tooltip:hover .tooltip-content {
    @apply visible opacity-100;
  }

  .warning-badge {
    @apply inline-flex items-center px-2 py-1 rounded-md
           text-sm font-medium;
  }

  .warning-badge.high {
    @apply bg-red-500/20 text-red-400;
  }

  .warning-badge.low {
    @apply bg-yellow-500/20 text-yellow-400;
  }

  /* Dark theme optimizations */
  :global(.dark) .custom-input {
    @apply bg-white/5 border-white/10;
  }

  :global(.dark) .preset-button {
    @apply bg-white/5 border-white/10;
  }

  /* Input placeholder styles */
  .custom-input::placeholder {
    @apply text-white/50;
  }

  .custom-input-container.active .custom-input::placeholder,
  .custom-input-container.focused .custom-input::placeholder {
    @apply text-black/50;
  }
</style>
