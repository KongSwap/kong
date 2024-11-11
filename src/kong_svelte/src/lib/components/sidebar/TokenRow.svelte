<!-- src/lib/components/sidebar/TokenRow.svelte -->
<script lang="ts">
	import TokenImages from '$lib/components/common/TokenImages.svelte';
  export let token: {
    logo?: string;
    symbol: string;
    name: string;
    formattedBalance: string;
    formattedUsdValue: string;
  };
  export let onClick: () => void;
</script>

<button 
  class="token-row"
  on:click={onClick}
  type="button"
>
  <div class="token-info">
    <TokenImages
      tokens={[token]}
      class="h-[48px] w-[48px] rounded-full"
      loading="lazy"
    />
    <div class="flex flex-col text-left">
      <span class="symbol min-w-[96px]">{token.symbol}</span>
      <span class="name hide-on-small text-nowrap text-ellipsis text-xs">{token.name}</span>
    </div>
  </div>
  <div class="token-values">
    <span>
      {#if token.formattedBalance.includes('.') && token.formattedBalance.split('.')[1].length > 5}
        {token.formattedBalance.split('.')[0]}.{token.formattedBalance.split('.')[1].slice(0, 5)}...
      {:else}
        {token.formattedBalance}
      {/if}
    </span>
    <span class="hide-on-small">${token.formattedUsdValue}</span>
  </div>
</button>

<style scoped lang="postcss">
  .token-row {
    width: 100%;
    text-align: left;
    border: 2px solid transparent;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .token-row:hover {
    border-color: rgba(247, 191, 38, 0.5);
    background: rgba(0, 0, 0, 0.1);
    transform: scale(1.005);
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .token-values {
    text-align: right;
    display: flex;
    flex-direction: column;
    font-size: 0.875rem; /* 14px */
  }

  .symbol {
    color: #fbbf24; /* Tailwind's yellow-300 */
    font-size: 1rem; /* 16px */
    font-weight: bold;
    min-width: 96px; /* Reserves space for ~8 characters */
    display: inline-block;
  }

  .name {
    font-size: 0.875rem; /* 14px */
    opacity: 0.7;
  }

  @media (max-width: 400px) {
    .hide-on-small {
      display: none;
    }
    
    .token-values {
      font-size: 0.75rem; /* Slightly smaller font on mobile */
    }
    .symbol {
      min-width: 72px; /* Slightly smaller on mobile but still fits 8 chars */
    }
  }
</style>
