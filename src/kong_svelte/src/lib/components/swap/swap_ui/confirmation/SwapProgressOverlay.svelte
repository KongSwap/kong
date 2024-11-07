<script lang="ts">
  import Panel from '$lib/components/common/Panel.svelte';
  import { tokenStore } from '$lib/stores/tokenStore';
  import TokenImages from '$lib/components/common/TokenImages.svelte';

  export let routingPath: string[] = [];
  export let currentRouteIndex: number;
  export let swapStatus: 'pending' | 'success' | 'failed';
  export let currentStep: string;
  export let error: string;

  const STATUS_COLORS = {
    pending: '#FFA500',
    success: '#00E676',
    failed: '#FF1744'
  };

  function getStepStatus(index: number) {
    if (swapStatus === 'failed' && index <= currentRouteIndex) {
      return 'failed';
    }
    if (index < currentRouteIndex) {
      return 'completed';
    }
    if (index === currentRouteIndex) {
      return 'current';
    }
    return 'upcoming';
  }

  function getStepDescription(index: number): string {
    if (swapStatus === 'failed') {
      return 'Swap failed';
    }
    
    const fromToken = routingPath[index];
    const toToken = routingPath[index + 1];
    
    if (index < currentRouteIndex) {
      return `Completed ${fromToken} → ${toToken}`;
    }
    if (index === currentRouteIndex) {
      return `Swapping ${fromToken} → ${toToken}...`;
    }
    return `Waiting to swap ${fromToken} → ${toToken}`;
  }
</script>

<div class="overlay">
  <Panel variant="green" type="main" width="auto">
    <div class="content">
      <!-- Status Header -->
      <div class="status-header">
        <div 
          class="status-indicator"
          style="background-color: {STATUS_COLORS[swapStatus]}">
        </div>
        <span class="status-text" class:error={!!error}>
          {error || currentStep}
        </span>
      </div>

      <!-- Route Display -->
      <div class="route">
        {#each routingPath as token, i}
          <div class="token-step" data-status={getStepStatus(i)}>
            <TokenImages
              tokens={[
                $tokenStore.tokens?.find(t => t.symbol === token) || "/tokens/not_verified.webp"
              ]}
              size={28}
            />
            {#if i < routingPath.length - 1}
              <div class="arrow">→</div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Step Description -->
      {#if routingPath.length > 1}
        <div class="step-description">
          {#each routingPath.slice(0, -1) as _, i}
            <div 
              class="step-text"
              class:active={i === currentRouteIndex}
              class:completed={i < currentRouteIndex}
              class:failed={swapStatus === 'failed' && i <= currentRouteIndex}
            >
              {getStepDescription(i)}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </Panel>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: grid;
    place-items: center;
    z-index: 100;
  }

  .content {
    padding: 1.5rem;
    min-width: 320px;
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
  }

  .status-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-shadow: 0 0 10px currentColor;
  }

  .status-text {
    font-family: 'Aeonik Mono', 'Aluminium Sans', monospace;
    font-size: 0.875rem;
    color: #fff;
  }

  .status-text.error {
    color: #FF1744;
  }

  .route {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    flex-wrap: wrap;
    min-width: 280px;
    width: 100%;
  }

  .token-step {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .token-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid var(--border-color);
    background: #000;
    transition: all 0.2s ease;
  }

  .arrow {
    color: #666;
    font-weight: bold;
    font-size: 1.2rem;
  }

  /* Step States */
  .token-step[data-status="completed"] .token-icon {
    --border-color: #00E676;
    box-shadow: 0 0 10px rgba(0, 230, 118, 0.4);
  }

  .token-step[data-status="current"] .token-icon {
    --border-color: #FFA500;
    box-shadow: 0 0 10px rgba(255, 165, 0, 0.4);
  }

  .token-step[data-status="failed"] .token-icon {
    --border-color: #FF1744;
    box-shadow: 0 0 10px rgba(255, 23, 68, 0.4);
  }

  .token-step[data-status="upcoming"] .token-icon {
    --border-color: #666;
    opacity: 0.5;
  }

  .step-description {
    margin-top: 1rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    font-family: 'Aeonik Mono', 'Aluminium Sans', monospace;
    font-size: 0.75rem;
  }

  .step-text {
    padding: 0.5rem;
    color: #666;
    text-align: center;
    font-family: 'Aeonik Mono', 'Aluminium Sans', monospace;
  }

  .step-text.active {
    color: #FFA500;
  }

  .step-text.completed {
    color: #00E676;
  }

  .step-text.failed {
    color: #FF1744;
  }

  @media (max-width: 480px) {
    .content {
      padding: 1rem;
      min-width: 280px;
    }

    .route {
      min-width: 240px;
    }

    .token-icon {
      width: 32px;
      height: 32px;
    }

    .status-text {
      font-size: 0.75rem;
    }

    .step-text {
      font-size: 0.65rem;
      padding: 0.25rem;
    }
  }
</style>
