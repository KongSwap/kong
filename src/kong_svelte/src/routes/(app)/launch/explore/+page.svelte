<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { auth } from "$lib/stores/auth";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types"; // Import the PageData type

  // Receive data from +page.ts
  let { data } = $props<{ data: PageData }>();

  // Redirect if not authenticated (example) - Keep this logic if needed
  // $effect(() => {
  //   if (!$auth.isConnected) {
  //     // goto("/"); // Or handle appropriately
  //     console.log("User not connected, showing explore page anyway for now.");
  //   }
  // });
</script>

<div class="container mx-auto px-4 py-8">
  <Panel>
    <h2 class="text-xl font-semibold mb-4 text-kong-text-primary">Explore Launchpad</h2>
    <p class="text-kong-text-secondary mb-6">Discover new projects and tokens launching on KongSwap.</p>

    {#if data.error}
      <p class="text-red-500">Error loading data: {data.error}</p>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 class="text-lg font-semibold mb-3 text-kong-text-primary">Tokens</h3>
          {#if data.tokens.length === 0}
            <p class="text-kong-text-secondary">No tokens found.</p>
          {:else}
            <ul class="space-y-3">
              {#each data.tokens as token (token.canister_id.toText())}
                <li class="bg-kong-bg-secondary/30 p-4 rounded-lg border border-kong-border">
                  <p class="font-semibold text-kong-text-primary">{token.name} ({token.ticker})</p>
                  <p class="text-sm text-kong-text-secondary">Canister ID: {token.canister_id.toText()}</p>
                  <p class="text-sm text-kong-text-secondary">Total Supply: {token.total_supply.toString()}</p>
                  <p class="text-sm text-kong-text-secondary">Creator: {token.creator.toText()}</p>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <div>
          <h3 class="text-lg font-semibold mb-3 text-kong-text-primary">Miners</h3>
          {#if data.miners.length === 0}
            <p class="text-kong-text-secondary">No miners found.</p>
          {:else}
            <ul class="space-y-3">
              {#each data.miners as miner (miner.canister_id.toText())}
                <li class="bg-kong-bg-secondary/30 p-4 rounded-lg border border-kong-border">
                  <p class="font-semibold text-kong-text-primary">Miner</p>
                  <p class="text-sm text-kong-text-secondary">Canister ID: {miner.canister_id.toText()}</p>
                  <p class="text-sm text-kong-text-secondary">PoW Backend ID: {miner.pow_backend_id.toText()}</p>
                  <p class="text-sm text-kong-text-secondary">Creator: {miner.creator.toText()}</p>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    {/if}
  </Panel>
</div>
