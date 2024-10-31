<!-- src/lib/components/sidebar/TokenRow.svelte -->
<script lang="ts">
  import { formatTokenBalance } from "$lib/utils/formatNumberCustom";
  import { tokenStore } from "$lib/stores/tokenStore";
  import { onMount } from "svelte";

  export let token: FE.Token;

  // Memoize formatted values
  let formattedBalance: string;
  let formattedUsdValue: string;

  // Update formatted values only when balance changes
  $: {
    const balance = $tokenStore.balances[token.canister_id] || "0";
    formattedBalance = formatTokenBalance(balance, token.decimals);
    formattedUsdValue = formatTokenBalance(
      (BigInt(balance) * 0n).toString(),
      2,
    );
  }
</script>

<div class="token-row">
  <div class="token-info">
      <img
        src={token.logo || "/tokens/not_verified.webp"}
        alt={token.name}
        class="h-12 w-12 rounded-full"
        loading="lazy"
        decoding="async"
      />
    <div class="flex flex-col text-left">
      <span class="symbol">{token.symbol}</span>
      <span class="name text-nowrap text-ellipsis text-xs">{token.name}</span>
    </div>
  </div>
  <div class="token-values">
    <span>{formattedBalance} {token.symbol}</span>
    <span>${formattedUsdValue}</span>
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
    @apply text-right flex flex-col text-sm;
  }

  .symbol {
    @apply text-yellow-300 text-base;
    font-weight: bold;
  }

  .name {
    @apply text-sm opacity-70;
    opacity: 0.7;
  }
</style>
