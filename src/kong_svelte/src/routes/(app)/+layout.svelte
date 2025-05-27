<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut, cubicInOut } from "svelte/easing";
  import { page } from "$app/state";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import AddToHomeScreen from "$lib/components/common/AddToHomeScreen.svelte";
  import QRModal from "$lib/components/common/QRModal.svelte";
  import GlobalSearch from "$lib/components/search/GlobalSearch.svelte";
  import { searchStore } from "$lib/stores/searchStore";
  import KeyboardShortcutsHelp from "$lib/components/common/KeyboardShortcutsHelp.svelte";
  import GlobalWalletProvider from "$lib/components/wallet/GlobalWalletProvider.svelte";
  import { browser } from "$app/environment";
  import { auth } from "$lib/stores/auth";
  import { userTokens } from "$lib/stores/userTokens";
  import { keyboardShortcuts } from "$lib/services/keyboardShortcuts";
  import { configureStorage } from "$lib/config/localForage.config";
  import { DEFAULT_TOKENS } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import GlobalSignatureModal from "$lib/components/wallet/GlobalSignatureModal.svelte";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";

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
        }, 2000);

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


<div class="flex flex-col min-h-screen !bg-kong-bg-primary w-full origin-center overflow-hidden">
  {#if !themeReady}
  <LoadingIndicator message="Loading..." fullHeight />
{:else}
    <div class="bg-transparent navbar-section">
      <Navbar />
    </div>
    <main class="flex flex-grow relative">
      <div class="w-full !max-w-[90rem] mx-auto h-full relative">
        {#key page.url.pathname}
          <div 
            class="page-content w-full h-full" 
            in:fade={{ duration: 200, easing: cubicInOut, delay: 50 }}
            out:fade={{ duration: 150, easing: cubicOut }}
          >
            {@render children?.()}
          </div>
        {/key}
      </div>
    </main>
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
{/if}
</div>

<style>
  /* Ensure smooth transitions without layout shifts */
  .main-container {
    position: relative;
    overflow: hidden;
  }

</style>
