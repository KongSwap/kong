<!-- src/lib/components/sidebar/TokenRow.svelte -->
<script lang="ts">
    import type { Token } from '$lib/types/backend';
    import { tokenStore } from '$lib/stores/tokenStore';
    
    export let token: Token;
    
    $: tokenBalance = $tokenStore.balances[token.symbol] || { balance: '0', valueUsd: '0.00' };
    $: balance = tokenBalance.balance;
    $: usdValue = tokenBalance.valueUsd;

    function formatBalance(val: string | bigint): string {
        try {
            const num = typeof val === 'bigint' ? Number(val) : Number(val);
            return isNaN(num) ? '0' : num.toLocaleString(undefined, {
                maximumFractionDigits: 4
            });
        } catch {
            return '0';
        }
    }
</script>

<div class="token-row">
    <div class="token-info">
        <img src={token.logo} alt={token.symbol} class="h-10 w-10 rounded-full" />
        <div class="flex flex-col text-left">
            <span class="symbol">{token.symbol}</span>
            <span class="name">{token.name}</span>
        </div>
    </div>
    <div class="token-values">
        <span class="balance">{formatBalance(balance)} {token.symbol}</span>
        <span class="usd-value">${usdValue}</span>
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
      @apply text-right flex flex-col text-base;
    }
    
    .symbol {
      @apply text-yellow-300 text-lg;
      font-weight: bold;
    }
    
    .name {
      @apply text-sm opacity-70;
      opacity: 0.7;
    }
</style>
