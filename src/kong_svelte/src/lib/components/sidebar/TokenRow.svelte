<script lang="ts">  
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { fade } from 'svelte/transition';

  interface TokenRowProps {
    token: FE.Token;
    onClick?: () => void;
  }
  let { token, onClick }: TokenRowProps = $props();

  // Helper function for number formatting
  function formatBalance(value: string): string {
    if (!value.includes('.')) return value;
    const [whole, decimal] = value.split('.');
    return decimal.length > 5 
      ? `${whole}.${decimal.slice(0, 5)}...`
      : value;
  }
</script>

<button 
  class="token-row"
  onclick={onClick}
  type="button"
  aria-label="Select {token.name} ({token.symbol})"
  transition:fade
>
  <div class="token-info">
    <TokenImages
      tokens={[token]}
    />
    <div class="flex flex-col text-left overflow-hidden">
      <span class="symbol">{token.symbol}</span>
      <span 
        class="name hide-on-small" 
        title={token.name}
      >
        {token.name}
      </span>
    </div>
  </div>
  <div class="token-values">
    <span class="balance">
      {formatBalance(token.formattedBalance)}
    </span>
    <span class="usd-value hide-on-small">
      ${token.formattedUsdValue}
    </span>
  </div>
</button>

<style scoped lang="postcss">
  .token-row {
    @apply w-full text-left border-2 border-transparent flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ease-in-out bg-transparent;
  }

  .token-row:hover {
    @apply bg-opacity-5 border-opacity-30;
    background-color: rgba(255, 255, 255, 0.05);
    border-color: rgba(251, 191, 36, 0.3);
  }

  .token-row:active {
    @apply transform scale-95;
  }
  
  .token-info {
    @apply flex items-center gap-3 flex-1 min-w-0;
  }

  .token-values {
    @apply text-right flex flex-col text-sm gap-0.5;
  }

  .symbol {
    @apply text-yellow-400 text-base font-bold min-w-[96px] inline-block;
  }

  .name {
    @apply text-sm opacity-70 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px];
  }

  .balance {
    @apply font-medium;
  }

  .usd-value {
    @apply opacity-70;
  }

  @media (max-width: 400px) {
    .hide-on-small {
      @apply hidden;
    }
    
    .token-values {
      @apply text-xs;
    }

    .symbol {
      @apply min-w-[72px];
    }

    .token-row {
      @apply p-2;
    }
  }
</style>
