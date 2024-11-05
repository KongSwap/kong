<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { tokenStore } from '$lib/stores/tokenStore';
  import { SwapService } from '$lib/services/SwapService';
  import Panel from '$lib/components/common/Panel.svelte';
  import Button from '$lib/components/common/Button.svelte';
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
    <div class="header">
      <h2>Review Swap</h2>
      <button class="close" on:click={onClose}>×</button>
    </div>

    <div class="swap-info">
      <div class="row">
        <span>You Pay</span>
        <div class="token">
          <img src={$tokenStore.tokens?.find(t => t.symbol === payToken)?.logo || "/tokens/not_verified.webp"} 
               alt={payToken} />
          <span>{payToken}</span>
          <span>{payAmount}</span>
        </div>
      </div>

      <div class="row">
        <span>You Receive</span>
        <div class="token">
          <img src={$tokenStore.tokens?.find(t => t.symbol === receiveToken)?.logo || "/tokens/not_verified.webp"} 
               alt={receiveToken} />
          <span>{receiveToken}</span>
          <span>{receiveAmount}</span>
        </div>
      </div>
    </div>

    <div class="route">
      <h3>Route</h3>
      {#each routingPath.slice(0, -1) as token, i}
        <div class="step">
          <div class="tokens">
            <img src={$tokenStore.tokens?.find(t => t.symbol === token)?.logo || "/tokens/not_verified.webp"} 
                 alt={token} />
            <span>→</span>
            <img src={$tokenStore.tokens?.find(t => t.symbol === routingPath[i + 1])?.logo || "/tokens/not_verified.webp"} 
                 alt={routingPath[i + 1]} />
          </div>
          <div class="fees">
            <span>Gas: {gasFees[i]} {routingPath[i + 1]}</span>
            <span>LP: {lpFees[i]} {routingPath[i + 1]}</span>
          </div>
        </div>
      {/each}
    </div>

    <div class="summary">
      <div class="fee">
        <span>Network Fee</span>
        <span>{totalGasFee} {receiveToken}</span>
      </div>
      <div class="fee">
        <span>LP Fee</span>
        <span>{totalLPFee} {receiveToken}</span>
      </div>
      <div class="fee">
        <span>Slippage</span>
        <span class="highlight">{slippage}%</span>
      </div>
    </div>

    <button 
      class="confirm"
      disabled={isLoading}
      on:click={() => { isLoading = true; onConfirm(); }}>
      {isLoading ? 'Confirming...' : 'CONFIRM SWAP'}
    </button>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 16px;
  }

  .modal-content {
    background: #95C87D;
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h2, h3 {
    font-size: 1rem;
    color: #fff;
  }

  .close {
    background: none;
    border: none;
    color: #ff4444;
    font-size: 24px;
    cursor: pointer;
  }

  .row, .step, .fee {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
  }

  .token, .tokens {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  img {
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }

  .fees {
    display: flex;
    gap: 12px;
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .fee {
    flex-direction: column;
    align-items: flex-start;
    font-size: 0.875rem;
  }

  .highlight {
    color: #FFB800;
  }

  .confirm {
    background: #FFB800;
    color: #000;
    border: none;
    border-radius: 8px;
    padding: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .confirm:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .confirm:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .modal-content {
      padding: 16px;
    }

    .summary {
      grid-template-columns: 1fr;
    }

    .fee {
      flex-direction: row;
    }
  }
</style>
