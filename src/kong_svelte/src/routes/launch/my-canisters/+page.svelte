<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import Panel from "$lib/components/common/Panel.svelte";
    import { ArrowLeft, ExternalLink } from "lucide-svelte";
    import TokenInterface from "./token/TokenInterface.svelte";
    import MinerInterface from "./miner/MinerInterface.svelte";
    
    // Type for token canister entries from cache
    interface TokenCanisterEntry {
      id: string;
      tokenName: string;
      tokenSymbol: string;
      deploymentTimestamp: number;
      totalSupply: string;
      decimals: number;
      type: 'token';
    }
    
    // Type for miner canister entries
    interface MinerCanisterEntry {
      id: string;
      deploymentTimestamp: number;
      type: 'miner';
    }
    
    type CanisterEntry = TokenCanisterEntry | MinerCanisterEntry;
    
    let deployedCanisters: CanisterEntry[] = [];
    let isLoading = true;
    let selectedCanister: CanisterEntry | null = null;
    
    // Format date for display
    function formatDate(timestamp: number): string {
      return new Date(timestamp).toLocaleString();
    }
    
    // Format token amount with proper decimals
    function formatTokenAmount(amount: string, decimals: number): string {
      const value = BigInt(amount);
      const divisor = BigInt(10) ** BigInt(decimals);
      const wholePart = value / divisor;
      const fractionalPart = value % divisor;
      
      // Format fractional part with leading zeros
      let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
      // Trim trailing zeros
      fractionalStr = fractionalStr.replace(/0+$/, '');
      
      if (fractionalStr.length > 0) {
        return `${wholePart.toString()}.${fractionalStr}`;
      } else {
        return wholePart.toString();
      }
    }
    
    // Load deployed canisters from cache
    function loadDeployedCanisters() {
      try {
        // Load token canisters
        const cachedTokenData = localStorage.getItem('deployedTokenCanisters');
        let tokenCanisters: TokenCanisterEntry[] = [];
        if (cachedTokenData) {
          tokenCanisters = JSON.parse(cachedTokenData).map((canister: any) => ({
            ...canister,
            type: 'token'
          }));
        }
        
        // Load miner canisters
        const cachedMinerData = localStorage.getItem('deployedMinerCanisters');
        let minerCanisters: MinerCanisterEntry[] = [];
        if (cachedMinerData) {
          minerCanisters = JSON.parse(cachedMinerData).map((canister: any) => ({
            ...canister,
            type: 'miner'
          }));
        }
        
        // Combine and sort by deployment timestamp (newest first)
        deployedCanisters = [...tokenCanisters, ...minerCanisters];
        deployedCanisters.sort((a, b) => b.deploymentTimestamp - a.deploymentTimestamp);
      } catch (error) {
        console.error("Error loading deployed canisters:", error);
      } finally {
        isLoading = false;
      }
    }
    
    onMount(() => {
      loadDeployedCanisters();
    });
    
    // Navigate back to launch
    function goToLaunch() {
      goto("/launch");
    }
    
    // Open canister in IC dashboard
    function openDashboard(canisterId: string) {
      window.open(`https://dashboard.internetcomputer.org/canister/${canisterId}`, '_blank');
    }
    
    // Select a canister to view details
    function selectCanister(canister: CanisterEntry) {
      selectedCanister = canister;
    }
    
    // Go back to list view
    function backToList() {
      selectedCanister = null;
    }
  </script>
  
  <div class="max-w-[1200px] mx-auto p-4">
    <!-- Header with back button -->
    <div class="flex items-center gap-4 mb-6">
      <button 
        on:click={goToLaunch}
        class="flex items-center gap-2 px-3 py-2 transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light/10"
      >
        <ArrowLeft size={18} />
        <span>Back to Launch</span>
      </button>
      <h1 class="text-2xl font-bold">My Deployed Canisters</h1>
    </div>
    
    <!-- Main content -->
    <Panel className="p-6">
      {#if isLoading}
        <div class="flex items-center justify-center py-12">
          <div class="w-8 h-8 border-4 rounded-full border-t-transparent border-kong-primary animate-spin"></div>
          <span class="ml-3">Loading your canisters...</span>
        </div>
      {:else if selectedCanister}
        <!-- Back to list button -->
        <div class="mb-4">
          <button 
            on:click={backToList}
            class="flex items-center gap-2 px-3 py-2 transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light/10"
          >
            <ArrowLeft size={18} />
            <span>Back to list</span>
          </button>
        </div>
        
        <!-- Canister interface based on type -->
        {#if selectedCanister.type === 'token'}
          <TokenInterface canister={selectedCanister} />
        {:else if selectedCanister.type === 'miner'}
          <MinerInterface canisterId={selectedCanister.id} />
        {/if}
      {:else if deployedCanisters.length === 0}
        <div class="py-12 text-center text-kong-text-secondary">
          <h2 class="mb-2 text-lg font-semibold">No canisters deployed yet</h2>
          <p class="mb-6">You haven't deployed any canisters yet. Head over to the deployment page to create your first canister!</p>
          <button 
            on:click={() => goto("/launch/deploy-token")}
            class="px-4 py-2 font-medium transition-colors rounded-lg bg-kong-primary text-kong-text-inverse hover:bg-kong-primary-dark"
          >
            Deploy a Token
          </button>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="text-left border-b border-kong-border/30">
                <th class="pb-3">Type</th>
                <th class="pb-3">Name/ID</th>
                <th class="pb-3">Deployed on</th>
                <th class="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each deployedCanisters as canister}
                <tr class="border-b border-kong-border/20 hover:bg-kong-bg-light/5 cursor-pointer" on:click={() => selectCanister(canister)}>
                  <td class="py-4">
                    <span class="px-2 py-1 text-xs font-medium rounded-full {canister.type === 'token' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}">
                      {canister.type === 'token' ? 'Token' : 'Miner'}
                    </span>
                  </td>
                  <td class="py-4">
                    <div class="flex flex-col">
                      {#if canister.type === 'token'}
                        <span class="font-medium">{canister.tokenName}</span>
                        <span class="text-sm text-kong-text-secondary">{canister.tokenSymbol}</span>
                      {:else}
                        <span class="font-mono text-sm">{canister.id}</span>
                      {/if}
                    </div>
                  </td>
                  <td class="py-4 text-kong-text-secondary">
                    {formatDate(canister.deploymentTimestamp)}
                  </td>
                  <td class="py-4 text-right">
                    <button 
                      on:click={(e) => {
                        e.stopPropagation();
                        openDashboard(canister.id);
                      }}
                      class="flex items-center gap-1 px-3 py-1.5 ml-auto transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light/10"
                    >
                      <ExternalLink size={16} />
                      <span>Dashboard</span>
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Panel>
  </div>
