<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onMount } from "svelte";
  import kongLogo from "$lib/assets/kong_logo.png";
  import { loadingState } from "$lib/services/loading/loadingStore";
  import { appLoader } from "$lib/services/appLoader";
  import { derived } from "svelte/store";
  import { kongDB } from "$lib/services/db";
  import { liveQuery } from "dexie";
  import icpLogo from "$lib/assets/tokens/icp.webp";
  import gorillaRight from "$lib/assets/gorilla-facing-right.svg";

  let currentLogo = kongLogo;
  let dominantColor = "#4F46E5";
  let isShuttingDown = false;
  let glitchActive = false;
  let glitchOutActive = false;
  let nextImageIndex = 0;
  let frozenProgress = 0;
  let availableLogos: string[] = [];

  const appLoadingState = appLoader.loadingState;

    // Create a derived store for the loading progress
    const loadingProgress = derived(appLoadingState, $state => {
    const progress = $state.assetsLoaded / ($state.totalAssets || 1) * 100;
    return Math.min(Math.round(progress), 100);
  });


  // Use liveQuery to get logos in real-time
  const logoQuery = liveQuery(async () => {
    const tokenLogos = await kongDB.images.toArray();
    const logos = tokenLogos
      .filter(logo => logo.image_url) // Filter out entries without logos
      .map(logo => logo.image_url as string);
    
    // Combine with default logos
    return [...new Set([...logos, kongLogo, icpLogo])];
  });

  $: availableLogos = $logoQuery || [kongLogo, icpLogo];

  function getNextLogo(): string {
    if (!availableLogos || availableLogos.length === 0) return kongLogo;
    nextImageIndex = (nextImageIndex + 1) % availableLogos.length;
    return availableLogos[nextImageIndex];
  }

  async function cycleContent() {
    const CYCLE_INTERVAL = 800; // Reduced from 1000ms to 800ms
    const TRANSITION_TIME = 200; // Reduced from 300ms to 200ms
    
    const updateContent = async () => {
      // Calculate timings as percentages of transition time
      const glitchOutTime = TRANSITION_TIME * 0.4; // 80ms
      const colorCalcTime = TRANSITION_TIME * 0.2; // 40ms
      const glitchInTime = TRANSITION_TIME * 0.4; // 80ms
      
      try {
        // Prepare next logo before starting animation
        const nextLogo = getNextLogo();
        const nextColor = await getAverageColor(nextLogo);
        
        // Start transition sequence
        glitchOutActive = true;
        await new Promise(resolve => setTimeout(resolve, glitchOutTime));
        
        // Update content mid-transition
        glitchOutActive = false;
        currentLogo = nextLogo;
        dominantColor = nextColor;
        
        await new Promise(resolve => setTimeout(resolve, colorCalcTime));
        
        // Final glitch effect
        glitchActive = true;
        await new Promise(resolve => setTimeout(resolve, glitchInTime));
        glitchActive = false;
      } catch (error) {
        console.error('Error during logo transition:', error);
        // Reset states in case of error
        glitchOutActive = false;
        glitchActive = false;
      }
    };

    // Initial update
    await updateContent();

    // Set up interval for content cycling
    const interval = setInterval(async () => {
      if (isShuttingDown) {
        clearInterval(interval);
        return;
      }
      await updateContent();
    }, CYCLE_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }

  onMount(async () => {
    cycleContent();
  });

  async function getAverageColor(imgSrc: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve("#4F46E5"); // Fallback color if context is null
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < imageData.length; i += 4) {
          if (imageData[i + 3] > 128) { // Only consider non-transparent pixels
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }
        
        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          resolve(`rgb(${r}, ${g}, ${b})`);
        } else {
          resolve("#4F46E5"); // Fallback color
        }
      };
      
      img.onerror = () => resolve("#4F46E5"); // Fallback color
      img.src = imgSrc;
    });
  }

  $: containerStyle = `--glow-color: ${dominantColor};`;

  // Freeze progress when shutting down
  $: if (!isShuttingDown) {
    frozenProgress = $loadingProgress;
  }

  // Update loading state when assets are loaded
  $: if ($appLoadingState.assetsLoaded === $appLoadingState.totalAssets && $appLoadingState.totalAssets > 0) {
    isShuttingDown = true;
    setTimeout(() => {
      loadingState.update(state => ({ ...state, isLoading: false }));
    }, 200);
  }
</script>

{#if $loadingState.isLoading}
  <div
    class="h-screen top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center bg-gray-900 will-change-transform loading-screen"
    out:fade={{ duration: 400 }}
  >
    <div class="screen-curve animation min-h-screen"></div>
    <div class="crt-content min-h-screen">
      <img src={gorillaRight} alt="Kong Logo" class="absolute bottom-0 opacity-[8%] w-[600px] filter brightness-0 invert" />

      <div class="flex flex-col items-center">
        <div class="logo-wrapper mb-8">
          {#key currentLogo}
            <div 
              class="logo-container chrome-frame absolute-center"
              style={containerStyle}
              in:scale|local={{ duration: 400, delay: 200, easing: cubicOut, start: 0.2 }}
              out:scale|local={{ duration: 200, start: 0.8 }}
            >
              <div class="logo-inner !p-0 object-cover">
                <img
                  src={currentLogo}
                  alt="Current Logo"
                  class="logo-image pixelated !rounded-full !p-0 object-cover"
                />
              </div>
            </div>
          {/key}
        </div>
        <h2 class="relative !text-7xl font-bold mb-2 uppercase font-alumni neon-text mt-10 flex justify-center flex-col gap-x-2 items-center">
          <span class="h-[10] text-outline-1">KongSwap</span>
        </h2>
        <div class="progress-container mt-4">
          <div class="progress-bar rounded-lg">
            <div 
              class="progress-fill"
              style:width={(isShuttingDown ? frozenProgress : $loadingProgress) + "%"}
            ></div>
          </div>
         
        </div>

        <p class="progress-text text-sm mt-4">
          {#if $appLoadingState.totalAssets > 0}
            LOADING ASSETS: {isShuttingDown ? frozenProgress : $loadingProgress}%
          {:else}
            LOADING...
          {/if}
        </p>

        {#if $appLoadingState.errors.length > 0}
          <div class="errors mt-4">
            {#each $appLoadingState.errors as error}
              <p class="text-red-500 text-sm blink">> ERROR: {error}</p>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  :global(.loading-screen) {
    transform-origin: center;
    will-change: transform, opacity, filter;
  }

  @keyframes neonFlicker {
    0%, 100% {
      text-shadow:
        0 0 7px #fff,
        0 0 10px #fff,
        0 0 21px #fff,
        0 0 42px var(--glow-color),
        0 0 82px var(--glow-color),
        0 0 92px var(--glow-color),
        0 0 102px var(--glow-color),
        0 0 151px var(--glow-color);
    }
    5%, 95% {
      text-shadow: none;
    }
  }

  .neon-text {
    color: #fff;
    animation: neonFlicker 1.5s infinite;
    letter-spacing: 4px;
    text-shadow:
      0 0 7px #fff,
      0 0 10px #fff,
      0 0 21px #fff,
      0 0 42px var(--glow-color),
      0 0 82px var(--glow-color),
      0 0 92px var(--glow-color),
      0 0 102px var(--glow-color),
      0 0 151px var(--glow-color);
  }

  @keyframes scanline {
    0% { transform: translateY(0); }
    100% { transform: translateY(4px); }
  }

  @keyframes moveStripes {
    0% {
      background-position: 0 0;
    }
    100% {
      background-position: 50px 0;
    }
  }

  .progress-container {
    @apply w-80 relative;
    padding: 2px;
    background: transparent;
  }

  .progress-bar {
    @apply relative w-full overflow-hidden;
    height: 32px;
    background: #fff;
  }

  .progress-fill {
    @apply absolute top-0 left-0 h-full;
    background: #298000;
    transition: width 0.3s linear;
    
    &.shutting-down {
      transition: none;
    }
    
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: repeating-linear-gradient(
        to right,
        transparent 0,
        transparent 2px,
        #32a852 2px,
        #32a852 4px,
        #298000 4px,
        #298000 6px,
        #32a852 6px,
        #32a852 8px
      );
    }
  }

  .progress-numbers {
    @apply flex justify-between mt-2 text-sm font-mono;
    color: #ffffff;
    text-shadow: 1px 1px #000000;

    .current {
      @apply font-bold;
      color: #ffffff;
    }
  }

  .loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    animation: flicker 0.15s infinite;
    background: rgba(16, 16, 16, 0.94);
    display: flex;
    align-items: center;
    justify-content: center;

    &::before {
      content: "";
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: 
        linear-gradient(
          rgba(18, 16, 16, 0) 50%,
          rgba(0, 0, 0, 0.25) 50%
        ),
        linear-gradient(
          90deg,
          rgba(255, 0, 0, 0.06),
          rgba(0, 255, 0, 0.02),
          rgba(0, 0, 255, 0.06)
        );
      background-size: 100% 2px, 3px 100%;
      pointer-events: none;
      animation: scanlines 1s linear infinite;
    }

    &::after {
      content: "";
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(
        circle at center,
        transparent 0%,
        rgba(0, 0, 0, 0.2) 90%
      );
      pointer-events: none;
    }
  }

  .crt-content {
    position: relative;
    z-index: 1;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    
    &::before {
      content: " ";
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
      z-index: 2;
      background-size: 100% 2px, 3px 100%;
      pointer-events: none;
      animation: scanlines 1s linear infinite;
    }
    
    &::after {
      content: "";
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 5px;
      background: #fff;
      opacity: 0.1;
      animation: scanline 6s linear infinite;
    }
  }

  .screen-curve {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1;
    
    &::after {
      content: "";
      background: 
        radial-gradient(
          circle at center,
          rgba(var(--glow-color), 0.1),
          transparent 70%
        );
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      animation: flicker 0.15s infinite;
      mix-blend-mode: overlay;
    }
  }

  .glitch-container {
    position: relative;
    overflow: hidden;
  }

  .logo-wrapper {
    @apply relative;
    width: 180px;
    height: 180px;
  }

  .absolute-center {
    @apply absolute top-1/2 left-1/2;
    transform: translate(-50%, -50%);
  }

  .logo-container {
    @apply rounded-full p-0 overflow-hidden;
    background: transparent;
    box-shadow:
      0 0 30px color-mix(in srgb, var(--glow-color) 50%, transparent),
      0 0 60px color-mix(in srgb, var(--glow-color) 40%, transparent),
      0 0 90px color-mix(in srgb, var(--glow-color) 30%, transparent),
      0 0 120px color-mix(in srgb, var(--glow-color) 20%, transparent);
    width: 180px;
    height: 180px;
    position: relative;

    &::before, &::after {
      content: '';
      position: absolute;
      top: -100%;
      left: 0;
      right: 0;
      bottom: -100%;
      pointer-events: none;
      z-index: 2;
    }

    &::before {

      background-size: 100% 4px;
      animation: scanline 0.5s linear infinite;
    }

    &::after {
      background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.1) 0%,
        rgba(0, 0, 0, 0.1) 1px,
        transparent 2px,
        transparent 4px
      );
      background-size: 100% 4px;
      animation: scanline 0.5s linear infinite;
      animation-delay: 0.25s;
    }

    &.glitching {
      .glitch-base {
        animation: tv-compress-in 0.4s cubic-bezier(.25, .46, .45, .94) both;
      }

      .glitch-r {
        animation: tv-compress-in 0.4s cubic-bezier(.25, .46, .45, .94) both;
        animation-delay: 0.05s;
        opacity: 0.5;
      }

      .glitch-g {
        animation: tv-compress-in 0.4s cubic-bezier(.25, .46, .45, .94) both;
        animation-delay: 0.1s;
        opacity: 0.5;
      }

      .glitch-b {
        animation: tv-compress-in 0.4s cubic-bezier(.25, .46, .45, .94) both;
        animation-delay: 0.15s;
        opacity: 0.5;
      }
    }

    &.glitching-out {
      .glitch-base {
        animation: tv-compress-out 0.4s cubic-bezier(.25, .46, .45, .94) both;
      }

      .glitch-r {
        animation: tv-compress-out 0.4s cubic-bezier(.25, .46, .45, .94) both;
        animation-delay: 0.05s;
        opacity: 0.5;
      }

      .glitch-g {
        animation: tv-compress-out 0.4s cubic-bezier(.25, .46, .45, .94) both;
        animation-delay: 0.1s;
        opacity: 0.5;
      }

      .glitch-b {
        animation: tv-compress-out 0.4s cubic-bezier(.25, .46, .45, .94) both;
        animation-delay: 0.15s;
        opacity: 0.5;
      }
    }

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0, 0, 0, 0.1) 2px,
        rgba(0, 0, 0, 0.1) 4px
      );
      pointer-events: none;
      z-index: 10;
    }
  }

  .glitch-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .logo-image {
    @apply w-full h-full object-cover rounded-full;
    min-width: 100%;
    min-height: 100%;
    will-change: transform, clip-path;

    &.glitch-base {
      position: relative;
      z-index: 1;
    }

    &.glitch-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      mix-blend-mode: screen;
      opacity: 0.4;
    }

    &.glitch-r {
      animation: glitchAnim 2s steps(2) infinite;
      animation-delay: 0.5s;
      z-index: 2;
      filter: brightness(1.05) contrast(1.05) hue-rotate(45deg);
    }

    &.glitch-g {
      animation: glitchAnim 2s steps(2) infinite reverse;
      animation-delay: 1s;
      z-index: 3;
      filter: brightness(1.05) contrast(1.05) hue-rotate(-45deg);
    }

    &.glitch-b {
      animation: glitchAnim 2s steps(2) infinite;
      animation-delay: 1.5s;
      z-index: 4;
      filter: brightness(1.05) contrast(1.05) hue-rotate(90deg);
    }
  }

  @keyframes rgbShift {
    0% {
      filter: none;
      transform: scale(1);
    }
    20% {
      filter: hue-rotate(-45deg) brightness(1.2);
      transform: scale(1.05) skewX(2deg);
    }
    40% {
      filter: hue-rotate(45deg) brightness(0.9);
      transform: scale(0.95) skewX(-2deg);
    }
    60% {
      filter: hue-rotate(-30deg) brightness(1.1);
      transform: scale(1.02) skewY(2deg);
    }
    80% {
      filter: hue-rotate(30deg) brightness(0.95);
      transform: scale(0.98) skewY(-2deg);
    }
  }

  .message-container {
    min-height: 2rem;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .progress-text {
    @apply text-sm font-mono text-white/80;
    position: relative;
    text-align: center;
    text-shadow: 0 0 5px rgba(241, 241, 241, 0.8);
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @keyframes flicker {
    0% { opacity: 0.97; }
    5% { opacity: 0.95; }
    10% { opacity: 0.9; }
    15% { opacity: 0.95; }
    20% { opacity: 0.98; }
    25% { opacity: 0.95; }
    30% { opacity: 0.9; }
    35% { opacity: 0.95; }
    40% { opacity: 0.98; }
    45% { opacity: 0.94; }
    50% { opacity: 0.98; }
    55% { opacity: 0.95; }
    60% { opacity: 0.97; }
    65% { opacity: 0.95; }
    70% { opacity: 0.98; }
    75% { opacity: 0.94; }
    80% { opacity: 0.98; }
    85% { opacity: 0.96; }
    90% { opacity: 0.98; }
    95% { opacity: 0.95; }
    100% { opacity: 0.98; }
  }

  @keyframes scanline {
    0% {
      transform: translateY(-100%);
    }
    100% {
      transform: translateY(100%);
    }
  }

  @keyframes scanlines {
    0% {
      background-position: 0 -100vh;
    }
    100% {
      background-position: 0 100vh;
    }
  }

  .loading-screen {
    position: relative;
    overflow: hidden;
    animation: flicker 0.15s infinite;
    background: rgba(16, 16, 16, 0.94);

    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        linear-gradient(
          rgba(18, 16, 16, 0) 50%,
          rgba(0, 0, 0, 0.25) 50%
        ),
        linear-gradient(
          90deg,
          rgba(255, 0, 0, 0.06),
          rgba(0, 255, 0, 0.02),
          rgba(0, 0, 255, 0.06)
        );
      background-size: 100% 2px, 3px 100%;
      pointer-events: none;
      animation: scanlines 1s linear infinite;
    }

    &::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(
        circle at center,
        transparent 0%,
        rgba(0, 0, 0, 0.2) 90%
      );
      pointer-events: none;
    }
  }

  .crt-content {
    position: relative;
    z-index: 1;
    
    &::before {
      content: " ";
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
      z-index: 2;
      background-size: 100% 2px, 3px 100%;
      pointer-events: none;
      animation: scanlines 1s linear infinite;
    }
    
    &::after {
      content: "";
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 5px;
      background: #fff;
      opacity: 0.1;
      animation: scanline 6s linear infinite;
    }
  }

  .screen-curve {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1;
    
    &::after {
      content: "";
      background: 
        radial-gradient(
          circle at center,
          rgba(var(--glow-color), 0.1),
          transparent 70%
        );
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      animation: flicker 0.15s infinite;
      mix-blend-mode: overlay;
    }
  }
</style>
