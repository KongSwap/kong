<!-- src/lib/components/sidebar/TokenRow.svelte -->
<script lang="ts">
  export let token: {
    logo: string;
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
    <img
      src={token.logo || "/tokens/not_verified.webp"}
      alt={token.name}
      class="h-[48px] w-[48px] rounded-full"
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
</button>

<style scoped lang="postcss">
  .token-row {
    width: 100%;
    text-align: left;
    border: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .token-row:hover {
    border: 2px solid #f7bf26c8;
    background: rgba(0, 0, 0, 0.2);
    padding: 10px;
    transform: scale(1.02);
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
