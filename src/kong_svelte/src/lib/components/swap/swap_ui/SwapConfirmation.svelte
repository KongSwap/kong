<script lang="ts">
  import { fade } from 'svelte/transition';
  import { tokenStore } from '$lib/stores/tokenStore';
  import { SwapService } from '$lib/services/SwapService';
  import PayReceiveSection from './confirmation/PayReceiveSection.svelte';
  import RouteSection from './confirmation/RouteSection.svelte';
  import FeesSection from './confirmation/FeesSection.svelte';

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
  <div class="modal-content">
    <div class="modal-header">
      <h2>Review Swap</h2>
      <button class="close-button" on:click={onClose}>×</button>
    </div>

    <PayReceiveSection 
      {payToken}
      {payAmount}
      {receiveToken}
      {receiveAmount}
    />

    <RouteSection 
      {routingPath}
      {gasFees}
      {lpFees}
    />

    <FeesSection
      {totalGasFee}
      {totalLPFee}
      {slippage}
      {receiveToken}
    />

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
</style>
