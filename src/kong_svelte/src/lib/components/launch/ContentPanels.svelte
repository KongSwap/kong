<script lang="ts">
  import { AlertTriangle, Plus } from "lucide-svelte";
  import Panel from "$lib/components/common/Panel.svelte";
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
</script>

<!-- CONTENT PANELS -->
<div class="relative">
  <!-- LOADING OVERLAY -->
  {#if loading}
    <div class="absolute inset-0 bg-black/70 flex items-center justify-center z-20 rounded-xl">
      <div class="text-center">
        <div class="inline-block h-12 w-12 border-4 border-t-purple-500 border-r-transparent border-b-pink-500 border-l-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-xl font-bold">LOADING DEGEN DATA...</p>
      </div>
    </div>
  {/if}
  
  <!-- TOKENS PANEL -->
  <div class={`${activeTab === 'tokens' ? 'block' : 'hidden'} ${pulseTokens ? 'animate-pulse-subtle' : ''}`}>
    <Panel>
      <svelte:fragment slot="header">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-bold flex items-center gap-2">
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">💰 TOKENS</span>
            <span class="text-sm bg-purple-900/70 px-2 py-0.5 rounded-full">{filteredTokens.length}</span>
          </h2>
        </div>
      </svelte:fragment>
      
      <div class="overflow-x-auto">
        {#if filteredTokens.length === 0 && !loading}
          <div class="text-center py-10">
            <AlertTriangle class="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <p class="text-xl font-bold mb-2">NO TOKENS FOUND</p>
            <p class="text-gray-400 mb-4">Be the first to launch a token!</p>
            <button 
              on:click={handleCreateNew}
              class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
            >
              <Plus class="h-5 w-5" />
              LAUNCH TOKEN
            </button>
          </div>
        {:else}
          <TokenList tokens={filteredTokens} />
        {/if}
      </div>
    </Panel>
  </div>
  
  <!-- MINERS PANEL -->
  <div class={`${activeTab === 'miners' ? 'block' : 'hidden'} ${pulseMiners ? 'animate-pulse-subtle' : ''}`}>
    <Panel>
      <svelte:fragment slot="header">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-bold flex items-center gap-2">
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">⛏️ MINERS</span>
            <span class="text-sm bg-blue-900/70 px-2 py-0.5 rounded-full">{filteredMiners.length}</span>
          </h2>
        </div>
      </svelte:fragment>
      
      <div class="overflow-x-auto">
        {#if filteredMiners.length === 0 && !loading}
          <div class="text-center py-10">
            <AlertTriangle class="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <p class="text-xl font-bold mb-2">NO MINERS FOUND</p>
            <p class="text-gray-400 mb-4">Be the first to deploy a miner!</p>
            <button 
              on:click={handleCreateNew}
              class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg font-bold hover:from-blue-700 hover:to-cyan-700 transition-all duration-200"
            >
              <Plus class="h-5 w-5" />
              DEPLOY MINER
            </button>
          </div>
        {:else}
          <MinerList miners={filteredMiners} />
        {/if}
      </div>
    </Panel>
  </div>
</div> 