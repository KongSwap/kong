<script lang="ts">
  import { fade } from "svelte/transition";
  import { appLoader } from "$lib/services/appLoader";
  import { derived } from "svelte/store";
  import kongLogo from "$lib/assets/kong_logo.png";

  // Get the loading state store
  const loadingState = appLoader.loadingState;

  // Derive loading progress as a percentage
  const loadingProgress = derived(loadingState, ($state) => {
    if (!$state.totalAssets) return 0;
    return Math.min(100, Math.round(($state.assetsLoaded / $state.totalAssets) * 100));
  });

  $: showLoadingScreen = $loadingState.isLoading;
</script>

{#if showLoadingScreen}
  <div
    class="fixed top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
    transition:fade={{ duration: 200 }}
  >
    <div class="flex flex-col items-center">
      <div class="logo-container mb-8">
        <div class="glitch">
          <div class="logo-piece piece-1">
            <img src={kongLogo} alt="Kong Logo" class="w-48" />
          </div>
          <div class="logo-piece piece-2">
            <img src={kongLogo} alt="Kong Logo" class="w-48" />
          </div>
          <div class="logo-piece piece-3">
            <img src={kongLogo} alt="Kong Logo" class="w-48" />
          </div>
        </div>
      </div>
      <h2 class="text-4xl font-bold text-lime-500 mb-2 uppercase font-alumni">KongSwap</h2>
      <p class="text-gray-400">Please wait while we initialize the app...</p>

      <div class="progress-bar">
        <div class="progress-fill" style="width: {$loadingProgress}%"></div>
      </div>
      <p class="text-gray-400 text-sm mt-2">
        {#if $loadingState.totalAssets}
          Loading assets: {$loadingProgress}%
        {:else}
          Loading...
        {/if}
      </p>

      {#if $loadingState.errors.length > 0}
        <div class="errors mt-4">
          {#each $loadingState.errors as error}
            <p class="text-red-500 text-sm">{error}</p>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="postcss">
  @keyframes colorShift {
    0% {
      filter: hue-rotate(0deg) brightness(1);
    }
    25% {
      filter: hue-rotate(90deg) brightness(1.2);
    }
    50% {
      filter: hue-rotate(180deg) brightness(0.8);
    }
    75% {
      filter: hue-rotate(270deg) brightness(1.1);
    }
    100% {
      filter: hue-rotate(360deg) brightness(1);
    }
  }

  .logo-piece {
    position: absolute;
    inset: 0;
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    will-change: clip-path, transform;
  }

  .piece-1 {
    clip-path: polygon(0 0, 33% 0, 45% 100%, 0 100%);
    animation: piece1 1.5s ease-in-out infinite;
  }

  .piece-2 {
    clip-path: polygon(33% 0, 66% 0, 75% 100%, 45% 100%);
    animation: piece2 1.5s ease-in-out infinite;
  }

  .piece-3 {
    clip-path: polygon(66% 0, 100% 0, 100% 100%, 75% 100%);
    animation: piece3 1.5s ease-in-out infinite;
  }

  @keyframes piece1 {
    0%,
    100% {
      transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg);
    }
    50% {
      transform: translate3d(-10px, 5px, 20px) rotateX(2deg) rotateY(-3deg);
    }
  }

  @keyframes piece2 {
    0%,
    100% {
      transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg);
    }
    50% {
      transform: translate3d(5px, -8px, -15px) rotateX(-3deg) rotateY(2deg);
    }
  }

  @keyframes piece3 {
    0%,
    100% {
      transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg);
    }
    50% {
      transform: translate3d(8px, 10px, 25px) rotateX(3deg) rotateY(4deg);
    }
  }

  .glitch {
    position: relative;
    width: 100%;
    height: 100%;
    animation: colorShift 3s ease-in-out infinite;
    will-change: filter;
  }

  .glitch::before,
  .glitch::after {
    content: "";
    position: absolute;
    inset: 0;
    background-size: contain;
    background-position: center;
    background-repeat: no-repeat;
    mix-blend-mode: overlay;
    pointer-events: none;
  }

  .glitch::before {
    animation: glitch 2s cubic-bezier(0.2, 0, 0.8, 1) infinite;
    clip-path: polygon(
      0 15%,
      100% 15%,
      100% 30%,
      0 30%,
      0 45%,
      100% 45%,
      100% 65%,
      0 65%
    );
    transform: translate(3px);
    opacity: 0.7;
  }

  .glitch::after {
    animation: glitch 2.2s cubic-bezier(0.2, 0, 0.8, 1) infinite reverse;
    clip-path: polygon(
      0 10%,
      100% 10%,
      100% 20%,
      0 20%,
      0 55%,
      100% 55%,
      100% 70%,
      0 70%
    );
    transform: translate(-3px);
    opacity: 0.7;
  }

  .logo-container {
    position: relative;
    width: 8rem;
    height: 8rem;
    perspective: 500px;
    transform-style: preserve-3d;
  }

  @keyframes glitch {
    0% {
      transform: translate(0);
    }
    20% {
      transform: translate(-2px, 2px);
    }
    40% {
      transform: translate(2px, -2px);
    }
    60% {
      transform: skew(2deg);
    }
    80% {
      transform: skew(-2deg);
    }
    100% {
      transform: translate(0);
    }
  }

  .progress-bar {
    width: 200px;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 1rem;
  }

  .progress-fill {
    height: 100%;
    background: theme(colors.lime.500);
    transition: width 0.3s ease-out;
  }

  .errors {
    color: theme(colors.red.500);
    margin-top: 0.5rem;
    font-size: 0.875rem;
  }
</style>
