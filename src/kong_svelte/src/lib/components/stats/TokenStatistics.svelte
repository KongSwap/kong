<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
    import { TokenService } from "$lib/services/tokens";
    import { onMount } from "svelte";

  export let token: FE.Token;
  export let marketCapRank: number | null;

  let previousPrice: number | null = null;
  let priceFlash: 'up' | 'down' | null = null;

  function calculateVolumePercentage(volume: number, marketCap: number): string {
    if (!marketCap) return "0.00%";
    return ((volume / marketCap) * 100).toFixed(2) + "%";
  }

  // Watch for price changes
  $: {
    const currentPrice = Number(token?.metrics?.price || 0);
    if (previousPrice !== null && currentPrice !== previousPrice) {
      priceFlash = currentPrice > previousPrice ? 'up' : 'down';
      setTimeout(() => priceFlash = null, 1000);
    }
    previousPrice = currentPrice;
  }

   onMount(async () => {
    await TokenService.fetchTokens();
   })

   $: formattedPrice = formatUsdValue(token?.metrics?.price || 0);
   $: formattedPriceChange24h = Number(token.metrics.price_change_24h) || 0;
</script>

<Panel variant="transparent" type="main" className="p-6">
  <div class="flex flex-col gap-8">
    <!-- Price Section -->
    <div>
      <div class="text-sm text-kong-text-primary/50 uppercase tracking-wider mb-2">Current Price</div>
      <div class="flex flex-col gap-2">
        <div 
          class="text-[32px] font-medium text-kong-text-primary"
          class:flash-green={priceFlash === 'up'}
          class:flash-red={priceFlash === 'down'}
        >
          {formattedPrice}
        </div>
        {#if formattedPriceChange24h}
          <div class="text-sm">
            <span
              class={formattedPriceChange24h > 0 ? "text-green-400" : "text-red-400"}
            >
              {formattedPriceChange24h > 0 ? "+" : ""}{formattedPriceChange24h.toFixed(2)}%
            </span>
            <span class="text-kong-text-primary/40 ml-1">24h</span>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Market Stats -->
    <div class="grid grid-cols-2 gap-6">
      <!-- Market Cap -->
      <div>
        <div class="text-sm text-kong-text-primary/50 uppercase tracking-wider mb-2">Market Cap</div>
        <div class="text-xl font-medium text-kong-text-primary">
          {formatUsdValue(token?.metrics?.market_cap)}
        </div>
        <div class="text-sm text-kong-text-primary/40 mt-1">
          Rank #{marketCapRank !== null ? marketCapRank : "N/A"}
        </div>
      </div>
      
      <!-- 24h Volume -->
      <div>
        <div class="text-sm text-kong-text-primary/50 uppercase tracking-wider mb-2">24h Volume</div>
        <div class="text-xl font-medium text-kong-text-primary">
          {formatUsdValue(Number(token.metrics.volume_24h))}
        </div>
        <div class="text-sm text-kong-text-primary/40 mt-1">
          {token.metrics.volume_24h
            ? `${calculateVolumePercentage(Number(token.metrics.volume_24h), Number(token.metrics.market_cap))} of mcap`
            : "No volume data"}
        </div>
      </div>
      
      <!-- Total Supply -->
      <div>
        <div class="text-sm text-kong-text-primary/50 uppercase tracking-wider mb-2">Total Supply</div>
        <div class="text-xl font-medium text-kong-text-primary">
          {token?.metrics?.total_supply
            ? formatToNonZeroDecimal(
                Number(token.metrics?.total_supply) / 10 ** token.decimals,
              )
            : "0"}
        </div>
        <div class="text-sm text-kong-text-primary/40 mt-1">
          {token?.symbol || ""} tokens
        </div>
      </div>

      <!-- Circl Supply -->
      <div>
        <div class="text-sm text-kong-text-primary/50 uppercase tracking-wider mb-2">Circulating Supply</div>
        <div class="text-xl font-medium text-kong-text-primary">
          {token?.metrics?.total_supply
            ? formatToNonZeroDecimal(
                Number(token.metrics?.total_supply) / 10 ** token.decimals,
              )
            : "0"}
        </div>
        <div class="text-sm text-kong-text-primary/40 mt-1">
          {token?.symbol || ""} tokens
        </div>
      </div>
    </div>
  </div>
</Panel>

<style>
  .flash-green {
    animation: flashGreen 1s ease-out;
  }
  
  .flash-red {
    animation: flashRed 1s ease-out;
  }
  
  @keyframes flashGreen {
    0% { color: rgb(34, 197, 94); }
    100% { color: inherit; }
  }
  
  @keyframes flashRed {
    0% { color: rgb(239, 68, 68); }
    100% { color: inherit; }
  }
</style> 