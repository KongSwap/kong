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
  on:click={onClick}
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

<style lang="postcss">
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
    transition: all 0.2s ease;
    background: transparent;
  }

  .token-row:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(251, 191, 36, 0.3);
  }

  .token-row:active {
    transform: scale(0.98);
  }
  
  .token-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0; /* Enables text truncation */
  }

  .token-values {
    text-align: right;
    display: flex;
    flex-direction: column;
    font-size: 0.875rem;
    gap: 2px;
  }

  .symbol {
    color: #fbbf24;
    font-size: 1rem;
    font-weight: bold;
    min-width: 96px;
    display: inline-block;
  }

  .name {
    font-size: 0.875rem;
    opacity: 0.7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .balance {
    font-weight: 500;
  }

  .usd-value {
    opacity: 0.7;
  }

  @media (max-width: 400px) {
    .hide-on-small {
      display: none;
    }
    
    .token-values {
      font-size: 0.75rem;
    }

    .symbol {
      min-width: 72px;
    }

    .token-row {
      padding: 8px;
    }
  }
</style>
