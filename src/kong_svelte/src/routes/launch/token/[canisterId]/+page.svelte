<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { Principal } from '@dfinity/principal';
  import { auth } from '$lib/services/auth';
  import { idlFactory } from '../../../../../../../src/declarations/token_backend/token_backend.did.js';
  import Panel from '$lib/components/common/Panel.svelte';
  import { toastStore } from '$lib/stores/toastStore';
  import { formatBalance } from '$lib/utils/numberFormatUtils';
  import { formatDate } from '$lib/utils/dateUtils';
  import { 
    Flame, Rocket, ArrowLeft, Clock, Target, Award, Users, 
    Activity, BarChart3, Zap, ChevronRight, Copy, Check,
    Trophy, Bell, Info, Hash, Cpu, Layers
  } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  
  // Token info data
  let canisterId = $page.params.canisterId;
  let tokenInfo: any = null;
  let miningInfo: any = null;
  let metrics: any = null;
  let events: any[] = [];
  let miners: any[] = [];
  let minerLeaderboard: any[] = [];
  let blockTime: number = null;
  let isLoading = true;
  let error = null;
  
  // UI state
  let activeTab = 'overview';
  let copiedId = '';
  
  // Reset to overview tab if mining tab is selected (since we removed it)
  $: if (activeTab === 'mining') {
    activeTab = 'overview';
  }
  
  // Go back to token list
  function goBack() {
    goto('/launch');
  }
  
  // Format the block time
  function formatBlockTime(seconds) {
    if (!seconds) return "0s";
    
    if (seconds < 60) {
      return `${seconds.toFixed(2)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 
        ? `${minutes}m ${remainingSeconds.toFixed(0)}s` 
        : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 
        ? `${hours}h ${minutes}m` 
        : `${hours}h`;
    }
  }
  
  // Format circulation percentage
  function formatCirculationPercentage(circulating, total) {
    if (!circulating || !total || total === 0) return "0%";
    const percentage = (Number(circulating) / Number(total)) * 100;
    return percentage.toFixed(2) + "%";
  }
  
  // Format event type for display
  function formatEventType(event) {
    if (!event || !event.event_type) return null;
    
    const type = Object.keys(event.event_type)[0];
    const data = event.event_type[type];
    
    switch(type) {
      case 'DifficultyAdjustment':
        return {
          title: 'Difficulty Adjustment',
          icon: Target,
          color: 'text-blue-400',
          description: `Difficulty changed from ${data.old_difficulty} to ${data.new_difficulty}`,
          bgColor: 'bg-blue-900/20'
        };
      case 'RewardHalving':
        return {
          title: 'Reward Halving',
          icon: Flame,
          color: 'text-orange-400',
          description: `Block reward halved at height ${data.block_height}`,
          bgColor: 'bg-orange-900/20'
        };
      case 'BlockMined':
        return {
          title: 'Block Mined',
          icon: Cpu,
          color: 'text-green-400',
          description: `Miner ${data.miner.toString().substring(0, 10)}... received ${formatBalance(data.reward, tokenInfo?.decimals || 0)} ${tokenInfo?.ticker || ''}`,
          bgColor: 'bg-green-900/20'
        };
      case 'SystemAnnouncement':
        return {
          title: 'System Announcement',
          icon: Bell,
          color: 'text-purple-400',
          description: data.message,
          bgColor: 'bg-purple-900/20'
        };
      case 'MiningMilestone':
        return {
          title: 'Mining Milestone',
          icon: Award,
          color: 'text-yellow-400',
          description: `Miner reached ${data.blocks_mined} blocks mined`,
          bgColor: 'bg-yellow-900/20'
        };
      case 'LeaderboardUpdate':
        return {
          title: 'Leaderboard Update',
          icon: Trophy,
          color: 'text-green-400',
          description: `Miner ranked #${data.position} with ${data.total_mined} blocks`,
          bgColor: 'bg-green-900/20'
        };
      case 'VersionUpgrade':
        return {
          title: 'Version Upgrade',
          icon: Zap,
          color: 'text-indigo-400',
          description: `Upgraded to ${data.new_version}`,
          bgColor: 'bg-indigo-900/20'
        };
      default:
        return {
          title: type,
          icon: Info,
          color: 'text-gray-400',
          description: JSON.stringify(data),
          bgColor: 'bg-gray-900/20'
        };
    }
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
  
  // Load token data using anonymous agent
  async function loadTokenData() {
    isLoading = true;
    error = null;
    
    try {
      // Create an anonymous actor to interact with the token backend
      const actor = await auth.getActor(canisterId, idlFactory);
      
      // Make parallel calls to get all the data we need
      const [
        tokenInfoResult,
        miningInfoResult,
        metricsResult,
        eventsResult,
        minersResult,
        blockTimeResult,
        leaderboardResult
      ] = await Promise.all([
        actor.get_info(),
        actor.get_mining_info(),
        actor.get_metrics(),
        actor.get_recent_events_from_batches([]),
        actor.get_active_miners(),
        actor.get_average_block_time([]),
        actor.get_miner_leaderboard([])
      ]);
      
      // Process basic token info
      if (tokenInfoResult.Ok) {
        tokenInfo = tokenInfoResult.Ok;
        console.log('Token info:', tokenInfo);
      } else if (tokenInfoResult.Err) {
        console.warn(`Warning: ${tokenInfoResult.Err}`);
      }
      
      // Process mining info
      if (miningInfoResult.Ok) {
        miningInfo = miningInfoResult.Ok;
        console.log('Mining info:', miningInfo);
      } else if (miningInfoResult.Err) {
        console.warn(`Warning: ${miningInfoResult.Err}`);
      }
      
      // Process metrics
      if (metricsResult.Ok) {
        metrics = metricsResult.Ok;
        console.log('Metrics:', metrics);
      } else if (metricsResult.Err) {
        console.warn(`Warning: ${metricsResult.Err}`);
      }
      
      // Process events
      if (Array.isArray(eventsResult)) {
        events = eventsResult;
        console.log('Events:', events);
      } else if (eventsResult.Err) {
        console.warn(`Warning: ${eventsResult.Err}`);
      }
      
      // Process miners
      if (Array.isArray(minersResult)) {
        miners = minersResult;
        console.log('Miners:', miners);
      } else if (minersResult.Err) {
        console.warn(`Warning: ${minersResult.Err}`);
      }
      
      // Process block time
      if (blockTimeResult.Ok) {
        blockTime = blockTimeResult.Ok;
        console.log('Block time:', blockTime);
      } else if (blockTimeResult.Err) {
        console.warn(`Warning: ${blockTimeResult.Err}`);
      }
      
      // Process leaderboard
      if (Array.isArray(leaderboardResult)) {
        minerLeaderboard = leaderboardResult;
        console.log('Leaderboard:', minerLeaderboard);
      } else if (leaderboardResult.Err) {
        console.warn(`Warning: ${leaderboardResult.Err}`);
      }
      
      // If we don't have token info, show error
      if (!tokenInfo) {
        error = "Could not load token information";
        toastStore.error(error);
      }
    } catch (err) {
      console.error('Error loading token data:', err);
      error = `Failed to load token data: ${err.message || err}`;
      toastStore.error(error);
    } finally {
      isLoading = false;
    }
  }
  
  // Load data on mount
  onMount(() => {
    loadTokenData();
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
      <span>Back to Tokens</span>
    </button>
  </div>

  {#if isLoading}
    <div class="flex justify-center items-center p-12">
      <div class="inline-block h-12 w-12 border-4 border-t-green-500 border-r-transparent border-b-green-500 border-l-transparent rounded-full animate-spin"></div>
    </div>
  {:else if error}
    <Panel>
      <div class="p-8 text-center">
        <p class="text-red-500 font-bold mb-4">{error}</p>
        <button 
          class="bg-kong-primary-600 hover:bg-kong-primary-700 text-white py-2 px-6 rounded-lg"
          on:click={loadTokenData}
        >
          Try Again
        </button>
      </div>
    </Panel>
  {:else if tokenInfo}
    <!-- Hero Section with Mining Progress -->
    <div class="relative overflow-hidden bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-2xl mb-6">
      <div class="absolute inset-0 bg-pattern opacity-5"></div>
      
      <!-- Animated particles -->
      <div class="absolute inset-0 overflow-hidden">
        {#each Array(8) as _, i}
          <div class="hero-particle" style="--delay: {i * 1.5}s; --size: {5 + i * 3}px;"></div>
        {/each}
      </div>
      
      <div class="relative z-10 p-6 md:p-8">
        <div class="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <!-- Token Logo with Mining Progress Ring -->
          <div class="relative w-28 h-28 flex-shrink-0">
            {#if tokenInfo.logo && tokenInfo.logo.length > 0 && tokenInfo.logo[0]}
              <img 
                src={tokenInfo.logo[0]} 
                alt={tokenInfo.name} 
                class="w-full h-full object-cover rounded-full border-2 border-white/20"
                on:error={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = document.getElementById('logo-fallback');
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            {:else}
              <div id="logo-fallback" class="w-full h-full rounded-full bg-gradient-to-r from-green-600 to-blue-600 flex items-center justify-center text-4xl font-bold">
                {tokenInfo.ticker?.[0] || '?'}
              </div>
            {/if}
            
            <!-- Mining progress ring -->
            {#if metrics}
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
                  stroke="url(#progressGradient)" 
                  stroke-width="3"
                  stroke-dasharray="339.3"
                  stroke-dashoffset={339.3 - (339.3 * (Number(metrics.circulating_supply) / Number(tokenInfo.total_supply)))}
                  class="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#10b981" />
                    <stop offset="100%" stop-color="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
            {/if}
          </div>
          
          <!-- Token Info -->
          <div class="flex-grow text-center md:text-left">
            <h1 class="text-3xl font-bold mb-1">{tokenInfo.name}</h1>
            <p class="text-xl font-medium text-white/70 mb-3">
              ${tokenInfo.ticker}
              <span class="ml-2 px-2 py-0.5 bg-white/10 rounded text-sm">{tokenInfo.decimals} decimals</span>
            </p>
            
            <!-- Mining Progress Bar -->
            {#if metrics}
              <div class="mb-4">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-sm text-white/70">Mining Progress</span>
                  <span class="text-sm font-bold text-green-400">
                    {formatCirculationPercentage(metrics.circulating_supply, tokenInfo.total_supply)}
                  </span>
                </div>
                <div class="h-2 bg-black/30 rounded-full overflow-hidden">
                  <div 
                    class="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                    style="width: {formatCirculationPercentage(metrics.circulating_supply, tokenInfo.total_supply)};"
                  ></div>
                </div>
                <div class="flex justify-between text-xs text-white/60 mt-1">
                  <span>{formatBalance(metrics.circulating_supply, tokenInfo.decimals)} mined</span>
                  <span>{formatBalance(tokenInfo.total_supply, tokenInfo.decimals)} total</span>
                </div>
              </div>
            {/if}
            
            <div class="flex flex-wrap gap-4 justify-center md:justify-start">
              {#if miningInfo}
                <div class="bg-black/30 px-4 py-2 rounded-lg">
                  <p class="text-sm text-white/60 flex items-center gap-1">
                    <Flame size={14} class="text-orange-400" /> Block Reward
                  </p>
                  <p class="font-bold">
                    {formatBalance(miningInfo.current_block_reward, tokenInfo.decimals)} {tokenInfo.ticker}
                  </p>
                </div>
                
                <div class="bg-black/30 px-4 py-2 rounded-lg">
                  <p class="text-sm text-white/60 flex items-center gap-1">
                    <Clock size={14} class="text-blue-400" /> Block Time
                  </p>
                  <p class="font-bold flex items-center gap-1">
                    {blockTime ? formatBlockTime(blockTime) : 'N/A'}
                    {#if blockTime}
                      <span class="block-time-pulse" style="--pulse-speed: {Math.min(5, blockTime / 2)}s"></span>
                    {/if}
                  </p>
                </div>
                
                <div class="bg-black/30 px-4 py-2 rounded-lg">
                  <p class="text-sm text-white/60 flex items-center gap-1">
                    <Layers size={14} class="text-purple-400" /> Block Height
                  </p>
                  <p class="font-bold">
                    {miningInfo.current_height?.toLocaleString() || 'N/A'}
                  </p>
                </div>
                
                <div class="bg-black/30 px-4 py-2 rounded-lg">
                  <p class="text-sm text-white/60 flex items-center gap-1">
                    <Target size={14} class="text-green-400" /> Difficulty
                  </p>
                  <p class="font-bold">
                    {miningInfo.current_difficulty?.toLocaleString() || 'N/A'}
                  </p>
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
        class={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-green-900/30 text-green-400' : 'hover:bg-black/20'}`}
        on:click={() => activeTab = 'overview'}
      >
        Overview
      </button>
      {#if events && events.length > 0}
        <button 
          class={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'events' ? 'bg-green-900/30 text-green-400' : 'hover:bg-black/20'}`}
          on:click={() => activeTab = 'events'}
        >
          Events
        </button>
      {/if}
      {#if miners && miners.length > 0}
        <button 
          class={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'miners' ? 'bg-green-900/30 text-green-400' : 'hover:bg-black/20'}`}
          on:click={() => activeTab = 'miners'}
        >
          Miners
        </button>
      {/if}
    </div>
    
    <!-- Tab Content -->
    {#if activeTab === 'overview'}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Token Details -->
        <Panel className="lg:col-span-3">
          <h3 class="text-xl font-bold mb-4">Token Details</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
                <Rocket size={14} class="text-blue-400" /> Token Canister ID
              </p>
              <div class="flex items-center gap-2">
                <p class="font-mono text-sm break-all">
                  {canisterId}
                </p>
                <button 
                  class="p-1 hover:bg-black/30 rounded transition-colors"
                  on:click={() => copyToClipboard(canisterId, 'Token ID')}
                >
                  {#if copiedId === canisterId}
                    <Check size={14} class="text-green-400" />
                  {:else}
                    <Copy size={14} />
                  {/if}
                </button>
              </div>
            </div>
            
            {#if tokenInfo.ledger_id && tokenInfo.ledger_id.length > 0}
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
                  <Rocket size={14} class="text-blue-400" /> Ledger ID
                </p>
                <div class="flex items-center gap-2">
                  <p class="font-mono text-sm break-all">
                    {tokenInfo.ledger_id[0].toString()}
                  </p>
                  <button 
                    class="p-1 hover:bg-black/30 rounded transition-colors"
                    on:click={() => copyToClipboard(tokenInfo.ledger_id[0].toString(), 'Ledger ID')}
                  >
                    {#if copiedId === tokenInfo.ledger_id[0].toString()}
                      <Check size={14} class="text-green-400" />
                    {:else}
                      <Copy size={14} />
                    {/if}
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </Panel>
        
        <!-- Mining Information -->
        {#if miningInfo}
          <Panel className="lg:col-span-3">
            <h3 class="text-xl font-bold mb-4">Mining Information</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70">Current Height</p>
                <p class="font-bold text-xl">
                  {miningInfo.current_height?.toLocaleString() || 'N/A'}
                </p>
              </div>
              
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70">Block Reward</p>
                <p class="font-bold text-xl flex items-center gap-1">
                  {formatBalance(miningInfo.current_block_reward, tokenInfo.decimals)}
                  <span class="text-white/90">{tokenInfo.ticker}</span>
                  <Flame size={16} class="text-orange-400 animate-pulse" />
                </p>
              </div>
              
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70">Blocks to Halving</p>
                <p class="font-bold text-xl">
                  {miningInfo.next_halving_interval?.toLocaleString() || 'N/A'}
                </p>
              </div>
              
              <div class="bg-black/20 p-4 rounded-lg">
                <p class="text-sm text-white/70">Current Difficulty</p>
                <p class="font-bold text-xl">
                  {miningInfo.current_difficulty?.toLocaleString() || 'N/A'}
                </p>
              </div>
            </div>
            
            <!-- Mining Progress Visualization -->
            {#if metrics}
              <div class="mt-6 bg-black/20 p-4 rounded-lg">
                <h4 class="font-bold mb-2">Mining Progress</h4>
                <div class="h-8 bg-black/30 rounded-lg overflow-hidden relative">
                  <div 
                    class="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-1000 ease-out"
                    style="width: {formatCirculationPercentage(metrics.circulating_supply, tokenInfo.total_supply)};"
                  ></div>
                  <div class="absolute inset-0 flex items-center justify-center text-white font-bold">
                    {formatBalance(metrics.circulating_supply, tokenInfo.decimals)} / {formatBalance(tokenInfo.total_supply, tokenInfo.decimals)} {tokenInfo.ticker}
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p class="text-sm text-white/70">Circulating Supply</p>
                    <p class="font-bold">
                      {formatBalance(metrics.circulating_supply, tokenInfo.decimals)} {tokenInfo.ticker}
                    </p>
                  </div>
                  <div>
                    <p class="text-sm text-white/70">Mining Completion</p>
                    <p class="font-bold">
                      {formatCirculationPercentage(metrics.circulating_supply, tokenInfo.total_supply)}
                    </p>
                  </div>
                </div>
              </div>
            {/if}
            
            <!-- Block Time Information -->
            {#if blockTime}
              <div class="mt-4 bg-black/20 p-4 rounded-lg">
                <h4 class="font-bold mb-2">Block Time</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p class="text-sm text-white/70">Average Block Time</p>
                    <p class="font-bold flex items-center gap-2">
                      {formatBlockTime(blockTime)}
                      <span class="block-time-pulse" style="--pulse-speed: {Math.min(5, blockTime / 2)}s"></span>
                    </p>
                  </div>
                  <div>
                    <p class="text-sm text-white/70">Target Block Time</p>
                    <p class="font-bold">
                      {formatBlockTime(Number(miningInfo.block_time_target) / 1000000000)}
                    </p>
                  </div>
                  <div>
                    <p class="text-sm text-white/70">Performance</p>
                    <p class="font-bold" class:text-green-400={blockTime < Number(miningInfo.block_time_target) / 1000000000} class:text-yellow-400={blockTime >= Number(miningInfo.block_time_target) / 1000000000 && blockTime < Number(miningInfo.block_time_target) / 1000000000 * 1.5} class:text-red-400={blockTime >= Number(miningInfo.block_time_target) / 1000000000 * 1.5}>
                      {blockTime < Number(miningInfo.block_time_target) / 1000000000 ? 'Faster than target' : blockTime < Number(miningInfo.block_time_target) / 1000000000 * 1.5 ? 'Near target' : 'Slower than target'}
                    </p>
                  </div>
                </div>
              </div>
            {/if}
          </Panel>
        {/if}
        
        <!-- Token Economics -->
        <Panel className="lg:col-span-2">
          <h3 class="text-xl font-bold mb-4">Token Economics</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
                <Hash size={14} class="text-blue-400" /> Total Supply
              </p>
              <p class="font-bold">
                {formatBalance(tokenInfo.total_supply, tokenInfo.decimals)} {tokenInfo.ticker}
              </p>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
                <Zap size={14} class="text-blue-400" /> Transfer Fee
              </p>
              <p class="font-bold">
                {formatBalance(tokenInfo.transfer_fee, tokenInfo.decimals)} {tokenInfo.ticker}
              </p>
            </div>
          </div>
        </Panel>
        
        <!-- Recent Events -->
        {#if events && events.length > 0}
          <Panel className="lg:col-span-3">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">Recent Events</h3>
              <button 
                class="text-sm text-green-400 flex items-center gap-1"
                on:click={() => activeTab = 'events'}
              >
                View All <ChevronRight size={14} />
              </button>
            </div>
            
            <div class="space-y-2">
              {#each events.slice(0, 3) as event}
                {@const formattedEvent = formatEventType(event)}
                {#if formattedEvent}
                  <div class={`p-3 rounded-lg ${formattedEvent.bgColor}`}>
                    <div class="flex items-start gap-3">
                      <div class={`p-2 rounded-full bg-black/20 ${formattedEvent.color}`}>
                        <svelte:component this={formattedEvent.icon} size={16} />
                      </div>
                      <div>
                        <p class="font-bold">{formattedEvent.title}</p>
                        <p class="text-sm text-white/70">{formattedEvent.description}</p>
                        <p class="text-xs text-white/50 mt-1">
                          Block: {event.block_height.toLocaleString()} • {formatDate(new Date(Number(event.timestamp) * 1000))}
                        </p>
                      </div>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </Panel>
        {/if}
      </div>
    {:else if activeTab === 'events' && events && events.length > 0}
      <Panel>
        <h3 class="text-xl font-bold mb-4">Token Events</h3>
        <div class="space-y-2">
          {#each events as event}
            {@const formattedEvent = formatEventType(event)}
            {#if formattedEvent}
              <div class={`p-3 rounded-lg ${formattedEvent.bgColor}`}>
                <div class="flex items-start gap-3">
                  <div class={`p-2 rounded-full bg-black/20 ${formattedEvent.color}`}>
                    <svelte:component this={formattedEvent.icon} size={16} />
                  </div>
                  <div class="flex-grow">
                    <p class="font-bold">{formattedEvent.title}</p>
                    <p class="text-sm text-white/70">{formattedEvent.description}</p>
                    <p class="text-xs text-white/50 mt-1">
                      Block: {event.block_height.toLocaleString()} • {formatDate(new Date(Number(event.timestamp) * 1000))}
                    </p>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </Panel>
    {:else if activeTab === 'miners' && (miners.length > 0 || minerLeaderboard.length > 0)}
      <Panel>
        <h3 class="text-xl font-bold mb-4">Miners</h3>
        
        {#if minerLeaderboard && minerLeaderboard.length > 0}
          <div class="mb-6">
            <h4 class="font-bold text-lg mb-2">Leaderboard</h4>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="bg-black/20">
                    <th class="p-2 text-left">Rank</th>
                    <th class="p-2 text-left">Miner</th>
                    <th class="p-2 text-right">Blocks Mined</th>
                    <th class="p-2 text-right">Rewards</th>
                    <th class="p-2 text-right">Hashrate</th>
                  </tr>
                </thead>
                <tbody>
                  {#each minerLeaderboard as miner, i}
                    <tr class="border-b border-white/10 hover:bg-black/20 transition-colors">
                      <td class="p-2">#{i+1}</td>
                      <td class="p-2">
                        <a 
                          href={`/launch/miner/${miner.principal.toString()}`}
                          class="font-mono text-sm hover:text-green-400 transition-colors flex items-center gap-1"
                        >
                          {miner.principal.toString().substring(0, 20)}...
                          <ChevronRight size={12} class="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </td>
                      <td class="p-2 text-right">{miner.stats.blocks_mined.toLocaleString()}</td>
                      <td class="p-2 text-right">{formatBalance(miner.stats.total_rewards, tokenInfo.decimals)} {tokenInfo.ticker}</td>
                      <td class="p-2 text-right">{miner.stats.current_hashrate.toFixed(2)} H/s</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
        
        {#if miners && miners.length > 0}
          <div>
            <h4 class="font-bold text-lg mb-2">Active Miners: {miners.length}</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {#each miners.slice(0, 12) as miner}
                <a 
                  href={`/launch/miner/${miner.toString()}`} 
                  class="bg-black/20 p-2 rounded-lg hover:bg-black/30 transition-colors group"
                >
                  <div class="flex items-center justify-between">
                    <p class="font-mono text-xs truncate">{miner.toString().substring(0, 15)}...</p>
                    <span class="text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </a>
              {/each}
              {#if miners.length > 12}
                <div class="bg-black/20 p-2 rounded-lg text-center">
                  +{miners.length - 12} more miners
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </Panel>
    {/if}
  {:else}
    <Panel>
      <div class="p-8 text-center">
        <p class="text-lg mb-4">No token information found</p>
        <button 
          class="bg-kong-primary-600 hover:bg-kong-primary-700 text-white py-2 px-6 rounded-lg"
          on:click={loadTokenData}
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
      radial-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px),
      radial-gradient(rgba(16, 185, 129, 0.05) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: 0 0, 10px 10px;
  }
  
  .hero-particle {
    position: absolute;
    width: var(--size, 5px);
    height: var(--size, 5px);
    background: radial-gradient(circle, rgba(16, 185, 129, 0.7) 0%, rgba(16, 185, 129, 0) 70%);
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
  
  .block-time-pulse {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #10b981;
    animation: pulse var(--pulse-speed, 3s) infinite;
  }
  
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
