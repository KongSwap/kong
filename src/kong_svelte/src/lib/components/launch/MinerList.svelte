<script lang="ts">
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { ArrowRight, Activity } from "lucide-svelte";

  export let miners = [];
  export let loading = false;

  function handleMinerClick(owner) {
    goto(`/miner/${owner}`);
  }

  function getMinerTypeDisplay(type) {
    if (type.Premium) return "Premium";
    if (type.Normal) return "Normal";
    if (type.Lite) return "Lite";
    return "Unknown";
  }

  function formatHashRate(hashRate) {
    if (hashRate > 1000000) {
      return `${(hashRate / 1000000).toFixed(2)} MH/s`;
    } else if (hashRate > 1000) {
      return `${(hashRate / 1000).toFixed(2)} KH/s`;
    }
    return `${hashRate.toFixed(2)} H/s`;
  }
</script>

<div class="grid gap-4">
  {#if loading}
    <Panel>
      <div class="flex flex-col gap-4 animate-pulse">
        <div class="w-1/4 h-6 rounded bg-kong-background-secondary"></div>
        <div class="w-1/2 h-4 rounded bg-kong-background-secondary"></div>
      </div>
    </Panel>
  {:else if miners.length === 0}
    <Panel>
      <div class="py-8 text-center text-kong-text-primary/60">
        No miners found
      </div>
    </Panel>
  {:else}
    {#each miners as miner}
      <Panel>
        <button
          class="w-full p-4 text-left transition-colors rounded-lg hover:bg-kong-background-secondary"
          on:click={() => handleMinerClick(miner.owner)}
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="flex items-center justify-center w-12 h-12 rounded-full bg-kong-background-secondary">
                <Activity size={24} class="text-kong-text-primary/60" />
              </div>
              <div>
                <h3 class="text-lg font-semibold">
                  {getMinerTypeDisplay(miner.type)} Miner
                </h3>
                <p class="text-sm text-kong-text-primary/60">
                  {miner.owner.toString().slice(0, 10)}...
                </p>
              </div>
            </div>
            <div class="flex items-center gap-8">
              <div class="text-right">
                {#if miner.is_mining && miner.mining_stats}
                  <p class="text-sm text-kong-text-primary/60">Hash Rate</p>
                  <p class="font-medium text-kong-success">
                    {formatHashRate(miner.mining_stats.last_hash_rate)}
                  </p>
                {:else}
                  <p class="text-sm text-kong-text-primary/60">Status</p>
                  <p class="font-medium text-kong-text-primary/40">Inactive</p>
                {/if}
              </div>
              <ArrowRight size={20} class="text-kong-text-primary/40" />
            </div>
          </div>
          {#if miner.mining_stats}
            <div class="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-kong-border">
              <div>
                <p class="text-sm text-kong-text-primary/60">Blocks Mined</p>
                <p class="font-medium">{miner.mining_stats.blocks_mined.toString()}</p>
              </div>
              <div>
                <p class="text-sm text-kong-text-primary/60">Total Hashes</p>
                <p class="font-medium">{miner.mining_stats.total_hashes.toString()}</p>
              </div>
              <div>
                <p class="text-sm text-kong-text-primary/60">Total Rewards</p>
                <p class="font-medium">{miner.mining_stats.total_rewards.toString()}</p>
              </div>
            </div>
          {/if}
        </button>
      </Panel>
    {/each}
  {/if}
</div>
