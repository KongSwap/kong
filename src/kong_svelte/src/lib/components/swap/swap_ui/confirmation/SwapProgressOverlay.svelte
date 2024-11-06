<script lang="ts">
    import { fade } from 'svelte/transition';
    import Button from '$lib/components/common/Button.svelte';
    import { tokenStore } from '$lib/stores/tokenStore';
    import { tweened } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';
  
    export let routingPath: string[] = [];
    export let currentRouteIndex: number;
    export let swapStatus: 'pending' | 'success' | 'failed';
    export let currentStep: string;
    export let error: string;
    export let onClose: () => void;
  
    export let routeProgress = tweened(0, {
      duration: 1000,
      easing: cubicOut
    });
  
    function getTokenLogo(symbol: string): string {
      const token = $tokenStore.tokens.find(t => t.symbol === symbol);
      return token?.logo || `/tokens/${symbol.toLowerCase()}.webp`;
    }
  
    // Add banana animation config
    const BANANA_COUNT = 15;
    const bananas = Array(BANANA_COUNT).fill(0).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 3 + Math.random() * 4,
        rotation: Math.random() * 360,
        flip: Math.random() > 0.5,
        scale: 0.5 + Math.random() * 0.5
    }));
  </script>
  
  <div 
    class="loading-overlay"
    transition:fade={{ duration: 300 }}
  >
    <!-- Add banana rain container before the content -->
    <div class="banana-rain">
        {#each bananas as banana (banana.id)}
            <img 
                src="/stats/banana.webp"
                alt="Falling banana"
                class="falling-banana"
                style="
                    --left: {banana.left}%;
                    --delay: {banana.delay}s;
                    --duration: {banana.duration}s;
                    --rotation: {banana.rotation}deg;
                    --scale: {banana.scale};
                    transform: scale({banana.flip ? -1 : 1}, 1);
                "
            />
        {/each}
    </div>

    <div class="loading-content">
      <div class="jungle-mist"></div>
      
      <div class="title-container">
        <img 
          src="/titles/swap_title.webp" 
          alt="Kong Swap" 
          class="kong-title"
        />
      </div>
  
      <div class="center-container">
        <div class="pixel-box">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              class:success={swapStatus === 'success'} 
              class:failed={swapStatus === 'failed'}
            ></div>
          </div>
  
          <!-- Route Visualization -->
          <div class="route-visualization">
            {#each routingPath as token, i}
              <div class="token-node" class:active={i <= currentRouteIndex}>
                <div class="token-icon-wrapper">
                  <img 
                    src={getTokenLogo(token)}
                    alt={token}
                    class="token-icon"
                  />
                  {#if i <= currentRouteIndex}
                    <div class="glow-effect"></div>
                  {/if}
                </div>
                <span class="token-symbol">{token}</span>
              </div>
              {#if i < routingPath.length - 1}
                <div 
                  class="route-line"
                  class:active={i < currentRouteIndex}
                  class:in-progress={i === currentRouteIndex}
                ></div>
              {/if}
            {/each}
          </div>
  
          <p 
            class="status-text" 
            class:success={swapStatus === 'success'} 
            class:failed={swapStatus === 'failed'}
          >
            {currentStep}
          </p>
          {#if error}
            <p class="error-text">{error}</p>
          {/if}
          {#if swapStatus === 'pending'}
            <p class="warning-text">DO NOT CLOSE THIS WINDOW</p>
          {:else if swapStatus === 'failed'}
            <Button
              text="CLOSE"
              variant="yellow"
              size="small"
              onClick={onClose}
            />
          {/if}
        </div>
      </div>
  
      <div class="vines left-vines"></div>
      <div class="vines right-vines"></div>
    </div>
  </div>
  
  <style lang="postcss">
    .loading-overlay {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center, #1a1a1a 0%, #000 100%);
      z-index: 9999;
      overflow: hidden;
    }

    .loading-content {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .jungle-mist {
      position: absolute;
      inset: 0;
      background: 
        repeating-linear-gradient(
          0deg,
          transparent 0%,
          rgba(0, 255, 0, 0.05) 50%,
          transparent 100%
        );
      background-size: 100% 8px;
      animation: mistScroll 20s linear infinite;
      pointer-events: none;
    }

    .title-container {
      position: absolute;
      top: 15%;
      left: 50%;
      transform: translateX(-50%);
      width: 500px;
      animation: titlePulse 2s ease-in-out infinite;
    }

    .kong-title {
      width: 100%;
      height: auto;
      filter: drop-shadow(0 0 20px rgba(0, 255, 0, 0.4));
    }

    .center-container {
      position: relative;
      z-index: 2;
    }

    .pixel-box {
      background: rgba(0, 0, 0, 0.8);
      border: 4px solid #4a4;
      padding: 20px;
      width: 400px;
      min-width: 400px;
      box-shadow: 
        0 0 0 4px #000,
        0 0 20px rgba(0, 255, 0, 0.4);
      image-rendering: pixelated;
    }

    .progress-bar {
      height: 30px;
      background: #000;
      border: 2px solid #4a4;
      padding: 4px;
      margin-bottom: 20px;
    }

    .progress-fill {
      height: 100%;
      background: #4a4;
      width: 0%;
      animation: progressPulse 2s ease-in-out infinite;
    }

    .progress-fill.success {
      background: #4a4;
      width: 100%;
      animation: none;
    }

    .progress-fill.failed {
      background: #f44;
      width: 100%;
      animation: none;
    }

    .status-text {
      font-family: 'Alumni Sans', sans-serif;
      color: #4a4;
      text-align: center;
      margin: 10px 0;
      font-size: 1.2rem;
      min-height: 1.2em;
    }

    .status-text.success {
      color: #4a4;
      animation: none;
    }

    .status-text.failed {
      color: #f44;
      animation: none;
    }

    .warning-text {
      font-family: 'Alumni Sans', sans-serif;
      color: #f44;
      text-align: center;
      font-size: 0.8rem;
      margin-top: 20px;
      animation: warningPulse 2s ease-in-out infinite;
    }

    .vines {
      position: absolute;
      width: 200px;
      height: 100%;
      background: 
        repeating-linear-gradient(
          45deg,
          transparent,
          transparent 20px,
          #4a4 22px,
          #4a4 25px
        );
      opacity: 0.2;
    }

    .left-vines {
      left: 0;
      transform: skew(-15deg);
    }

    .right-vines {
      right: 0;
      transform: skew(15deg);
    }

    @keyframes mistScroll {
      0% { background-position: 0 0; }
      100% { background-position: 0 100%; }
    }

    @keyframes titlePulse {
      0%, 100% { 
        transform: translateX(-50%) scale(1);
        filter: drop-shadow(0 0 20px rgba(0, 255, 0, 0.4));
      }
      50% { 
        transform: translateX(-50%) scale(1.05);
        filter: drop-shadow(0 0 30px rgba(0, 255, 0, 0.6));
      }
    }

    @keyframes progressPulse {
      0% { width: 0%; }
      50% { width: 90%; }
      100% { width: 0%; }
    }

    @keyframes warningPulse {
      0%, 100% { color: #f44; }
      50% { color: #f88; }
    }

    .error-text {
      color: #ff4444;
      font-family: 'Alumni Sans', sans-serif;
      font-size: 0.8rem;
      text-align: center;
      margin-top: 1rem;
    }

    .route-visualization {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px 0;
      padding: 16px;
      background: rgba(0, 0, 0, 0.4);
      border: 2px solid #4a4;
      border-radius: 12px;
      gap: 16px;
      position: relative;
      overflow: hidden;
      min-width: 320px;
    }

    .route-visualization::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        45deg,
        transparent 0%,
        rgba(74, 170, 68, 0.1) 50%,
        transparent 100%
      );
      animation: shimmer 2s linear infinite;
    }

    .token-node {
      display: flex;
      flex-direction: column;
      align-items: center;
      opacity: 0.5;
      transition: all 0.3s ease;
      position: relative;
      z-index: 1;
    }

    .token-node.active {
      opacity: 1;
      transform: scale(1.1);
    }

    .token-icon-wrapper {
      position: relative;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      padding: 2px;
      background: linear-gradient(45deg, #4a4, #f7bf26);
    }

    .token-icon {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      background: #000;
      border: 2px solid #000;
    }

    .glow-effect {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      background: radial-gradient(circle at center, rgba(74, 170, 68, 0.4) 0%, transparent 70%);
      animation: pulse 2s ease-in-out infinite;
    }

    .token-symbol {
      font-family: 'Alumni Sans', sans-serif;
      font-size: 0.7rem;
      color: #fff;
      margin-top: 8px;
      text-shadow: 0 0 8px rgba(74, 170, 68, 0.6);
    }

    .route-line {
      width: 60px;
      height: 4px;
      background: #4a4;
      opacity: 0.3;
      transition: all 0.3s ease;
      box-shadow: 
        0 0 8px rgba(74, 170, 68, 0.6),
        0 0 2px #fff;
    }

    .route-line.active {
      opacity: 1;
    }

    .route-line.in-progress {
      opacity: 1;
      background: #f7bf26; /* Orange/yellow color */
      box-shadow: 
        0 0 8px rgba(247, 191, 38, 0.6),
        0 0 2px #fff;
    }

    @media (max-width: 768px) {
      .title-container {
        width: 80%;
      }

      .pixel-box {
        width: 90%;
        min-width: 320px;
        margin: 0 20px;
      }

      .status-text {
        font-size: 0.9rem;
      }

      .warning-text {
        font-size: 0.7rem;
      }

      .route-visualization {
        padding: 12px;
        gap: 8px;
        flex-wrap: wrap;
        min-width: 280px;
      }

      .token-icon-wrapper {
        width: 36px;
        height: 36px;
      }

      .token-symbol {
        font-size: 0.6rem;
      }

      .route-line {
        width: 32px;
      }
    }

    .banana-rain {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 1;
        overflow: hidden;
    }

    .falling-banana {
        position: absolute;
        top: -50px;
        left: var(--left);
        width: 32px;
        height: 32px;
        opacity: 0.7;
        animation: fall var(--duration) linear infinite;
        animation-delay: var(--delay);
        filter: drop-shadow(0 0 5px rgba(255, 255, 0, 0.3));
        transform-origin: center;
        scale: var(--scale);
    }

    @keyframes fall {
        0% {
            transform: translateY(-50px) rotate(var(--rotation));
            opacity: 0.7;
        }
        10% {
            opacity: 0.7;
        }
        90% {
            opacity: 0.7;
        }
        100% {
            transform: translateY(100vh) rotate(calc(var(--rotation) + 360deg));
            opacity: 0;
        }
    }

    /* Make bananas more visible on success */
    .progress-fill.success ~ .banana-rain .falling-banana {
        filter: drop-shadow(0 0 8px rgba(255, 255, 0, 0.5));
        opacity: 0.9;
    }

    /* Make bananas red on failure */
    .progress-fill.failed ~ .banana-rain .falling-banana {
        filter: drop-shadow(0 0 8px rgba(255, 0, 0, 0.5));
        opacity: 0.9;
        animation-duration: calc(var(--duration) * 0.7);
    }
  </style>
