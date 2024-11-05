<script lang="ts">
  import { fade } from 'svelte/transition';
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
  let showLoadingScreen = false;

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleConfirm() {
    isLoading = true;
    showLoadingScreen = true;
    onConfirm();
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

  function scaleDecimalToBigInt(decimal: number, decimals: number): bigint {
    const scaleFactor = 10n ** BigInt(decimals);
    const scaledValue = decimal * Number(scaleFactor);
    return BigInt(Math.floor(scaledValue));
  }
</script>

{#if showLoadingScreen}
  <div 
    class="loading-overlay"
    transition:fade={{ duration: 300 }}
  >
    <div class="loading-content">
      <div class="jungle-mist"></div>
      
      <div class="title-container">
        <img 
          src="/titles/swap_title.webp" 
          alt="Kong Swap" 
          class="kong-title"
        />
      </div>

      <div class="center-container">
        <div class="pixel-box">
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <p class="status-text">SWAP IN PROGRESS...</p>
          <p class="warning-text">DO NOT CLOSE THIS WINDOW</p>
        </div>
      </div>

      <div class="vines left-vines"></div>
      <div class="vines right-vines"></div>
    </div>
  </div>
{:else}
  <div 
    class="modal-overlay" 
    transition:fade={{ duration: 200 }}
    on:click={handleOverlayClick}
  >
    <Panel variant="green" width="auto" height="auto">
      <div class="modal-content">
        <div class="header">
          <h2>Review Swap</h2>
          <button class="close" on:click={onClose}>×</button>
        </div>

        <div class="sections-container">
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
            {payToken}
            {receiveToken}
          />

          <FeesSection
            {totalGasFee}
            {totalLPFee}
            {slippage}
            {receiveToken}
          />

          <div class="mt-4">
            <Button
              text={isLoading ? 'Confirming...' : 'CONFIRM SWAP'}
              variant="yellow"
              size="big"
              disabled={isLoading}
              onClick={handleConfirm}
              width="100%"
            />
          </div>
        </div>
      </div>
    </Panel>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 12px;
  }

  .modal-content {
    width: 100%;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sections-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: calc(80vh - 140px);
    overflow-y: auto;
    padding-right: 4px;
  }

  .sections-container::-webkit-scrollbar {
    width: 4px;
  }

  .sections-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  }

  h2 {
    font-family: 'Press Start 2P', monospace;
    font-size: 1rem;
    color: #fff;
    margin: 0;
  }

  .close {
    background: none;
    border: none;
    color: #ff4444;
    font-size: 24px;
    cursor: pointer;
    padding: 2px;
    line-height: 1;
    transition: transform 0.2s;
  }

  .close:hover {
    transform: scale(1.1);
  }

  @media (max-width: 480px) {
    .modal-content {
      padding: 12px;
    }
  }

  .section {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 12px;
  }

  .loading-overlay {
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at center, #1a1a1a 0%, #000 100%);
    z-index: 9999;
    overflow: hidden;
  }

  .loading-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .jungle-mist {
    position: absolute;
    inset: 0;
    background: 
      repeating-linear-gradient(
        0deg,
        transparent 0%,
        rgba(0, 255, 0, 0.05) 50%,
        transparent 100%
      );
    background-size: 100% 8px;
    animation: mistScroll 20s linear infinite;
    pointer-events: none;
  }

  .title-container {
    position: absolute;
    top: 15%;
    left: 50%;
    transform: translateX(-50%);
    width: 500px;
    animation: titlePulse 2s ease-in-out infinite;
  }

  .kong-title {
    width: 100%;
    height: auto;
    filter: drop-shadow(0 0 20px rgba(0, 255, 0, 0.4));
  }

  .center-container {
    position: relative;
    z-index: 2;
  }

  .pixel-box {
    background: rgba(0, 0, 0, 0.8);
    border: 4px solid #4a4;
    padding: 20px;
    width: 400px;
    box-shadow: 
      0 0 0 4px #000,
      0 0 20px rgba(0, 255, 0, 0.4);
    image-rendering: pixelated;
  }

  .progress-bar {
    height: 30px;
    background: #000;
    border: 2px solid #4a4;
    padding: 4px;
    margin-bottom: 20px;
  }

  .progress-fill {
    height: 100%;
    background: #4a4;
    width: 0%;
    animation: progressFill 2s ease-in-out infinite;
  }

  .status-text {
    font-family: 'Press Start 2P', monospace;
    color: #4a4;
    text-align: center;
    margin: 10px 0;
    font-size: 1.2rem;
    animation: textBlink 1s step-end infinite;
  }

  .warning-text {
    font-family: 'Press Start 2P', monospace;
    color: #f44;
    text-align: center;
    font-size: 0.8rem;
    margin-top: 20px;
    animation: warningPulse 2s ease-in-out infinite;
  }

  .vines {
    position: absolute;
    width: 200px;
    height: 100%;
    background: 
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 20px,
        #4a4 22px,
        #4a4 25px
      );
    opacity: 0.2;
  }

  .left-vines {
    left: 0;
    transform: skew(-15deg);
  }

  .right-vines {
    right: 0;
    transform: skew(15deg);
  }

  @keyframes mistScroll {
    0% { background-position: 0 0; }
    100% { background-position: 0 100%; }
  }

  @keyframes titlePulse {
    0%, 100% { 
      transform: translateX(-50%) scale(1);
      filter: drop-shadow(0 0 20px rgba(0, 255, 0, 0.4));
    }
    50% { 
      transform: translateX(-50%) scale(1.05);
      filter: drop-shadow(0 0 30px rgba(0, 255, 0, 0.6));
    }
  }

  @keyframes progressFill {
    0% { width: 0%; }
    50% { width: 100%; }
    100% { width: 0%; }
  }

  @keyframes textBlink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  @keyframes warningPulse {
    0%, 100% { color: #f44; }
    50% { color: #f88; }
  }

  @media (max-width: 768px) {
    .title-container {
      width: 80%;
    }

    .pixel-box {
      width: 90%;
      margin: 0 20px;
    }

    .status-text {
      font-size: 0.9rem;
    }

    .warning-text {
      font-size: 0.7rem;
    }
  }
</style>

