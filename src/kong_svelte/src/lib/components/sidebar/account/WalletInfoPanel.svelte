<script lang="ts">
  import { availableWallets, selectedWalletId } from "$lib/services/auth";

  let networkType = process.env.DFX_NETWORK === 'local' ? 'Local' : 'Mainnet';
  let networkHost = process.env.DFX_NETWORK === 'local' ? 'http://localhost:4943' : 'https://ic0.app';
  
  $: walletProvider = availableWallets.find(w => w.id === $selectedWalletId)?.name || 'Unknown';
</script>

<div class="tab-panel">
  <div class="detail-section">
    <h3>Wallet Information</h3>
    <div class="info-grid">
      <div class="info-item">
        <span class="label">Provider:</span>
        <span class="value">{walletProvider}</span>
      </div>
      <div class="info-item">
        <span class="label">Network:</span>
        <span class="value">{networkType}</span>
      </div>
      <div class="info-item">
        <span class="label">Host:</span>
        <span class="value">{networkHost}</span>
      </div>
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

  .info-grid {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }

  .value {
    color: rgba(255, 255, 255, 0.9);
    font-family: monospace;
    font-size: 0.875rem;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style> 
