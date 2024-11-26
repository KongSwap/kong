<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { auth } from "$lib/services/auth";
  import { poolStore } from "$lib/services/pools/poolStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";

  export let pools: any[] = [];
  let loading = true;
  let error: string | null = null;
  let poolBalances: FE.UserPoolBalance[] = [];

  let processedPools = pools.map(pool => ({
    ...pool,
    balance: $poolStore.userPoolBalances.find(b => b.name === pool.name)?.balance || "0"
  }));

  async function loadPoolBalances() {
    try {
      loading = true;
      error = null;
      await poolStore.loadUserPoolBalances();
      poolBalances = $poolStore.userPoolBalances;
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
                    { symbol: pool.symbol_0 },
                    { symbol: pool.symbol_1 }
                  ]} 
                  size={36}
                />
                <div class="pool-info">
                  <span class="pool-pair">{pool.symbol_0}/{pool.symbol_1}</span>
                  <span class="pool-balance">{pool.balance} LP</span>
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
</style>
