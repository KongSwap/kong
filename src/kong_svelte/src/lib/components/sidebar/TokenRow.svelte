<script lang="ts">  
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { fade } from 'svelte/transition';
  import { tokenLogoStore } from '$lib/services/tokens/tokenLogos';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { sidebarStore } from '$lib/stores/sidebarStore';
  import { Star, TrendingUp, ArrowUpDown, ArrowUpRight, ArrowDownLeft } from 'lucide-svelte';
  import { auth } from '$lib/services/auth';
  import { derived } from 'svelte/store';
  import { formatBalance, formatUsdValue, formatTokenValue, formatPercentage } from '$lib/utils/tokenFormatters';

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

  function handleSend(e: MouseEvent) {
    e.stopPropagation();
    // TODO: Implement send functionality
    console.log('Send clicked for', token.symbol);
  }

  function handleReceive(e: MouseEvent) {
    e.stopPropagation();
    // TODO: Implement receive functionality
    console.log('Receive clicked for', token.symbol);
  }

  const isFavorite = $derived($tokenStore.favoriteTokens[$auth.account?.owner?.toString()]?.includes(token.canister_id) ?? false);
  
  // Calculate 24h change percentage (mock data for now)
  const priceChange24h = Math.random() * 20 - 10; // Random value between -10 and 10
  const volume24h = Math.random() * 1000000; // Random volume
</script>

{#if token}
<div 
  class="token-row"
  class:expanded={$sidebarStore.isExpanded}
  transition:fade
>
  <div class="token-content">
    <div class="token-header">
      <button 
        class="token-info"
        on:click={onClick}
        type="button"
        aria-label="Select {token.name} ({token.symbol})"
      >
        <div class="token-image">
          <TokenImages tokens={[token]} />
        </div>
        <div class="flex flex-col text-left overflow-hidden">
          <span class="symbol">{token.symbol}</span>
          <span class="name" title={token.name}>
            {token.name}
          </span>
        </div>
      </button>
      <div class="token-actions">
        <button
          class="action-btn"
          on:click={handleReceive}
          title="Receive {token.symbol}"
        >
          <ArrowDownLeft size={16} />
          <span class="action-text">Receive</span>
        </button>
        <button
          class="action-btn"
          on:click={handleSend}
          title="Send {token.symbol}"
        >
          <ArrowUpRight size={16} />
          <span class="action-text">Send</span>
        </button>
        <button
          class="favorite-btn"
          class:active={isFavorite}
          on:click={handleFavoriteClick}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
    </div>

    <div class="token-footer" class:expanded={$sidebarStore.isExpanded}>
      <div class="footer-section balance-section">
        <div class="metric-row">
          <div class="metric-group">
            <span class="label">Balance</span>
            <span class="value mono" title={formatBalance(token.balance, token.decimals)}>
              {formatBalance(token.balance, token.decimals)} {token.symbol}
            </span>
          </div>
          <div class="vertical-divider"></div>
          <div class="metric-group">
            <span class="label">Value</span>
            <span class="value mono">
              {formatTokenValue(token.balance, token.price, token.decimals)}
            </span>
          </div>
        </div>
      </div>

      {#if $sidebarStore.isExpanded}
        <div class="footer-section market-section">
          <div class="metric">
            <span class="label">Price</span>
            <span class="value mono">{token.price ? formatUsdValue(token.price) : "N/A"}</span>
          </div>
          <div class="metric">
            <span class="label">24h</span>
            <span class="value mono" class:positive={priceChange24h > 0} class:negative={priceChange24h < 0}>
              <TrendingUp size={12} />
              {formatPercentage(priceChange24h)}
            </span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
{/if}

<style lang="postcss">
  .token-row {
    @apply w-full p-4 rounded-lg bg-black/20 border border-white/5 
           transition-all duration-200 hover:bg-black/30
           focus-within:border-white/20 focus-within:bg-black/30;
  }

  .token-row.expanded {
    @apply hover:scale-[1.01] hover:shadow-lg hover:shadow-black/50;
  }

  .token-content {
    @apply flex flex-col gap-4;
  }

  .token-header {
    @apply flex items-center justify-between gap-4;
  }

  .token-info {
    @apply flex items-center gap-3 flex-1 min-w-0 rounded-lg p-1.5 -m-1.5
           transition-colors duration-200 hover:bg-white/5
           focus:outline-none focus:bg-white/5;
  }

  .token-image {
    @apply flex-shrink-0 w-10 h-10 rounded-full overflow-hidden 
           bg-black/20 flex items-center justify-center
           ring-2 ring-white/5;
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

  .token-actions {
    @apply flex items-center gap-2;
  }

  .action-btn {
    @apply px-3 py-1.5 rounded-lg text-xs font-medium
           flex items-center gap-1.5
           bg-white/5 text-white/80
           transition-all duration-200
           hover:bg-white/10 hover:text-white
           focus:outline-none focus:ring-2 focus:ring-white/20;
  }

  .action-text {
    @apply hidden sm:inline;
  }

  .favorite-btn {
    @apply p-1.5 rounded-lg transition-colors duration-200
           hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20
           flex-shrink-0 bg-white/5;
  }

  .favorite-btn.active {
    @apply text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20;
  }

  .token-footer {
    @apply flex flex-col gap-2 mt-3 pt-3 border-t border-white/10;
  }

  .token-footer.expanded {
    @apply grid grid-cols-2 gap-4;
  }

  .footer-section {
    @apply flex flex-col;
  }

  .metric-row {
    @apply flex items-center justify-between w-full 
           p-2 rounded-lg bg-white/5;
  }

  .metric-group {
    @apply flex flex-col items-start min-w-0;
  }

  .vertical-divider {
    @apply w-px h-8 bg-white/10 mx-4;
  }

  .market-section {
    @apply grid grid-cols-2 gap-2;
  }

  .market-section .metric {
    @apply p-2 rounded-lg bg-white/5 flex flex-col items-start;
  }

  .metric {
    @apply flex flex-col items-start gap-0.5 min-w-0;
  }

  .label {
    @apply text-[10px] uppercase tracking-wider text-white/40 font-medium;
  }

  .value {
    @apply text-sm text-white/90 flex items-center gap-1 font-medium truncate max-w-full;
  }

  .value.mono {
    @apply font-mono;
  }

  .value.positive {
    @apply text-green-400;
  }

  .value.negative {
    @apply text-red-400;
  }

  /* Make all SVG icons inherit text color */
  :global(svg) {
    @apply text-current stroke-current;
  }

  @media (max-width: 768px) {
    .token-footer.expanded {
      @apply grid-cols-1 gap-3;
    }

    .metric-row {
      @apply p-1.5;
    }

    .vertical-divider {
      @apply mx-3;
    }

    .market-section {
      @apply grid-cols-2;
    }

    .market-section .metric {
      @apply flex-row justify-between items-center;
    }
  }
</style>
