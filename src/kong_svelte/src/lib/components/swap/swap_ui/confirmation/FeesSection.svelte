<script lang="ts">
  export let totalGasFee: number;
  export let totalLPFee: number;
  export let userMaxSlippage: number;
  export let receiveToken: FE.Token;
</script>

<div class="section">
  <h3 class="section-title">Transaction Details</h3>
  
  <div class="fee-rows">
    <div class="fee-row">
      <div class="label-container">
        <span class="label">Network Fee</span>
        <div class="info-tooltip">
          ℹ️
          <span class="tooltip-text">Gas fee required by the network to process your transaction</span>
        </div>
      </div>
      <div class="amount">
        <span class="value">{totalGasFee.toFixed(6)}</span>
        <span class="token">{receiveToken.symbol}</span>
      </div>
    </div>
    
    <div class="fee-row">
      <div class="label-container">
        <span class="label">Trading Fee</span>
        <div class="info-tooltip">
          ℹ️
          <span class="tooltip-text">Fee paid to liquidity providers for facilitating the trade</span>
        </div>
      </div>
      <div class="amount">
        <span class="value">{totalLPFee.toFixed(6)}</span>
        <span class="token">{receiveToken.symbol}</span>
      </div>
    </div>
    
    <div class="fee-row slippage-row">
      <div class="label-container">
        <span class="label">Max Slippage</span>
        <div class="info-tooltip">
          ℹ️
          <span class="tooltip-text">Maximum price movement you're willing to accept</span>
        </div>
      </div>
      <div class="amount">
        <span class="value {userMaxSlippage > 1 ? 'warning' : ''}">{userMaxSlippage}%</span>
      </div>
    </div>
  </div>
</div>

<style>
  .section {
    background: rgba(26, 27, 35, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 100%;
    box-sizing: border-box;
  }

  .section-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin: 0 0 16px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .fee-rows {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .fee-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    transition: background-color 0.2s ease;
    flex-wrap: nowrap;
    min-height: 32px;
  }

  .label-container {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .label {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
    white-space: nowrap;
  }

  .info-tooltip {
    position: relative;
    cursor: help;
    font-size: 0.8rem;
    opacity: 0.6;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
  }

  .info-tooltip:hover {
    opacity: 1;
  }

  .tooltip-text {
    visibility: hidden;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: 100%;
    margin-bottom: 8px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    font-size: 0.8rem;
    white-space: normal;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    z-index: 10;
    opacity: 0;
    transition: opacity 0.2s ease, visibility 0.2s ease;
    max-width: 200px;
    word-wrap: break-word;
  }

  .tooltip-text::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 100%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.9);
  }

  .info-tooltip:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
  }

  .amount {
    font-size: 0.95rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .value {
    color: rgba(255, 255, 255, 0.9);
    font-feature-settings: "tnum";
    font-variant-numeric: tabular-nums;
  }

  .token {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.85rem;
  }

  .warning {
    color: #fbbf24;
  }

  .slippage-row .value {
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    font-size: 0.85rem;
  }

  @media (max-width: 640px) {
    .section {
      padding: 12px 16px;
    }

    .section-title {
      font-size: 0.85rem;
      margin: 0 0 8px 0;
      padding-bottom: 8px;
    }

    .fee-rows {
      gap: 8px;
    }

    .fee-row {
      padding: 2px 0;
      min-height: 24px;
    }

    .label {
      font-size: 0.8rem;
    }

    .info-tooltip {
      font-size: 0.75rem;
    }

    .amount {
      font-size: 0.8rem;
    }

    .token {
      font-size: 0.75rem;
    }

    .slippage-row .value {
      padding: 2px 6px;
      font-size: 0.8rem;
    }

    .tooltip-text {
      display: none;
    }
  }
</style>
