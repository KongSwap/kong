<script lang="ts">
  import { tokenStore } from '$lib/stores/tokenStore';

  export let routingPath: string[] = [];
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];
</script>

<div class="section">
  <h3>Swap Route</h3>
  <div class="route-steps">
    {#each routingPath.slice(0, -1) as token, i}
      <div class="route-step">
        <div class="token-pair">
          <div class="token">
            <img 
              src={$tokenStore.tokens?.find(t => t.symbol === token)?.logo || "/tokens/not_verified.webp"}
              alt={token}
              class="token-icon"
            />
            <span>{token}</span>
          </div>
          <div class="arrow">→</div>
          <div class="token">
            <img 
              src={$tokenStore.tokens?.find(t => t.symbol === routingPath[i + 1])?.logo || "/tokens/not_verified.webp"}
              alt={routingPath[i + 1]}
              class="token-icon"
            />
            <span>{routingPath[i + 1]}</span>
          </div>
        </div>
        <div class="fees">
          <div class="fee">
            <span class="fee-label">Gas:</span>
            <span class="fee-amount">{gasFees[i]} {routingPath[i + 1]}</span>
          </div>
          <div class="fee">
            <span class="fee-label">LP:</span>
            <span class="fee-amount">{lpFees[i]} {routingPath[i + 1]}</span>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .section {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px;
  }

  h3 {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 16px;
  }

  .route-steps {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .route-step {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 16px;
  }

  .token-pair {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .token {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.1);
    padding: 8px 12px;
    border-radius: 20px;
  }

  .token-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }

  .arrow {
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.25rem;
  }

  .fees {
    display: flex;
    justify-content: space-between;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .fee {
    display: flex;
    gap: 8px;
  }

  .fee-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .fee-amount {
    font-family: monospace;
    font-size: 0.875rem;
    color: #fff;
  }
</style> 
