<script lang="ts">
  // Props
  export let tokenParams: any;
  export let kongAmount: string;
  export let icpAmount: string;
  export let canisterId: string;
  export let kongIcpRate: string;
  export let estimatedTCycles: string;
  export let actualIcpReceived: string;
  export let IC_DASHBOARD_BASE_URL: string;
</script>

<div class="token-parameters">
  <h3 class="text-xl font-bold mb-4">Token Parameters</h3>
  
  {#if tokenParams}
    <div class="param-grid">
      <div class="param-group">
        <h4 class="param-group-title">Token Details</h4>
        <div class="param-row">
          <span class="param-label">Name:</span>
          <span class="param-value">{tokenParams.name}</span>
        </div>
        <div class="param-row">
          <span class="param-label">Symbol:</span>
          <span class="param-value">{tokenParams.symbol}</span>
        </div>
        <div class="param-row">
          <span class="param-label">Decimals:</span>
          <span class="param-value">{tokenParams.decimals}</span>
        </div>
        <div class="param-row">
          <span class="param-label">Initial Supply:</span>
          <span class="param-value">{tokenParams.initialSupply}</span>
        </div>
      </div>
      
      <div class="param-group">
        <h4 class="param-group-title">Deployment Costs</h4>
        <div class="param-row">
          <span class="param-label">KONG Amount:</span>
          <span class="param-value">{kongAmount} KONG</span>
        </div>
        <div class="param-row">
          <span class="param-label">ICP Estimate:</span>
          <span class="param-value">{icpAmount} ICP</span>
        </div>
        {#if actualIcpReceived !== "0"}
          <div class="param-row">
            <span class="param-label">Actual ICP:</span>
            <span class="param-value">{actualIcpReceived} ICP</span>
          </div>
        {/if}
        <div class="param-row">
          <span class="param-label">Est. T-Cycles:</span>
          <span class="param-value">{estimatedTCycles}T</span>
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
    <div class="loading-params">Loading token parameters...</div>
  {/if}
</div>

<style>
  .token-parameters {
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
