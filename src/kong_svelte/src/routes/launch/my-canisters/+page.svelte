<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import Panel from "$lib/components/common/Panel.svelte";
    import { ArrowLeft, ExternalLink } from "lucide-svelte";
    
    // Type for canister entries from cache
    interface CanisterEntry {
      id: string;
      tokenName: string;
      tokenSymbol: string;
      deploymentTimestamp: number;
      totalSupply: string;
      decimals: number;
    }
    
    let deployedCanisters: CanisterEntry[] = [];
    let isLoading = true;
    
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
        const cachedData = localStorage.getItem('deployedTokenCanisters');
        if (cachedData) {
          deployedCanisters = JSON.parse(cachedData);
          // Sort by deployment timestamp (newest first)
          deployedCanisters.sort((a, b) => b.deploymentTimestamp - a.deploymentTimestamp);
        }
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
      <h1 class="text-2xl font-bold">My Deployed Tokens</h1>
    </div>
    
    <!-- Main content -->
    <Panel className="p-6">
      {#if isLoading}
        <div class="flex items-center justify-center py-12">
          <div class="w-8 h-8 border-4 rounded-full border-t-transparent border-kong-primary animate-spin"></div>
          <span class="ml-3">Loading your canisters...</span>
        </div>
      {:else if deployedCanisters.length === 0}
        <div class="py-12 text-center text-kong-text-secondary">
          <h2 class="mb-2 text-lg font-semibold">No tokens deployed yet</h2>
          <p class="mb-6">You haven't deployed any tokens yet. Head over to the token deployment page to create your first token!</p>
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
                <th class="pb-3">Token</th>
                <th class="pb-3">Canister ID</th>
                <th class="pb-3">Total Supply</th>
                <th class="pb-3">Deployed on</th>
                <th class="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each deployedCanisters as canister}
                <tr class="border-b border-kong-border/20 hover:bg-kong-bg-light/5">
                  <td class="py-4">
                    <div class="flex flex-col">
                      <span class="font-medium">{canister.tokenName}</span>
                      <span class="text-sm text-kong-text-secondary">{canister.tokenSymbol}</span>
                    </div>
                  </td>
                  <td class="py-4">
                    <div class="flex items-center">
                      <span class="font-mono text-sm text-kong-text-secondary">{canister.id}</span>
                    </div>
                  </td>
                  <td class="py-4">
                    {formatTokenAmount(canister.totalSupply, canister.decimals)} {canister.tokenSymbol}
                  </td>
                  <td class="py-4 text-kong-text-secondary">
                    {formatDate(canister.deploymentTimestamp)}
                  </td>
                  <td class="py-4 text-right">
                    <button 
                      on:click={() => openDashboard(canister.id)}
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