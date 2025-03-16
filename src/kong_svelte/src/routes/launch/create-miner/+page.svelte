<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { minerParams } from "$lib/stores/minerParams";
  import { TCyclesService } from "$lib/services/canister/tcycles-service";
  import { ArrowLeft, ArrowRight, Calculator, Coins, HelpCircle } from "lucide-svelte";
  import { writable } from "svelte/store";
  import Panel from "$lib/components/common/Panel.svelte";

  // Define MinerType locally to fix linter errors
  type MinerType = { Lite: null } | { Normal: null } | { Premium: null };
  
  // Track state
  let loading = true;
  let comparing = false;
  let error = "";
  let comparisonData: {
    kongViaIcp: string;
    kongViaTCycles: string;
    difference: string;
    differencePercent: string;
    cheaperPath: 'icp' | 'tcycles';
  } | null = null;
  let showDetails = false;

  // Initialize parameters
  function initMinerParams() {
    // Store the hardcoded Normal miner type in the minerParams store
    const initArgs = {
      owner: null, // Will be set by the backend
      minerType: { Normal: null } as MinerType,
      tokenCanisterId: undefined // No token by default
    };
    
    // Update the miner parameters store
    minerParams.set(initArgs);
    return initArgs;
  }
  
  // Get comparison data
  async function getPriceComparison() {
    comparing = true;
    try {
      comparisonData = await TCyclesService.calculateKongForCanister();
      console.log("Price comparison data:", comparisonData);
    } catch (e) {
      console.error("Error getting price comparison:", e);
      error = "Failed to get price comparison. You can still proceed with either option.";
    } finally {
      comparing = false;
    }
  }
  
  // Choose a deployment path
  function choosePath(path: 'icp' | 'tcycles') {
    if (path === 'icp') {
      goto("/launch/deploy-miner");
    } else {
      goto("/launch/deploy-miner-tcycles");
    }
  }

  // On mount, initialize parameters and get comparison
  onMount(async () => {
    initMinerParams();
    await getPriceComparison();
    loading = false;
  });
</script>

<div class="grid gap-6 lg:grid-cols-12 max-w-[1200px] mx-auto">
  <!-- Left sidebar with navigation -->
  <div class="lg:col-span-3">
    <div class="sticky flex flex-col gap-5 top-6">
      <!-- Back button -->
      <button 
        on:click={() => goto("/launch")}
        class="flex items-center gap-2 px-3 py-2 transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light/10"
      >
        <ArrowLeft size={18} />
        <span>Back to Launch</span>
      </button>
      
      <!-- Help card -->
      <div class="p-5 transition-all duration-200 border rounded-xl bg-kong-bg-secondary/30 border-kong-border/30 backdrop-blur-sm">
        <div class="flex items-start gap-3">
          <div class="p-2 rounded-lg bg-kong-bg-light/10 text-kong-primary">
            <HelpCircle size={18} />
          </div>
          <div>
            <h3 class="mb-1 text-sm font-medium">Need Help?</h3>
            <p class="text-xs text-kong-text-secondary">
              Creating a miner is the first step to earning cycles for your dapp.
            </p>
            <a href="https://support.kongfi.com" target="_blank" rel="noopener" class="inline-flex items-center gap-1 mt-3 text-xs text-kong-primary hover:underline">
              <span>Read the docs</span>
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main content area -->
  <div class="lg:col-span-9">
    <div class="flex flex-col">
      <Panel variant="solid" type="main" className="p-6 backdrop-blur-xl">
        <h1 class="text-2xl font-bold mb-4">Miner Deployment Options</h1>
        
        {#if loading || comparing}
          <div class="flex flex-col items-center justify-center py-8">
            <div class="w-12 h-12 border-4 border-t-blue-500 border-b-transparent border-l-transparent border-r-transparent rounded-full animate-spin mb-4"></div>
            <p class="text-kong-text-primary/60">{comparing ? 'Comparing prices...' : 'Preparing deployment options...'}</p>
          </div>
        {:else if error}
          <div class="bg-red-900/20 border border-red-900 rounded-lg p-4 mb-6">
            <p class="text-red-300">{error}</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button 
              class="bg-kong-accent-blue hover:bg-kong-accent-blue/90 text-white p-4 rounded-lg transition-colors flex items-center justify-center gap-3"
              on:click={() => choosePath('tcycles')}>
              <Coins size={20} />
              Deploy with TCycles
            </button>
            <button 
              class="bg-kong-accent-blue hover:bg-kong-accent-blue/90 text-white p-4 rounded-lg transition-colors flex items-center justify-center gap-3"
              on:click={() => choosePath('icp')}>
              <Coins size={20} />
              Deploy with ICP
            </button>
          </div>
        {:else if comparisonData}
          <div class="mb-6 p-4 bg-kong-accent-blue/20 border border-kong-accent-blue/30 rounded-lg">
            <p class="text-kong-accent-blue mb-2 font-medium">We found a better price option for you!</p>
            <p class="text-kong-text-primary/80">Choose your preferred deployment method below. The {comparisonData.cheaperPath === 'tcycles' ? 'TCycles' : 'ICP'} path is currently cheaper.</p>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button 
              class={`p-4 rounded-lg transition-colors flex flex-col items-center justify-center ${comparisonData.cheaperPath === 'tcycles' ? 'bg-kong-accent-green hover:bg-kong-accent-green/90 ring-2 ring-kong-accent-green' : 'bg-kong-accent-blue hover:bg-kong-accent-blue/90'}`}
              on:click={() => choosePath('tcycles')}>
              <div class="flex items-center justify-center gap-2 mb-2">
                <Coins size={20} />
                <span class="font-bold">TCycles Path</span>
              </div>
              <div class="text-sm opacity-80">Cost: {comparisonData.kongViaTCycles} KONG</div>
              {#if comparisonData.cheaperPath === 'tcycles'}
                <div class="text-xs mt-2 px-2 py-1 bg-kong-accent-green/80 rounded-full text-white">Cheaper by {comparisonData.differencePercent}%</div>
              {/if}
            </button>
            
            <button 
              class={`p-4 rounded-lg transition-colors flex flex-col items-center justify-center ${comparisonData.cheaperPath === 'icp' ? 'bg-kong-accent-green hover:bg-kong-accent-green/90 ring-2 ring-kong-accent-green' : 'bg-kong-accent-blue hover:bg-kong-accent-blue/90'}`}
              on:click={() => choosePath('icp')}>
              <div class="flex items-center justify-center gap-2 mb-2">
                <Coins size={20} />
                <span class="font-bold">ICP Path</span>
              </div>
              <div class="text-sm opacity-80">Cost: {comparisonData.kongViaIcp} KONG</div>
              {#if comparisonData.cheaperPath === 'icp'}
                <div class="text-xs mt-2 px-2 py-1 bg-kong-accent-green/80 rounded-full text-white">Cheaper by {comparisonData.differencePercent}%</div>
              {/if}
            </button>
          </div>
          
          <div class="mt-4">
            <button 
              class="text-kong-accent-blue text-sm flex items-center justify-center w-full"
              on:click={() => showDetails = !showDetails}>
              {showDetails ? 'Hide' : 'Show'} price details
              <ArrowRight size={16} class={`ml-1 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
            </button>
            
            {#if showDetails}
              <div class="mt-2 p-3 bg-kong-bg-light/10 border border-kong-border/20 rounded-lg text-sm">
                <div class="mb-1"><span class="opacity-70">TCycles path cost:</span> {comparisonData.kongViaTCycles} KONG</div>
                <div class="mb-1"><span class="opacity-70">ICP path cost:</span> {comparisonData.kongViaIcp} KONG</div>
                <div class="mb-1"><span class="opacity-70">Difference:</span> {comparisonData.difference} KONG ({comparisonData.differencePercent}%)</div>
                <div class="mt-3 text-xs opacity-70">
                  Prices may vary based on current market rates. The TCycles path uses pre-minted cycles, while the ICP path converts KONG→ICP→Cycles.
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button 
              class="bg-kong-accent-blue hover:bg-kong-accent-blue/90 text-white p-4 rounded-lg transition-colors flex items-center justify-center gap-3"
              on:click={() => choosePath('tcycles')}>
              <Coins size={20} />
              Deploy with TCycles
            </button>
            <button 
              class="bg-kong-accent-blue hover:bg-kong-accent-blue/90 text-white p-4 rounded-lg transition-colors flex items-center justify-center gap-3"
              on:click={() => choosePath('icp')}>
              <Coins size={20} />
              Deploy with ICP
            </button>
          </div>
        {/if}
      </Panel>
      
      <div class="flex justify-end mt-6">
        <button 
          class="px-6 py-2.5 font-medium transition-colors rounded-lg border border-kong-border bg-transparent hover:bg-kong-bg-light/20 flex items-center gap-2"
          on:click={() => goto("/launch")}
        >
          <ArrowLeft size={20} />
          Back to Launch
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-in-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
