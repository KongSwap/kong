<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip';
  import { Star, Flame } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { FavoriteService } from "$lib/services/tokens/favoriteService";

  interface StatsToken extends FE.Token {
    marketCapRank?: number;
    volumeRank?: number;
    isHot?: boolean;
  }

  export let token: StatsToken;
  export let isConnected: boolean;
  export let isFavorite: boolean;
  export let priceClass: string;
  export let trendClass: string;
  export let showHotIcon = false;
</script>

<div 
  class="token-card {token.canister_id === 'o7oak-iyaaa-aaaaq-aadzq-cai' ? 'kong-special-card' : ''}"
>
  <span class="token-rank">#{token.marketCapRank}</span>
  <div class="token-card-main">
    <div class="token-card-left">
      {#if isConnected}
        <button
          class="favorite-button-mobile"
          on:click|stopPropagation={(e) => FavoriteService.toggleFavorite(token.canister_id)}
        >
          {#if isFavorite}
            <Star class="star-icon filled" size={14} color="yellow" fill="yellow" />
          {:else}
            <Star class="star-icon" size={14} />
          {/if}
        </button>
      {/if}
      <TokenImages tokens={[token]} size={24} />
      <div class="token-info-mobile">
        <div class="flex items-center gap-1">
          <span class="token-symbol-mobile">{token.symbol}</span>
          {#if showHotIcon}
            <Flame class="w-4 h-4 text-orange-500" />
          {/if}
        </div>
        <div class="token-metrics-row text-nowrap">
          <span>MCap: {formatUsdValue(token?.metrics?.market_cap)}</span>
          <span class="separator">|</span>
          <span>Vol: {formatUsdValue(token?.metrics?.volume_24h)}</span>
        </div>
      </div>
    </div>
    <div class="token-card-right">
      <div class="font-medium text-kong-text-primary text-right">
        <span class={priceClass}>
          ${formatToNonZeroDecimal(token?.metrics?.price || 0)}
        </span>
      </div>
      <span class="token-change {trendClass}">
        {Number(token?.metrics?.price_change_24h) > 0 ? '+' : ''}
        {formatToNonZeroDecimal(token?.metrics?.price_change_24h)}%
      </span>
    </div>
  </div>
</div>

<style lang="postcss">
  .token-card {
    @apply flex items-center justify-between p-3 rounded-lg relative;
    @apply bg-kong-bg-dark border border-kong-border;

    &.kong-special-card {
      @apply bg-kong-bg-dark border-kong-accent-green;
      
      .token-symbol-mobile {
        @apply text-base;
        font-weight: 500;
      }
    }
  }

  .token-rank {
    @apply absolute top-1 left-2 text-xs text-kong-text-secondary;
  }

  .token-card-main {
    @apply flex items-center justify-between w-full mt-2;
  }

  .token-card-left {
    @apply flex items-center gap-2 flex-1 min-w-0;
  }

  .token-info-mobile {
    @apply flex flex-col justify-center min-w-0;
  }

  .token-symbol-mobile {
    @apply text-kong-text-primary font-medium text-base;
  }

  .token-metrics-row {
    @apply flex items-center gap-2 text-xs text-kong-text-secondary mt-0.5;
  }

  .separator {
    @apply text-kong-text-secondary mx-0.5;
  }

  .token-card-right {
    @apply flex flex-col items-end justify-end;
  }

  .token-change {
    @apply text-xs font-medium mt-0.5;
  }

  .favorite-button-mobile {
    @apply flex items-center justify-center w-6 h-6 rounded-lg 
           hover:bg-kong-bg-dark active:bg-kong-bg-dark/10 transition-colors duration-150;
  }

  .hot-icon {
    @apply text-kong-accent-red;
    fill: #FFA500;
    stroke: #FFA500;
  }
</style> 