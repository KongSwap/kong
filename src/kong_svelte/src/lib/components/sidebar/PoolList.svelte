<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/services/auth";
  import { poolStore } from "$lib/services/pools/poolStore";

  // Accept pools prop for live data
  export let pools: any[] = [];

  let loading = true;
  let error: string | null = null;
  let poolBalances: FE.UserPoolBalance[] = [];

  // Process pools data when it changes
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
    // TODO: Implement add liquidity flow
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

<div class="liquidity-view">
  <div class="liquidity-header">
    <h3>Your Liquidity</h3>
    <button class="add-liquidity-button" on:click={handleAddLiquidity}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Add Position
    </button>
  </div>

  {#if loading && processedPools.length === 0}
    <div class="loading">Loading pools...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if processedPools.length === 0}
    <div class="empty-liquidity-state">
      <div class="icon-container">
        <svg class="icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="1.5">
          <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5l6.74-6.76z"></path>
          <line x1="16" y1="8" x2="2" y2="22"></line>
          <line x1="17.5" y1="15" x2="9" y2="15"></line>
        </svg>
      </div>
      <h3>No Active Positions</h3>
      <p>Add liquidity to start earning trading fees</p>
      <div class="action-buttons">
        <button class="primary-action" on:click={handleAddLiquidity}>
          Add Your First Position
        </button>
        <a href="/pools" class="secondary-action">
          Learn About Providing Liquidity
        </a>
      </div>
      <div class="help-text">
        <span class="info-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </span>
        <p>When you add liquidity, you'll receive pool tokens representing your position</p>
      </div>
    </div>
  {:else}
    {#each processedPools as pool (pool.id)}
      <div class="pool-item">
        <div class="flex justify-between items-center">
          <span class="text-white font-medium">{pool.name}</span>
          <span class="text-white/80">{pool.balance} LP</span>
        </div>
      </div>
    {/each}
  {/if}
</div>

<style lang="postcss">
  .liquidity-header {
    @apply flex items-center justify-between
           px-4 py-3 border-b border-white/5
           bg-[#1a1b23]/40;
  }

  .liquidity-header h3 {
    @apply text-lg font-semibold text-white/90;
  }

  .add-liquidity-button {
    @apply flex items-center gap-2 px-3 py-1.5
           bg-blue-500 text-white text-sm font-medium
           rounded-lg transition-all duration-200
           hover:bg-blue-600;
  }

  .empty-liquidity-state {
    @apply flex flex-col items-center justify-center gap-4
           min-h-[400px] m-4 p-8 text-center
           bg-[#2a2d3d]/20 rounded-2xl
           border border-white/5;
  }

  .icon-container {
    @apply w-20 h-20 flex items-center justify-center
           bg-gradient-to-b from-blue-500/20 to-purple-500/20
           rounded-2xl backdrop-blur-sm
           border border-white/10;
  }

  .icon-container svg {
    @apply w-10 h-10 text-blue-400;
  }

  .empty-liquidity-state h3 {
    @apply text-2xl font-semibold text-white/90;
  }

  .empty-liquidity-state p {
    @apply text-base text-white/60;
  }

  .action-buttons {
    @apply flex flex-col gap-3 w-full max-w-sm mt-2;
  }

  .primary-action {
    @apply w-full py-3 px-4
           bg-gradient-to-r from-blue-500 to-blue-600
           text-white font-medium
           rounded-xl transition-all duration-200
           hover:from-blue-600 hover:to-blue-700
           shadow-lg shadow-blue-500/20;
  }

  .secondary-action {
    @apply w-full py-3 px-4
           bg-[#2a2d3d]/40 text-white/90 font-medium
           rounded-xl transition-all duration-200
           hover:bg-[#2a2d3d]/60 hover:text-white
           border border-white/10;
  }

  .help-text {
    @apply flex items-start gap-3 mt-4
           px-4 py-3 max-w-sm
           bg-[#2a2d3d]/30 rounded-xl
           border border-white/5;
  }

  .info-icon {
    @apply flex items-center justify-center
           w-6 h-6 mt-0.5
           text-white/60;
  }

  .help-text p {
    @apply text-sm leading-relaxed text-white/70;
  }

  .loading, .error {
    @apply text-center p-4 text-gray-200;
  }

  .pool-item {
    @apply flex justify-between items-center p-2 bg-gray-800 rounded;
  }
</style>
