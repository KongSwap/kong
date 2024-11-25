<script lang="ts">  
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { fade } from 'svelte/transition';
  import { tokenLogoStore } from '$lib/services/tokens/tokenLogos';
  import { tokenStore } from '$lib/services/tokens/tokenStore';
  import { sidebarStore } from '$lib/stores/sidebarStore';
  import { Star, TrendingUp, ArrowUpRight, ArrowDownLeft } from 'lucide-svelte';
  import { auth } from '$lib/services/auth';
  import { formatBalance, formatUsdValue, formatTokenValue, formatPercentage } from '$lib/utils/tokenFormatters';
  import { getFavoritesForWallet } from '$lib/services/tokens/tokenStore';

  interface TokenRowProps {
    token: FE.Token;
    onClick?: () => void;
    onSendClick?: () => void;
    onReceiveClick?: () => void;
  }
  let { token, onClick, onSendClick, onReceiveClick }: TokenRowProps = $props();

  let logoUrl = $derived(() => {
    $tokenLogoStore[token.canister_id] ?? '/tokens/not_verified.webp';
  });

  function handleFavoriteClick(e: MouseEvent) {
    e.stopPropagation();
    tokenStore.toggleFavorite(token.canister_id);
  }

  function handleSend(e: MouseEvent) {
    e.stopPropagation();
    onSendClick?.();
  }

  function handleReceive(e: MouseEvent) {
    e.stopPropagation();
    onReceiveClick?.();
  }

  
  const isFavorite = $derived(() =>{
   return $getFavoritesForWallet.includes(token.canister_id)
  });

  const priceChange24h = Math.random() * 20 - 10;
  const volume24h = Math.random() * 1000000;
</script>

{#if token}
<div class="token-row" class:expanded={$sidebarStore.isExpanded} transition:fade>
  <div class="token-content">
    <div class="token-header">
      <button class="token-info" onclick={onClick} type="button" aria-label="Select {token.name} ({token.symbol})">
        <div class="token-image">
          <TokenImages tokens={[token]} size={32} containerClass="!w-8" />
        </div>
        <div class="flex flex-col text-left overflow-hidden">
          <span class="symbol">{token.symbol}</span>
          <span class="name" title={token.name}>{token.name}</span>
        </div>
      </button>
      <div class="token-actions">
        <button class="icon-btn h-full w-10" onclick={handleReceive} title="Receive {token.symbol}">
          <ArrowDownLeft size={14} />
        </button>
        <button class="icon-btn h-full w-10" onclick={handleSend} title="Send {token.symbol}">
          <ArrowUpRight size={14} />
        </button>
        <button class="icon-btn h-full w-10" class:active={isFavorite} onclick={handleFavoriteClick} title={isFavorite ? "Remove from favorites" : "Add to favorites"}>
          <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
    </div>

    <div class="token-footer" class:expanded={$sidebarStore.isExpanded}>
      <div class="footer-section">
        <div class="metric-row">
          <div class="metric-group">
            <span class="label">Balance</span>
            <span class="value mono" title={formatBalance(token.balance?.toString(), token.decimals)}>
              {formatBalance(token.balance?.toString(), token.decimals)} {token.symbol}
            </span>
          </div>
          <div class="metric-group">
            <span class="label">Value</span>
            <span class="value mono">{formatTokenValue(token.balance?.toString() || "0", token.price, token.decimals)}</span>
          </div>
        </div>
      </div>

      {#if $sidebarStore.isExpanded}
        <div class="market-section">
          <div class="metric">
            <span class="label">Price</span>
            <span class="value mono">{token.price ? formatUsdValue(Number(token.price)) || "N/A" : "N/A"}</span>
          </div>
          <div class="metric">
            <span class="label">24h</span>
            <span class="value mono" class:positive={priceChange24h > 0} class:negative={priceChange24h < 0}>
              <TrendingUp size={12} />{formatPercentage(Number(priceChange24h))}
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
    @apply w-full p-2 rounded-lg bg-black/20 border border-white/5 
           transition-all duration-200 hover:bg-black/30;
  }

  .token-row.expanded {
    @apply hover:scale-[1.01];
  }

  .token-content {
    @apply flex flex-col gap-2;
  }

  .token-header {
    @apply flex items-stretch justify-between gap-2;
  }

  .token-info {
    @apply flex items-center gap-2 flex-1 min-w-0 rounded-lg p-1
           transition-colors duration-200 hover:bg-white/5;
  }

  .token-image {
    @apply flex-shrink-0 w-8 h-8 rounded-full overflow-hidden;
  }

  .token-image :global(img) {
    @apply w-auto h-auto;
  }

  .symbol {
    @apply text-sm font-bold text-white truncate;
  }

  .name {
    @apply text-xs text-white/60 truncate;
  }

  .token-actions {
    @apply flex items-stretch gap-1;
  }

  .icon-btn {
    @apply p-1.5 rounded-lg text-xs
           bg-white/5 text-white/80
           transition-all duration-200
           hover:bg-white/10 hover:text-white
           flex items-center justify-center;
  }

  .icon-btn.active {
    @apply text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20;
  }

  .token-footer {
    @apply flex flex-col gap-2 mt-2 pt-2 border-t border-white/10;
  }

  .token-footer.expanded {
    @apply grid grid-cols-2 gap-2;
  }

  .metric-row {
    @apply flex items-center justify-between w-full gap-4
           p-1.5 rounded-lg bg-white/5;
  }

  .metric-group {
    @apply flex flex-col items-start min-w-0;
  }

  .market-section {
    @apply grid grid-cols-2 gap-2;
  }

  .market-section .metric {
    @apply p-1.5 rounded-lg bg-white/5 flex flex-col items-start;
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

  :global(svg) {
    @apply text-current stroke-current;
  }

  @media (max-width: 768px) {
    .token-footer.expanded {
      @apply grid-cols-1 gap-2;
    }

    .market-section {
      @apply grid-cols-2;
    }

    .market-section .metric {
      @apply flex-row justify-between items-center;
    }
  }
</style>
