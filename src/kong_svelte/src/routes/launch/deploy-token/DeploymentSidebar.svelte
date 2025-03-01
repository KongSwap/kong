<script lang="ts">
  import { onMount } from "svelte";
  import { formatDistanceToNow } from "date-fns";
  import { CheckCircle2, XCircle, Clock, AlertCircle, Trash2, RefreshCw } from "lucide-svelte";
  import { deploymentHistoryStore, type DeploymentHistoryEntry } from "$lib/stores/deploymentHistory";
  
  // Props
  export let onLoadDeployment = (deployment: DeploymentHistoryEntry) => {};
  
  // Local state
  let deployments: DeploymentHistoryEntry[] = [];
  let selectedDeploymentId: string | null = null;
  
  // Format timestamp to relative time
  function formatTimestamp(timestamp: number): string {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  }
  
  // Get icon component based on status
  function getStatusIcon(completed: boolean, error: string | undefined) {
    if (error) return XCircle;
    return completed ? CheckCircle2 : Clock;
  }
  
  // Get CSS class based on status
  function getStatusClass(completed: boolean, error: string | undefined): string {
    if (error) return "text-red-500";
    return completed ? "text-green-500" : "text-blue-500";
  }
  
  // Handle deployment selection
  function selectDeployment(id: string) {
    selectedDeploymentId = id;
  }
  
  // Handle loading a deployment
  function loadDeployment(deployment: DeploymentHistoryEntry) {
    onLoadDeployment(deployment);
  }
  
  // Handle deleting a deployment
  function deleteDeployment(event: Event, id: string) {
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this deployment?")) {
      deploymentHistoryStore.removeDeployment(id);
      if (selectedDeploymentId === id) {
        selectedDeploymentId = null;
      }
    }
  }
  
  // Subscribe to the deployment history store
  onMount(() => {
    const unsubscribe = deploymentHistoryStore.subscribe(value => {
      deployments = value;
    });
    
    return unsubscribe;
  });
</script>

<div class="deployment-sidebar">
  <header class="sidebar-header">
    <h2>Deployment History</h2>
  </header>
  
  <div class="sidebar-content">
    {#if deployments.length === 0}
      <div class="empty-state">
        <AlertCircle size={32} />
        <p>No deployment history available</p>
      </div>
    {:else}
      <div class="deployment-list">
        {#each deployments as deployment}
          <div 
            class="deployment-item" 
            class:selected={selectedDeploymentId === deployment.id}
            on:click={() => selectDeployment(deployment.id)}
          >
            <div class="deployment-icon {getStatusClass(deployment.completed, deployment.error)}">
              <svelte:component this={getStatusIcon(deployment.completed, deployment.error)} size={20} />
            </div>
            <div class="deployment-details">
              <div class="deployment-name">
                {deployment.tokenName} ({deployment.tokenSymbol})
              </div>
              <div class="deployment-time">
                <Clock size={12} />
                <span>{formatTimestamp(deployment.timestamp)}</span>
              </div>
              {#if deployment.canisterId}
                <div class="deployment-canister">
                  ID: {deployment.canisterId.slice(0, 10)}...
                </div>
              {/if}
            </div>
            <button 
              class="delete-button" 
              on:click={(e) => deleteDeployment(e, deployment.id)}
              title="Delete deployment"
            >
              <Trash2 size={16} />
            </button>
          </div>
        {/each}
      </div>
      
      {#if selectedDeploymentId}
        {@const selectedDeployment = deployments.find(d => d.id === selectedDeploymentId)}
        {#if selectedDeployment}
          <div class="deployment-details-panel">
            <h3>Deployment Details</h3>
            <div class="detail-item">
              <span class="detail-label">Token:</span>
              <span class="detail-value">{selectedDeployment.tokenName} ({selectedDeployment.tokenSymbol})</span>
            </div>
            {#if selectedDeployment.canisterId}
              <div class="detail-item">
                <span class="detail-label">Canister ID:</span>
                <span class="detail-value canister-id">{selectedDeployment.canisterId}</span>
              </div>
            {/if}
            <div class="detail-item">
              <span class="detail-label">Created:</span>
              <span class="detail-value">{new Date(selectedDeployment.timestamp).toLocaleString()}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Status:</span>
              <span class="detail-value {getStatusClass(selectedDeployment.completed, selectedDeployment.error)}">
                {selectedDeployment.error ? 'Failed' : (selectedDeployment.completed ? 'Completed' : 'In Progress')}
              </span>
            </div>
            {#if selectedDeployment.error}
              <div class="detail-item">
                <span class="detail-label">Error:</span>
                <span class="detail-value error-message">{selectedDeployment.error}</span>
              </div>
            {/if}
            
            <button 
              class="load-button" 
              on:click={() => loadDeployment(selectedDeployment)}
              disabled={selectedDeployment.completed}
            >
              <RefreshCw size={16} />
              {selectedDeployment.completed ? 'Deployment Completed' : 'Continue Deployment'}
            </button>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</div>

<style>
  .deployment-sidebar {
    background-color: #1a1b26;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 300px;
  }
  
  .sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .sidebar-header h2 {
    font-size: 1.25rem;
    font-weight: bold;
    margin: 0;
  }
  
  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: rgba(255, 255, 255, 0.5);
    gap: 1rem;
  }
  
  .deployment-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .deployment-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 0.25rem;
    background-color: rgba(255, 255, 255, 0.05);
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }
  
  .deployment-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .deployment-item.selected {
    background-color: rgba(59, 130, 246, 0.2);
    border-left: 3px solid rgb(59, 130, 246);
  }
  
  .deployment-icon {
    margin-top: 0.25rem;
  }
  
  .deployment-details {
    flex: 1;
    min-width: 0;
  }
  
  .deployment-name {
    font-weight: 500;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .deployment-time {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 0.25rem;
  }
  
  .deployment-canister {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .delete-button {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    opacity: 0;
    transition: all 0.2s;
  }
  
  .deployment-item:hover .delete-button {
    opacity: 1;
  }
  
  .delete-button:hover {
    color: rgb(239, 68, 68);
    background-color: rgba(239, 68, 68, 0.1);
  }
  
  .deployment-details-panel {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 0.25rem;
    padding: 1rem;
    margin-top: 1rem;
  }
  
  .deployment-details-panel h3 {
    font-size: 1rem;
    font-weight: bold;
    margin: 0 0 1rem 0;
  }
  
  .detail-item {
    margin-bottom: 0.75rem;
  }
  
  .detail-label {
    display: block;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 0.25rem;
  }
  
  .detail-value {
    font-size: 0.875rem;
    word-break: break-all;
  }
  
  .canister-id {
    font-family: monospace;
    font-size: 0.75rem;
  }
  
  .error-message {
    color: rgb(239, 68, 68);
  }
  
  .load-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem;
    background-color: rgb(59, 130, 246);
    color: white;
    border: none;
    border-radius: 0.25rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 1rem;
  }
  
  .load-button:hover:not(:disabled) {
    background-color: rgb(37, 99, 235);
  }
  
  .load-button:disabled {
    background-color: rgba(59, 130, 246, 0.5);
    cursor: not-allowed;
  }
  
  /* Status colors */
  .text-green-500 {
    color: rgb(34, 197, 94);
  }
  
  .text-red-500 {
    color: rgb(239, 68, 68);
  }
  
  .text-blue-500 {
    color: rgb(59, 130, 246);
  }
</style> 
