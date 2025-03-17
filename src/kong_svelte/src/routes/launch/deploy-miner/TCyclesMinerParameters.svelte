<script lang="ts">
  import { onMount } from "svelte";
  import { TCyclesService } from "$lib/services/canister/tcycles-service";
  import { Info, ExternalLink, TrendingUp, Server, Cpu } from "lucide-svelte";
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

  // Get miner type name for display
  function getMinerTypeName(type: number): string {
    switch (type) {
      case 0: return "Basic Miner";
      case 1: return "Standard Miner";
      case 2: return "Advanced Miner";
      case 3: return "Professional Miner";
      default: return "Unknown Miner";
    }
  }
</script>

<div class="miner-parameters">
  <div class="card-grid">
    <!-- Miner Info Card -->
    <div class="card">
      <div class="card-header">
        <Cpu size={20} />
        <h3>Miner Information</h3>
      </div>
      <div class="card-content">
        {#if minerParams}
          <div class="info-row">
            <span class="info-label">Miner Type:</span>
            <span class="info-value">{getMinerTypeName(minerParams.minerType)}</span>
          </div>
        {/if}
        
        <div class="info-row">
          <span class="info-label">KONG Amount:</span>
          <span class="info-value highlight">{formatNumber(kongAmount)} KONG</span>
        </div>
        
        <div class="info-row">
          <span class="info-label">Estimated T-Cycles:</span>
          <span class="info-value highlight">
            {estimatedTCycles ? formatNumber(estimatedTCycles) : "0"} T
          </span>
        </div>
        
        <div class="info-row">
          <span class="info-label">Exchange Rate:</span>
          <span class="info-value">
            {#if kongTCyclesRate && parseFloat(kongTCyclesRate) > 0}
              <div class="rate-display">
                <span>1 KONG = {formatNumber(kongTCyclesRate)} T</span>
                <span class="rate-inverse">{formatNumber(1 / parseFloat(kongTCyclesRate))} KONG = 1 T</span>
              </div>
            {:else}
              <div class="loading-spinner"></div> Calculating...
            {/if}
          </span>
        </div>
      </div>
    </div>
    
    <!-- Cost Comparison Card -->
    <div class="card">
      <div class="card-header">
        <TrendingUp size={20} />
        <h3>Cost Comparison</h3>
        <div class="tooltip">
          <Info size={16} />
          <span class="tooltiptext">
            Comparison between creating a canister via ICP vs. directly with TCYCLES
          </span>
        </div>
      </div>
      <div class="card-content">
        {#if isLoadingComparison}
          <div class="loading-container">
            <div class="loading-spinner"></div>
            <span>Loading comparison data...</span>
          </div>
        {:else if comparisonData}
          <div class="comparison-container">
            <div class="comparison-row">
              <span class="comparison-label">Via ICP:</span>
              <span class="comparison-value">{formatNumber(comparisonData.kongViaIcp)} KONG for 1T</span>
            </div>
            <div class="comparison-row">
              <span class="comparison-label">Via TCYCLES:</span>
              <span class="comparison-value">{formatNumber(comparisonData.kongViaTCycles)} KONG for 1T</span>
            </div>
            <div class="comparison-row savings">
              <span class="comparison-label">Savings:</span>
              <span class="savings-value">
                {formatNumber(comparisonData.difference)} KONG ({comparisonData.differencePercent}%)
              </span>
            </div>
            <div class="comparison-note">
              The direct T-Cycles path is more efficient than the ICP path.
            </div>
          </div>
        {:else}
          <div class="empty-state">Comparison data not available</div>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Subnet Selection Card -->
  <div class="card full-width">
    <div class="card-header">
      <Server size={20} />
      <h3>Subnet Selection</h3>
    </div>
    <div class="card-content">
      <p class="subnet-description">
        Choose a specific subnet for your miner canister or let the Internet Computer select the optimal one.
      </p>
      
      <div class="subnet-select-container">
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
      </div>
      
      {#if selectedSubnetId}
        <div class="subnet-details">
          <div class="subnet-detail-item">
            <span class="subnet-detail-label">ID:</span>
            <code class="subnet-detail-value">{selectedSubnetId}</code>
          </div>
          {#if selectedSubnetType}
            <div class="subnet-detail-item">
              <span class="subnet-detail-label">Type:</span>
              <span class="subnet-detail-value subnet-type-badge">{selectedSubnetType}</span>
            </div>
          {/if}
        </div>
      {:else}
        <div class="subnet-auto-select">
          <Info size={16} />
          <span>The Internet Computer will select the optimal subnet for your canister</span>
        </div>
      {/if}
      
      {#if subnetError}
        <div class="subnet-error">{subnetError}</div>
      {/if}
    </div>
  </div>
  
  <!-- Canister ID Card (only shown when available) -->
  {#if canisterId}
    <div class="card full-width">
      <div class="card-header">
        <h3>Canister ID</h3>
      </div>
      <div class="card-content">
        <div class="canister-id-container">
          <code class="canister-id">{canisterId}</code>
          <a 
            href={`${IC_DASHBOARD_BASE_URL}${canisterId}`} 
            target="_blank" 
            rel="noopener noreferrer"
            class="dashboard-link"
          >
            View on IC Dashboard
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .miner-parameters {
    width: 100%;
  }
  
  .card-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  @media (max-width: 768px) {
    .card-grid {
      grid-template-columns: 1fr;
    }
  }
  
  .card {
    background-color: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(71, 85, 105, 0.3);
    border-radius: 0.5rem;
    overflow: hidden;
    transition: all 0.2s ease;
  }
  
  .card:hover {
    border-color: rgba(71, 85, 105, 0.5);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  
  .full-width {
    grid-column: 1 / -1;
  }
  
  .card-header {
    background-color: rgba(15, 23, 42, 0.5);
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid rgba(71, 85, 105, 0.2);
  }
  
  .card-header h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    flex-grow: 1;
  }
  
  .card-content {
    padding: 1rem;
  }
  
  /* Info rows styling */
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(71, 85, 105, 0.1);
  }
  
  .info-row:last-child {
    border-bottom: none;
  }
  
  .info-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }
  
  .info-value {
    font-weight: 500;
  }
  
  .highlight {
    color: #60a5fa;
    font-weight: 600;
  }
  
  .rate-display {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
  }
  
  .rate-inverse {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 0.25rem;
  }
  
  /* Comparison styling */
  .comparison-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .comparison-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .comparison-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }
  
  .comparison-value {
    font-weight: 500;
  }
  
  .savings {
    margin-top: 0.25rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(71, 85, 105, 0.2);
  }
  
  .savings-value {
    color: #10b981;
    font-weight: 600;
  }
  
  .comparison-note {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
    background-color: rgba(16, 185, 129, 0.1);
    border-left: 2px solid #10b981;
    padding: 0.5rem;
    border-radius: 0.25rem;
  }
  
  /* Subnet selection styling */
  .subnet-description {
    margin-bottom: 1rem;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }
  
  .subnet-select-container {
    margin-bottom: 1rem;
  }
  
  .subnet-select {
    width: 100%;
    background-color: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(71, 85, 105, 0.3);
    color: white;
    padding: 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 1rem;
    transition: all 0.2s ease;
  }
  
  .subnet-select:focus {
    outline: none;
    border-color: #60a5fa;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.25);
  }
  
  .subnet-details {
    background-color: rgba(15, 23, 42, 0.3);
    border-radius: 0.375rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .subnet-detail-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .subnet-detail-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
    min-width: 3rem;
  }
  
  .subnet-detail-value {
    font-weight: 500;
  }
  
  code.subnet-detail-value {
    font-family: monospace;
    background-color: rgba(0, 0, 0, 0.2);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
  }
  
  .subnet-type-badge {
    background-color: rgba(96, 165, 250, 0.2);
    color: #60a5fa;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
  }
  
  .subnet-auto-select {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: rgba(96, 165, 250, 0.1);
    border-radius: 0.375rem;
    padding: 0.75rem;
    color: #60a5fa;
    font-size: 0.875rem;
  }
  
  .subnet-error {
    margin-top: 0.75rem;
    color: #ef4444;
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: 0.375rem;
    padding: 0.75rem;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  /* Canister ID styling */
  .canister-id-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .canister-id {
    font-family: monospace;
    background-color: rgba(15, 23, 42, 0.5);
    padding: 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    word-break: break-all;
    border: 1px solid rgba(71, 85, 105, 0.2);
  }
  
  .dashboard-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    color: #60a5fa;
    font-size: 0.875rem;
    text-decoration: none;
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    background-color: rgba(96, 165, 250, 0.1);
    transition: all 0.2s ease;
    width: fit-content;
  }
  
  .dashboard-link:hover {
    background-color: rgba(96, 165, 250, 0.2);
  }
  
  /* Loading states */
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.5rem 0;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .loading-spinner {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  .empty-state {
    text-align: center;
    padding: 1.5rem 0;
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
  }
  
  /* Tooltip */
  .tooltip {
    position: relative;
    display: inline-flex;
    cursor: help;
  }
  
  .tooltiptext {
    visibility: hidden;
    width: 220px;
    background-color: rgba(15, 23, 42, 0.95);
    color: #fff;
    text-align: center;
    border-radius: 0.375rem;
    padding: 0.75rem;
    position: absolute;
    z-index: 1;
    bottom: 125%;
    right: 0;
    opacity: 0;
    transition: opacity 0.3s;
    font-size: 0.75rem;
    font-weight: normal;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(71, 85, 105, 0.3);
  }
  
  .tooltip:hover .tooltiptext {
    visibility: visible;
    opacity: 1;
  }
</style> 