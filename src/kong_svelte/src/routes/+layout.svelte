<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { fade } from "svelte/transition";
  import { writable } from "svelte/store";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { t } from "$lib/services/translations";
  import { appLoader } from "$lib/services/appLoader";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import LoadingScreen from "$lib/components/common/LoadingScreen.svelte";
  import { updateWorkerService } from "$lib/services/updateWorkerService";
  import { cubicOut } from "svelte/easing";

  const hasNavigated = writable(false);
  let showLoadingScreen = $state(true);
  let isDecompressing = false;
  let showStatic = $state(true);
  let mainTransitionComplete = $state(false);
  let initialTransitionDone = $state(false);
  let pageTitle = $state(
    process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]",
  );
  let { children, data } = $props();
  let currentPath = $state($page.url.pathname);
  let initialLoad = $state(true);
  let isInitialized = false;

  // Initialize app
  onMount(() => {
    const init = async () => {
      await appLoader.initialize();
      updateWorkerService.initialize();
      isInitialized = true;
      initialLoad = false;
    };

    init().catch(console.error);
  });

  onDestroy(() => {
    appLoader.destroy();
    updateWorkerService.destroy();
  });

  $effect(() => {
    currentPath = $page.url.pathname;
  });

  $effect(() =>{ 
    if (!initialLoad && !$hasNavigated) {
      hasNavigated.set(true);
    }
  });

  // Custom transition for decompression effect
  function decompress(node: HTMLElement, { 
    delay = 0,
    duration = 400
  }) {
    return {
      delay,
      duration,
      css: (t: number) => {
        const eased = cubicOut(t);
        return `
          transform: scale(${0.9 + (0.1 * eased)});
          opacity: ${eased};
        `;
      }
    };
  }

  // Custom transition for CRT effect
  function crtTransition(node: HTMLElement, { 
    delay = 0,
    duration = 800,
    reverse = false
  }) {
    return {
      delay,
      duration,
      css: (t: number, u: number) => {
        if (initialTransitionDone) {
          return '';
        }

        const phase = Math.min(u * 2, 2);
        let scaleX = 1;
        let scaleY = 1;
        
        if (!reverse) {
          if (phase <= 1) {
            const compress = 1 - (Math.pow(phase, 3) * 0.95);
            scaleX = compress;
            scaleY = compress;
          } else {
            const stretchPhase = phase - 1;
            scaleX = 0.05 + (Math.pow(stretchPhase, 0.5) * 3);
            scaleY = Math.max(0.05 - (stretchPhase * 0.05), 0.001);
          }
        } else {
          if (phase <= 0.5) {
            // Phase 1: Start as horizontal line
            scaleX = 1;
            scaleY = 0.001;
          } else if (phase <= 1) {
            // Phase 2: Expand vertically from horizontal line
            const expandPhase = (phase - 0.5);
            scaleX = 1;
            scaleY = 1;
          } else {
            // Phase 3: Stay at full size
            scaleX = 1;
            scaleY = 1;
          }
        }

        // Calculate opacity and flash effects
        let opacity, flash;
        if (!reverse) {
          if (phase <= 1) {
            opacity = 1 - (Math.pow(phase, 2) * 0.7);
          } else {
            const endPhase = Math.max(0, (phase - 1.7) / 0.3);
            opacity = 0.3 + (Math.sin(endPhase * Math.PI) * 0.7);
          }
          const flashPoint = Math.max(0, (phase - 1.7) / 0.3);
          flash = Math.sin(flashPoint * Math.PI);
        } else {
          if (phase <= 0.5) {
            // Initial horizontal line with flash
            opacity = 1;
            flash = 0;
          } else if (phase <= 1.5) {
            // Maintain consistent brightness during expansion
            opacity = 1;
            flash = 0;
          } else {
            // Final state
            opacity = 1;
            flash = 0;
          }
        }
        
        if (t === 1) {
          mainTransitionComplete = true;
        }
        
        return `
          transform: scale(${scaleX}, ${scaleY});
          opacity: ${opacity};
          filter: brightness(${1 + flash * 5}) contrast(${1 + flash * 3});
        `;
      }
    };
  }

  $effect(() => {
    if (mainTransitionComplete && !initialTransitionDone) {
      initialTransitionDone = true;
      setTimeout(() => {
        showStatic = false;
      }, 500);
    }
  });

  // Handle loading screen transition end
  function handleLoadingScreenEnd() {
    showLoadingScreen = false;
    initialLoad = false;
  }
</script>

<svelte:head>
  <title>{pageTitle} - {$t("common.browserSubtitle")}</title>
</svelte:head>

{#if showLoadingScreen && initialLoad}
  <LoadingScreen on:outroend={handleLoadingScreenEnd} />
{:else}
  <div 
    class="tv-wrapper app-container"
    in:crtTransition|local={{ duration: 800, delay: 0, reverse: false }}
  >
    {#if mainTransitionComplete && showStatic && !initialTransitionDone}
      <div 
        class="animation top-0 left-0 right-0 bottom-0 opacity-50 z-[10] absolute pointer-events-none"
        out:fade={{ duration: 500 }}
      ></div>
    {/if}
    <PageWrapper page={currentPath}>
      <div class="nav-container">
        <Navbar />
      </div>
      <main class="content-container">
        {#key currentPath}
          <div
            class="w-full h-full"
            class:glitch-transition={!$hasNavigated}
            in:crtTransition={{ duration: 800, delay: 200, reverse: true }}
          >
            {@render children?.()}
          </div>
        {/key}
      </main>
    </PageWrapper>
    <Toast />
  </div>
{/if}

<style scoped lang="postcss">

:global(body) {
  width: 100%;
  height: 100%;
  display: flex;
  background-color: #010101;
  background-image: repeating-radial-gradient(circle at 17% 32%, rgba(255, 255, 255, 0.5), rgba(0, 0, 0, 0.2) 0.00085px);
  animation: tv-static 0.5s linear infinite;
}
.animation {
  width: 100%;
  height: 100%;
  margin: auto;
  background-image: repeating-radial-gradient(circle at 17% 32%, rgba(255, 255, 255, 0.5), rgba(0, 0, 0, 0.2) 0.00085px);
  animation: tv-static 0.5s linear infinite;
}
@keyframes tv-static {
  from {
    background-size: 100% 100%;
  }

  to {
    background-size: 200% 200%;
  }
}


  .nav-container {
    background-color: transparent;
  }

  :global([data-theme="modern"]) .nav-container {
    margin-bottom: 1rem;
  }

  .content-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .tv-wrapper {
    position: relative;
    width: 100%;
    min-height: 100vh;
    overflow: hidden;
  }

  .app-container {
    @apply flex flex-col min-h-screen;
    transform-origin: center;
    will-change: transform;
  }

  .glitch-transition {
    position: relative;
    animation:
      glitch-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both,
      squiggle 0.3s ease-in-out;
    animation-delay: 0s, 0.1s;
  }

  @keyframes squiggle {
    0% {
      transform: translate(0) scale(1.1);
    }
    10% {
      transform: translate(4px, 2px) skew(2deg, 2deg) scale(1.08);
    }
    20% {
      transform: translate(-3px, -1px) skew(-3deg, -1deg) scale(1.06);
    }
    30% {
      transform: translate(2px, 3px) skew(1deg, 3deg) scale(1.04);
    }
    40% {
      transform: translate(-2px, -2px) skew(-2deg, -2deg) scale(1.03);
    }
    50% {
      transform: translate(1px, 1px) skew(1deg, 1deg) scale(1.02);
    }
    60% {
      transform: translate(-1px, -1px) skew(-1deg, -1deg) scale(1.01);
    }
    100% {
      transform: translate(0) scale(1);
    }
  }

  @keyframes glitch-in {
    0% {
      transform: scale(1.1);
      opacity: 0;
      clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
      filter: brightness(2) saturate(1.5) contrast(2);
    }
    10% {
      clip-path: polygon(10% 0, 90% 0, 90% 100%, 10% 100%);
      filter: brightness(2) saturate(2) contrast(3) hue-rotate(90deg);
      transform: translate(5px, -5px) scale(1.08);
    }
    20% {
      clip-path: polygon(5% 0, 95% 0, 95% 100%, 5% 100%);
      filter: brightness(1.5) saturate(1.5) contrast(2) hue-rotate(-90deg);
      transform: translate(-4px, 4px) scale(1.06);
    }
    30% {
      clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
      filter: brightness(2) saturate(1) contrast(1.5);
      transform: translate(3px, -3px) scale(1.04);
    }
    40% {
      clip-path: polygon(0 15%, 100% 15%, 100% 85%, 0 85%);
      filter: brightness(1.5) saturate(2) contrast(2) hue-rotate(180deg);
      transform: translate(-2px, 2px) scale(1.02);
    }
    50% {
      clip-path: polygon(0 10%, 100% 10%, 100% 90%, 0 90%);
      filter: brightness(2) saturate(1.5) contrast(1.5) hue-rotate(-180deg);
      transform: translate(1px, -1px) scale(1.01);
    }
    60% {
      clip-path: polygon(0 5%, 100% 5%, 100% 95%, 0 95%);
      filter: brightness(1.5) saturate(1) contrast(2);
      transform: translate(-1px, 1px) scale(1.005);
    }
    100% {
      transform: scale(1);
      opacity: 1;
      clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
      filter: brightness(1) saturate(1) contrast(1);
    }
  }

  @keyframes glitch-rgb {
    0% {
      opacity: 0.3;
      transform: translate(-5px, 5px);
    }
    20% {
      transform: translate(4px, -4px);
    }
    40% {
      transform: translate(-3px, 3px);
    }
    60% {
      transform: translate(2px, -2px);
    }
    80% {
      transform: translate(-1px, 1px);
      opacity: 0.1;
    }
    100% {
      opacity: 0;
      transform: translate(0, 0);
    }
  }

  .glitch-transition::before,
  .glitch-transition::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    mix-blend-mode: screen;
    pointer-events: none;
    animation: squiggle-rgb 0.4s ease-in-out forwards;
    opacity: 0;
  }

  .glitch-transition::before {
    background: rgba(255, 0, 0, 0.2);
    animation:
      glitch-rgb 0.4s steps(2, end) forwards,
      squiggle-rgb 0.3s ease-in-out;
    transform: translate(-2px, 2px);
  }

  .glitch-transition::after {
    background: rgba(0, 255, 255, 0.2);
    animation:
      glitch-rgb 0.4s steps(2, end) forwards,
      squiggle-rgb 0.3s ease-in-out reverse;
    transform: translate(2px, -2px);
  }

  @keyframes squiggle-rgb {
    0% {
      transform: translate(0, 0) skew(0);
    }
    25% {
      transform: translate(4px, -4px) skew(2deg);
    }
    50% {
      transform: translate(-3px, 3px) skew(-2deg);
    }
    75% {
      transform: translate(2px, -2px) skew(1deg);
    }
    100% {
      transform: translate(0, 0) skew(0);
    }
  }

  .no-transition {
    animation: none !important;
    transition: none !important;
  }
</style>
