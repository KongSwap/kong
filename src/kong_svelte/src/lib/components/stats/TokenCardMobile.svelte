<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip';
  import { Star, Flame } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { favoriteStore } from "$lib/services/tokens/favoriteStore";

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
          on:click|stopPropagation={(e) => favoriteStore.toggleFavorite(token.canister_id)}
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
          {#if token.isHot}
            <div class="hot-badge-small" title="#{token.volumeRank} 24h volume" use:tooltip={{ text: `${token.volumeRank} 24h volume` }}>
              <Flame size={14} class="hot-icon" fill="#FFA500" stroke="white" />
            </div>
          {/if}
        </div>
        <div class="token-metrics-row">
          <span>MCap: {formatUsdValue(token?.metrics?.market_cap)}</span>
          <span class="separator">|</span>
          <span>Vol: {formatUsdValue(token?.metrics?.volume_24h)}</span>
        </div>
      </div>
    </div>
    <div class="token-card-right">
      <div class="font-medium text-white">
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
    background: #1a1b23;
    border: 1px solid #2a2d3d;

    &.kong-special-card {
      background: rgba(0, 255, 128, 0.02);
      border-left: 2px solid #00d3a533;
      
      .token-symbol-mobile {
        @apply text-base;
        font-weight: 500;
      }
    }
  }

  .token-rank {
    @apply absolute top-1 left-2 text-xs text-[#8890a4]/70;
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
    @apply text-sm text-white font-medium text-base;
  }

  .token-metrics-row {
    @apply flex items-center gap-2 text-xs text-[#8890a4] mt-0.5;
  }

  .separator {
    @apply text-[#8890a4]/50 mx-0.5;
  }

  .token-card-right {
    @apply flex flex-col items-end justify-center ml-2;
  }

  .token-change {
    @apply text-xs font-medium mt-0.5;
  }

  .favorite-button-mobile {
    @apply flex items-center justify-center w-6 h-6 rounded-lg 
           hover:bg-white/5 active:bg-white/10 transition-colors duration-150;
  }

  .hot-icon {
    @apply text-kong-accent-red;
    fill: #FFA500;
    stroke: #FFA500;
  }
</style> 