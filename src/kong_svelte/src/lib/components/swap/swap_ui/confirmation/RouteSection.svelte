<script lang="ts">
  import { tokenStore } from '$lib/stores/tokenStore';

  export let routingPath: string[] = [];
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];
  export let payToken: string;
  export let receiveToken: string;

  export let currentRouteIndex = 0;
  export let progress = 0;
</script>

<div class="section">
  <h3 class="section-title">Route</h3>
  <div class="route-visualization">
    {#each routingPath.slice(0, -1) as token, i}
      <div 
        class="route-step" 
        class:active={i === currentRouteIndex}
        class:completed={i < currentRouteIndex}
      >
        <div class="token-pair">
          <div class="token-badge-small from {token === payToken ? 'highlight' : ''}">
            <div class="token-icon-wrapper">
              <img 
                src={$tokenStore.tokens?.find(t => t.symbol === token)?.logo || "tokens/not_verified.webp"}
                alt={token}
                class="token-icon-small"
              />
            </div>
            <span class="token-symbol">{token}</span>
          </div>
          <div class="arrow-container">
            <span class="arrow">→</span>
            <div class="arrow-line"></div>
          </div>
          <div class="token-badge-small to {routingPath[i + 1] === receiveToken ? 'highlight' : ''}">
            <div class="token-icon-wrapper">
              <img 
                src={$tokenStore.tokens?.find(t => t.symbol === routingPath[i + 1])?.logo || "/tokens/not_verified.webp"}
                alt={routingPath[i + 1]}
                class="token-icon-small"
              />
            </div>
            <span class="token-symbol">{routingPath[i + 1]}</span>
          </div>
        </div>
        <div class="step-fees">
          <span class="fee-text">Gas: {gasFees[i]} {routingPath[i + 1]}</span>
          <span class="fee-text">LP: {lpFees[i]} {routingPath[i + 1]}</span>
        </div>
        
        {#if i === currentRouteIndex}
          <div class="progress-bar">
            <div 
              class="progress-fill"
              style="width: {progress * 100}%"
            />
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .section {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 12px;
    min-width: 320px;
  }

  .section-title {
    font-size: 0.9rem;
    margin: 0 0 8px 0;
    font-weight: 500;
    color: #ffd700;
  }

  .route-visualization {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .route-step {
    display: flex;
    flex-direction: column;
    gap: 4px;
    opacity: 0.5;
    transition: all 0.3s ease;
  }

  .route-step.active {
    opacity: 1;
    transform: scale(1.02);
  }

  .route-step.completed {
    opacity: 0.8;
  }

  .token-pair {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    position: relative;
    min-height: 48px;
  }

  .token-badge-small {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    z-index: 1;
    min-width: 100px;
  }

  .token-icon-wrapper {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .token-icon-small {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }

  .token-symbol {
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 40px;
  }

  .arrow-container {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 40px;
  }

  .arrow {
    color: #ffd700;
    font-size: 18px;
    position: relative;
    z-index: 2;
  }

  .arrow-line {
    position: absolute;
    top: 50%;
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }

  .step-fees {
    display: flex;
    justify-content: space-between;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
  }

  .fee-text {
    font-size: 0.75rem;
    color: #ffffff;
    font-family: monospace;
    white-space: nowrap;
  }

  .progress-bar {
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    margin-top: 8px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #ffd700;
    transition: width 0.3s ease;
  }
</style>
