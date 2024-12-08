<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { fade } from "svelte/transition";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { t } from "$lib/services/translations";
  import { appLoader } from "$lib/services/appLoader";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import { updateWorkerService } from "$lib/services/updateWorkerService";
  import { auth } from "$lib/services/auth";

  let pageTitle = $state(
    process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]",
  );
  let { children } = $props();
  let currentPath = $state($page.url.pathname);

  let initializationPromise: Promise<void> | null = null;

  async function init() {
    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      try {
        await appLoader.initialize();
        await auth.initialize();
      } catch (error) {
        console.error("Initialization error:", error);
        initializationPromise = null;
        throw error;
      }
    })();

    return initializationPromise;
  }

  onMount(() => {
    init();
  });

  onDestroy(() => {
    appLoader.destroy();
    updateWorkerService.destroy();
  });

  $effect(() => {
    currentPath = $page.url.pathname;
  });
</script>

<svelte:head>
  <title>{pageTitle} - {$t("common.browserSubtitle")}</title>
</svelte:head>

<div class="tv-wrapper app-container">
  <PageWrapper page={currentPath}>
    <div class="nav-container">
      <Navbar />
    </div>
    <main class="content-container">
      {#key currentPath}
        <div class="w-full h-full" in:fade={{ duration: 250 }}>
          {@render children?.()}
        </div>
      {/key}
    </main>
  </PageWrapper>
  <Toast />
</div>

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
