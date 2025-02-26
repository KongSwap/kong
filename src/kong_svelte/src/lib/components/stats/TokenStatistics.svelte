<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import { onMount } from "svelte";
  import { InfoIcon } from "lucide-svelte";
  import { tooltip } from "$lib/actions/tooltip";
  import { writable } from "svelte/store";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let token: FE.Token;
  export let marketCapRank: number | null;

  let previousPrice: number | null = null;
  let priceFlash: 'up' | 'down' | null = null;
  let priceFlashTimeout: NodeJS.Timeout;

  // Create a writable store for live token data
  const liveToken = writable<FE.Token | null>(null);

  // Add these after liveToken store
  const marketCap = tweened(0, { duration: 500, easing: cubicOut });
  const volume24h = tweened(0, { duration: 500, easing: cubicOut });
  const totalSupplyTweened = tweened(0, { duration: 500, easing: cubicOut });
  const circulatingSupplyTweened = tweened(0, { duration: 500, easing: cubicOut });

  // Function to update token data
  async function updateTokenData() {
    try {
      const result = await fetchTokensByCanisterId([token.canister_id]);
      if (result && result[0]) {
        // Create a new object to force reactivity
        liveToken.set({ ...result[0] });
      }
    } catch (error) {
      console.error("Error fetching token data:", error);
    }
  }

  // Initial fetch
  updateTokenData();

  // Use the live token data with fallback to prop token
  $: activeToken = $liveToken || token;

  // Track price changes efficiently
  $: {
    const currentPrice = Number(activeToken?.metrics?.price || 0);
    if (previousPrice !== null && currentPrice !== previousPrice) {
      if (priceFlashTimeout) {
        clearTimeout(priceFlashTimeout);
      }
      priceFlash = currentPrice > previousPrice ? 'up' : 'down';
      priceFlashTimeout = setTimeout(() => priceFlash = null, 1000);
    }
    previousPrice = currentPrice;
  }

  // Update these reactive statements
  $: {
    if (activeToken?.metrics) {
      marketCap.set(Number(activeToken.metrics.market_cap || 0));
      volume24h.set(Number(activeToken.metrics.volume_24h || 0));
      totalSupplyTweened.set(Number(activeToken.metrics.total_supply || 0) / 10 ** activeToken.decimals);
      circulatingSupplyTweened.set(Number(activeToken.metrics.total_supply || 0) / 10 ** activeToken.decimals);
    }
  }

  function calculateVolumePercentage(volume: number, marketCap: number): string {
    if (!marketCap) return "0.00%";
    return ((volume / marketCap) * 100).toFixed(2) + "%";
  }

  onMount(() => {
    const pollInterval = setInterval(async () => {
      try {
        await updateTokenData();
      } catch (error) {
        console.error("Error polling token data:", error);
      }
    }, 1000 * 10); // 10 seconds

    return () => {
      clearInterval(pollInterval);
      if (priceFlashTimeout) {
        clearTimeout(priceFlashTimeout);
      }
      marketCap.set(0);
      volume24h.set(0);
      totalSupplyTweened.set(0);
      circulatingSupplyTweened.set(0);
    };
  });

  // Use activeToken instead of directly using $liveToken
  $: formattedPrice = formatUsdValue(activeToken?.metrics?.price || 0, true);
  $: formattedPriceChange24h = Number(activeToken?.metrics?.price_change_24h) || 0;
</script>

<Panel variant="transparent" type="main" className="p-6">
  <div class="flex flex-col gap-8">
    <!-- Price Section -->
    <div>
      <div class="text-sm text-kong-text-primary/50 uppercase tracking-wider mb-2"
      >
      <span class="flex gap-x-2 items-center">
        Current Price       <span use:tooltip={{
          text: "This is a weighted average price of all pools",
          direction: "bottom",
        }}><InfoIcon size={16} /> 
      </span>
      </div>
      <div class="flex flex-col gap-2">
        <div 
          class="text-[32px] font-medium text-kong-text-primary"
          class:flash-green-text={priceFlash === 'up'}
          class:flash-red-text={priceFlash === 'down'}
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
          {formatUsdValue($marketCap)}
        </div>
        <div class="text-sm text-kong-text-primary/40 mt-1">
          Rank #{marketCapRank !== null ? marketCapRank : "N/A"}
        </div>
      </div>
      
      <!-- 24h Volume -->
      <div>
        <div class="text-sm text-kong-text-primary/50 uppercase tracking-wider mb-2">24h Volume</div>
        <div class="text-xl font-medium text-kong-text-primary">
          {formatUsdValue($volume24h)}
        </div>
        <div class="text-sm text-kong-text-primary/40 mt-1">
          {activeToken.metrics.volume_24h
            ? `${calculateVolumePercentage(Number(activeToken.metrics.volume_24h), Number(activeToken.metrics.market_cap))} of mcap`
            : "No volume data"}
        </div>
      </div>
      
      <!-- Total Supply -->
      <div>
        <div class="text-sm text-kong-text-primary/50 uppercase tracking-wider mb-2">Total Supply</div>
        <div class="text-xl font-medium text-kong-text-primary">
          {formatToNonZeroDecimal($totalSupplyTweened)}
        </div>
        <div class="text-sm text-kong-text-primary/40 mt-1">
          {activeToken?.symbol || ""} tokens
        </div>
      </div>

      <!-- Circl Supply -->
      <div>
        <div class="text-sm text-kong-text-primary/50 uppercase tracking-wider mb-2">Circulating Supply</div>
        <div class="text-xl font-medium text-kong-text-primary">
          {formatToNonZeroDecimal($circulatingSupplyTweened)}
        </div>
        <div class="text-sm text-kong-text-primary/40 mt-1">
          {activeToken?.symbol || ""} tokens
        </div>
      </div>
    </div>
  </div>
</Panel>

<style>
  .flash-green-text {
    animation: flashGreen 1s ease-out;
  }
  
  .flash-red-text {
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