<script lang="ts">
  export let totalGasFee: number;
  export let totalLPFee: number;
  export let slippage: number;
  export let receiveToken: string;
</script>

<div class="section">
  <div class="fee-row">
    <span class="label">Gas Fee</span>
    <div class="amount">
      <span class="value">{totalGasFee.toFixed(6)}</span>
      <span class="token">{receiveToken}</span>
    </div>
  </div>
  <div class="fee-row">
    <span class="label">LP Fee</span>
    <div class="amount">
      <span class="value">{totalLPFee.toFixed(6)}</span>
      <span class="token">{receiveToken}</span>
    </div>
  </div>
  <div class="fee-row">
    <span class="label">Max Slippage</span>
    <div class="amount">
      <span class="value">{slippage}</span>
      <span class="token">%</span>
    </div>
  </div>
</div>

<style>
  .section {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 12px;
  }

  .fee-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .fee-row:not(:last-child) {
    margin-bottom: 8px;
  }

  .label {
    color: #ffd700;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .amount {
    font-size: 1rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .value {
    color: #ffffff;
  }

  .token {
    color: #ffd700;
    font-weight: 500;
  }
</style>
