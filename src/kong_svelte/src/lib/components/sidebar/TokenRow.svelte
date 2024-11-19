<script lang="ts">  
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { fade } from 'svelte/transition';
  import { tokenLogoStore } from '$lib/services/tokens/tokenLogos';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { sidebarStore } from '$lib/stores/sidebarStore';
  import { Star } from 'lucide-svelte';
  import { walletStore } from '$lib/services/wallet/walletStore';
  import { derived } from 'svelte/store';
  import { formatBalance, formatUsdValue, formatTokenValue } from '$lib/utils/tokenFormatters';

  interface TokenRowProps {
    token: FE.Token;
    onClick?: () => void;
  }
  let { token, onClick }: TokenRowProps = $props();
  let logoUrl = '/tokens/not_verified.webp';  

  // Subscribe to the logo store
  $effect(() => {
    logoUrl = $tokenLogoStore[token.canister_id] ?? '/tokens/not_verified.webp';
  });

  function handleFavoriteClick(e: MouseEvent) {
    e.stopPropagation();
    tokenStore.toggleFavorite(token.canister_id);
  }

  const isFavorite = $derived($tokenStore.favoriteTokens[$walletStore.account?.owner?.toString()]?.includes(token.canister_id) ?? false);
</script>

{#if token}
<button 
  class="token-row"
  class:expanded={$sidebarStore.isExpanded}
  on:click={onClick}
  type="button"
  aria-label="Select {token.name} ({token.symbol})"
  transition:fade
>
  <div class="token-content">
    <div class="token-header">
      <div class="token-info">
        <div class="token-image">
          <TokenImages tokens={[token]} />
        </div>
        <div class="flex flex-col text-left overflow-hidden">
          <span class="symbol">{token.symbol}</span>
          <span class="name" title={token.name}>
            {token.name}
          </span>
        </div>
      </div>
      <div
        class="favorite-btn"
        class:active={isFavorite}
        on:click={handleFavoriteClick}
        role="button"
        tabindex="0"
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
      </div>
    </div>

    <div class="token-details">
      <div class="balance">
        <span class="label">Balance</span>
        <span class="value" title={formatBalance(token.balance, token.decimals)}>{formatBalance(token.balance, token.decimals)}</span>
      </div>
      {#if $sidebarStore.isExpanded}
        <div class="price">
          <span class="label">Price</span>
          <span class="value">{token.price ? formatUsdValue(token.price) : "N/A"}</span>
        </div>
        <div class="value">
          <span class="label">Value</span>
          <span class="value">{formatTokenValue(token.balance, token.price, token.decimals)}</span>
        </div>
      {/if}
    </div>
  </div>
</button>
{/if}

<style lang="postcss">
  .token-row {
    @apply w-full p-3 rounded-lg bg-black/20 border border-white/5 
           transition-all duration-200 hover:bg-black/30 hover:border-white/10
           focus:outline-none focus:ring-2 focus:ring-white/20;
  }

  .token-row.expanded {
    @apply hover:scale-[1.02] hover:shadow-lg hover:shadow-black/50;
  }

  .token-content {
    @apply flex flex-col gap-3;
  }

  .token-header {
    @apply flex items-center justify-between gap-2;
  }

  .token-info {
    @apply flex items-center gap-3 flex-1 min-w-0;
  }

  .token-image {
    @apply flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-black/20 flex items-center justify-center;
  }

  .token-image :global(img) {
    @apply w-full h-full object-cover;
  }

  .symbol {
    @apply text-sm font-bold text-white truncate;
  }

  .name {
    @apply text-xs text-white/60 truncate;
  }

  .token-details {
    @apply flex flex-col gap-1.5 text-sm;
  }

  .token-row.expanded .token-details {
    @apply flex-row justify-between items-center mt-2 pt-3 border-t border-white/5;
  }

  .balance, .price, .value {
    @apply flex flex-col gap-0.5 min-w-[80px];
  }

  .label {
    @apply text-xs text-white/40;
  }

  .value {
    @apply font-mono text-white/90 truncate;
  }

  .favorite-btn {
    @apply p-1.5 rounded-md transition-colors duration-200
           hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20
           flex-shrink-0;
  }

  .favorite-btn.active {
    @apply text-yellow-400;
  }

  @media (max-width: 768px) {
    .token-row.expanded .token-details {
      @apply flex-col;
    }

    .token-row {
      @apply p-2;
    }

    .token-image {
      @apply w-7 h-7;
    }

    .symbol {
      @apply text-xs;
    }

    .name {
      @apply text-[10px];
    }

    .value {
      @apply text-xs;
    }
  }
</style>
