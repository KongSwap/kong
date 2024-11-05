<script lang="ts">
  import { tokenStore } from '$lib/stores/tokenStore';
  import { cubicOut } from 'svelte/easing';

  export let routingPath: string[] = [];
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];

  const swoopIn = (node, { delay = 0, duration = 500 }) => {
    return {
      delay,
      duration,
      css: t => {
        const eased = cubicOut(t);
        return `
          transform: translateY(${(1 - eased) * 20}px);
          opacity: ${eased};
        `;
      }
    };
  };
</script>

<div class="section mid-section glass-effect">
  <h3 class="section-title glow-text">Route</h3>
  <div class="route-visualization">
    {#each routingPath.slice(0, -1) as token, i}
      <div class="route-step" in:swoopIn={{ delay: 200 + (i * 100) }}>
        <div class="token-pair">
          <div class="token-badge-small from">
            <img 
              src={$tokenStore.tokens?.find(t => t.symbol === token)?.logo || "/tokens/not_verified.webp"}
              alt={token}
              class="token-icon-small"
            />
            <span>{token}</span>
          </div>
          <div class="arrow-container">
            <span class="arrow">→</span>
            <div class="arrow-line"></div>
          </div>
          <div class="token-badge-small to">
            <img 
              src={$tokenStore.tokens?.find(t => t.symbol === routingPath[i + 1])?.logo || "/tokens/not_verified.webp"}
              alt={routingPath[i + 1]}
              class="token-icon-small"
            />
            <span>{routingPath[i + 1]}</span>
          </div>
        </div>
        <div class="step-fees">
          <span class="fee-text">Gas: {gasFees[i]} {routingPath[i + 1]}</span>
          <span class="fee-text">LP: {lpFees[i]} {routingPath[i + 1]}</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .section {
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 16px;
  }

  .mid-section {
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
  }

  .glass-effect {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .section-title {
    font-size: 1.2rem;
    margin-bottom: 16px;
    font-weight: 500;
  }

  .glow-text {
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  }

  .route-visualization {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
  }

  .route-step {
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: transform 0.3s ease;
  }

  .route-step:hover {
    transform: scale(1.02);
  }

  .token-pair {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.08));
    border-radius: 16px;
    position: relative;
    min-height: 60px;
    transition: all 0.3s ease;
  }

  .token-pair:hover {
    transform: scale(1.02);
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.1);
  }

  .token-badge-small {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    transition: all 0.2s ease;
    z-index: 1;
    animation: float 3s ease-in-out infinite;
  }

  .token-badge-small.from {
    margin-right: auto;
  }

  .token-badge-small.to {
    margin-left: auto;
  }

  .token-badge-small:hover {
    transform: scale(1.05);
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .token-icon-small {
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }

  .arrow-container {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 60px;
  }

  .arrow {
    background: linear-gradient(45deg, #FFD700, #FFA500);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-size: 24px;
    position: relative;
    z-index: 2;
    animation: floatArrow 3s ease-in-out infinite;
  }

  .arrow-line {
    position: absolute;
    top: 50%;
    width: 100%;
    height: 2px;
    background: rgba(255, 255, 255, 0.1);
  }

  .step-fees {
    display: flex;
    justify-content: space-between;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
  }

  .fee-text {
    font-size: 0.85rem;
    color: #888;
    font-family: monospace;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-4px);
    }
  }

  @keyframes floatArrow {
    0%, 100% {
      transform: translateX(-8px) scale(1);
      opacity: 0.7;
    }
    50% {
      transform: translateX(8px) scale(1.1);
      opacity: 1;
    }
  }
</style> 
