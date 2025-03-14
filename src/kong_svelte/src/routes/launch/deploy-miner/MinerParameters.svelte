<script lang="ts">
  import { onMount } from "svelte";
  import { fetchDefaultSubnets, fetchSubnets } from "$lib/services/canister/ic-api";
  import { Principal } from "@dfinity/principal";
  
  // Props
  export let minerParams: any;
  export let kongAmount: string;
  export let icpAmount: string;
  export let canisterId: string;
  export let kongIcpRate: string;
  export let estimatedTCycles: string;
  export let actualIcpReceived: string;
  export let IC_DASHBOARD_BASE_URL: string;
  
  // Add new props for subnet selection
  export let selectedSubnetType: string = "";
  export let selectedSubnetId: string = "";
  
  // Local state
  let availableSubnets: any[] = [];
  let isLoadingSubnets: boolean = false;
  let subnetError: string = "";
  
  // Get miner type name
  function getMinerTypeName(minerType: any): string {
    if (!minerType) return "Unknown";
    if ("Lite" in minerType) return "Lite Miner";
    if ("Normal" in minerType) return "Normal Miner";
    if ("Premium" in minerType) return "Premium Miner";
    return "Unknown Miner";
  }
  
  // Format T-Cycles for display
  $: displayTCycles = estimatedTCycles === "0" || !estimatedTCycles ? "Calculating..." : `${estimatedTCycles}T`;
  
  // Load subnets on mount
  onMount(async () => {
    await loadSubnets();
  });
  
  // Load available subnets
  async function loadSubnets() {
    try {
      isLoadingSubnets = true;
      subnetError = "";
      
      // Fetch default subnets from CMC
      const defaultSubnets = await fetchDefaultSubnets();
      console.log("Fetched default subnets:", defaultSubnets.map(s => s.toText()));
      
      // Also fetch subnet details for additional information
      const subnetDetails = await fetchSubnets();
      console.log("Fetched subnet details:", subnetDetails);
      
      // Create a map of subnet IDs to subnet details
      const subnetDetailsMap = new Map();
      subnetDetails.forEach(subnet => {
        subnetDetailsMap.set(subnet.subnet_id, subnet);
      });
      
      // Process subnets
      availableSubnets = defaultSubnets.map(subnet => {
        const subnetId = subnet.toText();
        const details = subnetDetailsMap.get(subnetId);
        
        return {
          id: subnetId,
          type: details?.subnet_type || "Unknown",
          displayName: details?.display_name || subnetId.substring(0, 10) + "...",
          nodeCount: details?.node_count || "Unknown",
          status: details?.status || "Unknown"
        };
      });
      
      console.log("Processed available subnets:", availableSubnets);
      
      // Set default subnet if available
      if (availableSubnets.length > 0 && !selectedSubnetId) {
        selectedSubnetId = availableSubnets[0].id;
        selectedSubnetType = availableSubnets[0].type;
        console.log(`Selected subnet ID: ${selectedSubnetId} (${selectedSubnetType})`);
      }
    } catch (error) {
      console.error("Error loading subnets:", error);
      subnetError = "Failed to load subnets. Please try again.";
    } finally {
      isLoadingSubnets = false;
    }
  }
</script>

<div class="miner-parameters">
  <h3 class="mb-4 text-xl font-bold">Miner Parameters</h3>
  
  {#if minerParams}
    <div class="param-grid">
      <div class="param-group">
        <h4 class="param-group-title">Miner Details</h4>
        <div class="param-row">
          <span class="param-label">Type:</span>
          <span class="param-value">{getMinerTypeName(minerParams.minerType)}</span>
        </div>
        
        <!-- Subnet Selection -->
        <div class="param-row subnet-selection">
          <span class="param-label">Subnet:</span>
          <select 
            class="subnet-select"
            bind:value={selectedSubnetId}
            disabled={isLoadingSubnets || availableSubnets.length === 0}
            on:change={() => {
              const selected = availableSubnets.find(s => s.id === selectedSubnetId);
              if (selected) {
                selectedSubnetType = selected.type;
              }
            }}
          >
            {#if isLoadingSubnets}
              <option value="">Loading subnets...</option>
            {:else if availableSubnets.length === 0}
              <option value="">No subnets available</option>
            {:else}
              {#each availableSubnets as subnet}
                <option value={subnet.id}>
                  {subnet.displayName} ({subnet.type}, {subnet.nodeCount} nodes)
                </option>
              {/each}
            {/if}
          </select>
        </div>
        
        {#if selectedSubnetId}
          <div class="subnet-info">
            <span class="subnet-id">ID: {selectedSubnetId}</span>
            {#if selectedSubnetType}
              <span class="subnet-type">Type: {selectedSubnetType}</span>
            {/if}
          </div>
        {/if}
        
        {#if subnetError}
          <div class="subnet-error">{subnetError}</div>
        {/if}
      </div>
      
      <div class="param-group">
        <h4 class="param-group-title">Deployment Costs</h4>
        <div class="param-row">
          <span class="param-label">KONG Amount:</span>
          <span class="param-value">{kongAmount} KONG</span>
        </div>
        <div class="param-row">
          <span class="param-label">Est. T-Cycles:</span>
          <span class="param-value">
            {displayTCycles}
          </span>
        </div>
      </div>
    </div>
    
    {#if canisterId}
      <div class="canister-info">
        <h4 class="param-group-title">Canister Information</h4>
        <div class="param-row">
          <span class="param-label">Canister ID:</span>
          <span class="param-value canister-id">{canisterId}</span>
        </div>
        <div class="param-row">
          <span class="param-label">Dashboard:</span>
          <a href="{IC_DASHBOARD_BASE_URL}{canisterId}" target="_blank" rel="noopener noreferrer" class="dashboard-link">
            View on IC Dashboard
          </a>
        </div>
      </div>
    {/if}
  {:else}
    <div class="loading-params">Loading miner parameters...</div>
  {/if}
</div>

<style>
  .miner-parameters {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .param-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }
  
  .param-group {
    margin-bottom: 1.5rem;
  }
  
  .param-group-title {
    font-weight: bold;
    font-size: 1.1rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .param-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  
  .param-label {
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
  }
  
  .param-value {
    font-family: monospace;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .subnet-selection {
    margin-top: 1rem;
  }
  
  .subnet-select {
    background-color: rgba(0, 0, 0, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-family: monospace;
    width: 60%;
  }
  
  .subnet-info {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
    font-family: monospace;
    word-break: break-all;
  }
  
  .subnet-id {
    display: block;
    padding-left: 8rem;
    font-size: 0.75rem;
  }
  
  .subnet-type {
    display: block;
    padding-left: 8rem;
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
  
  .subnet-error {
    color: #ef4444;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
  
  .canister-info {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .canister-id {
    font-family: monospace;
    word-break: break-all;
  }
  
  .dashboard-link {
    color: #3b82f6;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
  
  .dashboard-link:hover {
    text-decoration: underline;
  }
  
  .loading-params {
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
    text-align: center;
    padding: 2rem 0;
  }
  
  @media (max-width: 768px) {
    .param-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }
</style> 
