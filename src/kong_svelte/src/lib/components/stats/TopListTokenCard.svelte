<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

  export let token: Kong.Token;
  export let displayType: 'gainer' | 'loser' | 'volume' = 'gainer';

  $: priceChange = Number(token?.metrics?.price_change_24h || 0);
  $: volume = token?.metrics?.volume_24h;
  $: price = token?.metrics?.price;
  
  $: trendClass = displayType === 'gainer' 
    ? 'text-kong-success' 
    : displayType === 'loser' 
    ? 'text-kong-error'
    : 'text-kong-text-primary';
</script>

<div class="w-full bg-kong-bg-secondary/50 hover:bg-kong-bg-primary/40 rounded-lg transition-all duration-200 group">
  <div class="px-2 py-1 flex items-center justify-between gap-3">
    <!-- Left side: Token Image and Symbol -->
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <div class="flex-shrink-0">
        <TokenImages tokens={[token]} size={20} showNetworkIcon />
      </div>
      
      <div class="font-medium text-kong-text-primary text-sm flex-shrink-0">
        {token.symbol}
      </div>
    </div>

    <!-- Right side: Value display -->
    <div class="flex flex-col items-end flex-shrink-0">
      {#if displayType === 'volume'}
        <div class="text-sm {trendClass}">
          ${formatToNonZeroDecimal(volume)}
        </div>
        <div class="text-xs {priceChange > 0 ? 'text-kong-success' : 'text-kong-error'}">
          ${formatToNonZeroDecimal(price)}
        </div>
      {:else}
        <div class="font-semibold text-sm {trendClass}">
          {#if priceChange > 0}+{/if}{formatToNonZeroDecimal(priceChange)}%
        </div>
        <div class="text-xs text-kong-text-secondary">
          ${formatToNonZeroDecimal(price)}
        </div>
      {/if}
    </div>
  </div>
</div> 