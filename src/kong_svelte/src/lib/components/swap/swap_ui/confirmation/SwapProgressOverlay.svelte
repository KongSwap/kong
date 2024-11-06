<script lang="ts">
  import { fade } from 'svelte/transition';
  import { spring } from 'svelte/motion';
  import { tokenStore } from '$lib/stores/tokenStore';

  export let routingPath: string[] = [];
  export let currentRouteIndex: number;
  export let swapStatus: 'pending' | 'success' | 'failed';

  // Spring animation for smooth token progression
  const progressSpring = spring({ x: 0 }, {
    stiffness: 0.08,
    damping: 0.35
  });

  $: {
    progressSpring.set({ x: currentRouteIndex });
  }

  // Increase number of bananas and adjust their properties
  const bananas = Array(40).fill(0).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -20 - Math.random() * 100, // Start above viewport
    delay: Math.random() * 2,
    speed: 2 + Math.random() * 2,
    rotation: Math.random() * 360,
    scale: 0.3 + Math.random() * 0.3
  }));

  function getTokenLogo(symbol: string): string {
    const token = $tokenStore.tokens.find(t => t.symbol === symbol);
    return token?.logo || `/tokens/${symbol.toLowerCase()}.webp`;
  }
</script>

<div class="swap-overlay">
  <!-- Banana particle effects -->
  <div class="particle-field">
    {#each bananas as banana (banana.id)}
      <img 
        src="/stats/banana.webp"
        alt="Banana"
        class="banana-particle"
        style="
          --x: {banana.x}%;
          --y: {banana.y}%;
          --delay: {banana.delay}s;
          --speed: {banana.speed}s;
          --rotation: {banana.rotation}deg;
          --scale: {banana.scale};
        "
      />
    {/each}
  </div>

  <div class="swap-progress">
    <!-- Loading spinner video -->
    <video 
      class="loading-spinner" 
      autoplay 
      loop 
      muted 
      playsinline
    >
      <source src="loading/spin.mp4" type="video/mp4">
    </video>

    <!-- Token path visualization -->
    <div class="token-path">
      {#each routingPath as token, i}
        <div class="token-node" class:active={i <= $progressSpring.x}>
          <img 
            src={getTokenLogo(token)}
            alt={token}
            class="token-icon"
          />
          {#if i < routingPath.length - 1}
            <div class="path-line">
              <div class="energy-pulse" class:flowing={i === currentRouteIndex} />
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <span class="status-text">SWAP IN PROGRESS</span>
  </div>
</div>

<style lang="postcss">
  .swap-overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    z-index: 100;
    overflow: hidden;
  }

  .particle-field {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: -1; /* Place behind the swap progress panel */
  }

  .banana-particle {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: 24px;
    height: 24px;
    opacity: 0;
    animation: fall var(--speed) linear infinite;
    animation-delay: var(--delay);
    transform: rotate(var(--rotation)) scale(var(--scale));
  }

  .swap-progress {
    background: rgba(0, 20, 10, 0.8);
    padding: 2rem;
    border-radius: 16px;
    border: 1px solid rgba(0, 230, 118, 0.2);
    box-shadow: 0 0 40px rgba(0, 230, 118, 0.1);
  }

  .token-path {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .token-node {
    display: flex;
    align-items: center;
    opacity: 0.5;
    transition: all 0.4s ease;
  }

  .token-node.active {
    opacity: 1;
    transform: scale(1.1);
  }

  .token-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid rgba(0, 230, 118, 0.3);
    background: #000;
    transition: all 0.3s ease;
  }

  .path-line {
    width: 60px;
    height: 2px;
    background: rgba(0, 230, 118, 0.2);
    margin: 0 0.5rem;
    position: relative;
    overflow: hidden;
  }

  .energy-pulse {
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(
      90deg,
      transparent,
      #00E676,
      transparent
    );
  }

  .energy-pulse.flowing {
    animation: pulseFlow 1.5s ease-in-out infinite;
  }

  .status-indicator {
    text-align: center;
    position: relative;
  }

  .progress-ring {
    display: none;
  }

  .status-text {
    color: #00E676;
    font-family: monospace;
    font-size: 0.9rem;
    letter-spacing: 1px;
    animation: pulse 2s infinite;
  }

  @keyframes fall {
    0% {
      transform: translateY(-20px) rotate(var(--rotation));
      opacity: 0.8;
    }
    100% {
      transform: translateY(120vh) rotate(calc(var(--rotation) + 360deg));
      opacity: 0;
    }
  }

  @keyframes pulseFlow {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes pulse {
    50% { opacity: 0.5; }
  }
</style>
