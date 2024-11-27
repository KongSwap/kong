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
  $: {
    const balances = $poolStore.userPoolBalances as UserBalancesResponse;
    if (balances?.Ok) {
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

<div class="pool-list">
  <div class="header-section">
    <h3>Liquidity Positions</h3>
    <button class="add-button" on:click={handleAddLiquidity}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Add Position
    </button>
  </div>

  <div class="pools-content">
    {#if loading && processedPools.length === 0}
      <div class="empty-state">Loading positions...</div>
    {:else if error}
      <div class="empty-state error">{error}</div>
    {:else if processedPools.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <p>No active positions</p>
        <button class="primary-button" on:click={handleAddLiquidity}>
          Add Position
        </button>
      </div>
    {:else}
      <div class="pools-container">
        {#each processedPools as pool (pool.id)}
          <div class="pool-row" 
               in:fly={{ y: 20, duration: 400, delay: 200 }}
               out:fade={{ duration: 200 }}>
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
      </div>
    {/if}
  </div>
</div>

<style>
  .pool-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #15161c;
    border-radius: 12px;
    overflow: hidden;
  }

  .header-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: #15161c;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .header-section h3 {
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .add-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(59, 130, 246, 0.1);
    color: rgb(59, 130, 246);
    font-size: 14px;
    font-weight: 500;
    border-radius: 8px;
    transition: all 200ms;
  }

  .add-button:hover {
    background: rgba(59, 130, 246, 0.15);
  }

  .pools-content {
    flex: 1;
    overflow-y: auto;
  }

  .pool-row {
    background: rgba(42, 45, 61, 0.3);
    border: 1px solid rgba(58, 62, 82, 0.3);
    transition: all 200ms;
    margin: 8px;
    border-radius: 12px;
  }

  .pool-row:hover {
    background: rgba(42, 45, 61, 0.8);
    border-color: rgba(58, 62, 82, 0.8);
    transform: translateY(-1px);
  }

  .pool-content {
    padding: 16px;
  }

  .pool-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .pool-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pool-pair {
    font-size: 16px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.95);
  }

  .pool-balance {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 48px 24px;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
  }

  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 12px;
    color: rgb(59, 130, 246);
  }

  .primary-button {
    padding: 8px 16px;
    background: rgb(59, 130, 246);
    color: white;
    font-size: 14px;
    font-weight: 500;
    border-radius: 8px;
    transition: all 200ms;
  }

  .primary-button:hover {
    background: rgb(37, 99, 235);
  }

  .error {
    color: rgb(239, 68, 68);
  }

  .pool-usd-value {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
