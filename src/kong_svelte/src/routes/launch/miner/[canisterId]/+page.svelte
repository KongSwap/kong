<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { auth } from '$lib/services/auth';
  import { idlFactory } from '../../../../../../../src/declarations/miner/miner.did.js';
  import Panel from '$lib/components/common/Panel.svelte';
  import { toastStore } from '$lib/stores/toastStore';
  import { goto } from '$app/navigation';
  import { formatDate } from '$lib/utils/dateUtils';
  import { Cpu, Zap, Pickaxe, Activity, ArrowLeft, BarChart3, Bolt } from 'lucide-svelte';
  
  // Miner data
  let canisterId = $page.params.canisterId;
  let minerInfo: any = null;
  let minerStats: any = null;
  let isLoading = true;
  let error = null;
  
  // Go back to miner list
  function goBack() {
    goto('/launch');
  }
  
  // Helper functions
  function getMinerTypeDisplay(type) {
    if (type.Premium) return "Premium";
    if (type.Normal) return "Normal";
    if (type.Lite) return "Lite";
    return "Unknown";
  }
  
  function getMinerTypeGradient(type) {
    if (type.Premium) return "from-yellow-600 to-orange-600";
    if (type.Normal) return "from-blue-600 to-cyan-600";
    if (type.Lite) return "from-green-600 to-teal-600";
    return "from-gray-600 to-slate-600";
  }
  
  function formatHashRate(hashRate) {
    if (hashRate > 1000000) {
      return `${(hashRate / 1000000).toFixed(2)} MH/s`;
    } else if (hashRate > 1000) {
      return `${(hashRate / 1000).toFixed(2)} KH/s`;
    }
    return `${hashRate.toFixed(2)} H/s`;
  }

  function formatLargeNumber(num) {
    if (num > 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num > 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toString();
  }
  
  // Load miner data
  async function loadMinerData() {
    isLoading = true;
    error = null;
    
    try {
      // Create actor using auth service with anon option
      const actor = auth.getActor(canisterId, idlFactory, { anon: true });
      
      // Get miner info
      const infoResult = await actor.get_info();
      if (infoResult.Ok) {
        minerInfo = infoResult.Ok;
        console.log('Miner info:', minerInfo);
      } else if (infoResult.Err) {
        error = `Error fetching miner info: ${infoResult.Err}`;
        toastStore.error(error);
      }
      
      // Get mining stats
      const statsResult = await actor.get_mining_stats();
      if (statsResult && statsResult.length > 0) {
        minerStats = statsResult[0];
        console.log('Miner stats:', minerStats);
      } else {
        console.warn('No mining stats available');
      }
    } catch (err) {
      console.error('Error loading miner data:', err);
      error = `Failed to load miner data: ${err.message || err}`;
      toastStore.error(error);
    } finally {
      isLoading = false;
    }
  }
  
  // Load data on mount
  onMount(() => {
    loadMinerData();
  });
</script>

<div class="container mx-auto p-4 max-w-6xl">
  <!-- Back Button -->
  <div class="mb-4">
    <button 
      class="flex items-center gap-2 px-4 py-2 bg-black/30 hover:bg-black/50 rounded-lg transition-colors"
      on:click={goBack}
    >
      <ArrowLeft size={16} />
      <span>Back to Miners</span>
    </button>
  </div>

  <h1 class="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
    Miner Details
  </h1>
  
  {#if isLoading}
    <div class="flex justify-center items-center p-12">
      <div class="inline-block h-12 w-12 border-4 border-t-blue-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full animate-spin"></div>
    </div>
  {:else if error}
    <Panel>
      <div class="p-8 text-center">
        <p class="text-red-500 font-bold mb-4">{error}</p>
        <button 
          class="bg-kong-primary-600 hover:bg-kong-primary-700 text-white py-2 px-6 rounded-lg"
          on:click={loadMinerData}
        >
          Try Again
        </button>
      </div>
    </Panel>
  {:else if minerInfo}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Miner Overview -->
      <Panel className="lg:col-span-3">
        <div class="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <!-- Miner Icon -->
          <div class="w-24 h-24 flex-shrink-0">
            <div class={`flex items-center justify-center w-full h-full rounded-full bg-gradient-to-r ${getMinerTypeGradient(minerInfo.miner_type)} text-white shadow-glow`}>
              <Pickaxe size={48} class={minerInfo.is_mining ? 'animate-pulse' : ''} />
            </div>
          </div>
          
          <!-- Miner Info -->
          <div class="flex-grow text-center md:text-left">
            <h2 class="text-3xl font-bold mb-1">
              {getMinerTypeDisplay(minerInfo.miner_type)} Miner
              <span class={`ml-2 px-3 py-1 text-sm rounded-full ${minerInfo.is_mining ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {minerInfo.is_mining ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </h2>
            <p class="text-xl font-medium text-white/70 mb-3">
              ID: {canisterId}
            </p>
            
            <div class="flex flex-wrap gap-4 justify-center md:justify-start">
              <div class="bg-black/30 px-4 py-2 rounded-lg">
                <p class="text-sm text-white/60">Speed Setting</p>
                <p class="font-bold">
                  {minerInfo.speed_percentage}%
                </p>
              </div>
              
              {#if minerInfo.current_token && minerInfo.current_token.length > 0}
                <div class="bg-black/30 px-4 py-2 rounded-lg">
                  <p class="text-sm text-white/60">Connected Token</p>
                  <p class="font-bold">
                    {minerInfo.current_token[0].toString()}
                  </p>
                </div>
              {:else}
                <div class="bg-black/30 px-4 py-2 rounded-lg">
                  <p class="text-sm text-white/60">Connected Token</p>
                  <p class="font-bold text-white/50 italic">
                    None
                  </p>
                </div>
              {/if}
              
              {#if minerInfo.is_mining && minerStats && minerStats.last_hash_rate}
                <div class="bg-black/30 px-4 py-2 rounded-lg">
                  <p class="text-sm text-white/60">Current Hash Rate</p>
                  <p class="font-bold text-green-400">
                    {formatHashRate(minerStats.last_hash_rate)}
                  </p>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </Panel>
      
      <!-- Canister ID -->
      <Panel className="lg:col-span-3">
        <h3 class="text-xl font-bold mb-4">Canister ID</h3>
        <div class="bg-black/20 p-4 rounded-lg">
          <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
            <Cpu size={14} class="text-blue-400" /> Miner Canister ID
          </p>
          <p class="font-mono text-sm break-all">
            {canisterId}
          </p>
        </div>
      </Panel>
      
      <!-- Mining Stats -->
      {#if minerStats}
        <Panel className="lg:col-span-3">
          <h3 class="text-xl font-bold mb-4">Mining Statistics</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1">
                <BarChart3 size={14} class="text-blue-400" /> Blocks Mined
              </p>
              <p class="font-bold text-xl">
                {minerStats.blocks_mined.toString()}
              </p>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1">
                <Cpu size={14} class="text-purple-400" /> Total Hashes
              </p>
              <p class="font-bold text-xl">
                {formatLargeNumber(Number(minerStats.total_hashes))}
              </p>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1">
                <Zap size={14} class="text-yellow-400" /> Total Rewards
              </p>
              <p class="font-bold text-xl">
                {formatLargeNumber(Number(minerStats.total_rewards))}
              </p>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1">
                <Bolt size={14} class="text-green-400" /> Current Hash Rate
              </p>
              <p class="font-bold text-xl">
                {formatHashRate(minerStats.last_hash_rate)}
              </p>
            </div>
          </div>
          
          {#if minerStats.last_mining_time_nanos}
            <div class="mt-6 bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70">Last Mining Time</p>
              <p class="font-bold">
                {formatDate(new Date(Number(minerStats.last_mining_time_nanos) / 1000000))}
              </p>
            </div>
          {/if}
        </Panel>
      {/if}
      
      <!-- Owner -->
      <Panel className="lg:col-span-3">
        <h3 class="text-xl font-bold mb-4">Owner Information</h3>
        <div class="bg-black/20 p-4 rounded-lg">
          <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
            <Activity size={14} class="text-yellow-400" /> Owner Principal
          </p>
          <p class="font-mono text-sm break-all">
            {minerInfo.owner}
          </p>
        </div>
      </Panel>
    </div>
  {:else}
    <Panel>
      <div class="p-8 text-center">
        <p class="text-lg mb-4">No miner information found</p>
        <button 
          class="bg-kong-primary-600 hover:bg-kong-primary-700 text-white py-2 px-6 rounded-lg"
          on:click={loadMinerData}
        >
          Refresh
        </button>
      </div>
    </Panel>
  {/if}
</div> 