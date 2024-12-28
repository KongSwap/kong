<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";

  export let token: FE.Token;
  export let marketCapRank: number | null;

  function calculateVolumePercentage(volume: number, marketCap: number): string {
    if (!marketCap) return "0.00%";
    return ((volume / marketCap) * 100).toFixed(2) + "%";
  }
</script>

<Panel variant="transparent" type="main" className="p-6">
  <div class="flex flex-col gap-8">
    <!-- Price Section -->
    <div>
      <div class="text-sm text-kong-text-primary/50 uppercase tracking-wider mb-2">Current Price</div>
      <div class="flex flex-col gap-2">
        <div class="text-[32px] font-medium text-kong-text-primary">
          {formatUsdValue(token?.metrics?.price || 0)}
        </div>
        {#if token?.metrics?.price_change_24h && token.metrics.price_change_24h !== "n/a"}
          <div class="text-sm">
            <span
              class={Number(token.metrics.price_change_24h) > 0
                ? "text-green-400"
                : "text-red-400"}
            >
              {Number(token.metrics.price_change_24h) > 0 ? "+" : ""}{Number(
                token.metrics.price_change_24h,
              ).toFixed(2)}%
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