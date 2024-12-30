<script lang="ts">
  import { Star, Flame } from "lucide-svelte";
  import { tooltip } from "$lib/actions/tooltip";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { FavoriteService } from "$lib/services/tokens/favoriteService";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  interface StatsToken extends FE.Token {
    isHot?: boolean;
    volumeRank?: number;
  }

  export let token: StatsToken;
  export let isConnected: boolean;
  export let isFavorite: boolean;
  export let priceClass: string;
  export let trendClass: string;
  export let kongCanisterId: string;

  const handleFavoriteClick = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!isConnected) return;
    
    const success = await FavoriteService.toggleFavorite(token.canister_id);
    if (success) {
      isFavorite = !isFavorite;
      const event = new CustomEvent('favoriteToggled', {
        detail: { canisterId: token.canister_id, isFavorite: !isFavorite }
      });
      window.dispatchEvent(event);
    }
  };

  onMount(async () => {
    if (isConnected) {
      isFavorite = await FavoriteService.isFavorite(token.canister_id);
    }
  });
</script>

<tr
  class="stats-row h-[44px] border-b border-white/5 hover:bg-white/5 transition-colors duration-200 cursor-pointer {parseFloat(token.metrics?.price || '0') > parseFloat(token.metrics?.previous_price || '0') ? 'flash-green' : 'flash-red'}"
  class:kong-special-row={token.canister_id === kongCanisterId}
  on:click={() => goto(`/stats/${token.canister_id}`)}
>
  <td class="col-rank text-center text-[#8890a4]">#{token.marketCapRank || "-"}</td>
  <td class="col-token pl-2">
    <div class="flex items-center gap-2 h-full">
      {#if isConnected}
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
      <TokenImages tokens={[token]} containerClass="self-center" size={24} />
      <span class="token-name">{token.name}</span>
      <span class="token-symbol">{token.symbol}</span>
      {#if token?.isHot}
        <div
          class="hot-badge-small"
          title="#{token?.volumeRank} 24hr volume"
          use:tooltip={{
            text: `#${token.volumeRank} Volume`,
            direction: "right",
            textSize: "sm",
          }}
        >
          <Flame size={20} class="hot-icon" fill="#FFA500" stroke="white" />
        </div>
      {/if}
    </div>
  </td>
  <td class="col-price price-cell text-right">
    <span
      use:tooltip={{
        text: `$${Number(token?.metrics?.price).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8,
        }) || 0}`,
        direction: "top",
        textSize: "sm",
      }}
    >
      ${formatToNonZeroDecimal(token?.metrics?.price || 0)}
    </span>
  </td>
  <td class="col-change text-right text-nowrap">
    {#if token?.metrics?.price_change_24h === null || token?.metrics?.price_change_24h === "n/a"}
      <span class="text-slate-400">0.00%</span>
    {:else if Number(token?.metrics?.price_change_24h) === 0}
      <span class="text-slate-400">0.00%</span>
    {:else}
      <span class={trendClass}>
        {Number(token?.metrics?.price_change_24h) > 0 ? "+" : ""}
        {formatToNonZeroDecimal(token?.metrics?.price_change_24h)}%
      </span>
    {/if}
  </td>
  <td class="col-volume text-right">
    <span>{formatUsdValue(token?.metrics?.volume_24h)}</span>
  </td>
  <td class="col-mcap text-right">
    <span>{formatUsdValue(token?.metrics?.market_cap)}</span>
  </td>
  <td class="col-tvl text-right pr-3">
    <span>{formatUsdValue(token?.metrics?.tvl || 0)}</span>
  </td>
</tr>

<style scoped lang="postcss">
  .token-name {
    @apply text-kong-text-primary font-medium truncate max-w-[120px] md:max-w-none;
  }

  .token-symbol {
    @apply text-xs md:text-sm text-kong-text-primary/60 hidden sm:inline;
  }

  .favorite-button {
    @apply flex items-center justify-center w-6 h-6 rounded-lg hover:bg-white/10 transition-colors duration-200;
  }

  .favorite-button:hover .star-icon {
    @apply text-yellow-400;
  }

  .favorite-button.active:hover .star-icon {
    @apply text-yellow-600;
  }

  .kong-special-row {
    @apply bg-kong-primary/10 border border-b-0 border-kong-primary;

    &:hover {
      @apply bg-kong-primary/10;
    }

    td {
      @apply font-medium;
    }
  }
</style> 