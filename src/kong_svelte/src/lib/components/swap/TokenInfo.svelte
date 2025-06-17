<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import Panel from "$lib/components/common/Panel.svelte";
  import { copyToClipboard } from "$lib/utils/clipboard";

  export let token: Kong.Token | null = null;
</script>

<Panel variant="transparent" type="main" className="token-info-panel">
  {#if token}
    <div class="token-info-content">
      <div class="token-header">
        <img src={token.logo_url} alt={token.symbol} class="token-logo" />
        <div class="token-title">
          <h3>{token.name}</h3>
          <span class="token-symbol">{token.symbol}</span>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">{formatUsdValue(token.metrics.tvl)}</span>
          <span class="stat-label">TVL</span>
        </div>
        <div class="stat-item">
          <span class="stat-value"
            >{formatUsdValue(token.metrics.market_cap)}</span
          >
          <span class="stat-label">Market Cap</span>
        </div>
        <div class="stat-item">
          <span class="stat-value"
            >{formatUsdValue(token.metrics.volume_24h)}</span
          >
          <span class="stat-label">24h Volume</span>
        </div>
        <div class="stat-item">
          <button
            class="stat-value truncate canister-id"
            onclick={() => copyToClipboard(token.address)}
            title="Click to copy"
          >
            {token.address}
          </button>
          <span class="stat-label">Canister ID</span>
        </div>
      </div>
    </div>
  {:else}
    <div class="empty-state">Select a token to view details</div>
  {/if}
</Panel>

<style lang="postcss">
  .token-info-content {
    padding: 1rem;
  }

  .token-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border);
  }

  .token-logo {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .token-title {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .token-title h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
    line-height: 1.2;
  }

  .token-symbol {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    background: var(--color-background-secondary);
    border-radius: 0.5rem;
    transition: transform 0.2s ease;
  }

  .stat-item:hover {
    transform: translateY(-1px);
  }

  .stat-label {
    color: var(--color-text-secondary);
    @apply text-xs font-medium;
  }

  .stat-value {
    color: var(--color-text-primary);
    @apply text-xl font-medium;
  }

  .empty-state {
    padding: 1.5rem 1rem;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .canister-id {
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    width: 100%;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  .canister-id:hover {
    color: var(--color-primary);
  }

  .canister-id::after {
    content: "📋";
    font-size: 0.75rem;
    margin-left: 0.375rem;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .canister-id:hover::after {
    opacity: 1;
  }
</style>
