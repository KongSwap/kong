<script lang="ts">
  export let slippage: number;
  export let onSlippageChange: (value: number) => void;

  const slippageOptions = [0.5, 1, 2, 3];
  let customSlippage = "";

  function handleCustomSlippage(event: Event) {
    const input = (event.target as HTMLInputElement).value;
    if (!input) return;

    const value = Number(input);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      onSlippageChange(value);
    }
  }

  function handleSlippageSelect(value: number) {
    customSlippage = "";
    onSlippageChange(value);
  }

  $: warningMessage = slippage > 5 
    ? "⚠️ High slippage can lead to unexpected results."
    : slippage < 0.1
    ? "⚠️ Very low slippage may cause failed transactions." 
    : null;
</script>

<div class="settings-section">
  <div class="section-header">
    <h3 class="section-title">Slippage Tolerance</h3>
    <div class="info-tooltip">
      <span class="tooltip-icon">ℹ️</span>
      <div class="tooltip-content">
        Your transaction will revert if the price changes unfavorably by more than this percentage.
      </div>
    </div>
  </div>

  <div class="slippage-options">
    {#each slippageOptions as option}
      <button
        class="slippage-button"
        class:active={slippage === option && !customSlippage}
        on:click={() => handleSlippageSelect(option)}
      >
        {option}%
      </button>
    {/each}
    <div class="custom-input">
      <input
        type="number"
        bind:value={customSlippage}
        on:input={handleCustomSlippage}
        placeholder="Custom"
        min="0.1"
        max="100"
        step="0.1"
      />
      <span class="percentage-symbol">%</span>
    </div>
  </div>

  {#if warningMessage}
    <div class="warning-message">
      {warningMessage}
    </div>
  {/if}
</div>

<style lang="postcss">
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .section-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 1rem;
    color: #ffcd1f;
    margin: 0;
  }

  .info-tooltip {
    position: relative;
    display: inline-block;
  }

  .tooltip-icon {
    cursor: help;
  }

  .tooltip-content {
    display: none;
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.25rem;
    width: 200px;
    font-size: 0.875rem;
    z-index: 10;
  }

  .info-tooltip:hover .tooltip-content {
    display: block;
  }

  .slippage-options {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .slippage-button {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.25rem;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .slippage-button:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .slippage-button.active {
    background: #ffcd1f;
    color: black;
    border-color: #ffcd1f;
  }

  .custom-input {
    position: relative;
    width: 100px;
  }

  .custom-input input {
    width: 100%;
    padding: 0.5rem;
    padding-right: 1.5rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.25rem;
    color: white;
  }

  .percentage-symbol {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.5);
  }

  .warning-message {
    color: #ffcd1f;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
</style>
