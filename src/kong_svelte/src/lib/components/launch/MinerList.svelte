<script lang="ts">
  import { onMount } from 'svelte';
  import { createAnonymousActorHelper } from '$lib/utils/actorUtils'; // Use existing helper
  // Import from the specific index file using path from project root
  import { idlFactory } from '../../../../../declarations/miner/index.js';
  // Import types from the specific index file using path from project root
  import type { _SERVICE, MinerInfo, MiningStats, Result_2 } from '../../../../../declarations/miner/index.d.ts';
  import type { ActorSubclass } from '@dfinity/agent';
  import Panel from '$lib/components/common/Panel.svelte';
  import LoadingSpinner from '$lib/components/common/LoadingSpinner.svelte';

  // Props
  export let minerCanisterId: string;

  // State
  let minerInfo: MinerInfo | null = null;
  let miningStats: MiningStats | null = null;
  let isLoading: boolean = true;
  let error: string | null = null;

  // Lifecycle hook for data fetching
  onMount(async () => {
    await fetchMinerData();
  });

  // Reactive statement to refetch if canister ID changes (optional, but good practice)
  $: if (minerCanisterId) {
     // Debounce or add checks if rapid changes are possible
     fetchMinerData();
  }


  async function fetchMinerData() {
      // Prevent fetching if already loading or no ID
      if (isLoading && minerInfo) return; // Avoid refetch if already loading initial data
      if (!minerCanisterId) {
        error = "Miner canister ID is not provided.";
        isLoading = false; // Ensure loading stops if no ID
        return;
      }

      // Reset state for new fetch only if not already loading
      isLoading = true;
      error = null;
      // Keep previous data visible while loading new data if desired, or clear it:
      // minerInfo = null;
      // miningStats = null;


      try {
        // Use the helper function to get an anonymous actor
        // The helper handles agent creation, host, root key fetching, and caching
        const actor: ActorSubclass<_SERVICE> = createAnonymousActorHelper(minerCanisterId, idlFactory);

        // --- Fetch Miner Info (Query Call) ---
        // Ensure actor is valid before calling methods
        if (!actor || typeof actor.get_info !== 'function') {
          throw new Error("Failed to create a valid actor instance.");
        }

        const infoResult: Result_2 = await actor.get_info();
        if ('Ok' in infoResult) {
          minerInfo = infoResult.Ok;
        } else {
          throw new Error(`Failed to get miner info: ${infoResult.Err}`);
        }

        // --- Fetch Mining Stats (Query Call) ---
         if (typeof actor.get_mining_stats !== 'function') {
          throw new Error("Actor instance does not have get_mining_stats method.");
        }
        const statsResult: MiningStats = await actor.get_mining_stats();
        miningStats = statsResult;

      } catch (err: any) {
        error = `Failed to fetch miner data: ${err.message || 'An unknown error occurred'}`;
        console.error("Error fetching miner data for canister", minerCanisterId, ":", err);
        // Clear data on error? Optional.
        // minerInfo = null;
        // miningStats = null;
      } finally {
        isLoading = false;
      }
    }


  // Helper to format bigint timestamps (nanoseconds)
  function formatTimestampNs(ns: bigint | undefined | null): string {
    if (ns === undefined || ns === null || ns === 0n) return 'N/A';
    try {
      // Convert nanoseconds to milliseconds for Date constructor
      const ms = Number(ns / 1_000_000n); // Ensure BigInt division
      if (isNaN(ms)) return 'Invalid Date'; // Check if conversion resulted in NaN
      return new Date(ms).toLocaleString();
    } catch (e) {
      console.error("Error formatting timestamp:", ns, e);
      return 'Invalid Date';
    }
  }

</script>

<!-- Removed title prop and class prop as they caused errors -->
<Panel>
  <!-- Optional: Add title back using slots if Panel supports it -->
  <!-- <span slot="title">Miner Details ({minerCanisterId})</span> -->
  {#if isLoading}
    <div class="p-4 flex justify-center items-center">
      <LoadingSpinner message="Loading miner data..." />
    </div>
  {:else if error}
    <div class="p-4 border border-kong-error bg-kong-error/10 rounded text-kong-error">
      <p class="font-semibold">Error loading miner data:</p>
      <p class="font-mono text-sm mt-1">{error}</p>
    </div>
  {:else if minerInfo && miningStats}
    <div class="p-4 space-y-2 text-sm text-kong-text-secondary">
      <!-- Miner Info Section -->
      <h3 class="text-base font-semibold text-kong-text-primary mb-1">Miner Info</h3>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1">
        <span>Mining Status:</span>
        <span class="font-medium text-kong-text-primary">{minerInfo.is_mining ? 'Active' : 'Inactive'}</span>

        <span>Mining Speed:</span>
        <span class="font-medium text-kong-text-primary">{minerInfo.speed_percentage}%</span>

        <span>Chunk Size:</span>
        <span class="font-medium text-kong-text-primary">{minerInfo.chunk_size.toString()}</span>

        <span>Connected Token:</span>
        <span class="font-medium text-kong-text-primary break-all">
          {minerInfo.current_token.length > 0 ? minerInfo.current_token[0].toString() : 'None'}
        </span>
      </div>

      <!-- Mining Stats Section -->
      <h3 class="text-base font-semibold text-kong-text-primary mt-3 mb-1">Mining Stats</h3>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1">
        <span>Total Hashes:</span>
        <span class="font-medium text-kong-text-primary">{miningStats.total_hashes.toString()}</span>

        <span>Blocks Mined:</span>
        <span class="font-medium text-kong-text-primary">{miningStats.blocks_mined.toString()}</span>

        <span>Total Rewards:</span>
        <span class="font-medium text-kong-text-primary">{miningStats.total_rewards.toString()}</span> <!-- Consider formatting based on token decimals if known -->

        <span>Last Hash Rate:</span>
        <span class="font-medium text-kong-text-primary">{miningStats.last_hash_rate.toFixed(2)} H/s</span>

        <span>Mining Since:</span>
        <span class="font-medium text-kong-text-primary">{formatTimestampNs(miningStats.start_time)}</span>
      </div>
    </div>
  {:else}
    <p class="p-4 text-kong-text-secondary italic">No miner data available or component not fully loaded.</p>
  {/if}
</Panel>
