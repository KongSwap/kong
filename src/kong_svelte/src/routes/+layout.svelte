<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { fade } from "svelte/transition";
  import { writable } from "svelte/store";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { t } from "$lib/services/translations";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { appLoader } from "$lib/services/appLoader";
  import { themeStore } from "$lib/stores/themeStore";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import LoadingScreen from "$lib/components/common/LoadingScreen.svelte";
  import { auth } from "$lib/services/auth";
  import { updateWorkerService } from "$lib/services/updateWorkerService";

  const hasNavigated = writable(false);

  let pageTitle = $state(
    process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]",
  );
  let { children } = $props();
  let currentPath = $state($page.url.pathname);
  let initialLoad = $state(true);
  let isInitialized = false;

  // Initialize app
  onMount(() => {
    const init = async () => {
      await appLoader.initialize();
      updateWorkerService.initialize();
      isInitialized = true;
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
</script>

<svelte:head>
  <title>{pageTitle} - {$t("common.browserSubtitle")}</title>
</svelte:head>

<LoadingScreen on:outroend={() => (initialLoad = false)} />

{#if !initialLoad}
  <div class="tv-wrapper">
    <PageWrapper page={currentPath}>
      <div class="nav-container">
        <Navbar />
      </div>
      <main class="content-container">
        {#key currentPath}
          <div
            class:glitch-transition={!$hasNavigated}
            class="content-container"
            in:fade={{ duration: 200 }}
          >
            {@render children?.()}
          </div>
        {/key}
      </main>
    </PageWrapper>
  </div>
{/if}

<Toast />

<style scoped lang="postcss">
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

  :global(body) {
    margin: 0;
    background-color: #000;
  }

  .tv-wrapper {
    position: relative;
    width: 100%;
    min-height: 100vh;
    overflow: hidden;
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
</style>
