<script lang="ts">
  import { Star, TriangleRight, PiggyBank, TrendingUp, TrendingDown, AlertTriangle } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { tooltip } from "$lib/actions/tooltip";
  import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from "$lib/constants/canisterConstants";

  export let row: FE.StatsToken;
  export let isHovered = false;
  

  $: isExcludedToken = row.address === CKUSDT_CANISTER_ID || row.address === ICP_CANISTER_ID;
  $: isTopVolume = !isExcludedToken && row.volumeRank !== undefined && row.volumeRank <= 5 && Number(row.metrics?.volume_24h || 0) > 0;
  $: isTopTVL = !isExcludedToken && row.tvlRank !== undefined && row.tvlRank <= 5 && Number(row.metrics?.tvl || 0) > 0;
  $: isTopGainer = !isExcludedToken && row.priceChangeRank !== undefined && row.priceChangeRank <= 3 && Number(row.metrics?.price_change_24h || 0) > 0;
  $: isTopLoser = !isExcludedToken && row.priceChangeRank !== undefined && row.priceChangeRank <= 3 && Number(row.metrics?.price_change_24h || 0) < 0;
  $: isLowTVL = Number(row.metrics?.tvl || 0) < 100;
</script>

<div class="flex items-center gap-1">
  <TokenImages tokens={[row]} containerClass="self-center" size={28} showNetworkIcon />
  <span class="token-name ml-2 {isHovered ? '!text-kong-primary' : ''} {row.name === 'KongSwap' ? '!text-kong-accent-yellow' : ''} ">{row.name}</span>
  <span class="token-symbol {isHovered ? '!text-kong-primary' : ''} {row.name === 'KongSwap' ? '!text-kong-accent-yellow/60' : ''} ">({row.symbol})</span>
  <div class="flex gap-1 items-center">
    {#if isLowTVL}
      <div use:tooltip={{ text: "Low TVL (<$100) - Limited liquidity", direction: "top" }}>
        <AlertTriangle class="w-4 h-4 text-kong-accent-red !opacity-100" />
      </div>
    {/if}
    {#if isTopVolume}
      <div use:tooltip={{ text: `#${row.volumeRank} by Volume`, direction: "top" }}>
        <TriangleRight class="w-4 h-4 text-orange-400" fill="currentColor" />
      </div>
    {/if}
    {#if isTopGainer}
      <div use:tooltip={{ text: `#${row.priceChangeRank} Biggest Gainer (24h)`, direction: "top" }}>
        <TrendingUp class="w-4 h-4 text-green-400" />
      </div>
    {/if}
    {#if isTopLoser}
      <div use:tooltip={{ text: `#${row.priceChangeRank} Biggest Drop (24h)`, direction: "top" }}>
        <TrendingDown class="w-4 h-4 text-red-400" />
      </div>
    {/if}
    {#if isTopTVL}
      <div use:tooltip={{ text: `#${row.tvlRank} by TVL`, direction: "top" }}>
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