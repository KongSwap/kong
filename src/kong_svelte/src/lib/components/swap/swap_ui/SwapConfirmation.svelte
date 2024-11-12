<script lang="ts">
  import Modal from '$lib/components/common/Modal.svelte';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { SwapService } from '$lib/services/swap/SwapService';
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
  export let onConfirm: () => Promise<boolean>;
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];

  let isVisible = true;
  let isLoading = false;
  let error = '';

  async function handleConfirm() {
    if (isLoading) return;
    
    isLoading = true;
    error = '';
    
    try {
      const success = await onConfirm();
      if (!success) throw new Error('Swap failed');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Swap failed';
      return;
    } finally {
      isLoading = false;
      isVisible = false; 
      onClose();
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

<Modal show={isVisible} title="Review Swap" {onClose} variant="green">
  <div class="modal-content">
    <div class="sections-container">
      <PayReceiveSection {payToken} {payAmount} {receiveToken} {receiveAmount} />
      <RouteSection {routingPath} {gasFees} {lpFees} {payToken} {receiveToken} />
      <FeesSection {totalGasFee} {totalLPFee} {slippage} {receiveToken} />
    </div>
    
    <div class="button-container">
      {#if error}
        <p class="error-text">{error}</p>
      {/if}
      <Button
        text={isLoading ? 'Processing...' : 'CONFIRM SWAP'}
        variant="yellow"
        size="big"
        onClick={handleConfirm}
        disabled={isLoading}
        width="100%"
      />
    </div>
  </div>
</Modal>

<style lang="postcss">
  .modal-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sections-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    padding-right: 4px;
    margin-bottom: 16px;
  }

  .button-container {
    margin-top: auto;
  }

  .error-text {
    color: #f44336;
    font-size: 0.9rem;
    text-align: center;
    margin-bottom: 8px;
  }
</style>
