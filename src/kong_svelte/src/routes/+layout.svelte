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
  import { auth } from "$lib/services/auth";

  const hasNavigated = writable(false);
  let showLoadingScreen = $state(true);
  let isDecompressing = false;
  let showStatic = $state(true);
  let mainTransitionComplete = $state(false);
  let initialTransitionDone = $state(false);
  let skipTransition = $state(true);
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
      await auth.initialize();
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
  function pageTransition(node: HTMLElement, { 
    delay = 0,
    duration = 400
  }) {
    return {
      delay,
      duration,
      css: (t: number) => {
        const eased = cubicOut(t);
        return `
          opacity: ${eased};
          transform: scale(${0.95 + (0.05 * eased)});
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
  >
    <PageWrapper page={currentPath}>
      <div class="nav-container">
        <Navbar />
      </div>
      <main class="content-container">
        {#key currentPath}
          <div
            class="w-full h-full"
            in:fade={{ duration: skipTransition ? 0 : 200, delay: skipTransition ? 0 : 200 }}
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

  .no-transition {
    animation: none !important;
    transition: none !important;
  }
</style>
