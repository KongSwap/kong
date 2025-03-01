<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { formatDistanceToNow } from "date-fns";
  import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-svelte";
  
  export let deploymentHistory = [];
  export let onClose = () => {};
  export let onRetryStep = (step: number) => {};
  
  // Format timestamp to relative time
  function formatTimestamp(timestamp: number): string {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  }
  
  // Get icon component based on status
  function getStatusIcon(success: boolean) {
    return success ? CheckCircle2 : XCircle;
  }
  
  // Get CSS class based on status
  function getStatusClass(success: boolean): string {
    return success ? "text-green-500" : "text-red-500";
  }
  
  // Initial load
  onMount(() => {
    // Focus trap for accessibility
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  });
</script>

<div class="history-overlay" on:click|self={onClose}>
  <div class="history-modal">
    <header class="history-header">
      <h2>Deployment History</h2>
      <button class="close-button" on:click={onClose}>×</button>
    </header>
    
    <div class="history-content">
      {#if deploymentHistory.length === 0}
        <div class="empty-state">
          <AlertCircle size={32} />
          <p>No deployment history available</p>
        </div>
      {:else}
        <div class="history-timeline">
          {#each deploymentHistory as entry}
            <div class="history-item">
              <div class="history-icon {getStatusClass(entry.success)}">
                <svelte:component this={getStatusIcon(entry.success)} size={20} />
              </div>
              <div class="history-details">
                <div class="history-header-row">
                  <h3>{entry.stepName}</h3>
                  <div class="history-time">
                    <Clock size={12} />
                    <span>{formatTimestamp(entry.timestamp)}</span>
                  </div>
                </div>
                
                {#if entry.data}
                  <div class="history-data">
                    {#if entry.data.canisterId}
                      <div class="data-item">
                        <span class="data-label">Canister ID:</span>
                        <span class="data-value">{entry.data.canisterId}</span>
                      </div>
                    {/if}
                    {#if entry.data.tokenName}
                      <div class="data-item">
                        <span class="data-label">Token:</span>
                        <span class="data-value">{entry.data.tokenName} ({entry.data.tokenSymbol})</span>
                      </div>
                    {/if}
                    {#if entry.data.icpAmount}
                      <div class="data-item">
                        <span class="data-label">ICP:</span>
                        <span class="data-value">{entry.data.icpAmount}</span>
                      </div>
                    {/if}
                    {#if entry.data.kongAmount}
                      <div class="data-item">
                        <span class="data-label">KONG:</span>
                        <span class="data-value">{entry.data.kongAmount}</span>
                      </div>
                    {/if}
                  </div>
                {/if}
                
                {#if entry.error}
                  <div class="history-error">
                    <span class="error-label">Error:</span>
                    <span class="error-message">{entry.error}</span>
                  </div>
                  <button class="retry-button" on:click={() => onRetryStep(entry.step)}>
                    Retry from this step
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .history-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .history-modal {
    width: 500px;
    max-width: 90vw;
    max-height: 80vh;
    background-color: #1e1e2e;
    border-radius: 0.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
  }
  
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .history-header h2 {
    font-size: 1.25rem;
    font-weight: bold;
    margin: 0;
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    line-height: 1;
  }
  
  .close-button:hover {
    color: white;
  }
  
  .history-content {
    padding: 1rem;
    overflow-y: auto;
    flex: 1;
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
  
  .history-timeline {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .history-item {
    display: flex;
    gap: 1rem;
    position: relative;
  }
  
  .history-item:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 30px;
    left: 10px;
    bottom: -10px;
    width: 1px;
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .history-icon {
    min-width: 20px;
    margin-top: 4px;
    z-index: 1;
  }
  
  .history-details {
    flex: 1;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 0.25rem;
    padding: 0.75rem;
  }
  
  .history-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }
  
  .history-header-row h3 {
    font-size: 1rem;
    font-weight: bold;
    margin: 0;
  }
  
  .history-time {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .history-data {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .data-item {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  
  .data-label {
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
    min-width: 80px;
  }
  
  .data-value {
    word-break: break-all;
  }
  
  .history-error {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }
  
  .error-label {
    color: rgb(239, 68, 68);
    font-weight: 500;
    margin-right: 0.5rem;
  }
  
  .error-message {
    word-break: break-all;
  }
  
  .retry-button {
    margin-top: 0.5rem;
    padding: 0.25rem 0.5rem;
    background-color: rgb(59, 130, 246);
    color: white;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .retry-button:hover {
    background-color: rgb(37, 99, 235);
  }
  
  /* Success and error colors */
  .text-green-500 {
    color: rgb(34, 197, 94);
  }
  
  .text-red-500 {
    color: rgb(239, 68, 68);
  }
</style>