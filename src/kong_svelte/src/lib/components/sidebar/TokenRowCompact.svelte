<script lang="ts">  
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { formatBalance, formatUsdValue } from '$lib/utils/tokenFormatters';

  interface TokenRowProps {
    token: FE.Token;
    onClick?: () => void;
  }
  let { token, onClick }: TokenRowProps = $props();
</script>

{#if token}
<div class="base">
  <button class="content" on:click={onClick} type="button" aria-label="Select {token.name} ({token.symbol})">
    <div class="left">
      <div class="img-container">
        <TokenImages tokens={[token]} size={24} />
      </div>
      <div class="text">
        <span class="symbol">{token.symbol}</span>
        <span class="name" title={token.name}>{token.name}</span>
      </div>
    </div>
    <div class="right">
      <span class="balance">{formatBalance(token.balance, token.decimals)}</span>
      {#if token.price}
        <span class="price">{formatUsdValue(token.price)}</span>
      {/if}
    </div>
  </button>
</div>
{/if}

<style lang="postcss">
  .base {
    @apply w-full px-3 py-2 rounded-lg bg-black/20 border border-white/5 
           transition-all duration-200 hover:bg-black/30;
  }

  .content {
    @apply w-full flex items-center justify-between gap-6 
           text-left bg-transparent;
  }

  .left {
    @apply flex items-center gap-3 min-w-0 flex-1;
  }

  .img-container {
    @apply w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden;
  }

  .img-container :global(img) {
    @apply max-w-full max-h-full object-contain;
  }

  .text {
    @apply flex flex-col min-w-0 gap-0.5;
  }

  .symbol {
    @apply text-base font-medium text-white truncate;
  }

  .name {
    @apply text-sm text-white/60 truncate;
  }

  .right {
    @apply flex flex-col items-end flex-shrink-0 gap-0.5;
  }

  .balance {
    @apply text-base text-white/90 font-mono;
  }

  .price {
    @apply text-sm text-white/60 font-mono;
  }
</style>
