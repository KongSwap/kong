<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenList from "$lib/components/launch/TokenList.svelte";
  import MinerList from "$lib/components/launch/MinerList.svelte";
  import { Rocket, Pickaxe, Search, Grid, List, ArrowRight } from "lucide-svelte";
  import type { PageData } from "./$types";
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { goto } from "$app/navigation";

  export let data: PageData;
  
  // UI state
  let activeTab = "tokens";
  let viewMode = "grid";
  let searchQuery = "";
  
  // Handle tab switching
  function setActiveTab(tab) {
    activeTab = tab;
  }
  
  // Handle view mode switching
  function setViewMode(mode) {
    viewMode = mode;
  }
  
  // Handle create actions
  function handleCreateToken() {
    goto("/launch/create-token");
  }
  
  function handleCreateMiner() {
    goto("/launch/create-miner");
  }
</script>

<div class="container mx-auto px-4 pt-0 pb-8">
  <!-- Main content -->
  <div class="bg-kong-bg-dark/60 backdrop-blur-md border border-kong-border/50 rounded-xl overflow-hidden">
    <!-- Tabs and controls -->
    <div class="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-kong-border/50">
      <div class="flex gap-1 mb-3 md:mb-0">
        <button 
          class={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'tokens' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'hover:bg-kong-bg-secondary/30 text-kong-text-secondary'}`}
          on:click={() => setActiveTab('tokens')}
        >
          <Rocket size={16} />
          Tokens
        </button>
        
        <button 
          class={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'miners' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'hover:bg-kong-bg-secondary/30 text-kong-text-secondary'}`}
          on:click={() => setActiveTab('miners')}
        >
          <Pickaxe size={16} />
          Miners
        </button>
      </div>
      
      <div class="flex items-center gap-3">
        <!-- Search -->
        <div class="relative flex-grow">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} class="text-kong-text-secondary" />
          </div>
          <input 
            type="text" 
            class="w-full pl-10 pr-4 py-2 bg-kong-bg-secondary/30 border border-kong-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-kong-text-primary"
            placeholder={`Search ${activeTab}...`}
            bind:value={searchQuery}
          />
        </div>
        
        <!-- View mode toggle -->
        <div class="flex bg-kong-bg-secondary/30 border border-kong-border/50 rounded-lg overflow-hidden">
          <button 
            class={`p-2 ${viewMode === 'grid' ? 'bg-kong-bg-secondary text-kong-text-primary' : 'text-kong-text-secondary hover:bg-kong-bg-secondary/50'}`}
            on:click={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <Grid size={16} />
          </button>
          
          <button 
            class={`p-2 ${viewMode === 'list' ? 'bg-kong-bg-secondary text-kong-text-primary' : 'text-kong-text-secondary hover:bg-kong-bg-secondary/50'}`}
            on:click={() => setViewMode('list')}
            aria-label="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>
    </div>
    
    <!-- Content area -->
    <div class="p-4">
      {#if data.error}
        <div class="bg-red-900/20 border border-red-900/30 text-red-400 p-4 rounded-lg">
          Error loading data: {data.error}
        </div>
      {:else}
        {#if activeTab === 'tokens'}
          <div in:fade={{ duration: 200 }}>
            <!-- TokenList fetches its own data, only pass searchQuery if needed -->
            <TokenList {searchQuery} /> 
          </div>
        {:else}
          <div in:fade={{ duration: 200 }}>
            <!-- Iterate over miners and render MinerList for each -->
            {#if data.miners && data.miners.length > 0}
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {#each data.miners as minerInfo (minerInfo.canister_id.toString())}
                  <!-- Pass the canister_id field (converted to string) as the prop -->
                  <MinerList minerCanisterId={minerInfo.canister_id.toString()} />
                {/each}
              </div>
            {:else}
              <p class="text-kong-text-secondary italic text-center py-4">No miners found.</p>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  /* Animations */
  @keyframes pulse-slow {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.05); }
  }
  
  @keyframes pulse-fast {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.03); }
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  
  .animate-pulse-slow {
    animation: pulse-slow 4s ease-in-out infinite;
  }
  
  .animate-pulse-fast {
    animation: pulse-fast 2s ease-in-out infinite;
  }
  
  .animate-float {
    animation: float 6s ease-in-out infinite;
  }
  
  .shadow-glow-sm {
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
  }
  
  .shadow-glow-md {
    box-shadow: 0 0 25px rgba(59, 130, 246, 0.4);
  }
</style>
