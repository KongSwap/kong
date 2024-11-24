<script lang="ts">
  import { fade } from "svelte/transition";
  import { appLoader } from "$lib/services/appLoader";
  import { derived } from "svelte/store";
  import { onMount } from "svelte";
  import kongLogo from "$lib/assets/kong_logo.png";

  const loadingMessages = [
    "DEX INITIALIZATION IN PROGRESS",
    "CONNECTING TO BLOCKCHAIN",
    "LOADING SMART CONTRACTS",
    "SYNCING LIQUIDITY POOLS",
    "OPTIMIZING SWAP ROUTES",
    "CALIBRATING PRICE FEEDS",
    "SECURING TRADING ENGINE",
    "PREPARING USER INTERFACE"
  ];

  let currentMessageIndex = 0;
  $: currentMessage = loadingMessages[0];
  let messageInterval: ReturnType<typeof setInterval>;

  const loadingState = appLoader.loadingState;

  const loadingProgress = derived(
    loadingState,
    ($state) => {
      if (!$state.totalAssets) return 0;
      return Math.min(100, Math.round(($state.assetsLoaded / $state.totalAssets) * 100));
    }
  );

  onMount(() => {
    const interval = setInterval(() => {
          currentMessageIndex = (currentMessageIndex + 1) % loadingMessages.length;
          currentMessage = loadingMessages[currentMessageIndex];
    }, 1000);
    return () => clearInterval(interval);
  });

  $: showLoadingScreen = $loadingState.isLoading;
</script>

{#if showLoadingScreen}
  <div
    class="fixed top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm will-change-transform"
    transition:fade={{ duration: 150 }}
  >
    <div class="flex flex-col items-center">
      <div class="logo-container chrome-frame mb-8">
        <div class="logo-inner">
          <img src={kongLogo} alt="Kong Logo" class="w-48" />
        </div>
      </div>
      <h2 class="text-4xl font-bold mb-2 uppercase font-alumni neon-text">KongSwap</h2>
      {#key currentMessage}
        <p class="cyber-text" in:fade={{duration: 100}} out:fade={{duration: 100}}>{currentMessage}</p>
      {/key}
      <div class="progress-container mt-4">
        <div class="progress-bar">
          <div class="progress-track">
            <div class="progress-fill" style:transform="translateX({$loadingProgress - 100}%)">
              <div class="progress-glow"></div>
            </div>
          </div>
          <div class="progress-lines">
            {#each Array(Math.ceil($loadingProgress / 5) + 1) as _, i}
              <div 
                class="line" 
                style="left: {i * 5}%" 
                class:active={$loadingProgress >= i * 5}
              />
            {/each}
          </div>
        </div>
        <div class="progress-numbers">
          <span class="start">0</span>
          <span class="current">{$loadingProgress}%</span>
          <span class="end">100</span>
        </div>
      </div>
      
      <p class="cyber-text text-sm mt-2">
        {#if $loadingState.totalAssets}
          <span class="blink">></span> LOADING ASSETS: {$loadingProgress}%
        {:else}
          <span class="blink">></span> LOADING...
        {/if}
      </p>

      {#if $loadingState.errors.length > 0}
        <div class="errors mt-4">
          {#each $loadingState.errors as error}
            <p class="text-red-500 text-sm blink">> ERROR: {error}</p>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style scoped lang="postcss">
  @keyframes neonFlicker {
    0%, 100% { 
      text-shadow: 
        0 0 7px #fff,
        0 0 10px #fff,
        0 0 21px #fff,
        0 0 42px #24B844,
        0 0 82px #24B844,
        0 0 92px #24B844,
        0 0 102px #24B844,
        0 0 151px #24B844;
    }
    5%, 95% {
      text-shadow: none;
    }
  }

  @keyframes shine {
    0% {
      transform: translateX(-100%) skewX(-15deg);
    }
    100% {
      transform: translateX(200%) skewX(-15deg);
    }
  }

  @keyframes scanline {
    0% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(100%);
    }
  }

  @keyframes blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }

  .bg-gradient-radial {
    background: radial-gradient(circle at center, #536157 0%, #1a1a1a 50%, #000000 100%);
  }

  .scanlines::before {
    content: "";
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.15) 0px,
      rgba(0, 0, 0, 0.15) 1px,
      transparent 1px,
      transparent 2px
    );
    pointer-events: none;
  }

  .scanlines::after {
    content: "";
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      rgba(18, 16, 16, 0) 50%,
      rgba(0, 0, 0, 0.25) 50%
    );
    background-size: 100% 4px;
    pointer-events: none;
  }

  .logo-container {
    @apply relative p-1 rounded-2xl;
    background: linear-gradient(45deg, #00ff9580, #00ff9520);
    box-shadow: 0 0 20px #00ff95;
    position: relative;
  }

  .logo-inner {
    @apply bg-black/50 p-4 rounded-xl backdrop-blur-sm;
    border: 1px solid #00ff9550;
    position: relative;
    overflow: hidden;
  }

  .logo-inner::before {
    content: '';
    position: absolute;
    width: 150%;
    height: 150%;
    background: conic-gradient(
      from 0deg,
      transparent,
      #00ff9530,
      #00ff9550,
      #00ff9530,
      transparent
    );
    animation: orbit 4s linear infinite;
    top: -25%;
    left: -25%;
  }

  .logo-inner img {
    position: relative;
    filter: drop-shadow(0 0 15px #00ff95);
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes orbit {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse-glow {
    0%, 100% {
      filter: drop-shadow(0 0 15px #00ff95);
    }
    50% {
      filter: drop-shadow(0 0 25px #00ff95);
    }
  }

  .neon-text {
    color: #fff;
    animation: neonFlicker 2s infinite;
    text-shadow: 
      0 0 7px #fff,
      0 0 10px #fff,
      0 0 21px #fff,
      0 0 42px #24B844,
      0 0 82px #24B844,
      0 0 92px #24B844,
      0 0 102px #24B844,
      0 0 151px #24B844;
  }

  .cyber-text {
    font-family: 'Courier New', monospace;
    letter-spacing: 0.1em;
    color: #e0ffe5;
    text-shadow: 
      0 0 5px rgba(36, 184, 68, 0.5),
      1px 1px 0px rgba(0, 0, 0, 0.3);
    font-weight: 500;
  }

  .blink {
    animation: blink 1s step-start infinite;
    color: #24B844;
  }

  .progress-container {
    @apply w-96 relative;
  }

  .progress-bar {
    @apply relative;
  }

  .progress-track {
    @apply relative overflow-hidden rounded-lg;
    height: 12px;
    background: rgba(0, 0, 0, 0.3);
    box-shadow:
      inset 0 0 5px rgba(0, 0, 0, 0.2),
      0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .progress-fill {
    @apply h-full bg-emerald-500;
    width: 100%;
    transform-origin: left;
    will-change: transform;
    transition: transform 0.2s ease-out;
    background: linear-gradient(90deg,
      rgb(36, 184, 68),
      rgb(48, 200, 77)
    );
  }

  .progress-glow {
    @apply absolute inset-0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(36, 184, 68, 0.4),
      transparent
    );
    animation: glow 2s linear infinite;
  }

  .progress-lines {
    @apply absolute inset-0;
    pointer-events: none;
  }

  .line {
    @apply absolute top-0 bottom-0;
    width: 2px;
    background: rgba(0, 0, 0, 0.2);
    transform: scaleY(1.2);
  }

  .line.active {
    background: rgba(36, 184, 68, 0.4);
  }

  .progress-numbers {
    @apply flex justify-between mt-2 text-sm font-mono;
    color: rgb(36, 184, 68);
    text-shadow: 0 0 10px rgba(36, 184, 68, 0.3);
  }

  @keyframes glow {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(100%);
    }
  }
</style>
