<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import TopUp from './TopUp.svelte';
    import TopUpTCycles from './TopUpTCycles.svelte';
    import { ArrowLeft, HelpCircle, Coins } from 'lucide-svelte';
    import Panel from '$lib/components/common/Panel.svelte';
    import { TCyclesService } from '$lib/services/canister/tcycles-service';
    import { writable } from 'svelte/store';

    let canisterId: string | null = null;
    let selectedRoute: 'icp' | 'tcycles' | null = null;
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

    // Use a reactive statement to update canisterId when the URL changes
    $: if (browser && $page && $page.url) {
        const newCanisterId = $page.url.searchParams.get('canisterId');
        if (newCanisterId !== canisterId) {
            console.log("URL canisterId changed from", canisterId, "to", newCanisterId);
            canisterId = newCanisterId;
        }
    }

    function goBack() {
        goto('/launch/my-canisters');
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
            loading = false;
        }
    }

    onMount(() => {
        if (browser) {
            console.log("Page component mounted, $page.url:", $page.url);
            getPriceComparison();
        }
    });
</script>

<div class="grid gap-6 lg:grid-cols-12 max-w-[1200px] mx-auto">
    <!-- Left sidebar with navigation -->
    <div class="lg:col-span-3">
        <div class="sticky flex flex-col gap-5 top-6">
            <!-- Back button -->
            <button 
                on:click={goBack}
                class="flex items-center gap-2 px-3 py-2 transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light/10"
            >
                <ArrowLeft size={18} />
                <span>Back to My Canisters</span>
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
                            Top up your canister with KONG to add cycles. These cycles are used to pay for computation and storage on the Internet Computer.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Main content area -->
    <div class="pr-2 overflow-auto lg:col-span-9">
        {#if !selectedRoute}
            <Panel variant="solid" type="main" className="p-6 backdrop-blur-xl">
                <h1 class="text-2xl font-bold mb-4">Canister Top-Up Options</h1>
                
                {#if loading || comparing}
                    <div class="flex flex-col items-center justify-center py-8">
                        <div class="w-12 h-12 border-4 border-t-blue-500 border-b-transparent border-l-transparent border-r-transparent rounded-full animate-spin mb-4"></div>
                        <p class="text-kong-text-primary/60">{comparing ? 'Comparing prices...' : 'Preparing top-up options...'}</p>
                    </div>
                {:else if error}
                    <div class="bg-red-900/20 border border-red-900 rounded-lg p-4 mb-6">
                        <p class="text-red-300">{error}</p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <button 
                            class="bg-kong-accent-blue hover:bg-kong-accent-blue/90 text-white p-4 rounded-lg transition-colors flex items-center justify-center gap-3"
                            on:click={() => selectedRoute = 'tcycles'}>
                            <Coins size={20} />
                            Top Up with TCycles
                        </button>
                        <button 
                            class="bg-kong-accent-blue hover:bg-kong-accent-blue/90 text-white p-4 rounded-lg transition-colors flex items-center justify-center gap-3"
                            on:click={() => selectedRoute = 'icp'}>
                            <Coins size={20} />
                            Top Up with ICP
                        </button>
                    </div>
                {:else if comparisonData}
                    <div class="mb-6 p-4 bg-kong-accent-blue/20 border border-kong-accent-blue/30 rounded-lg">
                        <p class="text-kong-accent-blue mb-2 font-medium">We found a better price option for you!</p>
                        <p class="text-kong-text-primary/80">Choose your preferred top-up method below. The {comparisonData.cheaperPath === 'tcycles' ? 'TCycles' : 'ICP'} path is currently cheaper.</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <button 
                            class={`p-4 rounded-lg transition-colors flex flex-col items-center justify-center ${comparisonData.cheaperPath === 'tcycles' ? 'bg-kong-accent-green hover:bg-kong-accent-green/90 ring-2 ring-kong-accent-green' : 'bg-kong-accent-blue hover:bg-kong-accent-blue/90'}`}
                            on:click={() => selectedRoute = 'tcycles'}>
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
                            on:click={() => selectedRoute = 'icp'}>
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
                            <svg xmlns="http://www.w3.org/2000/svg" class={`w-4 h-4 ml-1 transition-transform ${showDetails ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
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
                            on:click={() => selectedRoute = 'tcycles'}>
                            <Coins size={20} />
                            Top Up with TCycles
                        </button>
                        <button 
                            class="bg-kong-accent-blue hover:bg-kong-accent-blue/90 text-white p-4 rounded-lg transition-colors flex items-center justify-center gap-3"
                            on:click={() => selectedRoute = 'icp'}>
                            <Coins size={20} />
                            Top Up with ICP
                        </button>
                    </div>
                {/if}
            </Panel>
        {:else}
            <Panel variant="solid" type="main" className="p-4 backdrop-blur-xl">
                <div class="flex justify-between items-center mb-4">
                    <h1 class="text-2xl font-bold">Top Up Canister with {selectedRoute === 'icp' ? 'ICP' : 'TCycles'}</h1>
                    <button 
                        class="px-3 py-1 text-sm border border-kong-border rounded-lg hover:bg-kong-bg-light/10 transition-colors"
                        on:click={() => selectedRoute = null}
                    >
                        Change Method
                    </button>
                </div>
                {#if selectedRoute === 'icp'}
                    <TopUp {canisterId} />
                {:else if selectedRoute === 'tcycles'}
                    <TopUpTCycles {canisterId} />
                {/if}
            </Panel>
        {/if}
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
