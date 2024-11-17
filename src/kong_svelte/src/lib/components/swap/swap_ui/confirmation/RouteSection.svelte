<script lang="ts">
  import TokenImages from '$lib/components/common/TokenImages.svelte';
  import { tokenStore } from '$lib/services/tokens/tokenStore';

  export let routingPath: string[] = [];
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];
  export let payToken: FE.Token;
  export let receiveToken: FE.Token;

  export let currentRouteIndex = 0;
  export let progress = 0;
  export let currentStep: string = '';

  let initialPath = routingPath
  let initialGasFees = gasFees
  let initialLpFees = lpFees

  function getTokenFromSymbol(symbol: string): FE.Token | undefined {
    const token = $tokenStore.tokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
    console.log('Finding token for symbol:', symbol, 'Found:', token);
    return token;
  }

  
</script>

<div class="section">
  <h3 class="section-title">Route</h3>
  <div class="route-visualization">
    {#each initialPath.slice(0, -1) as currentSymbol, i}
      <div class="route-step" class:active={i === currentRouteIndex} class:completed={i < currentRouteIndex}>
        <div class="token-pair">
          {#if i === 0}
            <div class="token-badge-small from">
              <div class="token-icon-wrapper">
                <TokenImages tokens={[payToken]} size={24} />
              </div>
              <span class="token-symbol">{initialPath[i]}</span>
            </div>
          {:else}
            <div class="token-badge-small">
              <div class="token-icon-wrapper">
                <TokenImages tokens={[getTokenFromSymbol(initialPath[i])]} size={24} />
              </div>
              <span class="token-symbol">{initialPath[i]}</span>
            </div>
          {/if}
          <div class="route-arrow">
            <div class="arrow-line"></div>
          </div>
          <div class="token-badge-small to {initialPath[i + 1] === receiveToken.symbol ? 'highlight' : ''}">
            <div class="token-icon-wrapper">
              <TokenImages tokens={[getTokenFromSymbol(initialPath[i + 1])]} size={24} />
            </div>
            <span class="token-symbol">{initialPath[i + 1]}</span>
          </div>
        </div>
        <div class="step-fees">
          <span class="fee-text">Gas: {initialGasFees[i]} {initialPath[i + 1]}</span>
          <span class="fee-text">LP: {initialLpFees[i]} {initialPath[i + 1]}</span>
        </div>
        {#if i === currentRouteIndex}
          <div class="step-status">
            {currentStep}
          </div>
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
    gap: 4px;
  }

  .route-arrow {
    display: flex;
    align-items: center;
  }

  .arrow-line {
    width: 24px;
    height: 1px;
    background-color: #ccc;
  }

  .token-icon-wrapper {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .token-symbol {
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 40px;
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

  .step-status {
    font-size: 0.8rem;
    color: #ffd700;
    text-align: center;
    margin-top: 4px;
  }
</style>
