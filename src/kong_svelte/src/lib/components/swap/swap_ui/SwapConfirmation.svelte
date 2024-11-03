<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { tokenStore } from '$lib/stores/tokenStore';
  import Button from '$lib/components/common/Button.svelte';
  import { SwapService } from '$lib/services/SwapService';
  import { cubicOut } from 'svelte/easing';

  export let payToken: string;
  export let payAmount: string;
  export let receiveToken: string;
  export let receiveAmount: string;
  export let routingPath: string[] = [];
  export let slippage: number;
  export let onClose: () => void;
  export let onConfirm: () => void;
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];

  let isLoading = false;

  const swoopIn = (node, { delay = 0, duration = 500 }) => {
    return {
      delay,
      duration,
      css: t => {
        const bounce = cubicOut(t);
        const scale = 0.9 + (bounce * 0.1) + Math.sin(t * Math.PI) * 0.02;
        return `
          transform: translateY(${(1 - bounce) * 20}px) scale(${scale});
          opacity: ${bounce};
        `;
      }
    };
  };

  const float = (node, { delay = 0, duration = 2000 }) => {
    return {
      delay,
      duration,
      css: t => {
        const y = Math.sin(t * 2 * Math.PI) * 3;
        return `transform: translateY(${y}px);`;
      },
      loop: true
    };
  };

  function scaleDecimalToBigInt(decimal: number, decimals: number): bigint {
    const scaleFactor = 10n ** BigInt(decimals);
    const scaledValue = decimal * Number(scaleFactor);
    return BigInt(Math.floor(scaledValue));
  }

  $: totalGasFee = routingPath.length > 0 ? 
    routingPath.slice(1).reduce((acc, _, i) => {
      const token = $tokenStore.tokens.find(t => t.symbol === routingPath[i + 1]);
      const decimals = token?.decimals || 8;
      const gasFeeValue = typeof gasFees[i] === 'string' ? Number(gasFees[i]) : gasFees[i] || 0;
      const stepGasFee = SwapService.getInstance().fromBigInt(
        scaleDecimalToBigInt(gasFeeValue, decimals),
        decimals
      );
      return acc + Number(stepGasFee);
    }, 0) : 0;

  $: totalLPFee = routingPath.length > 0 ?
    routingPath.slice(1).reduce((acc, _, i) => {
      const token = $tokenStore.tokens.find(t => t.symbol === routingPath[i + 1]);
      const decimals = token?.decimals || 8;
      const lpFeeValue = typeof lpFees[i] === 'string' ? Number(lpFees[i]) : lpFees[i] || 0;
      const stepLPFee = SwapService.getInstance().fromBigInt(
        scaleDecimalToBigInt(lpFeeValue, decimals),
        decimals
      );
      return acc + Number(stepLPFee);
    }, 0) : 0;
</script>

<div class="modal-overlay" transition:fade={{ duration: 300 }}>
  <div class="modal-content" transition:swoopIn={{ duration: 400 }}>
    <div class="modal-header">
      <h2>Review Swap</h2>
      <button class="close-button" on:click={onClose}>×</button>
    </div>

    <!-- Top Section -->
    <div class="section top-section glass-effect">
      <div class="amount-row" in:swoopIn={{ delay: 150 }}>
        <span class="label">You Pay</span>
        <div class="token-amount">
          <span class="amount glow-text">{payAmount}</span>
          <div class="token-badge hover-effect" use:float={{ duration: 3000 }}>
            <img src={$tokenStore.tokens?.find(t => t.symbol === payToken)?.logo || "/tokens/not_verified.webp"} 
                 alt={payToken} class="token-icon"/>
            <span>{payToken}</span>
          </div>
        </div>
      </div>

      <div class="separator shine"></div>

      <div class="amount-row" in:swoopIn={{ delay: 300 }}>
        <span class="label">You Receive</span>
        <div class="token-amount">
          <span class="amount">{receiveAmount}</span>
          <div class="token-badge">
            <img src={$tokenStore.tokens?.find(t => t.symbol === receiveToken)?.logo || "/tokens/not_verified.webp"} 
                 alt={receiveToken} class="token-icon"/>
            <span>{receiveToken}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Middle Section -->
    <div class="section mid-section glass-effect">
      <h3 class="section-title glow-text">Route</h3>
      <div class="route-visualization">
        {#each routingPath.slice(0, -1) as token, i}
          <div class="route-step" in:swoopIn={{ delay: 200 + (i * 100) }}>
            <div class="token-pair">
              <div class="token-badge-small from">
                <img 
                  src={$tokenStore.tokens?.find(t => t.symbol === token)?.logo || "/tokens/not_verified.webp"}
                  alt={token}
                  class="token-icon-small"
                />
                <span>{token}</span>
              </div>
              <div class="arrow-container">
                <span class="arrow">→</span>
                <div class="arrow-line"></div>
              </div>
              <div class="token-badge-small to">
                <img 
                  src={$tokenStore.tokens?.find(t => t.symbol === routingPath[i + 1])?.logo || "/tokens/not_verified.webp"}
                  alt={routingPath[i + 1]}
                  class="token-icon-small"
                />
                <span>{routingPath[i + 1]}</span>
              </div>
            </div>
            <div class="step-fees">
              <span class="fee-text">Gas: {gasFees[i]} {routingPath[i + 1]}</span>
              <span class="fee-text">LP: {lpFees[i]} {routingPath[i + 1]}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Bottom Section -->
    <div class="section bottom-section glass-effect">
      <div class="compact-totals">
        <div class="total-row">
          <span>Gas Fee</span>
          <span class="mono">{totalGasFee.toFixed(8)} {receiveToken}</span>
        </div>
        <div class="total-row">
          <span>LP Fee</span>
          <span class="mono">{totalLPFee.toFixed(8)} {receiveToken}</span>
        </div>
        <div class="total-row">
          <span>Slippage</span>
          <span class="highlight">{slippage}%</span>
        </div>
      </div>
    </div>

    <button class="confirm-button {isLoading ? 'loading' : ''}"
            on:click={() => { isLoading = true; onConfirm(); }}>
      {isLoading ? 'Confirming...' : 'Confirm Swap'}
    </button>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: linear-gradient(145deg, #1A1A1A, #232323);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 24px;
    padding: 24px;
    width: clamp(300px, 90%, 480px);
    color: white;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                0 2px 8px rgba(255, 215, 0, 0.1);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .modal-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .close-button {
    background: none;
    border: none;
    color: #888;
    font-size: 1.5rem;
    cursor: pointer;
  }

  .amount-section {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .amount-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
  }

  .label {
    color: #888;
  }

  .token-amount {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .amount {
    font-family: monospace;
  }

  .token-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    padding: 6px 12px;
    border-radius: 8px;
  }

  .token-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }

  .route-visualization {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
  }

  .route-step {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .token-pair {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 16px;
    position: relative;
    min-height: 60px;
    transition: all 0.3s ease;
  }

  .token-pair:hover {
    transform: scale(1.02);
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.1);
  }

  .arrow-container {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 60px;
  }

  .arrow {
    color: #666;
    font-size: 24px;
    position: relative;
    z-index: 2;
    animation: floatArrow 3s ease-in-out infinite;
  }

  .arrow-line {
    position: absolute;
    top: 50%;
    width: 100%;
    height: 2px;
    background: rgba(255, 255, 255, 0.1);
  }

  @keyframes floatArrow {
    0%, 100% {
      transform: translateX(-8px) scale(1);
      opacity: 0.7;
    }
    50% {
      transform: translateX(8px) scale(1.1);
      opacity: 1;
    }
  }

  .token-badge-small {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    transition: all 0.2s ease;
    z-index: 1;
    animation: float 3s ease-in-out infinite;
  }

  .token-badge-small.from {
    margin-right: auto;
    transform: translateX(0);
  }

  .token-badge-small.to {
    margin-left: auto;
    transform: translateX(0);
  }

  .token-badge-small:hover {
    transform: scale(1.05);
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .token-icon-small {
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }

  .step-fees {
    display: flex;
    justify-content: space-between;
    padding: 8px 16px;
    margin-top: 8px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
  }

  .fee-text {
    font-size: 0.85rem;
    color: #888;
    font-family: monospace;
  }

  .total-fees {
    margin-top: 24px;
    padding: 16px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
  }

  .fee-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .slippage {
    color: #FFB800;
  }

  .confirm-button {
    width: 100%;
    margin-top: 24px;
    background: linear-gradient(45deg, #FFD700, #FFA500);
    border: none;
    border-radius: 12px;
    padding: 14px;
    font-weight: bold;
    font-size: 1.1rem;
    color: black;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .confirm-button:hover:not(.loading) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 215, 0, 0.2);
  }

  .confirm-button.loading {
    opacity: 0.8;
    cursor: wait;
  }

  .confirm-button.loading::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 200%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    animation: loading 1.5s infinite;
  }

  @keyframes loading {
    from { transform: translateX(-100%); }
    to { transform: translateX(100%); }
  }

  @media (max-width: 480px) {
    .modal-content {
      width: 100%;
      height: 100%;
      border-radius: 0;
    }
  }

  .glass-effect {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .glow-text {
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  }

  .hover-effect {
    transition: all 0.3s ease;
  }

  .hover-effect:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 215, 0, 0.2);
  }

  .exchange-indicator {
    display: flex;
    justify-content: center;
    margin: -5px 0;
    position: relative;
  }

  .exchange-arrow {
    background: linear-gradient(45deg, #FFD700, #FFA500);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: black;
    font-weight: bold;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }

  .route-step {
    transition: transform 0.3s ease;
  }

  .route-step:hover {
    transform: scale(1.02);
  }

  .token-pair {
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.08));
  }

  .arrow {
    background: linear-gradient(45deg, #FFD700, #FFA500);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .separator {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 215, 0, 0.2),
      transparent
    );
    margin: 8px 0;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .fees-summary {
    display: flex;
    gap: 16px;
    font-size: 0.85rem;
    color: #888;
  }

  .fees-summary span {
    font-family: monospace;
  }

  .fees-summary .slippage {
    color: #FFB800;
  }

  .separator.shine {
    position: relative;
    overflow: hidden;
  }

  .separator.shine::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 200%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 215, 0, 0.3),
      transparent
    );
    animation: shine 3s infinite;
  }

  @keyframes shine {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .confirm-button::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.1) 0%,
      transparent 70%
    );
    transform: rotate(45deg);
    animation: shimmer 3s infinite;
  }

  @keyframes shimmer {
    0% { transform: rotate(45deg) translateY(-100%); }
    100% { transform: rotate(45deg) translateY(100%); }
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-4px);
    }
  }

  .section {
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 16px;
  }

  .section-title {
    font-size: 1.2rem;
    margin-bottom: 16px;
    font-weight: 500;
  }

  .totals-grid {
    display: grid;
    gap: 12px;
  }

  .total-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .total-item:last-child {
    border-bottom: none;
  }

  .total-label {
    color: #888;
  }

  .total-value {
    font-family: monospace;
    font-weight: 500;
  }

  .total-value.highlight {
    color: #FFB800;
  }

  .top-section {
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  }

  .mid-section {
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
  }

  .bottom-section {
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
    padding: 12px;
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
    gap: 8px;
    color: #888;
    font-size: 0.9rem;
  }

  .total-row .mono {
    font-family: monospace;
    color: white;
  }

  .total-row .highlight {
    color: #FFB800;
    font-weight: 500;
  }
</style>
