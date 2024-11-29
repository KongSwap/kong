<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { auth } from "$lib/services/auth";
  import { poolStore } from "$lib/services/pools/poolStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { tokenStore } from "$lib/services/tokens/tokenStore";

  export let pools: any[] = [];
  let loading = true;
  let error: string | null = null;
  let poolBalances: any[] = [];

  type UserBalanceLP = {
    LP: {
      name: string;
      symbol: string;
      symbol_0: string;
      symbol_1: string;
      balance: number;
      amount_0: number;
      amount_1: number;
      usd_balance: number;
    }
  };

  type UserBalancesResponse = {
    Ok?: UserBalanceLP[];
    Err?: string;
  };

  // Process pool balances when they update
  $: balances = $poolStore.userPoolBalances;
  $: if (balances?.Ok) {
      poolBalances = balances.Ok.map(balance => {
        if ('LP' in balance) {
          return {
            name: balance.LP.name,
            symbol: balance.LP.symbol,
            symbol_0: balance.LP.symbol_0,
            symbol_1: balance.LP.symbol_1,
            balance: balance.LP.balance.toString(),
            amount_0: balance.LP.amount_0,
            amount_1: balance.LP.amount_1,
            usd_balance: balance.LP.usd_balance
          };
        }
        return null;
      }).filter(Boolean);
      console.log("Processed pool balances:", poolBalances);
  }

  // Update processedPools to use the pool balances
  $: processedPools = poolBalances.map(pool => {
    // Find tokens by symbol to get their canister IDs
    const token0 = $tokenStore.tokens.find(t => t.symbol === pool.symbol_0);
    const token1 = $tokenStore.tokens.find(t => t.symbol === pool.symbol_1);

    return {
        id: pool.name,
        name: pool.name,
        symbol: pool.symbol,
        symbol_0: pool.symbol_0,
        symbol_1: pool.symbol_1,
        balance: pool.balance,
        amount_0: pool.amount_0,
        amount_1: pool.amount_1,
        usd_balance: pool.usd_balance,
        address_0: token0?.canister_id || pool.symbol_0,
        address_1: token1?.canister_id || pool.symbol_1
    };
  });

  async function loadPoolBalances() {
    try {
      loading = true;
      error = null;
      await poolStore.loadUserPoolBalances();
    } catch (err) {
      error = err.message;
      poolBalances = [];
    } finally {
      loading = false;
    }
  }

  function handleAddLiquidity() {
    window.location.href = '/earn';
  }

  onMount(() => {
    if ($auth.isConnected) {
      loadPoolBalances();
    }
  });

  $: if ($auth.isConnected) {
    loadPoolBalances();
  }
</script>

<div class="pool-list-wrapper">
  <div class="pool-list-content">
    <div class="pool-list">

      {#if loading && processedPools.length === 0}
        <div class="loading-state" in:fade>
          <p>Loading positions...</p>
        </div>
      {:else if error}
        <div class="error-state" in:fade>
          <p>{error}</p>
        </div>
      {:else if processedPools.length === 0}
        <div class="empty-state" in:fade>
          <p>No active positions</p>
          <button class="primary-button" on:click={handleAddLiquidity}>
            Add Position
          </button>
        </div>
      {:else}
        {#each processedPools as pool (pool.id)}
          <div class="pool-item" in:fade>
            <div class="pool-content">
              <div class="pool-left">
                <TokenImages 
                  tokens={[
                    $tokenStore.tokens.find(token => token.canister_id === pool.address_0),
                    $tokenStore.tokens.find(token => token.canister_id === pool.address_1)
                  ]} 
                  size={36}
                />
                <div class="pool-info">
                  <span class="pool-pair">{pool.symbol_0}/{pool.symbol_1}</span>
                  <span class="pool-balance">{parseFloat(pool.balance).toFixed(8)} LP</span>
                  <span class="pool-usd-value">${parseFloat(pool.usd_balance).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style lang="postcss">
  .pool-list-wrapper {
    @apply flex flex-col h-full overflow-hidden;
  }

  .pool-list-content {
    @apply flex-1 min-h-0 overflow-y-auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  .pool-list-content::-webkit-scrollbar {
    width: 6px;
  }

  .pool-list-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .pool-list-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .pool-list-content::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .pool-list {
    @apply flex flex-col gap-4 p-4 min-h-full;
  }

  .header-section {
    @apply flex justify-between items-center mb-2;
  }

  .header-section h3 {
    @apply text-base font-semibold text-white/90;
  }

  .add-button {
    @apply flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-400 bg-blue-500/10 rounded-lg transition-all duration-200;
  }

  .add-button:hover {
    @apply bg-blue-500/20;
  }

  .pool-item {
    @apply bg-gray-800/50 rounded-lg p-4;
  }

  .pool-content {
    @apply space-y-2;
  }

  .pool-left {
    @apply flex items-center gap-4;
  }

  .pool-info {
    @apply flex flex-col gap-1;
  }

  .pool-pair {
    @apply text-base font-medium text-white/95;
  }

  .pool-balance {
    @apply text-sm text-white/70;
  }

  .pool-usd-value {
    @apply text-xs text-white/50;
  }

  .loading-state, .error-state, .empty-state {
    @apply flex flex-col items-center justify-center gap-3
           min-h-[160px] text-white/40 text-sm;
  }

  .primary-button {
    @apply px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg
           transition-all duration-200 hover:bg-blue-600;
  }

  .error-state {
    @apply text-red-400;
  }
</style>
