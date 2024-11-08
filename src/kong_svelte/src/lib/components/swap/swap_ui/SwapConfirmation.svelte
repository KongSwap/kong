<script lang="ts">
  import { fade } from 'svelte/transition';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { SwapService } from '$lib/services/swap/SwapService';
  import Panel from '$lib/components/common/Panel.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import PayReceiveSection from './confirmation/PayReceiveSection.svelte';
  import RouteSection from './confirmation/RouteSection.svelte';
  import FeesSection from './confirmation/FeesSection.svelte';
  import SwapProgressOverlay from './confirmation/SwapProgressOverlay.svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let payToken: string;
  export let payAmount: string;
  export let receiveToken: string;
  export let receiveAmount: string;
  export let routingPath: string[] = [];
  export let slippage: number;
  export let onClose: () => void;
  export let onConfirm: () => Promise<boolean>;
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];

  let isLoading = false;
  let showLoadingScreen = false;
  let swapStatus: 'pending' | 'success' | 'failed' = 'pending';
  let currentStep: string = '';
  let error = '';

  let currentRouteIndex = 0;
  let routeProgress = tweened(0, {
    duration: 100,
    easing: cubicOut
  });

  $: isLastRoute = currentRouteIndex === routingPath.length - 1;

  function handleOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      onClose();
    }
  }

  async function handleConfirm() {
    isLoading = true;
    showLoadingScreen = true;
    swapStatus = 'pending';
    error = '';
    currentRouteIndex = 0;
    
    try {
      currentStep = 'Initializing swap...';
      await routeProgress.set(0);
      
      // Simulate progress through each route
      for (let i = 0; i < routingPath.length - 1; i++) {
        currentRouteIndex = i;
        currentStep = `Swapping ${routingPath[i]} → ${routingPath[i + 1]}...`;
        await routeProgress.set((i + 1) / (routingPath.length - 1));
      }
      
      const success = await onConfirm();
      
      if (!success) {
        throw new Error('Swap failed');
      }
      
      currentRouteIndex = routingPath.length - 1;
      await routeProgress.set(1);
      
      swapStatus = 'success';
      currentStep = 'Swap completed successfully!';
      
      setTimeout(() => {
        onClose();
      }, 3000);
      
    } catch (err) {
      swapStatus = 'failed';
      error = err instanceof Error ? err.message : 'Transaction failed';
      currentStep = 'Transaction failed. Please check your wallet and try again.';
      
      setTimeout(() => {
        isLoading = false;
        showLoadingScreen = false;
      }, 3000);
    }
  }

  $: totalGasFee = routingPath.length > 0 ? 
    routingPath.slice(1).reduce((acc, _, i) => {
      const token = $tokenStore.tokens.find(t => t.symbol === routingPath[i + 1]);
      const decimals = token?.decimals || 8;
      const gasFeeValue = typeof gasFees[i] === 'string' ? Number(gasFees[i]) : gasFees[i] || 0;
      const stepGasFee = SwapService.fromBigInt(
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
      const stepLPFee = SwapService.fromBigInt(
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
  <SwapProgressOverlay
    {routingPath}
    {currentRouteIndex}
    {swapStatus}
    currentStep={currentStep || 'Processing...'}
    {error}
  />
{:else}
  <div class="modal-overlay" on:click|self={onClose}>
    <div 
      class="modal-content confirmation-modal" 
      transition:fade={{ duration: 200 }}
    >
      <Panel variant="green" type="main" width="auto">
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
  </div>
{/if}

<style lang="postcss">
  .modal-content {
    width: 100%;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .sections-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
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

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
  }

  Button.mt-4 {
    margin-top: 1rem;
  }
</style>
