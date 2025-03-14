<script lang="ts">
  import { AlertTriangle, Plus } from "lucide-svelte";
  import TokenList from "$lib/components/launch/TokenList.svelte";
  import MinerList from "$lib/components/launch/MinerList.svelte";
  import { goto } from "$app/navigation";
  
  export let activeTab = "tokens";
  export let loading = false;
  export let filteredTokens = [];
  export let filteredMiners = [];
  export let pulseTokens = false;
  export let pulseMiners = false;
  
  function handleCreateNew() {
    goto(`/launch/${activeTab === "tokens" ? "create-token" : "create-miner"}`);
  }

  function handleCreateWithTCycles() {
    goto('/launch/deploy-miner-tcycles');
  }
</script>

<!-- CONTENT PANELS -->
<div class="relative">
  <!-- LOADING OVERLAY -->
  {#if loading}
    <div class="absolute inset-0 bg-black/70 flex items-center justify-center z-20 rounded-xl backdrop-blur-sm">
      <div class="text-center">
        <div class="inline-block h-12 w-12 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-xl font-medium">LOADING DATA...</p>
      </div>
    </div>
  {/if}
  
  <!-- TOKENS PANEL -->
  <div class={`${activeTab === 'tokens' ? 'block' : 'hidden'} ${pulseTokens ? 'animate-pulse-subtle' : ''}`}>
    
    <div class="overflow-x-auto">
      {#if filteredTokens.length === 0 && !loading}
        <div class="bg-kong-bg-dark/60 backdrop-blur-md border border-kong-border/50 rounded-xl p-6">
          <div class="text-center py-8">
            <div class="w-16 h-16 rounded-full bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">🚀</span>
            </div>
            <p class="text-xl font-bold mb-2 text-white">NO TOKENS FOUND</p>
            <p class="text-gray-400 mb-6 max-w-md mx-auto">BE THE FIRST TO LAUNCH A TOKEN ON THE NETWORK.</p>
            <button 
              on:click={handleCreateNew}
              class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 text-white"
            >
              <Plus class="h-4 w-4" />
              LAUNCH TOKEN
            </button>
          </div>
        </div>
      {:else}
        <TokenList tokens={filteredTokens} {loading} />
      {/if}
    </div>
  </div>
  
  <!-- MINERS PANEL -->
  <div class={`${activeTab === 'miners' ? 'block' : 'hidden'} ${pulseMiners ? 'animate-pulse-subtle' : ''}`}>

    
    <div class="overflow-x-auto">
      {#if filteredMiners.length === 0 && !loading}
        <div class="bg-kong-bg-dark/60 backdrop-blur-md border border-kong-border/50 rounded-xl p-6">
          <div class="text-center py-8">
            <div class="w-16 h-16 rounded-full bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">⛏️</span>
            </div>
            <p class="text-xl font-bold mb-2 text-white">NO MINERS FOUND</p>
            <p class="text-gray-400 mb-6 max-w-md mx-auto">DEPLOY A MINER TO START MINING TOKENS.</p>
            <div class="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                on:click={handleCreateNew}
                class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 text-white"
              >
                <Plus class="h-4 w-4" />
                DEPLOY MINER (ICP)
              </button>
              <button 
                on:click={handleCreateWithTCycles}
                class="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 rounded-lg font-medium hover:bg-purple-700 transition-all duration-200 text-white"
              >
                <Plus class="h-4 w-4" />
                DEPLOY MINER (TCYCLES)
              </button>
            </div>
          </div>
        </div>
      {:else}
        <MinerList miners={filteredMiners} {loading} />
      {/if}
    </div>
  </div>
</div>

<style>
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.9; }
  }
  
  :global(.animate-pulse-subtle) {
    animation: pulse-subtle 1.5s ease-in-out infinite;
  }
</style>