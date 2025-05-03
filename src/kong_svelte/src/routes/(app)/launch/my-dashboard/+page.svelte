<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import LoadingSpinner from "$lib/components/common/LoadingSpinner.svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { Principal } from "@dfinity/principal";
  import { canisterId as launchpadCanisterId } from "$declarations/launchpad";
  import type { _SERVICE as LaunchpadService, TokenInfo as LaunchpadTokenInfo } from "$declarations/launchpad/launchpad.did.js";
  import type { _SERVICE as MinerService, MinerInfo, MiningStats } from "$declarations/miner/miner.did.js";
  import { canisterIDLs } from "$lib/config/auth.config";
  import type { ActorSubclass } from "@dfinity/agent";
  import { toastStore } from "$lib/stores/toastStore";
  import { onDestroy } from "svelte";

  interface MinerData {
    principal: Principal;
    info: MinerInfo | null;
    stats: MiningStats | null;
    remainingHashes: bigint | null;
    timeRemaining: string | null;
    infoError: string | null;
    statsError: string | null;
    isLoadingInfo: boolean;
    isLoadingStats: boolean;
  }

  let launchpadActor = $state<ActorSubclass<LaunchpadService> | null>(null);
  let userMiners = $state<MinerData[]>([]);
  let isLoadingMinersList = $state(true);
  let listError = $state<string | null>(null);
  let availableTokens = $state<LaunchpadTokenInfo[]>([]);
  let isLoadingTokens = $state(false);
  let tokensError = $state<string | null>(null);
  let minerInputs = $state<Record<string, { chunkSize: string; speed: string }>>({});
  let isTokenModalOpen = $state(false);
  let selectedMinerPrincipal = $state<Principal | null>(null);
  let selectedMinerIndex = $state<number>(-1);

  let cumulativeStats = $derived(() => {
    let totalHashrate = 0;
    let totalBlocks = 0n;
    let totalRewards = 0n;

    for (const miner of userMiners) {
      if (miner.stats) {
        totalHashrate += miner.stats.last_hash_rate;
        totalBlocks += miner.stats.blocks_mined;
        totalRewards += miner.stats.total_rewards;
      }
    }
    return { totalHashrate, totalBlocks, totalRewards };
  });

  const REFRESH_INTERVAL = 30_000;
  let refreshIntervalId: ReturnType<typeof setInterval> | null = null;

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
      fetchAvailableTokens();
    }
  });

  $effect(() => {
    userMiners.forEach((miner, index) => {
      const principalStr = miner.principal.toText();
      if (!minerInputs[principalStr]) {
         minerInputs[principalStr] = {
           chunkSize: miner.info?.chunk_size?.toString() ?? '',
           speed: miner.info?.speed_percentage?.toString() ?? ''
         };
      } else {
        if (!minerInputs[principalStr].chunkSize && miner.info?.chunk_size) {
          minerInputs[principalStr].chunkSize = miner.info.chunk_size.toString();
        }
        if (!minerInputs[principalStr].speed && miner.info?.speed_percentage) {
           minerInputs[principalStr].speed = miner.info.speed_percentage.toString();
        }
      }

      if (!miner.info && !miner.stats && !miner.isLoadingInfo && !miner.isLoadingStats && !miner.infoError && !miner.statsError) {
        fetchMinerDetails(miner.principal, index);
      }
    });
  });

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

  async function initializeLaunchpadActor() {
    if (!$auth.isConnected || !$auth.account?.owner) return;
    try {
      const actor = await auth.getActor(
        launchpadCanisterId,
        canisterIDLs.launchpad
      );
      launchpadActor = actor;
      console.log("Launchpad actor initialized");
    } catch (error) {
      console.error("Error initializing launchpad actor:", error);
      listError = "Failed to initialize launchpad connection.";
      toastStore.error(listError);
    }
  }

  async function fetchAvailableTokens() {
    if (!launchpadActor) return;
    isLoadingTokens = true;
    tokensError = null;
    console.log("Fetching available PoW tokens...");
    try {
      const result = await launchpadActor.list_tokens();
      console.log("Raw available tokens result:", result);
      if (Array.isArray(result)) {
        availableTokens = result;
      } else {
         console.error("Unexpected result format from list_tokens:", result);
         throw new Error("Received unexpected data format for token list.");
      }
    } catch (error: any) {
      console.error("Error fetching available tokens:", error);
      tokensError = `Failed to fetch token list: ${error.message || "Unknown error"}`;
      toastStore.error(tokensError);
      availableTokens = [];
    } finally {
      isLoadingTokens = false;
    }
  }

  async function fetchUserMinersList() {
    if (!launchpadActor) return;
    isLoadingMinersList = true;
    listError = null;
    console.log("Fetching user miners list...");
    try {
      const result = await launchpadActor.list_miners();
      console.log("Raw miner list result:", result);

      if (Array.isArray(result)) {
        userMiners = result.map((item: any) => {
          const principal: Principal = item?.canister_id ?? item;
          return {
            principal,
            info: null,
            stats: null,
            remainingHashes: null,
            timeRemaining: null,
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
      userMiners = [];
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
      const minerActor = await auth.getActor(
        principal.toText(),
        canisterIDLs.miner
      );

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

      try {
        const statsResult = await minerActor.get_mining_stats();
        userMiners[index].stats = statsResult;
      } catch (statsError: any) {
        console.error(`Error fetching stats for miner ${principal.toText()}:`, statsError);
        userMiners[index].statsError = `Stats fetch failed: ${statsError.message || "Unknown error"}`;
      } finally {
        userMiners[index].isLoadingStats = false;
      }

      // New: remaining hashes and time estimate
      try {
        const remaining = await minerActor.get_remaining_hashes();
        userMiners[index].remainingHashes = remaining;
      } catch (rhErr: any) {
        console.error(`Error fetching remaining hashes for miner ${principal.toText()}:`, rhErr);
      }

      try {
        const timeEst = await minerActor.get_time_remaining_estimate();
        userMiners[index].timeRemaining = timeEst;
      } catch (trErr: any) {
        console.error(`Error fetching time estimate for miner ${principal.toText()}:`, trErr);
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

  async function handleMinerAction(
    action: 'start' | 'stop' | 'claim' | 'set_speed' | 'set_chunk' | 'connect_token' | 'disconnect_token',
    principal: Principal,
    index: number,
    value?: any
  ) {
    const actionLabel = action.replace('_', ' ');
    const actionToastId = toastStore.info(`Processing ${actionLabel}...`, { duration: 0 });
    let successMessage = `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} successful!`;

    try {
      const minerActor = await auth.getActor(principal.toText(), canisterIDLs.miner);
      let result: { Ok?: any; Err?: string };

      switch (action) {
        case 'start':
          result = await minerActor.start_mining();
          break;
        case 'stop':
          result = await minerActor.stop_mining();
          break;
        case 'claim':
          result = await minerActor.claim_rewards();
          if (result && 'Ok' in result && result.Ok > 0n) {
             successMessage = `Successfully claimed ${formatRewards(result.Ok)}!`;
          } else if (result && 'Ok' in result && result.Ok === 0n) {
             successMessage = `Claim successful, but no rewards to claim.`;
          }
          break;
        case 'set_speed':
          const speed = parseInt(value, 10);
          if (isNaN(speed) || speed < 0 || speed > 100) {
            throw new Error("Invalid speed percentage (must be 0-100).");
          }
          result = await minerActor.set_mining_speed(speed);
          break;
        case 'set_chunk':
           const chunkSize = BigInt(value);
           if (chunkSize <= 0n) {
             throw new Error("Chunk size must be a positive number.");
           }
           result = await minerActor.set_chunk_size(chunkSize);
           break;
        case 'connect_token':
           if (!value || !(value instanceof Principal)) {
             throw new Error("Invalid token principal provided.");
           }
           result = await minerActor.connect_token(value);
           break;
        case 'disconnect_token':
           result = await minerActor.disconnect_token();
           break;
        default:
           throw new Error(`Unknown action: ${action}`);
      }

      if (result && 'Ok' in result) {
        toastStore.success(successMessage);
        fetchMinerDetails(principal, index);
      } else if (result && 'Err' in result) {
        throw new Error(result.Err);
      } else {
         throw new Error("Received unexpected or undefined result from miner action.");
      }

    } catch (error: any) {
      console.error(`Error performing ${actionLabel} on miner ${principal.toText()}:`, error);
      toastStore.error(`${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} failed: ${error.message || "Unknown error"}`);
    } finally {
      toastStore.dismiss(actionToastId);
    }
  }

   function openTokenModal(principal: Principal, index: number) {
     selectedMinerPrincipal = principal;
     selectedMinerIndex = index;
     isTokenModalOpen = true;
   }

   function handleTokenSelection(tokenPrincipal: Principal) {
     if (selectedMinerPrincipal && selectedMinerIndex !== -1) {
       handleMinerAction('connect_token', selectedMinerPrincipal, selectedMinerIndex, tokenPrincipal);
     }
     isTokenModalOpen = false;
   }

  function resetState() {
    launchpadActor = null;
    userMiners = [];
    isLoadingMinersList = true;
    listError = null;
    availableTokens = [];
    isLoadingTokens = false;
    tokensError = null;
  }

  function handleConnect() {
    walletProviderStore.open();
  }

  function formatRewards(amount: bigint | number | null | undefined): string {
    if (amount === null || amount === undefined) return '0.0000';
    const num = BigInt(amount);
    const decimals = 8;
    const integerPart = num / (10n ** BigInt(decimals));
    const fractionalPart = num % (10n ** BigInt(decimals));
    const fractionalString = fractionalPart.toString().padStart(decimals, '0').substring(0, 4);
    return `${integerPart}.${fractionalString}`;
  }

  function formatHashrate(rate: number | null | undefined): string {
    if (rate === null || rate === undefined) return '0 H/s';
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
    <Panel>
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
            <p class="text-lg font-medium text-kong-text-primary">{formatHashrate(cumulativeStats().totalHashrate)}</p>
          </div>
          <div>
            <p class="text-sm text-kong-text-secondary">Total Blocks Mined</p>
            <p class="text-lg font-medium text-kong-text-primary">{cumulativeStats().totalBlocks.toString()}</p>
          </div>
          <div>
            <p class="text-sm text-kong-text-secondary">Total Rewards Mined</p>
            <p class="text-lg font-medium text-kong-text-primary">{formatRewards(cumulativeStats().totalRewards)}</p>
          </div>
        </div>
      {/if}
    </Panel>

    <Panel>
      <h2 class="text-xl font-semibold mb-4 text-kong-text-primary">My Miners</h2>
      {#if isLoadingMinersList}
        <LoadingSpinner />
      {:else if listError}
        <p class="text-red-500">{listError}</p>
      {:else if userMiners.length === 0}
        <p class="text-kong-text-secondary">You haven't created any miners yet.</p>
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
                    <p class="text-kong-text-secondary truncate" title={miner.info?.current_token?.[0]?.toText() ?? ''}>Token:
                      {#if miner.infoError} <span class="text-red-500">-</span>
                      {:else if miner.info?.current_token?.[0]} {miner.info.current_token[0].toText().substring(0,5)}...
                      {:else}<span class="text-gray-400">None</span>{/if}
                    </p>
                    {#if miner.infoError}<p class="text-red-500 text-xs mt-1">{miner.infoError}</p>{/if}
                  </div>

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
                    <p class="text-kong-text-secondary">Hashes Remaining:
                      {#if miner.statsError} <span class="text-red-500">-</span>
                      {:else if miner.remainingHashes !== null} {miner.remainingHashes.toString()}
                      {:else}<span class="text-gray-400">N/A</span>{/if}
                    </p>
                    <p class="text-kong-text-secondary">Time Remaining:
                      {#if miner.statsError} <span class="text-red-500">-</span>
                      {:else if miner.timeRemaining} {miner.timeRemaining}
                      {:else}<span class="text-gray-400">N/A</span>{/if}
                    </p>
                    {#if miner.statsError}<p class="text-red-500 text-xs mt-1">{miner.statsError}</p>{/if}
                  </div>

                  <div class="flex flex-col space-y-2 md:col-span-2 lg:col-span-1 lg:items-end">
                    <div class="flex space-x-2">
                      {#if miner.info && !miner.info.is_mining}
                        <ButtonV2 label="Start" size="sm" theme="success" on:click={() => handleMinerAction('start', miner.principal, index)} disabled={!!miner.infoError} />
                      {/if}
                      {#if miner.info && miner.info.is_mining}
                        <ButtonV2 label="Stop" size="sm" theme="warning" on:click={() => handleMinerAction('stop', miner.principal, index)} disabled={!!miner.infoError} />
                      {/if}
                      <ButtonV2 label="Claim" size="sm" theme="primary" on:click={() => handleMinerAction('claim', miner.principal, index)} disabled={!!miner.statsError || (miner.stats && miner.stats.total_rewards === 0n)} />
                    </div>
                    <div class="mt-4 space-y-3">
                       {#if minerInputs[miner.principal.toText()]}
                         <div>
                           <label for={`chunk-size-${index}`} class="block text-xs font-medium text-kong-text-secondary mb-1">Chunk Size</label>
                           <div class="flex items-center space-x-2">
                             <input
                               id={`chunk-size-${index}`}
                               type="number"
                               placeholder={`Current: ${miner.info?.chunk_size ?? 'N/A'}`}
                               bind:value={minerInputs[miner.principal.toText()].chunkSize}
                               class="input input-sm input-bordered w-full max-w-xs"
                               disabled={!!miner.infoError}
                             />
                             <ButtonV2 label="Set" size="sm" theme="secondary" on:click={() => handleMinerAction('set_chunk', miner.principal, index, minerInputs[miner.principal.toText()].chunkSize)} disabled={!minerInputs[miner.principal.toText()].chunkSize || !!miner.infoError} />
                           </div>
                         </div>
                         <div>
                            <label for={`speed-${index}`} class="block text-xs font-medium text-kong-text-secondary mb-1">Speed (%)</label>
                            <div class="flex items-center space-x-2">
                              <input
                                id={`speed-${index}`}
                                type="number"
                                placeholder={`Current: ${miner.info?.speed_percentage ?? 'N/A'}`}
                                bind:value={minerInputs[miner.principal.toText()].speed}
                                min="0" max="100"
                                class="input input-sm input-bordered w-full max-w-xs"
                                disabled={!!miner.infoError}
                              />
                             <ButtonV2 label="Set" size="sm" theme="secondary" on:click={() => handleMinerAction('set_speed', miner.principal, index, minerInputs[miner.principal.toText()].speed)} disabled={!minerInputs[miner.principal.toText()].speed || !!miner.infoError} />
                           </div>
                         </div>
                       {/if}
                       <div class="flex items-center space-x-2 pt-1">
                          {#if miner.info?.current_token?.[0]}
                            <ButtonV2 label="Disconnect Token" size="sm" theme="error" on:click={() => handleMinerAction('disconnect_token', miner.principal, index)} disabled={!!miner.infoError} />
                          {:else}
                            <ButtonV2 label="Connect Token" size="sm" theme="accent-blue" on:click={() => openTokenModal(miner.principal, index)} disabled={!!miner.infoError || isLoadingTokens || availableTokens.length === 0} />
                          {/if}
                       </div>
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

<Modal isOpen={isTokenModalOpen} on:close={() => isTokenModalOpen = false} title="Select PoW Token">
  {#if isLoadingTokens}
    <LoadingSpinner />
  {:else if tokensError}
    <p class="text-red-500">{tokensError}</p>
  {:else if availableTokens.length === 0}
    <p class="text-kong-text-secondary">No PoW tokens found on the launchpad.</p>
  {:else}
    <div class="space-y-2 max-h-60 overflow-y-auto">
      {#each availableTokens as token (token.canister_id.toText())}
        <button
          class="w-full text-left p-2 rounded hover:bg-kong-bg-secondary focus:outline-none focus:ring-1 focus:ring-kong-primary"
          on:click={() => handleTokenSelection(token.canister_id)}
        >
          <p class="font-medium">{token.name} ({token.ticker})</p>
          <p class="text-xs text-kong-text-secondary truncate">{token.canister_id.toText()}</p>
        </button>
      {/each}
    </div>
  {/if}
  <div class="mt-4 flex justify-end">
      <ButtonV2 label="Cancel" theme="muted" on:click={() => isTokenModalOpen = false} />
  </div>
</Modal>

<style>
  .input {
     @apply block w-full px-3 py-1.5 text-base font-normal text-kong-text-primary bg-kong-bg-light bg-clip-padding border border-solid border-kong-border rounded transition ease-in-out m-0 focus:text-kong-text-primary focus:bg-kong-bg-dark focus:border-kong-primary focus:outline-none;
  }
  .input-sm {
      @apply py-1 text-sm;
  }
  .input-bordered {
      @apply border border-kong-border;
  }
</style>
