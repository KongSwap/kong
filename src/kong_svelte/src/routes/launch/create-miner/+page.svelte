<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { minerParams } from "$lib/stores/minerParams";
  import { TCyclesService } from "$lib/services/canister/tcycles-service";
  import { ArrowLeft, ArrowRight, Calculator, Coins } from "lucide-svelte";
  import { writable } from "svelte/store";

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

<div class="flex flex-col items-center justify-center">
  <div class="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 max-w-xl w-full shadow-xl">
    <h1 class="text-2xl font-bold mb-4 text-center">Miner Deployment Options</h1>
    
    {#if loading || comparing}
      <div class="flex flex-col items-center justify-center py-8">
        <div class="w-12 h-12 border-4 border-t-blue-500 border-b-transparent border-l-transparent border-r-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-kong-text-primary/60">{comparing ? 'Comparing prices...' : 'Preparing deployment options...'}</p>
      </div>
    {:else if error}
      <div class="bg-red-900/20 border border-red-900 rounded p-4 mb-6">
        <p class="text-red-300">{error}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button 
          class="bg-blue-800 hover:bg-blue-700 text-white p-4 rounded-lg transition-colors flex items-center justify-center gap-3"
          on:click={() => choosePath('tcycles')}>
          <Coins size={20} />
          Deploy with TCycles
        </button>
        <button 
          class="bg-blue-800 hover:bg-blue-700 text-white p-4 rounded-lg transition-colors flex items-center justify-center gap-3"
          on:click={() => choosePath('icp')}>
          <Coins size={20} />
          Deploy with ICP
        </button>
      </div>
    {:else if comparisonData}
      <div class="mb-6 p-4 bg-blue-900/20 border border-blue-900 rounded">
        <p class="text-blue-300 mb-2">We found a better price option for you!</p>
        <p class="text-kong-text-primary/80">Choose your preferred deployment method below. The {comparisonData.cheaperPath === 'tcycles' ? 'TCycles' : 'ICP'} path is currently cheaper.</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button 
          class={`p-4 rounded-lg transition-colors flex flex-col items-center justify-center ${comparisonData.cheaperPath === 'tcycles' ? 'bg-green-800 hover:bg-green-700 ring-2 ring-green-500' : 'bg-blue-800 hover:bg-blue-700'}`}
          on:click={() => choosePath('tcycles')}>
          <div class="flex items-center justify-center gap-2 mb-2">
            <Coins size={20} />
            <span class="font-bold">TCycles Path</span>
          </div>
          <div class="text-sm opacity-80">Cost: {comparisonData.kongViaTCycles} KONG</div>
          {#if comparisonData.cheaperPath === 'tcycles'}
            <div class="text-xs mt-2 px-2 py-1 bg-green-700 rounded-full text-white">Cheaper by {comparisonData.differencePercent}%</div>
          {/if}
        </button>
        
        <button 
          class={`p-4 rounded-lg transition-colors flex flex-col items-center justify-center ${comparisonData.cheaperPath === 'icp' ? 'bg-green-800 hover:bg-green-700 ring-2 ring-green-500' : 'bg-blue-800 hover:bg-blue-700'}`}
          on:click={() => choosePath('icp')}>
          <div class="flex items-center justify-center gap-2 mb-2">
            <Coins size={20} />
            <span class="font-bold">ICP Path</span>
          </div>
          <div class="text-sm opacity-80">Cost: {comparisonData.kongViaIcp} KONG</div>
          {#if comparisonData.cheaperPath === 'icp'}
            <div class="text-xs mt-2 px-2 py-1 bg-green-700 rounded-full text-white">Cheaper by {comparisonData.differencePercent}%</div>
          {/if}
        </button>
      </div>
      
      <div class="mt-4">
        <button 
          class="text-blue-400 text-sm flex items-center justify-center w-full"
          on:click={() => showDetails = !showDetails}>
          {showDetails ? 'Hide' : 'Show'} price details
          <ArrowRight size={16} class={`ml-1 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
        </button>
        
        {#if showDetails}
          <div class="mt-2 p-3 bg-gray-900 rounded text-sm">
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
          class="bg-blue-800 hover:bg-blue-700 text-white p-4 rounded-lg transition-colors flex items-center justify-center gap-3"
          on:click={() => choosePath('tcycles')}>
          <Coins size={20} />
          Deploy with TCycles
        </button>
        <button 
          class="bg-blue-800 hover:bg-blue-700 text-white p-4 rounded-lg transition-colors flex items-center justify-center gap-3"
          on:click={() => choosePath('icp')}>
          <Coins size={20} />
          Deploy with ICP
        </button>
      </div>
    {/if}
    
    <div class="mt-6 flex justify-center">
      <button class="text-kong-text-primary/60 hover:text-kong-text-primary flex items-center" on:click={() => goto("/launch")}>
        <ArrowLeft size={16} class="mr-1" />
        Back to Launch
      </button>
    </div>
  </div>
</div>

<style>
</style>
