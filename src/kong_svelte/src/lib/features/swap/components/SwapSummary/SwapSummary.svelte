<script lang="ts">
  import type { SwapQuote, SwapToken } from '../../types/swap.types';
  import BigNumber from 'bignumber.js';
  import Card from '$lib/components/common/Card.svelte';
  
  interface Props {
    quote: SwapQuote;
    payToken: SwapToken | null;
    receiveToken: SwapToken | null;
  }
  
  let { quote, payToken, receiveToken }: Props = $props();
  
  // Calculate total fees (LP fees + gas fees)
  let totalFees = $derived(
    quote.lpFees
      .reduce((sum, fee) => sum.plus(fee.amount), new BigNumber(0))
      .plus(
        quote.gasFees
          .reduce((sum, fee) => sum.plus(fee.amount), new BigNumber(0))
      )
      .toFormat(6)
  );
  
  // Format price impact color
  let priceImpactColor = $derived(
    quote.priceImpact < 1 ? 'text-kong-success' :
    quote.priceImpact < 3 ? 'text-kong-warning' :
    'text-kong-error'
  );
</script>

<Card className="p-4 sm:p-6 bg-kong-swap-input-bg/50 border-kong-swap-input-border rounded-2xl">
  <div class="space-y-3 sm:space-y-4">
    <!-- Total Fees -->
    <div class="flex justify-between items-center">
      <span class="text-sm sm:text-base text-kong-text-secondary font-medium">Total Fees</span>
      <span class="text-sm sm:text-base font-semibold text-kong-text-primary tabular-nums">
        {totalFees} {receiveToken?.symbol || ''}
      </span>
    </div>
  
    <!-- Price Impact -->
    <div class="flex justify-between items-center">
      <span class="text-sm sm:text-base text-kong-text-secondary font-medium">Price Impact</span>
      <span class="text-sm sm:text-base font-semibold tabular-nums {priceImpactColor}">
        {quote.priceImpact.toFixed(2)}%
      </span>
    </div>
  </div>
</Card>