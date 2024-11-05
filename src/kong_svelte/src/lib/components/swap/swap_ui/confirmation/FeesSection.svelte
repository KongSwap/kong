<script lang="ts">
  export let totalGasFee: number;
  export let totalLPFee: number;
  export let slippage: number;
  export let receiveToken: string;

  const formatNumber = (num: number) => num.toFixed(8);
</script>

<div class="section bottom-section glass-effect" role="region" aria-label="Fee breakdown">
  <div class="compact-totals">
    <div class="total-row">
      <span class="label" title="Network fee for processing the transaction">Gas Fee</span>
      <span class="mono">{formatNumber(totalGasFee)} {receiveToken}</span>
    </div>
    <div class="total-row">
      <span class="label" title="Fee paid to liquidity providers">LP Fee</span>
      <span class="mono">{formatNumber(totalLPFee)} {receiveToken}</span>
    </div>
    <div class="total-row">
      <span class="label" title="Maximum price impact you're willing to accept">Slippage</span>
      <span class="highlight">{slippage}%</span>
    </div>
  </div>
</div>

<style>
  .section {
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 16px;
  }

  .bottom-section {
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
    padding: 12px;
  }

  .glass-effect {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .compact-totals {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .total-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 120px;
    gap: 12px;
    color: #888;
    font-size: 0.9rem;
  }

  .label {
    cursor: help;
  }

  .total-row:hover {
    color: #999;
  }

  .total-row .mono {
    font-family: monospace;
    color: white;
  }

  .total-row .highlight {
    color: #FFB800;
    font-weight: 500;
  }

  @media (max-width: 480px) {
    .compact-totals {
      flex-direction: column;
      gap: 12px;
    }
    
    .total-row {
      width: 100%;
    }
  }
</style>
