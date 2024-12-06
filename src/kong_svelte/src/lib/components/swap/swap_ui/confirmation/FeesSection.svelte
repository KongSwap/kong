<script lang="ts">
  export let totalGasFee: number;
  export let totalLPFee: number;
  export let userMaxSlippage: number;
  export let receiveToken: FE.Token;
</script>

<div class="section">
  <div class="fee-row">
    <span class="label">Gas Fee</span>
    <div class="amount">
      <span class="value">{totalGasFee.toFixed(6)}</span>
      <span class="token">{receiveToken.symbol}</span>
    </div>
  </div>
  <div class="fee-row">
    <span class="label">LP Fee</span>
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
  .section {
    background: rgba(26, 27, 35, 0.6);
    border: 1px solid rgba(42, 45, 61, 1);
    border-radius: 12px;
    padding: 16px;
  }

  .fee_fixed-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
  }

  .fee_fixed-row:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .label {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
  }

  .amount {
    font-size: 16px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .value {
    color: white;
  }

  .token {
    color: rgba(255, 255, 255, 0.6);
  }
</style>
