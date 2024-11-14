<script lang="ts">
  import { walletStore } from "$lib/services/wallet/walletStore";
  
  $: connectionStatus = $walletStore.isConnected ? 'Connected' : 'Disconnected';
</script>

<div class="tab-panel">
  <div class="detail-section">
    <h3>Connection Status</h3>
    <div class="status-container">
      <div class="status-item">
        <span class="status-label">Status:</span>
        <p class="status">
          <span class="status-dot" class:connected={$walletStore.isConnected}></span>
          {connectionStatus}
        </p>
      </div>

      {#if $walletStore.error}
        <p class="error-message">Error: {$walletStore.error.message}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .tab-panel {
    animation: fadeIn 0.3s ease;
  }

  .detail-section {
    padding-bottom: 1rem;
  }

  .detail-section h3 {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .status-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .status-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.9);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 68, 68, 0.7);
  }

  .status-dot.connected {
    background: rgba(76, 175, 80, 0.7);
  }

  .error-message {
    color: #ff4444;
    font-size: 0.875rem;
    padding: 0.75rem;
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid rgba(255, 68, 68, 0.2);
    border-radius: 4px;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style> 
