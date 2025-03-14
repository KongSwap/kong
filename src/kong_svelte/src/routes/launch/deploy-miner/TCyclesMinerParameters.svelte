<script lang="ts">
  import { onMount } from "svelte";
  import { TCyclesService } from "$lib/services/canister/tcycles-service";
  import { Info } from "lucide-svelte";
  import { fetchDefaultSubnets, fetchSubnets } from "$lib/services/canister/ic-api";
  import { Principal } from "@dfinity/principal";
  
  // Props
  export let minerParams: any;
  export let kongAmount: string;
  export let tcyclesAmount: string;
  export let canisterId: string;
  export let kongTCyclesRate: string;
  export let estimatedTCycles: string;
  export let actualTCyclesReceived: string;
  export let IC_DASHBOARD_BASE_URL: string;
  export let selectedSubnetType: string = "";
  export let selectedSubnetId: string = "";
  
  // Local state
  let isLoadingComparison = false;
  let comparisonData: {
    kongViaIcp: string;
    kongViaTCycles: string;
    difference: string;
    differencePercent: string;
    cheaperPath: 'icp' | 'tcycles';
  } | null = null;
  
  // Subnet state
  let availableSubnets: any[] = [];
  let isLoadingSubnets: boolean = false;
  let subnetError: string = "";
  
  // Load comparison data on mount
  onMount(async () => {
    await loadComparisonData();
    await loadSubnets();
  });
  
  // Load comparison data when kongAmount changes
  $: if (kongAmount) {
    loadComparisonData();
  }
  
  // Function to load comparison data
  async function loadComparisonData() {
    try {
      isLoadingComparison = true;
      comparisonData = await TCyclesService.calculateKongForCanister();
    } catch (error) {
      console.error("Error loading comparison data:", error);
    } finally {
      isLoadingComparison = false;
    }
  }
  
  // Format a number with commas
  function formatNumber(value: string | number): string {
    if (!value) return "0";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  
  // Format a number as USD
  function formatUSD(value: string | number): string {
    if (!value) return "$0.00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }
  
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
      
      // Don't set a default subnet - let the user choose or leave it empty
      // for the Internet Computer to decide the optimal one
    } catch (error) {
      console.error("Error loading subnets:", error);
      subnetError = "Failed to load subnets. Please try again.";
    } finally {
      isLoadingSubnets = false;
    }
  }
</script>

<div class="miner-parameters">
  <h3 class="parameters-title">Miner Parameters</h3>
  
  <div class="parameters-grid">
    <!-- KONG Amount -->
    <div class="parameter-item">
      <div class="parameter-label">KONG Amount</div>
      <div class="parameter-value">{formatNumber(kongAmount)} KONG</div>
    </div>
    
    <!-- Estimated T-Cycles -->
    <div class="parameter-item">
      <div class="parameter-label">Estimated T-Cycles</div>
      <div class="parameter-value">
        {estimatedTCycles ? formatNumber(estimatedTCycles) : "0"} T
      </div>
    </div>
    
    <!-- KONG to T-Cycles Rate -->
    <div class="parameter-item">
      <div class="parameter-label">KONG to T-Cycles Rate</div>
      <div class="parameter-value">
        {#if kongTCyclesRate && parseFloat(kongTCyclesRate) > 0}
          1 KONG = {formatNumber(kongTCyclesRate)} T
          <div class="rate-info">
            {formatNumber(1 / parseFloat(kongTCyclesRate))} KONG = 1 T
          </div>
        {:else}
          <div class="loading-spinner"></div> Calculating rate...
        {/if}
      </div>
    </div>
    
    <!-- Path Comparison -->
    <div class="parameter-item comparison-item">
      <div class="parameter-label">
        Path Comparison
        <div class="tooltip">
          <Info size={16} />
          <span class="tooltiptext">
            Comparison between creating a canister via ICP vs. directly with TCYCLES
          </span>
        </div>
      </div>
      <div class="parameter-value comparison-value">
        {#if isLoadingComparison}
          <div class="loading-spinner"></div>
        {:else if comparisonData}
          <div class="comparison-grid">
            <div class="comparison-row">
              <span>Via ICP:</span>
              <span>{formatNumber(comparisonData.kongViaIcp)} KONG for 1T</span>
            </div>
            <div class="comparison-row">
              <span>Via TCYCLES:</span>
              <span>{formatNumber(comparisonData.kongViaTCycles)} KONG for 1T</span>
            </div>
            <div class="comparison-row savings">
              <span>Savings:</span>
              <span class="savings-value">
                {formatNumber(comparisonData.difference)} KONG ({comparisonData.differencePercent}%)
              </span>
            </div>
            <div class="note">
              <span class="note-text">
                Note: The direct T-Cycles path is more efficient than the ICP path.
              </span>
            </div>
          </div>
        {:else}
          <div>Comparison not available</div>
        {/if}
      </div>
    </div>
    
    <!-- Subnet Selection -->
    <div class="parameter-item subnet-item">
      <div class="parameter-label">Subnet Selection</div>
      <div class="parameter-value">
        <select 
          class="subnet-select" 
          bind:value={selectedSubnetId}
          disabled={isLoadingSubnets}
          on:change={() => {
            if (selectedSubnetId) {
              const selected = availableSubnets.find(s => s.id === selectedSubnetId);
              if (selected) {
                selectedSubnetType = selected.type;
              }
            } else {
              // If empty selection (let IC decide), clear the subnet type too
              selectedSubnetType = "";
            }
          }}
        >
          <option value="">Let Internet Computer decide the most optimal subnet</option>
          {#if isLoadingSubnets}
            <option value="" disabled>Loading subnets...</option>
          {:else if availableSubnets.length === 0 && !isLoadingSubnets}
            <option value="" disabled>No subnets available</option>
          {:else}
            {#each availableSubnets as subnet}
              <option value={subnet.id}>
                {subnet.displayName} ({subnet.type}, {subnet.nodeCount} nodes)
              </option>
            {/each}
          {/if}
        </select>
        
        {#if selectedSubnetId}
          <div class="subnet-info">
            <span class="subnet-id">ID: {selectedSubnetId}</span>
            {#if selectedSubnetType}
              <span class="subnet-type">Type: {selectedSubnetType}</span>
            {/if}
          </div>
        {:else}
          <div class="subnet-info optimal-note">
            <span class="subnet-optimal">The Internet Computer will select the optimal subnet for your canister</span>
          </div>
        {/if}
        
        {#if subnetError}
          <div class="subnet-error">{subnetError}</div>
        {/if}
      </div>
    </div>
    
    <!-- Canister ID (only shown when available) -->
    {#if canisterId}
      <div class="parameter-item canister-item">
        <div class="parameter-label">Canister ID</div>
        <div class="parameter-value">
          <a 
            href={`${IC_DASHBOARD_BASE_URL}${canisterId}`} 
            target="_blank" 
            rel="noopener noreferrer"
            class="canister-link"
          >
            {canisterId}
            <svg class="external-link-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .miner-parameters {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .parameters-title {
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 1.5rem;
  }
  
  .parameters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }
  
  .parameter-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .parameter-label {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .parameter-value {
    font-size: 1rem;
    color: white;
  }
  
  .rate-info {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 0.25rem;
  }
  
  .loading-spinner {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s linear infinite;
    margin-right: 0.5rem;
  }
  
  .comparison-grid {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .comparison-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }
  
  .savings {
    margin-top: 0.5rem;
    font-weight: bold;
  }
  
  .savings-value {
    color: #4ade80;
  }
  
  .note {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .subnet-select {
    width: 100%;
    background-color: rgba(0, 0, 0, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.25rem;
    padding: 0.5rem;
    font-size: 0.875rem;
  }
  
  .subnet-info {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }
  
  .subnet-id, .subnet-type {
    display: block;
    margin-bottom: 0.25rem;
    word-break: break-all;
  }
  
  .subnet-optimal {
    color: #60a5fa;
    font-style: italic;
  }
  
  .subnet-error {
    margin-top: 0.5rem;
    color: #f87171;
    font-size: 0.75rem;
  }
  
  .canister-link {
    color: #60a5fa;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-family: monospace;
    word-break: break-all;
  }
  
  .external-link-icon {
    flex-shrink: 0;
  }
  
  .tooltip {
    position: relative;
    display: inline-block;
    cursor: help;
  }
  
  .tooltiptext {
    visibility: hidden;
    width: 200px;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    text-align: center;
    border-radius: 0.25rem;
    padding: 0.5rem;
    position: absolute;
    z-index: 1;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.3s;
    font-size: 0.75rem;
    font-weight: normal;
  }
  
  .tooltip:hover .tooltiptext {
    visibility: visible;
    opacity: 1;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style> 