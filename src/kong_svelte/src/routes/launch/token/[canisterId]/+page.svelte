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
  import { Flame, Rocket, ArrowLeft } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  
  // Token info data
  let canisterId = $page.params.canisterId;
  let tokenInfo: any = null;
  let miningInfo: any = null;
  let isLoading = true;
  let error = null;
  
  // Go back to token list
  function goBack() {
    goto('/launch');
  }
  
  // Load token data using anonymous agent
  async function loadTokenData() {
    isLoading = true;
    error = null;
    
    try {
      // Create actor using auth service with anon option
      const actor = auth.getActor(canisterId, idlFactory, { anon: true });
      
      // Get basic token info
      const infoResult = await actor.get_info();
      if (infoResult.Ok) {
        tokenInfo = infoResult.Ok;
        console.log('Token info:', tokenInfo);
      } else if (infoResult.Err) {
        error = `Error fetching token info: ${infoResult.Err}`;
        toastStore.error(error);
      }
      
      // Get mining info
      const miningResult = await actor.get_mining_info();
      if (miningResult.Ok) {
        miningInfo = miningResult.Ok;
        console.log('Mining info:', miningInfo);
      } else if (miningResult.Err) {
        console.warn(`Could not fetch mining info: ${miningResult.Err}`);
        // Not treating as fatal error since token may not be started
      }
    } catch (err) {
      console.error('Error loading token data:', err);
      error = `Failed to load token data: ${err.message || err}`;
      toastStore.error(error);
    } finally {
      isLoading = false;
    }
  }
  
  // Format the block time
  function formatBlockTime(seconds) {
    if (!seconds) return "0s";
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 
        ? `${minutes}m ${remainingSeconds}s` 
        : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 
        ? `${hours}h ${minutes}m` 
        : `${hours}h`;
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

  <h1 class="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
    Token Details
  </h1>
  
  {#if isLoading}
    <div class="flex justify-center items-center p-12">
      <div class="inline-block h-12 w-12 border-4 border-t-purple-500 border-r-transparent border-b-pink-500 border-l-transparent rounded-full animate-spin"></div>
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
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Token Overview -->
      <Panel className="lg:col-span-3">
        <div class="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <!-- Token Logo -->
          <div class="w-24 h-24 flex-shrink-0">
            {#if tokenInfo.logo && tokenInfo.logo.length > 0 && tokenInfo.logo[0]}
              <img 
                src={tokenInfo.logo[0]} 
                alt={tokenInfo.name} 
                class="w-full h-full object-cover rounded-full border-2 border-white/20"
                on:error={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            {:else}
              <div class="w-full h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center text-3xl font-bold">
                {tokenInfo.ticker?.[0] || '?'}
              </div>
            {/if}
          </div>
          
          <!-- Token Info -->
          <div class="flex-grow text-center md:text-left">
            <h2 class="text-3xl font-bold mb-1">{tokenInfo.name}</h2>
            <p class="text-xl font-medium text-white/70 mb-3">
              ${tokenInfo.ticker}
              <span class="ml-2 px-2 py-0.5 bg-white/10 rounded text-sm">{tokenInfo.decimals} decimals</span>
            </p>
            
            <div class="flex flex-wrap gap-4 justify-center md:justify-start">
              <div class="bg-black/30 px-4 py-2 rounded-lg">
                <p class="text-sm text-white/60">Total Supply</p>
                <p class="font-bold">
                  {formatBalance(tokenInfo.total_supply, tokenInfo.decimals)} {tokenInfo.ticker}
                </p>
              </div>
              
              <div class="bg-black/30 px-4 py-2 rounded-lg">
                <p class="text-sm text-white/60">Transfer Fee</p>
                <p class="font-bold">
                  {formatBalance(tokenInfo.transfer_fee, tokenInfo.decimals)} {tokenInfo.ticker}
                </p>
              </div>
              
              {#if miningInfo}
                <div class="bg-black/30 px-4 py-2 rounded-lg">
                  <p class="text-sm text-white/60">Block Reward</p>
                  <p class="font-bold">
                    {formatBalance(miningInfo.block_reward, tokenInfo.decimals)} {tokenInfo.ticker}
                  </p>
                </div>
                
                <div class="bg-black/30 px-4 py-2 rounded-lg">
                  <p class="text-sm text-white/60">Target Block Time</p>
                  <p class="font-bold">
                    {formatBlockTime(miningInfo.block_time_target_seconds)}
                  </p>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </Panel>
      
      <!-- Canister IDs -->
      <Panel className="lg:col-span-3">
        <h3 class="text-xl font-bold mb-4">Canister IDs</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-black/20 p-4 rounded-lg">
            <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
              <Rocket size={14} class="text-blue-400" /> Token Canister ID
            </p>
            <p class="font-mono text-sm break-all">
              {canisterId}
            </p>
          </div>
          
          {#if tokenInfo.ledger_id && tokenInfo.ledger_id.length > 0}
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70 flex items-center gap-1 mb-1">
                <Rocket size={14} class="text-blue-400" /> Ledger ID
              </p>
              <p class="font-mono text-sm break-all">
                {tokenInfo.ledger_id[0].toString()}
              </p>
            </div>
          {/if}
        </div>
      </Panel>
      
      <!-- Mining Stats -->
      {#if miningInfo}
        <Panel className="lg:col-span-3">
          <h3 class="text-xl font-bold mb-4">Mining Information</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70">Current Height</p>
              <p class="font-bold text-xl">
                {miningInfo.current_height}
              </p>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70">Block Reward</p>
              <p class="font-bold text-xl flex items-center gap-1">
                {formatBalance(miningInfo.block_reward, tokenInfo.decimals)}
                <span class="text-white/90">{tokenInfo.ticker}</span>
                <Flame size={16} class="text-orange-400 animate-pulse" />
              </p>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70">Blocks to Halving</p>
              <p class="font-bold text-xl">
                {miningInfo.blocks_to_reward_halving}
              </p>
            </div>
            
            <div class="bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70">Halving Interval</p>
              <p class="font-bold text-xl">
                {miningInfo.halving_interval} blocks
              </p>
            </div>
          </div>
          
          {#if miningInfo.last_block_timestamp_nanos}
            <div class="mt-6 bg-black/20 p-4 rounded-lg">
              <p class="text-sm text-white/70">Last Block Time</p>
              <p class="font-bold">
                {formatDate(new Date(Number(miningInfo.last_block_timestamp_nanos) / 1000000))}
              </p>
            </div>
          {/if}
        </Panel>
      {/if}
    </div>
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