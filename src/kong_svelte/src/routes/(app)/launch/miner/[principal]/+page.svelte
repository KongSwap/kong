<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { Server, ArrowLeft, Clock, Zap, Hash, Flame, BarChart, Activity, Award, HardDrive, Power } from "lucide-svelte";
  import * as minerAPI from "$lib/api/miner";
  import { toastStore } from "$lib/stores/toastStore";
  import { onDestroy, onMount } from "svelte";
  import { Principal } from "@dfinity/principal";

  const { data } = $props();
  const { 
    principal, 
    tokenInfo, 
    hashHistory, 
    referrerToken,
    error 
  } = data;
  
  // Create mutable versions of data that needs to be updated during refresh
  let minerData = $state(data.miner);
  let statsData = $state(data.stats);
  let timeRemainingData = $state(data.timeRemaining);
  let remainingHashesData = $state(data.remainingHashes);

  let isLoadingStats = $state(false);
  let isLoadingInfo = $state(false);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  
  // Truncate principal ID for display
  let shortPrincipal = $state("");
  $effect(() => {
    if (principal) {
      shortPrincipal = `${principal.slice(0, 5)}...${principal.slice(-5)}`;
    }
  });
  
  // Check if current user owns this miner
  let isMinerOwner = $state(false);
  $effect(() => {
    if ($auth.isConnected && $auth.account?.owner && minerData) {
      const ownerText = typeof $auth.account.owner === 'string' 
        ? $auth.account.owner 
        : $auth.account.owner.toText();
      
      const minerOwnerText = typeof minerData.owner === 'string'
        ? minerData.owner
        : minerData.owner.toString();
        
      isMinerOwner = ownerText === minerOwnerText;
    } else {
      isMinerOwner = false;
    }
  });
  
  // Periodically refresh miner data
  onMount(() => {
    refreshData();
    refreshInterval = setInterval(refreshData, 30000); // Refresh every 30 seconds
  });
  
  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });
  
  async function refreshData() {
    isLoadingInfo = true;
    isLoadingStats = true;
    
    try {
      // Refresh miner info
      const updatedMiner = await minerAPI.getMinerInfo(principal);
      if (updatedMiner) {
        minerData = updatedMiner;
      }
    } catch (e) {
      console.error("Failed to refresh miner info:", e);
    } finally {
      isLoadingInfo = false;
    }
    
    try {
      // Refresh miner stats
      const updatedStats = await minerAPI.getMiningStats(principal);
      if (updatedStats) {
        statsData = updatedStats;
      }
      
      // Update remaining hashes
      const newRemainingHashes = await minerAPI.getRemainingHashes(principal);
      if (newRemainingHashes !== undefined) {
        remainingHashesData = newRemainingHashes;
      }
      
      // Update time estimate
      const newTimeRemaining = await minerAPI.getTimeRemainingEstimate(principal);
      if (newTimeRemaining) {
        timeRemainingData = newTimeRemaining;
      }
    } catch (e) {
      console.error("Failed to refresh miner stats:", e);
    } finally {
      isLoadingStats = false;
    }
  }
  
  // Action handlers
  async function handleStartStop() {
    if (!isMinerOwner) return;
    
    const action = minerData?.is_mining ? 'stop' : 'start';
    const actionName = minerData?.is_mining ? 'Stop' : 'Start';
    const toast = toastStore.info(`${actionName}ing miner...`);
    
    try {
      if (minerData?.is_mining) {
        await minerAPI.stopMining(principal);
      } else {
        await minerAPI.startMining(principal);
      }
      toastStore.success(`Miner ${action}ed successfully`);
      await refreshData();
    } catch (e) {
      console.error(`Failed to ${action} miner:`, e);
      toastStore.error(`Failed to ${action} miner: ${e.message || "Unknown error"}`);
    } finally {
      toastStore.dismiss(toast);
    }
  }
  
  async function handleClaim() {
    if (!isMinerOwner) return;
    
    const toast = toastStore.info("Claiming rewards...");
    
    try {
      const result = await minerAPI.claimRewards(principal);
      toastStore.success(`Successfully claimed rewards: ${result} tokens`);
      await refreshData();
    } catch (e) {
      console.error("Failed to claim rewards:", e);
      toastStore.error(`Failed to claim rewards: ${e.message || "Unknown error"}`);
    } finally {
      toastStore.dismiss(toast);
    }
  }
  
  // Format utilities
  function formatHashrate(rate: number | null | undefined) {
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
  
  function formatRewards(amount: bigint | number | null | undefined, decimals = 8) {
    if (amount === null || amount === undefined) return '0.00';
    const num = typeof amount === 'bigint' ? amount : BigInt(amount);
    const divisor = 10n ** BigInt(decimals);
    const integerPart = num / divisor;
    const fractionalPart = num % divisor;
    const paddedFractional = fractionalPart.toString().padStart(decimals, '0');
    const formattedFractional = paddedFractional.substring(0, 4);
    return `${integerPart}.${formattedFractional}`;
  }
  
  function formatBlockTime(seconds) {
    if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) {
      return "--";
    }
    return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  }
  
  function formatBigInt(value: bigint | null | undefined) {
    if (value === null || value === undefined) return 'N/A';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  function getStatusColor(isMining) {
    return isMining ? 'bg-kong-accent-green/10 text-kong-accent-green' : 'bg-yellow-500/10 text-yellow-400';
  }

  function goBack() {
    if (referrerToken) {
      goto(`/launch/token/${referrerToken}`);
    } else {
      goto('/launch/my-dashboard');
    }
  }
</script>

<div class="max-w-5xl mx-auto px-4 py-6">
  {#if error}
    <Panel>
      <div class="text-center py-10">
        <div class="text-xl text-kong-error mb-2">Error Loading Miner</div>
        <p class="text-kong-text-secondary mb-4">{error}</p>
        <ButtonV2 label="Go Back" onclick={goBack} theme="secondary" />
      </div>
    </Panel>
  {:else}
    <!-- Back button -->
    <div class="mb-4">
      <button 
        class="inline-flex items-center gap-2 text-kong-text-secondary hover:text-kong-text-primary px-3 py-2 rounded-lg transition-colors hover:bg-kong-bg-light/10"
        onclick={goBack}
      >
        <ArrowLeft size={18} />
        <span>Go Back</span>
      </button>
    </div>
    
    <Panel class="!mb-6">
      <!-- Miner Header -->
      <div class="flex flex-col md:flex-row md:items-start gap-4 md:gap-8 pb-6 border-b border-kong-border/20">
        <!-- Miner Icon -->
        <div class="w-20 h-20 rounded-xl bg-gradient-to-br from-kong-accent-blue/20 to-kong-accent-purple/20 flex items-center justify-center flex-shrink-0">
          <Server size={32} class="text-kong-accent-purple" />
        </div>
        
        <!-- Miner Info -->
        <div class="flex-1">
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
            <h1 class="text-2xl font-bold text-kong-text-primary">Miner</h1>
            <div class="font-mono text-sm text-kong-text-secondary bg-kong-bg-light/20 px-2 py-1 rounded">
              {principal}
            </div>
          </div>
          
          <!-- Status and connected token -->
          <div class="flex flex-wrap gap-2 mt-1">
            {#if minerData}
              <div class={`px-2 py-1 rounded text-sm font-medium flex items-center gap-1 ${getStatusColor(minerData.is_mining)}`}>
                <Power size={14} />
                {minerData.is_mining ? 'Mining' : 'Stopped'}
              </div>
            {/if}
            
            {#if tokenInfo}
              <div class="px-2 py-1 rounded text-sm bg-kong-bg-light/20 text-kong-text-primary flex items-center gap-1">
                <Zap size={14} class="text-kong-accent-yellow" />
                {tokenInfo.name} ({tokenInfo.ticker})
              </div>
            {/if}
            
            {#if minerData?.owner}
              <div class="px-2 py-1 rounded text-sm bg-kong-bg-light/20 text-kong-text-primary flex items-center gap-1">
                <span class="text-xs">Owner: </span>
                <span class="font-mono text-xs truncate max-w-[100px] sm:max-w-none">{minerData.owner.toString()}</span>
              </div>
            {/if}
          </div>
          
          {#if statsData?.total_rewards}
            <div class="mt-3 flex flex-wrap gap-2">
              <div class="bg-kong-accent-green/10 text-kong-accent-green px-2 py-1 rounded flex items-center gap-2">
                <Award size={14} />
                <span class="text-sm font-medium">{formatRewards(statsData.total_rewards)} {tokenInfo?.ticker || 'tokens'}</span>
              </div>
              
              <div class="bg-kong-bg-light/10 text-kong-text-primary px-2 py-1 rounded flex items-center gap-2">
                <BarChart size={14} class="text-kong-accent-blue" />
                <span class="text-sm">{statsData.blocks_mined.toString()} blocks mined</span>
              </div>
            </div>
          {/if}
        </div>
        
        <!-- Action buttons -->
        {#if isMinerOwner}
          <div class="flex flex-wrap gap-2">
            <ButtonV2 
              label={minerData?.is_mining ? "Stop Mining" : "Start Mining"} 
              theme={minerData?.is_mining ? "danger" : "success"}
              icon={minerData?.is_mining ? Power : Zap}
              onclick={handleStartStop}
              isLoading={isLoadingInfo}
            />
            <ButtonV2 
              label="Claim Rewards" 
              theme="primary"
              icon={Award}
              onclick={handleClaim}
              isLoading={isLoadingStats}
            />
          </div>
        {/if}
      </div>
      
      <!-- Mining Stats -->
      <div class="pt-6">
        <h2 class="text-lg font-semibold text-kong-text-primary mb-4">Mining Statistics</h2>
        
        <!-- Mining stats grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Hashrate -->
          <div class="bg-kong-bg-light/10 p-4 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-kong-accent-blue/10 flex items-center justify-center">
                <Hash size={16} class="text-kong-accent-blue" />
              </div>
              <span class="text-sm text-kong-text-secondary">Hashrate</span>
            </div>
            <div class="text-xl font-semibold text-kong-text-primary">
              {statsData ? formatHashrate(statsData.last_hash_rate) : 'N/A'}
            </div>
          </div>
          
          <!-- Blocks Mined -->
          <div class="bg-kong-bg-light/10 p-4 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-kong-accent-green/10 flex items-center justify-center">
                <BarChart size={16} class="text-kong-accent-green" />
              </div>
              <span class="text-sm text-kong-text-secondary">Blocks Mined</span>
            </div>
            <div class="text-xl font-semibold text-kong-text-primary">
              {statsData ? statsData.blocks_mined.toString() : 'N/A'}
            </div>
          </div>
          
          <!-- Remaining -->
          <div class="bg-kong-bg-light/10 p-4 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-kong-accent-purple/10 flex items-center justify-center">
                <Activity size={16} class="text-kong-accent-purple" />
              </div>
              <span class="text-sm text-kong-text-secondary">Remaining Hashes</span>
            </div>
            <div class="text-xl font-semibold text-kong-text-primary">
              {remainingHashesData ? formatBigInt(remainingHashesData) : 'N/A'}
            </div>
          </div>
          
          <!-- Time Remaining -->
          <div class="bg-kong-bg-light/10 p-4 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-kong-accent-yellow/10 flex items-center justify-center">
                <Clock size={16} class="text-kong-accent-yellow" />
              </div>
              <span class="text-sm text-kong-text-secondary">Time Remaining</span>
            </div>
            <div class="text-xl font-semibold text-kong-text-primary">
              {timeRemainingData || 'N/A'}
            </div>
          </div>
        </div>
        
        <!-- Progress bar -->
        {#if minerData?.chunk_size && remainingHashesData}
          <div class="mt-6">
            <div class="flex justify-between items-center mb-1">
              <span class="text-sm text-kong-text-secondary">Mining Progress</span>
              <span class="text-sm text-kong-text-primary">
                {Math.min(100, Math.max(0, 100 - Math.floor(Number(remainingHashesData) / Number(minerData.chunk_size) * 100)))}%
              </span>
            </div>
            <div class="w-full h-3 bg-kong-bg-light/20 rounded-full overflow-hidden">
              <div 
                class="bg-gradient-to-r from-kong-accent-blue to-kong-accent-purple h-full rounded-full"
                style="width: {Math.min(100, Math.max(0, 100 - Math.floor(Number(remainingHashesData) / Number(minerData.chunk_size) * 100)))}%"
              ></div>
            </div>
          </div>
        {/if}
        
        <!-- Additional miner details -->
        {#if minerData}
          <div class="mt-6 grid sm:grid-cols-2 gap-4">
            <div class="bg-kong-bg-light/5 p-4 rounded-lg">
              <h3 class="text-sm font-medium text-kong-text-secondary mb-3">Miner Configuration</h3>
              <div class="space-y-2 divide-y divide-kong-border/10">
                <div class="flex justify-between pb-2">
                  <span class="text-sm text-kong-text-secondary">Chunk Size</span>
                  <span class="text-sm font-medium text-kong-text-primary">{minerData.chunk_size}</span>
                </div>
                
                <div class="flex justify-between pt-2">
                  <span class="text-sm text-kong-text-secondary">Subaccount</span>
                  <span class="text-sm font-mono text-kong-text-primary truncate max-w-[200px]">
                    {minerData.subaccount?.length ? minerData.subaccount.toString() : 'None'}
                  </span>
                </div>
              </div>
            </div>
            
            {#if tokenInfo}
              <div class="bg-kong-bg-light/5 p-4 rounded-lg">
                <h3 class="text-sm font-medium text-kong-text-secondary mb-3">Token Information</h3>
                <div class="space-y-2 divide-y divide-kong-border/10">
                  <div class="flex justify-between pb-2">
                    <span class="text-sm text-kong-text-secondary">Name</span>
                    <span class="text-sm font-medium text-kong-text-primary">{tokenInfo.name}</span>
                  </div>
                  
                  <div class="flex justify-between pt-2 pb-2">
                    <span class="text-sm text-kong-text-secondary">Ticker</span>
                    <span class="text-sm font-medium text-kong-text-primary">{tokenInfo.ticker}</span>
                  </div>
                  
                  <div class="flex justify-between pt-2">
                    <span class="text-sm text-kong-text-secondary">Principal</span>
                    <span class="text-sm font-mono text-kong-text-primary truncate max-w-[200px]">
                      {minerData.token_canister_id}
                    </span>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </Panel>
  {/if}
</div>

<style>
  .loading-pulse {
    @apply animate-pulse bg-kong-bg-light/50 rounded;
  }
</style>