<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { fade } from "svelte/transition";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { appLoader } from "$lib/services/appLoader";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import AddToHomeScreen from "$lib/components/common/AddToHomeScreen.svelte";
  import QRModal from "$lib/components/common/QRModal.svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import { browser } from "$app/environment";
  import TokenTicker from "$lib/components/nav/TokenTicker.svelte";
  import { auth } from "$lib/services/auth";
  import { kongDB } from "$lib/services/db";
  import { userTokens } from "$lib/stores/userTokens";
  import { DEFAULT_TOKENS } from "$lib/constants/tokenConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import TrollBox from "$lib/components/trollbox/TrollBox.svelte";
  import GlobalSearch from "$lib/components/search/GlobalSearch.svelte";
  import { searchStore } from "$lib/stores/searchStore";
  
  let pageTitle = $state(
    process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]",
  );
  let initializationPromise: Promise<void> | null = null;
  let initializationError: Error | null = null;
  let defaultTokens: FE.Token[] = [];
  
  async function init() {
    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      try {
        await kongDB.initialize();
        await auth.initialize();
        await appLoader.initialize();
        console.log("[App] App initialization complete");
      } catch (error) {
        console.error("[App] Initialization error:", error);
        initializationError = error as Error;
        initializationPromise = null;
        throw error;
      }
    })();

    return initializationPromise;
  }

  function handleKeyDown(event: KeyboardEvent) {
    // Ctrl+K or Cmd+K to open search
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      searchStore.open();
    }
  }

  onMount(() => {
    // Add keyboard shortcut listener
    if (browser) {
      window.addEventListener('keydown', handleKeyDown);
      themeStore.initTheme();
    }
    
    // Initialize the app
    init().catch((error) => {
      console.error("[App] Failed to initialize app:", error);
      initializationError = error instanceof Error ? error : new Error(String(error));
    });
    
    // Load tokens
    fetchTokensByCanisterId(Object.values(DEFAULT_TOKENS))
      .then((tokens) => {
        defaultTokens = tokens;
        if (defaultTokens.length > 0 && !$auth.isConnected) {
          userTokens.enableTokens(defaultTokens);
        }
        return userTokens.refreshTokenData();
      })
      .catch((error) => {
        console.error("[App] Failed to fetch tokens:", error);
      });
  });

  onDestroy(() => {
    if (browser) {
      appLoader.destroy();
      window.removeEventListener('keydown', handleKeyDown);
    }
  });

  $effect(() => {
    if (defaultTokens.length > 0 && !$auth.isConnected) {
      userTokens.enableTokens(defaultTokens);
    }
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
  <!-- Add TrollBox component -->
  <TrollBox />
  <GlobalSearch isOpen={$searchStore.isOpen} on:close={() => searchStore.close()} />
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
