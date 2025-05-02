<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import LoadingSpinner from "$lib/components/common/LoadingSpinner.svelte";
  import { Principal } from "@dfinity/principal";
  import { canisterId as launchpadCanisterId } from "$declarations/launchpad";
  import type { _SERVICE as LaunchpadService } from "$declarations/launchpad/launchpad.did.js";
  import type { _SERVICE as MinerService, MinerInfo, MiningStats } from "$declarations/miner/miner.did.js";
  import { canisterIDLs } from "$lib/config/auth.config";
  import type { ActorSubclass } from "@dfinity/agent";
  import { toastStore } from "$lib/stores/toastStore";
  import { onDestroy } from "svelte"; // Using onMount temporarily, will refactor with $effect if needed

  // --- Types ---
  interface MinerData {
    principal: Principal;
    info: MinerInfo | null;
    stats: MiningStats | null;
    infoError: string | null;
    statsError: string | null;
    isLoadingInfo: boolean;
    isLoadingStats: boolean;
  }

  // --- State ---
  let launchpadActor = $state<ActorSubclass<LaunchpadService> | null>(null);
  let userMiners = $state<MinerData[]>([]);
  let isLoadingMinersList = $state(true);
  let listError = $state<string | null>(null);

  // --- Derived State for Cumulative Stats ---
  let cumulativeStats = $derived(() => {
    let totalHashrate = 0;
    let totalBlocks = 0n;
    let totalRewards = 0n;

    for (const miner of userMiners) {
      if (miner.stats) {
        totalHashrate += miner.stats.last_hash_rate;
        totalBlocks += miner.stats.blocks_mined;
        totalRewards += miner.stats.total_rewards; // Assuming total_rewards is cumulative per miner
      }
    }
    return { totalHashrate, totalBlocks, totalRewards };
  });

  // --- Refresh interval (auto-update miner stats) ---
  const REFRESH_INTERVAL = 30_000; // 30 s
  let refreshIntervalId: ReturnType<typeof setInterval> | null = null;

  // --- Effects / Lifecycle ---
  // Initialize or reset when auth state changes (runs before DOM is ready)
  $effect.pre(() => {
    if ($auth.isConnected && $auth.account?.owner) {
      initializeLaunchpadActor();
    } else {
      resetState();
    }
  });

  $effect(() => {
    if (launchpadActor) {
      fetchUserMinersList();
    }
  });

  $effect(() => {
    // Fetch details for each miner once the list is available
    userMiners.forEach((miner, index) => {
      if (!miner.info && !miner.stats && !miner.isLoadingInfo && !miner.isLoadingStats && !miner.infoError && !miner.statsError) {
        fetchMinerDetails(miner.principal, index);
      }
    });
  });

  // Auto-refresh the miners list periodically when the user is connected
  $effect(() => {
    if ($auth.isConnected && launchpadActor) {
      if (refreshIntervalId) clearInterval(refreshIntervalId);
      refreshIntervalId = setInterval(fetchUserMinersList, REFRESH_INTERVAL);
    } else if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }
  });

  onDestroy(() => {
    if (refreshIntervalId) clearInterval(refreshIntervalId);
  });

  // --- Actor Initialization ---
  async function initializeLaunchpadActor() {
    if (!$auth.isConnected || !$auth.account?.owner) return;
    try {
      const actor = await auth.getActor<LaunchpadService>(
        launchpadCanisterId,
        canisterIDLs.launchpad // Assuming launchpad IDL is configured
      );
      launchpadActor = actor;
      console.log("Launchpad actor initialized");
    } catch (error) {
      console.error("Error initializing launchpad actor:", error);
      listError = "Failed to initialize launchpad connection.";
      toastStore.error(listError);
    }
  }

  // --- Data Fetching ---
  async function fetchUserMinersList() {
    if (!launchpadActor) return;
    isLoadingMinersList = true;
    listError = null;
    console.log("Fetching user miners list...");
    try {
      // Fetch list of miners for the caller
      const result = await launchpadActor.list_miners();
      console.log("Raw miner list result:", result);

      if (Array.isArray(result)) {
        userMiners = result.map((item: any) => {
          // The launchpad can return either `MinerInfo` objects or `Principal` values (older version)
          const principal: Principal = item?.canister_id ?? item;
          return {
            principal,
            info: null,
            stats: null,
            infoError: null,
            statsError: null,
            isLoadingInfo: false,
            isLoadingStats: false,
          } as MinerData;
        });

        console.log("Processed user miners:", userMiners);
        if (userMiners.length === 0) {
          toastStore.info("No miners found for your principal.");
        }
      } else {
        console.error("Unexpected result format from list_miners:", result);
        throw new Error("Received unexpected data format for miner list.");
      }

    } catch (error: any) {
      console.error("Error fetching user miners list:", error);
      listError = `Failed to fetch miner list: ${error.message || "Unknown error"}`;
      toastStore.error(listError);
      userMiners = []; // Clear miners on error
    } finally {
      isLoadingMinersList = false;
    }
  }

  async function fetchMinerDetails(principal: Principal, index: number) {
    console.log(`Fetching details for miner ${index}: ${principal.toText()}`);
    userMiners[index].isLoadingInfo = true;
    userMiners[index].isLoadingStats = true;
    userMiners[index].infoError = null;
    userMiners[index].statsError = null;

    try {
      const minerActor = await auth.getActor<MinerService>(
        principal.toText(),
        canisterIDLs.miner // Assuming miner IDL is configured
      );

      // Fetch Info
      try {
        const infoResult = await minerActor.get_info();
        if ('Ok' in infoResult) {
          userMiners[index].info = infoResult.Ok;
        } else {
          throw new Error(infoResult.Err);
        }
      } catch (infoError: any) {
        console.error(`Error fetching info for miner ${principal.toText()}:`, infoError);
        userMiners[index].infoError = `Info fetch failed: ${infoError.message || "Unknown error"}`;
      } finally {
        userMiners[index].isLoadingInfo = false;
      }

      // Fetch Stats
      try {
        const statsResult = await minerActor.get_mining_stats();
        // Assuming get_mining_stats directly returns MiningStats or throws
        userMiners[index].stats = statsResult;
      } catch (statsError: any) {
        console.error(`Error fetching stats for miner ${principal.toText()}:`, statsError);
        userMiners[index].statsError = `Stats fetch failed: ${statsError.message || "Unknown error"}`;
      } finally {
        userMiners[index].isLoadingStats = false;
      }

    } catch (actorError: any) {
      console.error(`Error getting actor for miner ${principal.toText()}:`, actorError);
      const errorMsg = `Actor fetch failed: ${actorError.message || "Unknown error"}`;
      userMiners[index].infoError = errorMsg;
      userMiners[index].statsError = errorMsg;
      userMiners[index].isLoadingInfo = false;
      userMiners[index].isLoadingStats = false;
    }
  }

  // --- Actions ---
  async function handleAction(action: 'start' | 'stop' | 'claim', principal: Principal, index: number) {
    const actionToastId = toastStore.info(`Processing ${action}...`, { duration: 0 });
    try {
      const minerActor = await auth.getActor<MinerService>(principal.toText(), canisterIDLs.miner);
      let result: any; // Adjust type as needed

      switch (action) {
        case 'start':
          result = await minerActor.start_mining();
          break;
        case 'stop':
          result = await minerActor.stop_mining();
          break;
        case 'claim':
          result = await minerActor.claim_rewards();
          break;
      }

      if ('Ok' in result) {
        toastStore.success(`${action.charAt(0).toUpperCase() + action.slice(1)} successful!`);
        // Re-fetch details to update status
        fetchMinerDetails(principal, index);
        if (action === 'claim') {
          // Potentially update cumulative stats if claim returns amount
          console.log("Claim result:", result.Ok); // Log claimed amount if available
        }
      } else {
        throw new Error(result.Err);
      }

    } catch (error: any) {
      console.error(`Error performing ${action} on miner ${principal.toText()}:`, error);
      toastStore.error(`${action.charAt(0).toUpperCase() + action.slice(1)} failed: ${error.message || "Unknown error"}`);
    } finally {
      toastStore.dismiss(actionToastId);
    }
  }

  // --- Helpers ---
  function resetState() {
    launchpadActor = null;
    userMiners = [];
    isLoadingMinersList = true;
    listError = null;
  }

  function handleConnect() {
    walletProviderStore.open();
  }

  // Format BigInt rewards (assuming 8 decimals like KONG)
  function formatRewards(amount: bigint | number): string {
    const num = BigInt(amount); // Ensure it's BigInt
    const decimals = 8;
    const integerPart = num / (10n ** BigInt(decimals));
    const fractionalPart = num % (10n ** BigInt(decimals));
    // Pad fractional part if needed and take first few decimals for display
    const fractionalString = fractionalPart.toString().padStart(decimals, '0').substring(0, 4); // Show 4 decimal places
    return `${integerPart}.${fractionalString}`;
  }

  function formatHashrate(rate: number): string {
    if (rate < 1000) {
      return `${rate.toFixed(2)} H/s`;
    } else if (rate < 1000000) {
      return `${(rate / 1000).toFixed(2)} KH/s`;
    } else if (rate < 1000000000) {
      return `${(rate / 1000000).toFixed(2)} MH/s`;
    } else {
      return `${(rate / 1000000000).toFixed(2)} GH/s`;
    }
  }

</script>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-2xl font-semibold mb-6 text-kong-text-primary">My Miner Dashboard</h1>

  {#if !$auth.isConnected}
    <Panel>
      <p class="text-kong-text-secondary mb-4">Connect your wallet to view your miner dashboard.</p>
      <ButtonV2 label="Connect Wallet" on:click={handleConnect} theme="primary" />
    </Panel>
  {:else}
    <!-- Cumulative Stats Panel -->
    <Panel class="mb-6">
      <h2 class="text-xl font-semibold mb-4 text-kong-text-primary">Cumulative Stats</h2>
      {#if isLoadingMinersList}
        <LoadingSpinner />
      {:else if listError}
        <p class="text-red-500">Error loading stats: {listError}</p>
      {:else if userMiners.length === 0}
        <p class="text-kong-text-secondary">No miners found.</p>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p class="text-sm text-kong-text-secondary">Total Hashrate</p>
            <p class="text-lg font-medium text-kong-text-primary">{formatHashrate(cumulativeStats.totalHashrate)}</p>
          </div>
          <div>
            <p class="text-sm text-kong-text-secondary">Total Blocks Mined</p>
            <p class="text-lg font-medium text-kong-text-primary">{cumulativeStats.totalBlocks.toString()}</p>
          </div>
          <div>
            <p class="text-sm text-kong-text-secondary">Total Rewards Mined</p>
            <!-- Assuming rewards are in a token like KONG with 8 decimals -->
            <p class="text-lg font-medium text-kong-text-primary">{formatRewards(cumulativeStats.totalRewards)}</p>
          </div>
        </div>
      {/if}
    </Panel>

    <!-- Individual Miners List -->
    <Panel>
      <h2 class="text-xl font-semibold mb-4 text-kong-text-primary">My Miners</h2>
      {#if isLoadingMinersList}
        <LoadingSpinner />
      {:else if listError}
        <p class="text-red-500">{listError}</p>
      {:else if userMiners.length === 0}
        <p class="text-kong-text-secondary">You haven't created any miners yet.</p>
        <!-- Optional: Link to create miner page -->
        <a href="/launch/create-miner" class="text-kong-link hover:underline mt-2 inline-block">Create a Miner</a>
      {:else}
        <div class="space-y-4">
          {#each userMiners as miner, index (miner.principal.toText())}
            <div class="border border-kong-border p-4 rounded-md">
              <h3 class="text-lg font-medium mb-2 text-kong-text-primary truncate" title={miner.principal.toText()}>
                Miner: {miner.principal.toText().substring(0, 5)}...{miner.principal.toText().substring(miner.principal.toText().length - 3)}
              </h3>

              {#if miner.isLoadingInfo || miner.isLoadingStats}
                <LoadingSpinner size="sm" />
              {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm mb-3">
                  <!-- Info Section -->
                  <div>
                    <p class="text-kong-text-secondary">Status:
                      {#if miner.infoError}
                        <span class="text-red-500">Error</span>
                      {:else if miner.info}
                        <span class={miner.info.is_mining ? 'text-green-500' : 'text-yellow-500'}>
                          {miner.info.is_mining ? 'Mining' : 'Stopped'}
                        </span>
                      {:else}<span class="text-gray-400">N/A</span>{/if}
                    </p>
                    <p class="text-kong-text-secondary">Speed:
                      {#if miner.infoError} <span class="text-red-500">-</span>
                      {:else if miner.info} {miner.info.speed_percentage}%
                      {:else}<span class="text-gray-400">N/A</span>{/if}
                    </p>
                    <p class="text-kong-text-secondary">Chunk Size:
                      {#if miner.infoError} <span class="text-red-500">-</span>
                      {:else if miner.info} {miner.info.chunk_size.toString()}
                      {:else}<span class="text-gray-400">N/A</span>{/if}
                    </p>
                    <p class="text-kong-text-secondary truncate" title={miner.info?.current_token?.toText() ?? ''}>Token:
                      {#if miner.infoError} <span class="text-red-500">-</span>
                      {:else if miner.info?.current_token} {miner.info.current_token.toText().substring(0,5)}...
                      {:else}<span class="text-gray-400">None</span>{/if}
                    </p>
                    {#if miner.infoError}<p class="text-red-500 text-xs mt-1">{miner.infoError}</p>{/if}
                  </div>

                  <!-- Stats Section -->
                  <div>
                    <p class="text-kong-text-secondary">Hashrate:
                      {#if miner.statsError} <span class="text-red-500">Error</span>
                      {:else if miner.stats} {formatHashrate(miner.stats.last_hash_rate)}
                      {:else}<span class="text-gray-400">N/A</span>{/if}
                    </p>
                    <p class="text-kong-text-secondary">Blocks Mined:
                      {#if miner.statsError} <span class="text-red-500">-</span>
                      {:else if miner.stats} {miner.stats.blocks_mined.toString()}
                      {:else}<span class="text-gray-400">N/A</span>{/if}
                    </p>
                    <p class="text-kong-text-secondary">Rewards Mined:
                      {#if miner.statsError} <span class="text-red-500">-</span>
                      {:else if miner.stats} {formatRewards(miner.stats.total_rewards)}
                      {:else}<span class="text-gray-400">N/A</span>{/if}
                    </p>
                    <p class="text-kong-text-secondary">Total Hashes:
                      {#if miner.statsError} <span class="text-red-500">-</span>
                      {:else if miner.stats} {miner.stats.total_hashes.toString()}
                      {:else}<span class="text-gray-400">N/A</span>{/if}
                    </p>
                    {#if miner.statsError}<p class="text-red-500 text-xs mt-1">{miner.statsError}</p>{/if}
                  </div>

                  <!-- Actions Section -->
                  <div class="flex flex-col space-y-2 md:col-span-2 lg:col-span-1 lg:items-end">
                    <div class="flex space-x-2">
                      {#if miner.info && !miner.info.is_mining}
                        <ButtonV2 label="Start" size="sm" theme="success" on:click={() => handleAction('start', miner.principal, index)} disabled={!!miner.infoError} />
                      {/if}
                      {#if miner.info && miner.info.is_mining}
                        <ButtonV2 label="Stop" size="sm" theme="warning" on:click={() => handleAction('stop', miner.principal, index)} disabled={!!miner.infoError} />
                      {/if}
                      <ButtonV2 label="Claim" size="sm" theme="primary" on:click={() => handleAction('claim', miner.principal, index)} disabled={!!miner.statsError || (miner.stats && miner.stats.total_rewards === 0n)} />
                      <!-- Add more actions like set speed/chunk later -->
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </Panel>
  {/if}
</div>

<style>
</style>
