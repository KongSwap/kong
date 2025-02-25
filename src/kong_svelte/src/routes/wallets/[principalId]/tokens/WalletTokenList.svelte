<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatBalance, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { flip } from "svelte/animate";
  import { walletBalancesStore } from "$lib/stores/walletBalancesStore";
  import { ArrowUp, ArrowDown } from "lucide-svelte";

  export let tokens: FE.Token[] = [];

  // Calculate formatted values reactively based on wallet balances
  $: formattedTokens = tokens
    .map(token => {
      const balance = $walletBalancesStore[token.canister_id];
      return {
        ...token,
        balance: balance?.in_tokens || "0",
        formattedUsdValue: balance?.in_usd || "0",
        priceChange24h: token.metrics?.price_change_24h || "0",
        price: token.metrics?.price || "0"
      };
    })
    .sort((a, b) => Number(b.formattedUsdValue) - Number(a.formattedUsdValue));

  function formatPriceChange(change: string) {
    const num = Number(change);
    return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
  }

  function getPriceChangeColor(change: string) {
    const num = Number(change);
    if (num > 0) return 'text-kong-text-accent-green';
    if (num < 0) return 'text-kong-accent-red';
    return 'text-kong-text-secondary';
  }
</script>

<div class="token-list">
  <div class="token-table">
    <div class="token-header">
      <div class="token-col">Token</div>
      <div class="balance-col text-right">Balance</div>
      <div class="price-col text-right">Price</div>
      <div class="change-col text-right">24h Change</div>
      <div class="value-col text-right">Value</div>
    </div>
    <div class="token-body">
      {#each formattedTokens as token (token.canister_id)}
        <div class="token-row" animate:flip={{ duration: 300 }}>
          <div class="token-col">
            <div class="token-info">
              <TokenImages tokens={[token]} size={32} />
              <div class="token-details">
                <span class="token-symbol">{token.symbol}</span>
                <span class="token-name">{token.name}</span>
              </div>
            </div>
          </div>
          <div class="balance-col text-right">
            {formatBalance(token.balance, token.decimals)} {token.symbol}
          </div>
          <div class="price-col text-right">
            ${formatToNonZeroDecimal(token.price)}
          </div>
          <div class="change-col text-right">
            <span class={getPriceChangeColor(token.priceChange24h)}>
              {formatPriceChange(token.priceChange24h)}
              {#if Number(token.priceChange24h) > 0}
                <ArrowUp class="inline h-4 w-4" />
              {:else if Number(token.priceChange24h) < 0}
                <ArrowDown class="inline h-4 w-4" />
              {/if}
            </span>
          </div>
          <div class="value-col text-right">
            ${formatToNonZeroDecimal(token.formattedUsdValue)}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .token-list {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .token-table {
    display: flex;
    flex-direction: column;
    min-width: 600px;
    height: 100%;
  }

  .token-header {
    display: grid;
    grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr;
    padding: 1rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(var(--base-content-rgb), 0.6);
    border-bottom: 1px solid rgba(var(--base-content-rgb), 0.1);
    position: sticky;
    top: 0;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(8px);
  }

  .token-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .token-row {
    display: grid;
    grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(var(--base-content-rgb), 0.1);
    transition: background-color 150ms ease;
  }

  .token-row:hover {
    background: rgba(var(--base-content-rgb), 0.05);
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .token-symbol {
    font-weight: 600;
    color: rgb(var(--base-content-rgb));
  }

  .token-name {
    font-size: 0.875rem;
    color: rgba(var(--base-content-rgb), 0.6);
  }

  .balance-col,
  .price-col,
  .change-col,
  .value-col {
    font-weight: 600;
    color: rgb(var(--base-content-rgb));
  }

  @media (max-width: 768px) {
    .token-table {
      min-width: 100%;
    }

    .token-row {
      padding: 0.75rem 1rem;
    }

    .token-header {
      padding: 0.75rem 1rem;
    }

    .token-info {
      gap: 0.75rem;
    }
  }
</style> 