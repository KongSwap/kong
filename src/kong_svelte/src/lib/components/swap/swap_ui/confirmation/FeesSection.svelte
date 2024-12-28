<script lang="ts">
  export let totalGasFee: number;
  export let totalLPFee: number;
  export let userMaxSlippage: number;
  export let receiveToken: FE.Token;

  let showGasTooltip = false;
  let showLpTooltip = false;
</script>

<div class="fees-container">
  <div class="fee-row">
    <span class="label">
      Gas Fee
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span class="info-icon" on:mouseenter={() => showGasTooltip = true} on:mouseleave={() => showGasTooltip = false}>?
        {#if showGasTooltip}
          <div class="tooltip">Gas Fee: A network fee required to execute the transaction.</div>
        {/if}
      </span>
    </span>
    <div class="amount">
      <span class="value">{totalGasFee.toFixed(6)}</span>
      <span class="token">{receiveToken.symbol}</span>
    </div>
  </div>

  <div class="fee-row">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="label">
      LP Fee
      <span class="info-icon" on:mouseenter={() => showLpTooltip = true} on:mouseleave={() => showLpTooltip = false}>?
        {#if showLpTooltip}
          <div class="tooltip">LP Fee: A fee paid to liquidity providers who enable the swap.</div>
        {/if}
      </span>
    </span>
    <div class="amount">
      <span class="value">{totalLPFee.toFixed(6)}</span>
      <span class="token">{receiveToken.symbol}</span>
    </div>
  </div>

  <div class="fee-row">
    <span class="label">Max Slippage</span>
    <div class="amount">
      <span class="value">{userMaxSlippage}</span>
      <span class="token">%</span>
    </div>
  </div>
</div>

<style>
  .fees-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;

  }

  .fee-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .fee-row:last-child {
    border-bottom: none;
  }

  .label {
    font-size: 14px;
    @apply text-kong-text-secondary;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .amount {
    font-size: 16px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
    @apply text-kong-text-primary;
  }

  .info-icon {
    font-size: 12px;
    @apply bg-kong-bg-dark/20;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: help;
    position: relative;
  }

  .info-icon:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .tooltip {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 6px;
    @apply bg-kong-bg-dark;
    @apply text-kong-text-primary;
    font-size: 12px;
    padding: 8px;
    border-radius: 8px;
    width: 180px;
    @apply shadow-kong-bg-dark/50;
    line-height: 1.4;
    z-index: 10;
  }

  .tooltip::after {
    content: '';
    position: absolute;
    top: -6px;
    left: 10px;
    border-width: 6px;
    border-style: solid;
    @apply border-kong-bg-dark border-t-transparent border-r-transparent border-l-transparent border-b-kong-bg-dark;
  }

  @media (max-width: 640px) {
    .fee-row {
      padding: 2px 0;
    }

    .label {
      font-size: 12px;
    }

    .amount {
      font-size: 14px;
    }

    .info-icon {
      width: 14px;
      height: 14px;
      font-size: 10px;
    }

    .tooltip {
      font-size: 11px;
      width: 150px;
    }
  }
</style>
