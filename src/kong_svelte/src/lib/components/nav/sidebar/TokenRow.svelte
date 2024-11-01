<!-- src/lib/components/sidebar/TokenRow.svelte -->
<script lang="ts">
  export let token: {
    logo: string;
    symbol: string;
    name: string;
    formattedBalance: string;
    formattedUsdValue: string;
  };
</script>

<div class="token-row">
  <div class="token-info">
    <img
      src={token.logo || "/tokens/not_verified.webp"}
      alt={token.name}
      class="h-12 w-12 rounded-full"
      loading="lazy"
    />
    <div class="flex flex-col text-left">
      <span class="symbol">{token.symbol}</span>
      <span class="name text-nowrap text-ellipsis text-xs">{token.name}</span>
    </div>
  </div>
  <div class="token-values">
    <span>{token.formattedBalance} {token.symbol}</span>
    <span>${token.formattedUsdValue}</span>
  </div>
</div>

<style scoped lang="postcss">
  .token-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
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
  }

  .name {
    font-size: 0.875rem; /* 14px */
    opacity: 0.7;
  }
</style>