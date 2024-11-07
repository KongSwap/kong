<script lang="ts">
  import { onMount } from "svelte";
  import { walletStore } from "$lib/stores/walletStore";
    import { poolStore } from "$lib/features/pools/poolStore";

  let loading = true;
  let error: string | null = null;
  let poolBalances: FE.UserPoolBalance[] = [];

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

  // Load balances on mount and when wallet changes
  $: if ($walletStore.isConnected) {
    loadPoolBalances();
  }

  onMount(() => {
    if ($walletStore.isConnected) {
      loadPoolBalances();
    }
  });
</script>

<div class="space-y-4">
  <h3 class="text-lg font-medium text-white">Your Liquidity Positions</h3>
  {#if loading}
    <div class="text-white/50">Loading...</div>
  {:else if error}
    <div class="text-red-400">{error}</div>
  {:else if poolBalances.length === 0}
    <div class="text-white/50">No LP positions found</div>
  {:else}
    {#each poolBalances as pool}
      <div class="bg-white/5 rounded-lg p-4 space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-white font-medium">{pool.name}</span>
          <span class="text-white/80">{pool.balance} LP</span>
        </div>
        <div class="flex justify-between items-center text-sm">
          <span class="text-white/60">{pool.amount_0} {pool.symbol_0}</span>
          <span class="text-white/60">{pool.amount_1} {pool.symbol_1}</span>
        </div>
      </div>
    {/each}
  {/if}
</div>
