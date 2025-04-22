<script lang="ts">
  import { Star, Flame, PiggyBank, TrendingUp, TrendingDown } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { tooltip } from "$lib/actions/tooltip";
  import { auth } from "$lib/stores/auth";
	import { favoriteStore } from "$lib/stores/favoriteStore";
  import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from "$lib/constants/canisterConstants";

  export let row: FE.StatsToken;
  
  let isFavorite = false;

  $: isExcludedToken = row.address === CKUSDT_CANISTER_ID || row.address === ICP_CANISTER_ID;
  $: isTopVolume = !isExcludedToken && row.volumeRank !== undefined && row.volumeRank <= 5 && Number(row.metrics?.volume_24h || 0) > 0;
  $: isTopTVL = !isExcludedToken && row.tvlRank !== undefined && row.tvlRank <= 5 && Number(row.metrics?.tvl || 0) > 0;
  $: isTopGainer = !isExcludedToken && row.priceChangeRank !== undefined && row.priceChangeRank <= 3 && Number(row.metrics?.price_change_24h || 0) > 0;
  $: isTopLoser = !isExcludedToken && row.priceChangeRank !== undefined && row.priceChangeRank <= 3 && Number(row.metrics?.price_change_24h || 0) < 0;

  $: if ($auth.isConnected) {
    favoriteStore.isFavorite(row.address).then(fav => isFavorite = fav);
  }

  async function handleFavoriteClick(e: MouseEvent) {
    e.stopPropagation();
    if (!$auth.isConnected) return;
    
    const success = await favoriteStore.toggleFavorite(row.address);
    if (success) {
      isFavorite = !isFavorite;
    }
  }
</script>

<div class="flex items-center gap-2">
  {#if $auth.isConnected}
    <button
      class="favorite-button {isFavorite ? 'active' : ''}"
      on:click={handleFavoriteClick}
      use:tooltip={{
        text: isFavorite ? "Remove from favorites" : "Add to favorites",
        direction: "right",
        textSize: "sm",
      }}
    >
      <Star 
        class="star-icon" 
        size={16} 
        color={isFavorite ? "#FFD700" : "#8890a4"} 
        fill={isFavorite ? "#FFD700" : "transparent"} 
      />
    </button>
  {/if}
  <TokenImages tokens={[row]} containerClass="self-center" size={24} />
  <span class="token-name">{row.name}</span>
  <span class="token-symbol">{row.symbol}</span>
  <div class="flex gap-1 items-center">
    {#if isTopVolume}
      <div use:tooltip={{ text: `#${row.volumeRank} by Volume`, direction: "top" }}>
        <Flame class="w-4 h-4 text-orange-400" />
      </div>
    {/if}
    {#if isTopTVL}
      <div use:tooltip={{ text: `#${row.tvlRank} by TVL`, direction: "top" }}>
        <PiggyBank class="w-4 h-4 text-pink-500" />
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
  </div>
</div>

<style lang="postcss">
  .token-name {
    @apply text-kong-text-primary font-medium truncate max-w-[120px] md:max-w-none;
  }

  .token-symbol {
    @apply text-xs md:text-sm text-kong-text-primary/60 hidden sm:inline;
  }

  .favorite-button {
    @apply flex items-center justify-center w-6 h-6 rounded-lg hover:bg-white/10 transition-colors duration-200;
  }
</style> 