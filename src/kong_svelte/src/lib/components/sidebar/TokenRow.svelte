<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { Star, Send, ArrowUpRight, ArrowDown, ArrowUp } from 'lucide-svelte';
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { formatBalance } from '$lib/utils/tokenFormatters';
  import { createEventDispatcher } from 'svelte';
  import TokenDetails from '$lib/components/common/TokenDetails.svelte';
  export let token: any;
  const dispatch = createEventDispatcher();
  let showDetails = false;
  let isHovered = false;

  function handleFavoriteClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch('toggleFavorite');
  }

  function handleRowClick() {
    showDetails = true;
  }

  function handleSendClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch('send', { token });
  }

  function handleReceiveClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch('receive', { token });
  }
</script>

<div class="token-wrapper">
  <div 
    class="token-row"
    transition:fade={{ duration: 200 }}
    on:click={handleRowClick}
    on:mouseenter={() => isHovered = true}
    on:mouseleave={() => isHovered = false}
    role="button"
    tabindex="0"
    on:keydown={e => e.key === 'Enter' && handleRowClick()}
  >
    <div class="token-content">
      <div class="token-left">
        <div class="token-image" class:hovered={isHovered}>
          <TokenImages tokens={[token]} size={36} />
        </div>

        <div class="token-info">
          <div class="token-name-row">
            <button 
              class="favorite-button"
              class:active={token.isFavorite}
              on:click={handleFavoriteClick}
              title={token.isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star size={16} />
            </button>
            <span class="token-symbol">{token.symbol}</span>
          </div>
          <span class="token-name">{token.name}</span>
        </div>
      </div>

      <div class="token-right">
        <div class="value-info">
          <div class="balance">
            {formatBalance(token.balance, token.decimals)} 
          </div>
          <div class="usd-value">
            ${token.usdValue}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- <button 
    class="action-button receive"
    on:click={handleReceiveClick}
    title="Receive {token.symbol} to your wallet"
  >
    <ArrowDown size={16} />
  </button>
  <button 
    class="action-button send"
    on:click={handleSendClick}
    title="Send {token.symbol} to another wallet"
  >
    <ArrowUp size={16} />
  </button> -->
</div>

{#if showDetails}
  <div transition:scale={{duration: 200, start: 0.95}}>
    <TokenDetails {token} on:close={() => showDetails = false} />
  </div>
{/if}

<style lang="postcss">
  .token-wrapper {
    @apply flex gap-2;
  }

  .token-row {
    @apply flex-1;
    @apply bg-[#2a2d3d]/50 hover:bg-[#2a2d3d];
    @apply rounded-xl cursor-pointer;
    @apply transition-all duration-300 ease-out;
    @apply border border-transparent hover:border-[#3a3e52];
    @apply hover:shadow-lg hover:shadow-black/20;
    @apply outline-none focus:ring-2 focus:ring-[#3772ff]/50;
  }

  .token-content {
    @apply flex items-center justify-between;
    @apply h-[72px] px-4;
  }

  .token-left {
    @apply flex items-center gap-4;
  }

  .token-info {
    @apply flex flex-col;
  }

  .token-name-row {
    @apply flex items-center gap-2;
  }

  .favorite-button {
    @apply p-1 rounded-lg;
    @apply text-white/40 hover:text-white/90;
    @apply bg-white/5 hover:bg-white/10;
    @apply transition-all duration-200;
  }

  .token-symbol {
    @apply text-lg font-bold text-white;
  }

  .token-name {
    @apply text-sm text-white/70;
  }

  .token-right {
    @apply flex items-center gap-4;
  }

  .value-info {
    @apply flex flex-col items-end;
  }

  .balance {
    @apply text-base font-medium text-white;
  }

  .usd-value {
    @apply text-sm text-white/70;
  }

  .action-button {
    @apply h-[72px] w-[72px];
    @apply flex items-center justify-center;
    @apply text-white/90 hover:text-white;
    @apply transition-colors duration-200;
    @apply rounded-xl;
  }

  .action-button.receive {
    @apply bg-[#2a2d3d] hover:bg-[#3772ff]/30;
  }

  .action-button.send {
    @apply bg-[#3772ff]/20 hover:bg-[#3772ff]/30;
  }
</style>
