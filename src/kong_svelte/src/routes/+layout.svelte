<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { fade } from "svelte/transition";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { appLoader } from "$lib/services/appLoader";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import { updateWorkerService } from "$lib/services/updateWorkerService";
  import AddToHomeScreen from "$lib/components/common/AddToHomeScreen.svelte";
  import QRModal from '$lib/components/common/QRModal.svelte';
  import { themeStore } from '$lib/stores/themeStore';
  import { browser } from '$app/environment';
  import TokenTicker from "$lib/components/nav/TokenTicker.svelte";
  import { auth } from "$lib/services/auth";
  import { kongDB } from "$lib/services/db";
  
  let pageTitle = $state(process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]");
  let initializationPromise: Promise<void> | null = null;
  let initializationError: Error | null = null;

  async function init() {
    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      try {
        // First initialize the database and wait for it to complete
        console.log('[App] Initializing database...');
        await kongDB.initialize();
        console.log('[App] Database initialization complete');

        // Then initialize auth and app loader
        console.log('[App] Initializing auth and app loader...');
        await auth.initialize();
        await appLoader.initialize();
        console.log('[App] App initialization complete');
      } catch (error) {
        console.error("[App] Initialization error:", error);
        initializationError = error as Error;
        initializationPromise = null;
        throw error;
      }
    })();

    return initializationPromise;
  }

  onMount(() => {
    init().catch(error => {
      console.error("[App] Failed to initialize app:", error);
      initializationError = error;
    });
    
    if (browser) {
      themeStore.initTheme();
    }
  });

  onDestroy(() => {
    appLoader.destroy();
    updateWorkerService.destroy();
  });
</script>

{#if initializationError}
  <div class="error-message">
    Failed to initialize app: {initializationError.message}
  </div>
{/if}

<svelte:head>
  <title>{pageTitle} - Rumble in the crypto jungle!</title>
</svelte:head>

<div class="app-container">
  <PageWrapper page={$page.url.pathname}>
      <div class="ticker-section">
      <TokenTicker />
    </div>
    <div class="nav-container">
      <Navbar />
    </div>
    <main class="content-container">
      {#key $page.url.pathname}
        <div class="w-full h-full" in:fade={{ duration: 250 }}>
           <slot />
        </div>
      {/key}
    </main>
  </PageWrapper>
  <Toast />
  <AddToHomeScreen />
  <QRModal />
  <div id="modals"></div>
</div>

<style scoped lang="postcss">
  :global(body) {
    width: 100%;
    height: 100%;
    display: flex;
    @apply dark:bg-[#010101] light:bg-gray-200 transition-colors duration-200;
  }

  .nav-container {
    background-color: transparent;
  }

  .content-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .app-container {
    @apply flex flex-col min-h-screen w-full;
    transform-origin: center;
  }
</style>
