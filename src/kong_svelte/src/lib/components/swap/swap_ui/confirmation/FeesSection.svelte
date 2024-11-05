<script lang="ts">
  export let totalGasFee: number;
  export let totalLPFee: number;
  export let slippage: number;
  export let receiveToken: string;

  const formatNumber = (num: number) => num.toFixed(8);
</script>

<div class="section">
  <div class="fees-grid">
    <div class="fee-item">
      <span class="fee-label">Network Fee</span>
      <span class="fee-value">{formatNumber(totalGasFee)} {receiveToken}</span>
    </div>
    
    <div class="fee-item">
      <span class="fee-label">LP Fee</span>
      <span class="fee-value">{formatNumber(totalLPFee)} {receiveToken}</span>
    </div>
    
    <div class="fee-item">
      <span class="fee-label">Max Slippage</span>
      <span class="fee-value highlight">{slippage}%</span>
    </div>
  </div>
</div>

<style>
  .section {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px;
  }

  .fees-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .fee-item {
    background: rgba(0, 0, 0, 0.1);
    padding: 12px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .fee-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .fee-value {
    font-family: monospace;
    font-size: 1rem;
    color: #fff;
  }

  .highlight {
    color: #FFB800;
  }

  @media (max-width: 480px) {
    .fees-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
