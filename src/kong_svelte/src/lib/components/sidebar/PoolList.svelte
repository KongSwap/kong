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
  {#if loading && processedPools.length === 0}
    <div class="loading">Loading pools...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if processedPools.length === 0}
    <div class="empty">No LP positions found</div>
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
  .pool-list {
    @apply flex flex-col gap-2;
  }

  .pool-item {
    @apply flex justify-between items-center p-2 bg-gray-800 rounded;
  }

  .loading, .error, .empty {
    @apply text-center p-4 text-gray-200;
  }
</style>
