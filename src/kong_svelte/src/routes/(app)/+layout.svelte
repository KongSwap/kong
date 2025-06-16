<script lang="ts">
  import { fade } from "svelte/transition";
  import { page } from "$app/state";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import AddToHomeScreen from "$lib/components/common/AddToHomeScreen.svelte";
  import QRModal from "$lib/components/common/QRModal.svelte";
  import TokenTicker from "$lib/components/nav/NavbarTokenTicker.svelte";
  import GlobalSearch from "$lib/components/search/GlobalSearch.svelte";
  import { searchStore } from "$lib/stores/searchStore";
  import KeyboardShortcutsHelp from "$lib/components/common/KeyboardShortcutsHelp.svelte";
  import GlobalWalletProvider from "$lib/components/wallet/GlobalWalletProvider.svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { auth } from "$lib/stores/auth";
  import { userTokens } from "$lib/stores/userTokens";
  import { keyboardShortcuts } from "$lib/services/keyboardShortcuts";
  import { configureStorage } from "$lib/config/localForage.config";
  import { allowanceStore } from "$lib/stores/allowanceStore";
  import { DEFAULT_TOKENS } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import GlobalSignatureModal from "$lib/components/wallet/GlobalSignatureModal.svelte";
  import { themeStore } from "$lib/stores/themeStore";
    import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import { initializeAuthFavoriteSync } from "$lib/stores/authFavoriteSync";
  let { children } = $props<{
    children: any;
  }>();

  let initializationPromise = $state<Promise<void> | null>(null);
  let defaultTokens = $state<Kong.Token[]>([]);
  let themeReady = $state(false);
  let loadingTimeout: number | null = $state(null);

  async function init() {
    const promise = (async () => {
      try {
        if (browser) {
          configureStorage();
        }
        await auth.initialize();
        if (browser) {
          allowanceStore.initialize();
          // Initialize auth-favorite sync after auth is initialized
          initializeAuthFavoriteSync();

          // Fetch default tokens
          const tokenCanisterIds = Object.values(DEFAULT_TOKENS);
          const tokens = await fetchTokensByCanisterId(tokenCanisterIds);
          defaultTokens = tokens;
        }
      } catch (error) {
        console.error("[App] Initialization error:", error);
        initializationPromise = null;
      }
    })();

    initializationPromise = promise;
    return promise;
  }

  // Initialize on component mount
  $effect.root(() => {
    // Initialize theme
    if (browser) {
      // Check if theme is ready immediately - it might be ready from the inline script
      if (
        document.documentElement.getAttribute("data-theme-ready") === "true"
      ) {
        themeReady = true;
      } else {
        // Setup a timeout to hide loading spinner if it takes too long
        loadingTimeout = window.setTimeout(() => {
          // Force show content after 2 seconds even if theme isn't fully ready
          themeReady = true;
          document.documentElement.setAttribute("data-theme-ready", "true");
          console.log("[Layout] Forced theme ready due to timeout");
        }, 2000);

        // Start theme initialization
        themeStore.initTheme();

        // Check if theme is ready
        const checkThemeReady = () => {
          if (
            document.documentElement.getAttribute("data-theme-ready") === "true"
          ) {
            themeReady = true;
            if (loadingTimeout) {
              clearTimeout(loadingTimeout);
              loadingTimeout = null;
            }
          } else {
            // Check more frequently (faster response)
            setTimeout(checkThemeReady, 5);
          }
        };

        checkThemeReady();
      }

      // Initialize keyboard shortcuts
      keyboardShortcuts.initialize();
    }

    // Initialize the app only if not already initializing
    if (!initializationPromise) {
      init().catch((error) => {
        console.error("[App] Failed to initialize app:", error);
      });
    }

    // Cleanup on destroy
    return () => {
      if (browser) {
        keyboardShortcuts.destroy();
        allowanceStore.destroy();
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
        }
      }
    };
  });

  $effect(() => {
    if (defaultTokens.length > 0 && !$auth.isConnected) {
      userTokens.enableTokens(defaultTokens);
    }
  });
</script>


<div class="flex flex-col min-h-screen w-full origin-center app-content">
  {#if !themeReady}
  <LoadingIndicator text="Loading..." fullHeight />
{:else}
  <PageWrapper page={page.url.pathname}>
    <div class="ticker-section">
      <TokenTicker />
    </div>
    <div class="bg-transparent navbar-section">
      <Navbar />
    </div>
    <main class="flex flex-col items-center w-full flex-grow">
      <div class="w-full h-full" transition:fade>
        {@render children?.()}
      </div>
    </main>

    <footer class="w-full h-6 bg-transparent absolute bottom-0 mx-auto">
      <div
        class="flex items-center justify-center opacity-60 hover:opacity-90 transition-opacity duration-200"
      >
        <p class="text-xs text-kong-text-secondary">
          Powered by <button
            onclick={() => goto("/")}
            class="text-kong-text-primary font-semibold hover:text-kong-primary"
            >KongSwap</button
          >
        </p>
      </div>
    </footer>
  </PageWrapper>
  <Toast />
  <AddToHomeScreen />
  <QRModal />
  <GlobalSearch
    isOpen={$searchStore.isOpen}
    on:close={() => searchStore.close()}
  />
  <KeyboardShortcutsHelp />
  <GlobalWalletProvider />
  <GlobalSignatureModal />
  <div id="modals"></div>
{/if}
</div>
