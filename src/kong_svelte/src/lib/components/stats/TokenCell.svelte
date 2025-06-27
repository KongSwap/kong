<script lang="ts">
  import { Star, TriangleRight, PiggyBank, TrendingUp, TrendingDown, AlertTriangle } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { tooltip } from "$lib/actions/tooltip";
  import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from "$lib/constants/canisterConstants";

  export let row: FE.StatsToken;
  export let isHovered = false;
  export let topTokens: { gainers: Kong.Token[], losers: Kong.Token[], hottest: Kong.Token[], top_volume: Kong.Token[] } = { gainers: [], losers: [], hottest: [], top_volume: [] };
  

  $: isExcludedToken = row.address === CKUSDT_CANISTER_ID || row.address === ICP_CANISTER_ID;
  $: isTopVolume = !isExcludedToken && topTokens.top_volume.some(token => token.address === row.address) && Number(row.metrics?.volume_24h || 0) > 0;
  $: isTopGainer = !isExcludedToken && topTokens.gainers.some(token => token.address === row.address) && Number(row.metrics?.price_change_24h || 0) > 0;
  $: isTopLoser = !isExcludedToken && topTokens.losers.some(token => token.address === row.address) && Number(row.metrics?.price_change_24h || 0) < 0;
  $: isLowTVL = Number(row.metrics?.tvl || 0) < 1000;
  
  // For TVL, we'll calculate from the current tokens since it's not in topTokens
  // This is a simplified approach - you might want to add a top_tvl array to your API response
  $: isTopTVL = false; // Disabled for now since we don't have top TVL data from fetchTopTokens
  
  // Get the rank for display in tooltips
  $: volumeRank = isTopVolume ? topTokens.top_volume.findIndex(token => token.address === row.address) + 1 : undefined;
  $: gainerRank = isTopGainer ? topTokens.gainers.findIndex(token => token.address === row.address) + 1 : undefined;
  $: loserRank = isTopLoser ? topTokens.losers.findIndex(token => token.address === row.address) + 1 : undefined;
</script>

<div class="flex items-center gap-1">
  <TokenImages tokens={[row]} containerClass="self-center" size={28} showNetworkIcon />
  <span class="token-name ml-2 {isHovered ? '!text-kong-primary' : ''}">{row.name}</span>
  <span class="token-symbol {isHovered ? '!text-kong-primary' : ''}">({row.symbol})</span>
  <div class="flex gap-1 items-center">
    {#if isLowTVL}
      <div use:tooltip={{ text: "Low TVL (<$1,000) - Limited liquidity", direction: "top" }}>
        <AlertTriangle class="w-4 h-4 text-kong-error !opacity-100" />
      </div>
    {/if}
    {#if isTopVolume}
      <div use:tooltip={{ text: `#${volumeRank} by Volume`, direction: "top" }}>
        <TriangleRight class="w-4 h-4 text-orange-400" fill="currentColor" />
      </div>
    {/if}
    {#if isTopGainer}
      <div use:tooltip={{ text: `#${gainerRank} Gainer (24h)`, direction: "top" }}>
        <TrendingUp class="w-4 h-4 text-green-400" />
      </div>
    {/if}
    {#if isTopLoser}
      <div use:tooltip={{ text: `#${loserRank} Loser (24h)`, direction: "top" }}>
        <TrendingDown class="w-4 h-4 text-red-400" />
      </div>
    {/if}
    {#if isTopTVL}
      <div use:tooltip={{ text: `Top TVL`, direction: "top" }}>
        <PiggyBank class="w-4 h-4 text-pink-500" />
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .token-name {
    @apply text-kong-text-primary font-medium truncate max-w-[120px] text-base md:max-w-none;
  }

  .token-symbol {
    @apply text-xs md:text-xs text-kong-text-primary/50 hidden sm:inline;
  }
</style> 