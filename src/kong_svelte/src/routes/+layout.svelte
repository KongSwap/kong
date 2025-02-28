<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
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
  import { keyboardShortcuts } from "$lib/services/keyboardShortcuts";
  import KeyboardShortcutsHelp from "$lib/components/common/KeyboardShortcutsHelp.svelte";
  
  const pageTitle = $state(
    process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]",
  );
  let initializationPromise = $state<Promise<void> | null>(null);
  let defaultTokens = $state<FE.Token[]>([]);
  let { children } = $props();
  
  async function init() {
    if (initializationPromise) {
      return initializationPromise;
    }

    const promise = (async () => {
      try {
        await kongDB.initialize();
        await auth.initialize();
        console.log("[App] App initialization complete");
      } catch (error) {
        console.error("[App] Initialization error:", error);
        initializationPromise = null;
        throw error;
      }
    })();

    initializationPromise = promise;
    return promise;
  }

  // Initialize on component mount
  $effect.root(() => {
    // Initialize theme
    if (browser) {
      themeStore.initTheme();
      
      // Initialize keyboard shortcuts
      keyboardShortcuts.initialize();
    }
    
    // Initialize the app
    init().catch((error) => {
      console.error("[App] Failed to initialize app:", error);
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
      
    // Cleanup on destroy
    return () => {
      if (browser) {  
        keyboardShortcuts.destroy();
      }
    };
  });

  $effect(() => {
    if (defaultTokens.length > 0 && !$auth.isConnected) {
      userTokens.enableTokens(defaultTokens);
    }
  });
</script>

<svelte:head>
  <title>{pageTitle} - Rumble in the crypto jungle!</title>
  <style>
    body {
      width: 100%;
      height: 100%;
      display: flex;
      @apply dark:bg-[#010101] light:bg-gray-200 transition-colors duration-200;
    }
  </style>
</svelte:head>

<div class="flex flex-col min-h-screen w-full origin-center">
  <PageWrapper page={page.url.pathname}>
    <div class="ticker-section">
      <TokenTicker />
    </div>
    <div class="bg-transparent">
      <Navbar />
    </div>
    <main class="flex flex-col items-center w-full">
      <div class="w-full h-full">
        {@render children?.()}
      </div>
    </main>
  </PageWrapper>
  <Toast />
  <AddToHomeScreen />
  <QRModal />
  <!-- Add TrollBox component -->
  <TrollBox />
  <GlobalSearch isOpen={$searchStore.isOpen} on:close={() => searchStore.close()} />
  <KeyboardShortcutsHelp />
  <div id="modals"></div>
</div>
