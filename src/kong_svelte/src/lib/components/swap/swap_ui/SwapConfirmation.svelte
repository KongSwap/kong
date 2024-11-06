<script lang="ts">
  import { fade } from 'svelte/transition';
  import { tokenStore } from '$lib/stores/tokenStore';
  import { SwapService } from '$lib/services/SwapService';
  import Panel from '$lib/components/common/Panel.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import PayReceiveSection from './confirmation/PayReceiveSection.svelte';
  import RouteSection from './confirmation/RouteSection.svelte';
  import FeesSection from './confirmation/FeesSection.svelte';
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

  let isSwapping = false;
  let currentRouteIndex = 0;
  let swapStatus: 'pending' | 'success' | 'failed' = 'pending';
  let currentStep = '';
  let error = '';
  let routeProgress = tweened(0, {
    duration: 25,
    easing: cubicOut
  });

  $: isLastRoute = currentRouteIndex === routingPath.length - 1;
  $: buttonText = isSwapping ? currentStep : 'CONFIRM SWAP';
  $: buttonVariant = swapStatus === 'failed' ? 'red' : 'yellow';
  $: buttonDisabled = isSwapping || swapStatus === 'success';

  function handleOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      onClose();
    }
  }

  async function handleConfirm() {
    isSwapping = true;
    currentStep = 'Swapping...';
    
    try {
      routeProgress.set(0.5);
      const success = await onConfirm();
      if (!success) throw new Error('Failed');
      
      routeProgress.set(1);
      onClose();
    } catch (err) {
      error = 'Failed';
      isSwapping = false;
    }
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

<div class="modal-overlay" on:click|self={onClose}>
  <div class="modal-content confirmation-modal" transition:fade={{ duration: 200 }}>
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
            {currentRouteIndex}
            progress={$routeProgress}
            status={swapStatus}
          />

          <FeesSection
            {totalGasFee}
            {totalLPFee}
            {slippage}
            {receiveToken}
          />

          {#if error}
            <div class="error-message">
              {error}
            </div>
          {/if}

          <div class="mt-4">
            <Button
              text={isSwapping ? 'Swapping...' : 'Confirm Swap'}
              variant={error ? 'red' : 'yellow'}
              size="big"
              disabled={isSwapping}
              onClick={handleConfirm}
              width="100%"
            />
          </div>
        </div>
      </div>
    </Panel>
  </div>
</div>

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

  .error-message {
    color: #ff4444;
    text-align: center;
    padding: 8px;
    background: rgba(255, 68, 68, 0.1);
    border-radius: 8px;
    margin-top: 8px;
  }
</style>
