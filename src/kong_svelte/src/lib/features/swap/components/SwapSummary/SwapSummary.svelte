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

<Card className="p-3 sm:p-4 bg-kong-bg-tertiary/20 border-kong-border/30">
  <div class="space-y-2 sm:space-y-3">
    <!-- Total Fees -->
    <div class="flex justify-between items-center">
      <span class="text-xs sm:text-sm text-kong-text-secondary">Total Fees</span>
      <span class="text-xs sm:text-sm font-medium text-kong-text-primary">
        {totalFees} {receiveToken?.symbol || ''}
      </span>
    </div>
  
    <!-- Price Impact -->
    <div class="flex justify-between items-center">
      <span class="text-xs sm:text-sm text-kong-text-secondary">Price Impact</span>
      <span class="text-xs sm:text-sm font-semibold {priceImpactColor}">
        {quote.priceImpact.toFixed(2)}%
      </span>
    </div>
  </div>
</Card>