<script lang="ts">
  import Modal from '$lib/components/common/Modal.svelte';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { SwapService } from '$lib/services/swap/SwapService';
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
  <Modal
    show={!showLoadingScreen}
    title="Review Swap"
    onClose={onClose}
    variant="green"
    height="80vh"
  >
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
  </Modal>
{/if}

<style lang="postcss">
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

  .mt-4 {
    margin-top: 1rem;
  }
</style>
