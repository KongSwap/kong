<script lang="ts">
  import { page } from "$app/stores";
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
  import { DEFAULT_TOKENS } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import GlobalSignatureModal from "$lib/components/wallet/GlobalSignatureModal.svelte";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import { settingsStore } from "$lib/stores/settingsStore";

  let { children } = $props<{
    children: any;
  }>();

  let initializationPromise = $state<Promise<void> | null>(null);
  let defaultTokens = $state<Kong.Token[]>([]);
  let themeReady = $state(false);
  let loadingTimeout: number | null = $state(null);
  
  // Track background transition state
  let backgroundTransitioning = $state(false);
  let previousPath = $state('');
  let pageKey = $state(0);
  
  // Determine if current page should have themed background
  const hasThemedBackground = $derived(
    $page.url.pathname === '/' || 
    $page.url.pathname.startsWith('/pro') || 
    $page.url.pathname.includes('/competition')
  );

  async function init() {
    const promise = (async () => {
      try {
        if (browser) {
          // Initialize theme store for all pages
          themeStore.initTheme();
          // Initialize settings store
          await settingsStore.initializeStore();
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
  
  // Handle page transitions
  $effect(() => {
    const currentPath = $page.url.pathname;
    if (previousPath && previousPath !== currentPath) {
      // Increment key to trigger transition
      pageKey++;
      
      // Check if we're transitioning between themed and non-themed pages
      const wasThemed = previousPath === '/' || previousPath.startsWith('/pro') || previousPath.includes('/competition');
      const isThemed = hasThemedBackground;
      
      if (wasThemed !== isThemed) {
        backgroundTransitioning = true;
        setTimeout(() => {
          backgroundTransitioning = false;
        }, 800); // Match the CSS transition duration
      }
    }
    previousPath = currentPath;
  });
</script>


<div class="flex flex-col min-h-screen w-full origin-center overflow-hidden app-container bg-kong-bg-primary" 
     class:bg-transition={backgroundTransitioning}
>
  {#if !themeReady}
  <LoadingIndicator message="Loading..." fullHeight />
{:else}
    <PageWrapper page={$page.url.pathname} enableBackground={hasThemedBackground}>
      <div id="navbar-section" class="bg-transparent navbar-section">
        <Navbar />
      </div>
      <main class="flex relative">
        <div class="w-full mx-auto relative">
          <div class="page-content w-full">
            {@render children?.()}
          </div>
        </div>
      </main>
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
{/if}
</div>

<style scoped lang="postcss">
  /* Ensure content is visible */
  main {
    min-height: 0; /* Fix flexbox issue */
  }
  
  /* Page content transitions */
  .page-content {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Smooth color transitions for theme changes */
  :global(html) {
    background-color: rgb(var(--bg-primary));
  }
  
  :global(body) {
    transition: background-color 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    background-color: rgb(var(--bg-primary));
    min-height: 100vh;
  }
  

  .app-container.bg-transition {
    transition-duration: 0.8s;
  }

</style>
