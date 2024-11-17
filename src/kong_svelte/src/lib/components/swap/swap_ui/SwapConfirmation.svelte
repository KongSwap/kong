<script lang="ts">
  import Modal from '$lib/components/common/Modal.svelte';
  import { tokenStore, getTokenDecimals } from '$lib/services/tokens/tokenStore';
  import { SwapService } from '$lib/services/swap/SwapService';
  import Button from '$lib/components/common/Button.svelte';
  import PayReceiveSection from './confirmation/PayReceiveSection.svelte';
  import RouteSection from './confirmation/RouteSection.svelte';
  import FeesSection from './confirmation/FeesSection.svelte';
  import { onMount, onDestroy } from 'svelte';

  export let payToken: FE.Token;
  export let payAmount: string;
  export let receiveToken: FE.Token;
  export let receiveAmount: string;
  export let routingPath: string[] = [];
  export let userMaxSlippage: number;
  export let onClose: () => void;
  export let onConfirm: () => Promise<boolean>;
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];


  let isVisible = true;
  let isLoading = false;
  let isCountingDown = false; // Added for countdown state
  let error = '';
  let isInitializing = true;
  let countdown = 2;
  let countdownInterval: NodeJS.Timeout;
  let initialQuoteLoaded = false;

  onMount(async () => {
    try {
      isInitializing = true;
      const payDecimals = payToken.decimals;
      const payAmountBigInt = SwapService.toBigInt(payAmount, payDecimals);
      
      const quote = await SwapService.swap_amounts(
        payToken,
        payAmountBigInt,
        receiveToken,
      );

      if ("Ok" in quote) {
        const receiveDecimals = receiveToken.decimals;
        receiveAmount = SwapService.fromBigInt(
          quote.Ok.receive_amount,
          receiveDecimals,
        );
        
        // Only update routing path and fees on initial load
        if (quote.Ok.txs.length > 0 && !initialQuoteLoaded) {
          initialQuoteLoaded = true;
          routingPath = [
            payToken.symbol,
            ...quote.Ok.txs.map((tx) => tx.receive_symbol),
          ];

          gasFees = [];
          lpFees = [];

          quote.Ok.txs.forEach((tx) => {
            const receiveDecimals = getTokenDecimals(tx.receive_symbol);
            gasFees.push(SwapService.fromBigInt(tx.gas_fee, receiveDecimals));
            lpFees.push(SwapService.fromBigInt(tx.lp_fee, receiveDecimals));
          });
        }
      } else {
        error = quote.Err;
        setTimeout(() => onClose(), 2000);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to get quote';
      setTimeout(() => onClose(), 2000);
    } finally {
      isInitializing = false;
    }
  });

  async function handleConfirm() {
    if (isLoading || isCountingDown) return; // Prevent multiple triggers
    
    isLoading = true;
    error = '';
    
    try {
      const success = onConfirm();
      if (success) {
        // Start countdown
        isCountingDown = true;
        countdown = 2; // Reset countdown
        countdownInterval = setInterval(() => {
          countdown--;
          if (countdown <= 0) {
            clearInterval(countdownInterval);
            isVisible = false;
            onClose();
          }
        }, 1000);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Swap failed';
    } finally {
      isLoading = false;
    }
  }

  onDestroy(() => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
  });

  $: totalGasFee = calculateTotalFee(gasFees);
  $: totalLPFee = calculateTotalFee(lpFees);

  function calculateTotalFee(fees: string[]): number {
  if (!routingPath.length || !fees.length) return 0;
  
  return routingPath.slice(1).reduce((acc, _, i) => {
    const token = $tokenStore.tokens.find(t => t.symbol === routingPath[i + 1]);
    if (!token) return acc;

    const decimals = token.decimals || 8;
    // Parse the fee value safely
    const feeValue = parseFloat(fees[i]) || 0;
    
    try {
      const stepFee = SwapService.fromBigInt(
        scaleDecimalToBigInt(feeValue, decimals),
        decimals
      );
      return acc + (Number(stepFee) || 0);
    } catch (error) {
      console.error('Error calculating fee:', error);
      return acc;
    }
  }, 0);
}

function scaleDecimalToBigInt(decimal: number, decimals: number): bigint {
  if (isNaN(decimal) || !isFinite(decimal)) return 0n;
  
  const scaleFactor = 10n ** BigInt(decimals);
  const scaledValue = decimal * Number(scaleFactor);
  // Ensure we're converting a valid number
  return BigInt(Math.floor(Math.max(0, scaledValue)));
}
</script>

<Modal show={isVisible} title="Review Swap" {onClose} variant="green" height="auto">
  {#if isInitializing}
    <div class="flex justify-center items-center max-h-[100px]">
      <span class="text-white text-lg opacity-80">Getting latest price...</span>
    </div>
  {:else if error}
    <div class="flex justify-center items-center min-h-[200px] p-4">
      <p class="text-red-500 text-base text-center">{error}</p>
    </div>
  {:else if payToken && receiveToken}
    <div class="flex flex-col h-full">
      <div class="flex flex-col gap-2 overflow-y-auto pr-1 mb-4">
        <PayReceiveSection {payToken} {payAmount} {receiveToken} {receiveAmount} />
        <RouteSection {routingPath} {gasFees} {lpFees} {payToken} {receiveToken} />
        <FeesSection {totalGasFee} {totalLPFee} {userMaxSlippage} {receiveToken} />
      </div>
      
      <div class="mt-auto">
        <Button
          text={isCountingDown ? `Processing ${countdown}...` : 'CONFIRM SWAP'}
          variant="yellow"
          size="big"
          onClick={handleConfirm}
          disabled={isLoading || isCountingDown}
          width="100%"
        />
      </div>
    </div>
  {/if}
</Modal>