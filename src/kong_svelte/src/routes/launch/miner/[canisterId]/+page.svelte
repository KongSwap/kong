<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { auth } from '$lib/services/auth';
  import { idlFactory } from '../../../../../../../src/declarations/miner/miner.did.js';
  import Panel from '$lib/components/common/Panel.svelte';
  import { toastStore } from '$lib/stores/toastStore';
  import { goto } from '$app/navigation';
  import { formatDate } from '$lib/utils/dateUtils';
  import { 
    Cpu, Zap, Pickaxe, Activity, ArrowLeft, BarChart3, Bolt, 
    Clock, Target, Award, ChevronRight, Copy, Check, Hash, 
    Settings, Power, Link, Calendar
  } from 'lucide-svelte';
  
  // Miner data
  let canisterId = $page.params.canisterId;
  let minerInfo: any = null;
  let minerStats: any = null;
  let hashRateHistory: any[] = [];
  let isLoading = true;
  let error = null;
  let copiedId = '';
  
  // UI state
  let activeTab = 'overview';
  
  // Go back to miner list
  function goBack() {
    goto('/launch');
  }
  
  // Helper functions
  function getMinerTypeDisplay(type) {
    if (!type) return "Unknown";
    if (type.Premium) return "Premium";
    if (type.Normal) return "Normal";
    if (type.Lite) return "Lite";
    return "Unknown";
  }
  
  function getMinerTypeGradient(type) {
    if (!type) return "from-gray-600 to-slate-600";
    if (type.Premium) return "from-yellow-600 to-orange-600";
    if (type.Normal) return "from-blue-600 to-cyan-600";
    if (type.Lite) return "from-green-600 to-teal-600";
    return "from-gray-600 to-slate-600";
  }
  
  function getMinerTypeColor(type) {
    if (!type) return "text-gray-400";
    if (type.Premium) return "text-yellow-400";
    if (type.Normal) return "text-blue-400";
    if (type.Lite) return "text-green-400";
    return "text-gray-400";
  }
  
  function formatHashRate(hashRate) {
    if (!hashRate) return "0 H/s";
    if (hashRate > 1000000) {
      return `${(hashRate / 1000000).toFixed(2)} MH/s`;
    } else if (hashRate > 1000) {
      return `${(hashRate / 1000).toFixed(2)} KH/s`;
    }
    return `${hashRate.toFixed(2)} H/s`;
  }

  function formatLargeNumber(num) {
    if (!num) return "0";
    if (num > 1000000000) {
      return `${(num / 1000000000).toFixed(2)}B`;
    } else if (num > 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num > 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toString();
  }
  
  // Calculate mining efficiency based on speed setting and hash rate
  function calculateEfficiency(speedPercentage, hashRate) {
    if (!speedPercentage || !hashRate) return 0;
    
    // This is a simplified calculation - you might want to adjust based on your actual metrics
    const baselineHashRate = {
      Premium: 1000,
      Normal: 500,
      Lite: 200
    };
    
    const minerType = getMinerTypeDisplay(minerInfo?.miner_type);
    const baseline = baselineHashRate[minerType] || 500;
    const expectedRate = baseline * (speedPercentage / 100);
    
    return Math.min(100, Math.round((hashRate / expectedRate) * 100));
  }
  
  // Copy to clipboard
  async function copyToClipboard(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      copiedId = text;
      toastStore.success(`Copied ${label} to clipboard`);
      setTimeout(() => {
        copiedId = '';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toastStore.error('Failed to copy to clipboard');
    }
  }
  
  // Calculate uptime percentage
  function calculateUptime() {
    if (!minerStats || !minerStats.start_time) return "N/A";
    
    const startTime = Number(minerStats.start_time) / 1000000; // Convert to milliseconds
    const now = Date.now();
    const totalTime = now - startTime;
    
    // This is a placeholder - in a real app, you'd track actual mining time
    // For now, let's assume the miner has been active 80% of the time since start
    const estimatedUptime = minerInfo.is_mining ? 80 : 0;
    
    return `${estimatedUptime}%`;
  }
  
  // Generate mock hash rate history for visualization
  function generateHashRateHistory() {
    if (!minerStats || !minerStats.last_hash_rate) return [];
    
    const baseRate = minerStats.last_hash_rate;
    const history = [];
    
    // Generate 24 data points with some random variation
    for (let i = 0; i < 24; i++) {
      const variation = 0.8 + (Math.random() * 0.4); // 80% to 120% of base rate
      const timestamp = Date.now() - (i * 3600 * 1000); // Hourly points going back
      
      history.push({
        timestamp,
        hashRate: baseRate * variation
      });
    }
    
    return history.reverse();
  }
  
  // Load miner data
  async function loadMinerData() {
    isLoading = true;
    error = null;
    
    try {
      // Create actor using auth service with anon option
      const actor = auth.getActor(canisterId, idlFactory, { anon: true });
      
      // Fetch data in parallel
      const [infoResult, statsResult] = await Promise.all([
        actor.get_info().catch(err => ({ Err: `Error fetching miner info: ${err}` })),
        actor.get_mining_stats().catch(err => ({ Err: `Error fetching mining stats: ${err}` }))
      ]);
      
      // Process miner info
      if (infoResult.Ok) {
        // Handle the case where miner_type is missing in the response
        const rawMinerInfo = infoResult.Ok;
        // Default to Normal type if miner_type is missing
        minerInfo = {
          ...rawMinerInfo,
          miner_type: rawMinerInfo.miner_type || { Normal: null }
        };
        console.log('Miner info:', minerInfo);
      } else if (infoResult.Err) {
        error = `Error fetching miner info: ${infoResult.Err}`;
        toastStore.error(error);
      }
      
      // Process mining stats
      if (statsResult && statsResult.length > 0) {
        minerStats = statsResult[0];
        console.log('Miner stats:', minerStats);
        
        // Generate hash rate history for visualization
        hashRateHistory = generateHashRateHistory();
      } else {
        console.warn('No mining stats available');
      }
      
      // If we don't have miner info, show error
      if (!minerInfo) {
        error = "Could not load miner information";
        toastStore.error(error);
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
    <!-- Hero Section with Miner Status -->
    <div class="relative overflow-hidden bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-2xl mb-6">
      <div class="absolute inset-0 bg-pattern opacity-5"></div>
      
      <!-- Animated particles -->
      <div class="absolute inset-0 overflow-hidden">
        {#each Array(8) as _, i}
          <div class="hero-particle" style="--delay: {i * 1.5}s; --size: {5 + i * 3}px;"></div>
        {/each}
      </div>
      
      <div class="relative z-10 p-6 md:p-8">
        <div class="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <!-- Miner Icon with Status Ring -->
          <div class="relative w-28 h-28 flex-shrink-0">
            <div class={`flex items-center justify-center w-full h-full rounded-full bg-gradient-to-r ${getMinerTypeGradient(minerInfo.miner_type)} text-white shadow-glow`}>
              <Pickaxe size={48} class={minerInfo.is_mining ? 'animate-pulse' : ''} />
            </div>
            
            <!-- Status ring -->
            <svg class="absolute inset-0 w-28 h-28 -rotate-90">
              <circle 
                cx="56" 
                cy="56" 
                r="54" 
                fill="none" 
                stroke="rgba(16, 185, 129, 0.2)" 
                stroke-width="3"
              />
              <circle 
                cx="56" 
                cy="56" 
                r="54" 
                fill="none" 
                stroke={minerInfo.is_mining ? "url(#activeGradient)" : "url(#inactiveGradient)"} 
                stroke-width="3"
                stroke-dasharray="339.3"
                stroke-dashoffset={minerInfo.is_mining ? 0 : 339.3 * 0.7}
                class="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#10b981" />
                  <stop offset="100%" stop-color="#3b82f6" />
                </linearGradient>
                <linearGradient id="inactiveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#ef4444" />
                  <stop offset="100%" stop-color="#f97316" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          
          <!-- Miner Info -->
          <div class="flex-grow text-center md:text-left">
            <h1 class="text-3xl font-bold mb-1">
              {getMinerTypeDisplay(minerInfo.miner_type)} Miner
              <span class={`ml-2 px-3 py-1 text-sm rounded-full ${minerInfo.is_mining ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {minerInfo.is_mining ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </h1>
            <p class="text-xl font-medium text-white/70 mb-3 flex items-center gap-2">
              <span class="font-mono">
                {canisterId.substring(0, 15)}...
              </span>
              <button 
                class="p-1 hover:bg-black/30 rounded transition-colors"
                on:click={() => copyToClipboard(canisterId, 'Miner ID')}
              >
                {#if copiedId === canisterId}
                  <Check size={14} class="text-green-400" />
                {:else}
                  <Copy size={14} />
                {/if}
              </button>
            </p>
            
            <!-- Mining Progress Bar -->
            {#if minerStats && minerInfo.is_mining}
              <div class="mb-4">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-sm text-white/70">Mining Efficiency</span>
                  <span class="text-sm font-bold text-blue-400">
                    {calculateEfficiency(minerInfo.speed_percentage, minerStats.last_hash_rate)}%
                  </span>
                </div>
                <div class="h-2 bg-black/30 rounded-full overflow-hidden">
                  <div 
                    class="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                    style="width: {calculateEfficiency(minerInfo.speed_percentage, minerStats.last_hash_rate)}%;"
                  ></div>
                </div>
              </div>
            {/if}
            
            <div class="flex flex-wrap gap-4 justify-center md:justify-start">
              <div class="bg-black/30 px-4 py-2 rounded-lg">
                <p class="text-sm text-white/60 flex items-center gap-1">
                  <Settings size={14} class="text-blue-400" /> Speed Setting
                </p>
                <p class="font-bold">
                  {minerInfo.speed_percentage}%
                </p>
              </div>
              
              <div class="bg-black/30 px-4 py-2 rounded-lg">
                <p class="text-sm text-white/60 flex items-center gap-1">
                  <Power size={14} class="text-green-400" /> Status
                </p>
                <p class="font-bold" class:text-green-400={minerInfo.is_mining} class:text-red-400={!minerInfo.is_mining}>
                  {minerInfo.is_mining ? 'Mining' : 'Idle'}
                </p>
              </div>
              
              {#if minerStats && minerStats.last_hash_rate}
                <div class="bg-black/30 px-4 py-2 rounded-lg">
                  <p class="text-sm text-white/60 flex items-center gap-1">
                    <Bolt size={14} class="text-yellow-400" /> Hash Rate
                  </p>
                  <p class="font-bold">
                    {formatHashRate(minerStats.last_hash_rate)}
                  </p>
                </div>
              {/if}
              
              {#if minerInfo.current_token && minerInfo.current_token.length > 0}
                <div class="bg-black/30 px-4 py-2 rounded-lg">
                  <p class="text-sm text-white/60 flex items-center gap-1">
                    <Link size={14} class="text-purple-400" /> Token
                  </p>
                  <a 
                    href={`/launch/token/${minerInfo.current_token[0].toString()}`}
                    class="font-bold hover:text-blue-400 transition-colors"
                  >
                    {minerInfo.current_token[0].toString().substring(0, 10)}...
                  </a>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Navigation Tabs -->
    <div class="flex overflow-x-auto mb-6 bg-black/20 rounded-xl p-1">
      <button 
        class={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-blue-900/30 text-blue-400' : 'hover:bg-black/20'}`}
        on:click={() => activeTab = 'overview'}
      >
        Overview
      </button>
      <button 
        class={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'stats' ? 'bg-blue-900/30 text-blue-400' : 'hover:bg-black/20'}`}
        on:click={() => activeTab = 'stats'}
      >
        Statistics
      </button>
      <button 
        class={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-blue-900/30 text-blue-400' : 'hover:bg-black/20'}`}
        on:click={() => activeTab = 'history'}
      >
        Performance
      </button>
    </div>
    
    <!-- Tab Content -->
    {#if activeTab === 'overview'}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Miner Details -->
        <Panel className="lg:col-span-3">
          <h3 class="text-xl font-bold mb-4">Miner Details</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
                <Cpu size={14} class="text-blue-400" /> Miner Canister ID
              </p>
              <div class="flex items-center gap-2">
                <p class="font-mono text-sm break-all">
                  {canisterId}
                </p>
                <button 
                  class="p-1 hover:bg-black/30 rounded transition-colors"
                  on:click={() => copyToClipboard(canisterId, 'Miner ID')}
                >
                  {#if copiedId === canisterId}
                    <Check size={14} class="text-green-400" />
                  {:else}
                    <Copy size={14} />
                  {/if}
                </button>
              </div>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
                <Activity size={14} class="text-yellow-400" /> Owner Principal
              </p>
              <div class="flex items-center gap-2">
                <p class="font-mono text-sm break-all">
                  {minerInfo.owner}
                </p>
                <button 
                  class="p-1 hover:bg-black/30 rounded transition-colors"
                  on:click={() => copyToClipboard(minerInfo.owner, 'Owner ID')}
                >
                  {#if copiedId === minerInfo.owner}
                    <Check size={14} class="text-green-400" />
                  {:else}
                    <Copy size={14} />
                  {/if}
                </button>
              </div>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
                <Award size={14} class={getMinerTypeColor(minerInfo.miner_type)} /> Miner Type
              </p>
              <p class="font-bold">
                {getMinerTypeDisplay(minerInfo.miner_type)}
              </p>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
                <Settings size={14} class="text-blue-400" /> Chunks Per Refresh
              </p>
              <p class="font-bold">
                {minerInfo.chunks_per_refresh.toString()}
              </p>
            </div>
          </div>
        </Panel>
        
        <!-- Connected Token -->
        <Panel className="lg:col-span-3">
          <h3 class="text-xl font-bold mb-4">Connected Token</h3>
          
          {#if minerInfo.current_token && minerInfo.current_token.length > 0}
            <div class="bg-black/20 p-4 rounded-lg">
              <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
                    <Link size={14} class="text-purple-400" /> Token Canister ID
                  </p>
                  <p class="font-mono text-sm break-all">
                    {minerInfo.current_token[0].toString()}
                  </p>
                </div>
                <a 
                  href={`/launch/token/${minerInfo.current_token[0].toString()}`}
                  class="px-4 py-2 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded-lg transition-colors flex items-center gap-2"
                >
                  View Token <ChevronRight size={14} />
                </a>
              </div>
            </div>
          {:else}
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-center text-white/70 py-4">
                No token currently connected to this miner
              </p>
            </div>
          {/if}
        </Panel>
        
        <!-- Mining Stats Summary -->
        {#if minerStats}
          <Panel className="lg:col-span-3">
            <h3 class="text-xl font-bold mb-4">Mining Summary</h3>
            
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
                  <Hash size={14} class="text-purple-400" /> Total Hashes
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
          </Panel>
        {/if}
      </div>
    {:else if activeTab === 'stats'}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Detailed Stats -->
        {#if minerStats}
          <Panel className="lg:col-span-3">
            <h3 class="text-xl font-bold mb-4">Detailed Statistics</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70 flex items-center gap-1">
                  <Calendar size={14} class="text-blue-400" /> Start Time
                </p>
                <p class="font-bold">
                  {formatDate(new Date(Number(minerStats.start_time) / 1000000))}
                </p>
              </div>
              
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70 flex items-center gap-1">
                  <Clock size={14} class="text-green-400" /> Uptime
                </p>
                <p class="font-bold">
                  {calculateUptime()}
                </p>
              </div>
              
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70 flex items-center gap-1">
                  <Hash size={14} class="text-purple-400" /> Chunks Since Refresh
                </p>
                <p class="font-bold">
                  {minerStats.chunks_since_refresh.toString()}
                </p>
              </div>
              
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70 flex items-center gap-1">
                  <Bolt size={14} class="text-yellow-400" /> Hash Rate
                </p>
                <p class="font-bold">
                  {formatHashRate(minerStats.last_hash_rate)}
                </p>
              </div>
            </div>
            
            <!-- Mining Efficiency -->
            <div class="mt-6 bg-black/20 p-4 rounded-lg">
              <h4 class="font-bold mb-2">Mining Efficiency</h4>
              <div class="h-8 bg-black/30 rounded-lg overflow-hidden relative">
                <div 
                  class="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-out"
                  style="width: {calculateEfficiency(minerInfo.speed_percentage, minerStats.last_hash_rate)}%;"
                ></div>
                <div class="absolute inset-0 flex items-center justify-center text-white font-bold">
                  {calculateEfficiency(minerInfo.speed_percentage, minerStats.last_hash_rate)}% Efficiency
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p class="text-sm text-white/70">Speed Setting</p>
                  <p class="font-bold">
                    {minerInfo.speed_percentage}%
                  </p>
                </div>
                <div>
                  <p class="text-sm text-white/70">Status</p>
                  <p class="font-bold" class:text-green-400={minerInfo.is_mining} class:text-red-400={!minerInfo.is_mining}>
                    {minerInfo.is_mining ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </div>
          </Panel>
          
          <!-- Rewards Analysis -->
          <Panel className="lg:col-span-3">
            <h3 class="text-xl font-bold mb-4">Rewards Analysis</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70">Total Rewards</p>
                <p class="font-bold text-xl">
                  {formatLargeNumber(Number(minerStats.total_rewards))}
                </p>
              </div>
              
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70">Blocks Mined</p>
                <p class="font-bold text-xl">
                  {minerStats.blocks_mined.toString()}
                </p>
              </div>
              
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70">Average Reward per Block</p>
                <p class="font-bold text-xl">
                  {Number(minerStats.blocks_mined) > 0 
                    ? formatLargeNumber(Number(minerStats.total_rewards) / Number(minerStats.blocks_mined)) 
                    : '0'}
                </p>
              </div>
            </div>
          </Panel>
        {/if}
      </div>
    {:else if activeTab === 'history'}
      <Panel>
        <h3 class="text-xl font-bold mb-4">Performance History</h3>
        
        {#if hashRateHistory && hashRateHistory.length > 0}
          <!-- Hash Rate Chart -->
          <div class="bg-black/20 p-4 rounded-lg mb-6">
            <h4 class="font-bold mb-4">Hash Rate Over Time</h4>
            <div class="h-64 relative">
              <!-- Chart background -->
              <div class="absolute inset-0 grid grid-cols-6 grid-rows-4">
                {#each Array(24) as _, i}
                  <div class="border-t border-l border-white/5"></div>
                {/each}
              </div>
              
              <!-- Chart line -->
              <svg class="absolute inset-0 h-full w-full">
                <polyline 
                  points={hashRateHistory.map((point, i) => {
                    const x = (i / (hashRateHistory.length - 1)) * 100;
                    const maxRate = Math.max(...hashRateHistory.map(p => p.hashRate));
                    const y = 100 - ((point.hashRate / maxRate) * 90);
                    return `${x}% ${y}%`;
                  }).join(' ')}
                  fill="none"
                  stroke="url(#chartGradient)"
                  stroke-width="2"
                  class="drop-shadow-md"
                />
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#3b82f6" />
                    <stop offset="100%" stop-color="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              
              <!-- Data points -->
              {#each hashRateHistory as point, i}
                {@const x = (i / (hashRateHistory.length - 1)) * 100}
                {@const maxRate = Math.max(...hashRateHistory.map(p => p.hashRate))}
                {@const y = 100 - ((point.hashRate / maxRate) * 90)}
                <div 
                  class="absolute w-2 h-2 bg-blue-400 rounded-full transform -translate-x-1 -translate-y-1"
                  style="left: {x}%; top: {y}%;"
                ></div>
              {/each}
              
              <!-- Y-axis labels -->
              <div class="absolute left-0 inset-y-0 flex flex-col justify-between text-xs text-white/50 py-2">
                <span>{formatHashRate(Math.max(...hashRateHistory.map(p => p.hashRate)))}</span>
                <span>{formatHashRate(Math.max(...hashRateHistory.map(p => p.hashRate)) / 2)}</span>
                <span>0 H/s</span>
              </div>
              
              <!-- X-axis labels -->
              <div class="absolute bottom-0 inset-x-0 flex justify-between text-xs text-white/50 px-8">
                <span>-24h</span>
                <span>-12h</span>
                <span>Now</span>
              </div>
            </div>
          </div>
          
          <!-- Performance Metrics -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70">Current Hash Rate</p>
              <p class="font-bold text-xl">
                {formatHashRate(minerStats.last_hash_rate)}
              </p>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70">Average Hash Rate</p>
              <p class="font-bold text-xl">
                {formatHashRate(hashRateHistory.reduce((sum, point) => sum + point.hashRate, 0) / hashRateHistory.length)}
              </p>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70">Peak Hash Rate</p>
              <p class="font-bold text-xl">
                {formatHashRate(Math.max(...hashRateHistory.map(p => p.hashRate)))}
              </p>
            </div>
          </div>
        {:else}
          <div class="bg-black/20 p-4 rounded-lg">
            <p class="text-center text-white/70 py-4">
              No performance history available for this miner
            </p>
          </div>
        {/if}
      </Panel>
    {/if}
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

<style>
  .bg-pattern {
    background-image: 
      radial-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
      radial-gradient(rgba(59, 130, 246, 0.05) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: 0 0, 10px 10px;
  }
  
  .hero-particle {
    position: absolute;
    width: var(--size, 5px);
    height: var(--size, 5px);
    background: radial-gradient(circle, rgba(59, 130, 246, 0.7) 0%, rgba(59, 130, 246, 0) 70%);
    border-radius: 50%;
    opacity: 0.5;
    animation: float 15s ease-in-out infinite;
    animation-delay: var(--delay, 0s);
  }
  
  .hero-particle:nth-child(1) { top: 20%; left: 10%; }
  .hero-particle:nth-child(2) { top: 60%; left: 80%; }
  .hero-particle:nth-child(3) { top: 40%; left: 40%; }
  .hero-particle:nth-child(4) { top: 80%; left: 30%; }
  .hero-particle:nth-child(5) { top: 30%; left: 70%; }
  .hero-particle:nth-child(6) { top: 70%; left: 20%; }
  .hero-particle:nth-child(7) { top: 50%; left: 60%; }
  .hero-particle:nth-child(8) { top: 10%; left: 50%; }
  
  @keyframes float {
    0%, 100% { transform: translateY(0) translateX(0); }
    25% { transform: translateY(-20px) translateX(10px); }
    50% { transform: translateY(-10px) translateX(20px); }
    75% { transform: translateY(-30px) translateX(-10px); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
  }
</style>