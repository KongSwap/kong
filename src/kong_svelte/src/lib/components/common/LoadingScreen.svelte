<script lang="ts">
  import { fade } from "svelte/transition";
  import { appLoader } from "$lib/services/appLoader";
  import { derived } from "svelte/store";
  import { onMount } from "svelte";
  import kongLogo from "$lib/assets/kong_logo.png";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { tokenLogoStore } from "$lib/services/tokens/tokenLogos";

  const loadingMessages = [
    "DEX INITIALIZATION IN PROGRESS",
    "CONNECTING TO BLOCKCHAIN",
    "LOADING SMART CONTRACTS",
    "SYNCING LIQUIDITY POOLS",
    "OPTIMIZING SWAP ROUTES",
    "CALIBRATING PRICE FEEDS",
    "SECURING TRADING ENGINE",
    "PREPARING USER INTERFACE",
  ];

  let currentMessageIndex = 0;
  let currentLogoIndex = 0;
  $: currentMessage = loadingMessages[currentMessageIndex];
  let messageInterval: ReturnType<typeof setInterval>;
  let logoInterval: ReturnType<typeof setInterval>;
  let currentLogo = kongLogo;

  const loadingState = appLoader.loadingState;

  const loadingProgress = derived(loadingState, ($state) => {
    if (!$state.totalAssets) return 0;
    return Math.min(
      100,
      Math.round(($state.assetsLoaded / $state.totalAssets) * 100),
    );
  });

  $: availableTokens = $tokenStore.tokens || [];
  $: tokenLogos = availableTokens
    .map((token) => $tokenLogoStore[token.canister_id])
    .filter((logo) => logo !== undefined && logo !== null);

  $: if (tokenLogos.length > 0 && !logoInterval) {
    startLogoInterval();
  }

  function startLogoInterval() {
    if (logoInterval) {
      clearInterval(logoInterval);
    }
    logoInterval = setInterval(() => {
      currentLogoIndex = (currentLogoIndex + 1) % (tokenLogos.length + 1);
      currentLogo =
        currentLogoIndex === tokenLogos.length
          ? kongLogo
          : tokenLogos[currentLogoIndex];
    }, 300);
  }

  onMount(() => {
    messageInterval = setInterval(() => {
      currentMessageIndex = (currentMessageIndex + 1) % loadingMessages.length;
      currentMessage = loadingMessages[currentMessageIndex];
    }, 1000);

    return () => {
      clearInterval(messageInterval);
      if (logoInterval) {
        clearInterval(logoInterval);
      }
    };
  });

  $: showLoadingScreen = $loadingState.isLoading;
</script>

{#if showLoadingScreen}
  <div
    class="fixed top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm will-change-transform crt"
    transition:fade={{ duration: 150 }}
  >
    <div class="flex flex-col items-center">
      <div class="logo-container chrome-frame mb-8">
        <div class="logo-inner">
          <img
            src={currentLogo}
            alt="Current Logo"
            class="logo-image pixelated rounded-full"
          />
        </div>
      </div>
      <h2 class="text-4xl font-bold mb-2 uppercase font-alumni neon-text">
        KongSwap
      </h2>
      <div class="message-container h-8 flex items-center justify-center mb-4">
        {#key currentMessage}
          <p
            class="cyber-text"
            in:fade={{ duration: 100 }}
            out:fade={{ duration: 100 }}
          >
            {currentMessage}
          </p>
        {/key}
      </div>
      <div class="progress-container mt-4">
        <div class="progress-bar">
          <div class="progress-track">
            <div
              class="progress-fill"
              style:transform="translateX({$loadingProgress - 100}%)"
            >
              <div class="progress-glow"></div>
            </div>
          </div>
          <div class="progress-lines">
            {#each Array(Math.ceil($loadingProgress / 5) + 1) as _, i}
              <div class="line" style="left: {i * 5}%"></div>
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
    0%,
    100% {
      text-shadow:
        0 0 7px #fff,
        0 0 10px #fff,
        0 0 21px #fff,
        0 0 42px #24b844,
        0 0 82px #24b844,
        0 0 92px #24b844,
        0 0 102px #24b844,
        0 0 151px #24b844;
    }
    5%,
    95% {
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
      transform: translateY(-100%);
    }
    100% {
      transform: translateY(100%);
    }
  }

  @keyframes blink {
    0%,
    49% {
      opacity: 1;
    }
    50%,
    100% {
      opacity: 0;
    }
  }

  @keyframes flicker {
    0% {
      opacity: 0.97;
    }
    5% {
      opacity: 0.95;
    }
    10% {
      opacity: 0.9;
    }
    15% {
      opacity: 0.95;
    }
    20% {
      opacity: 1;
    }
    25% {
      opacity: 0.95;
    }
    30% {
      opacity: 1;
    }
    35% {
      opacity: 0.95;
    }
    40% {
      opacity: 0.98;
    }
    45% {
      opacity: 0.95;
    }
    50% {
      opacity: 1;
    }
    51% {
      opacity: 0.98;
    }
    60% {
      opacity: 0.95;
    }
    70% {
      opacity: 0.9;
    }
    80% {
      opacity: 0.95;
    }
    90% {
      opacity: 0.98;
    }
    100% {
      opacity: 0.95;
    }
  }

  .bg-gradient-radial {
    background: radial-gradient(
      circle at center,
      #536157 0%,
      #1a1a1a 50%,
      #000000 100%
    );
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
    content: "";
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

  .logo-image {
    @apply w-48 h-48;
    object-fit: contain;
    object-position: center;
    position: relative;
    filter: drop-shadow(0 0 15px #00ff95);
    animation: pulse-glow 2s ease-in-out infinite;
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
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
    0%,
    100% {
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
      0 0 42px #24b844,
      0 0 82px #24b844,
      0 0 92px #24b844,
      0 0 102px #24b844,
      0 0 151px #24b844;
  }

  .cyber-text {
    font-family: "Courier New", monospace;
    letter-spacing: 0.1em;
    color: #e0ffe5;
    text-shadow:
      0 0 5px rgba(36, 184, 68, 0.5),
      1px 1px 0px rgba(0, 0, 0, 0.3);
    font-weight: 500;
  }

  .blink {
    animation: blink 1s step-start infinite;
    color: #24b844;
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
    background: linear-gradient(90deg, rgb(36, 184, 68), rgb(48, 200, 77));
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

  .crt {
    animation: flicker 0.15s infinite;
    overflow: hidden;
    &::before {
      content: " ";
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
      background: linear-gradient(
        to bottom,
        rgba(18, 16, 16, 0) 50%,
        rgba(0, 0, 0, 0.25) 50%
      );
      background-size: 100% 4px;
      pointer-events: none;
      z-index: 2;
    }
    &::after {
      content: " ";
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
      background: rgba(18, 16, 16, 0.1);
      opacity: 0;
      z-index: 2;
      pointer-events: none;
      animation: flicker 0.15s infinite;
    }
    > * {
      position: relative;
      z-index: 1;
    }
  }

  .crt::before {
    animation: scanline 6s linear infinite;
  }

  .message-container {
    min-height: 2rem;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .cyber-text {
    @apply text-sm font-mono text-white/80;
    position: relative;
    text-align: center;
    text-shadow: 0 0 5px rgba(0, 255, 149, 0.8);
  }
</style>
