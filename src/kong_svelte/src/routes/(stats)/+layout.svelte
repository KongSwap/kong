<script lang="ts">
  import { fade, crossfade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { page } from "$app/state";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import AddToHomeScreen from "$lib/components/common/AddToHomeScreen.svelte";
  import QRModal from "$lib/components/common/QRModal.svelte";
  import TokenTicker from "$lib/components/nav/TokenTicker.svelte";
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
  import { DEFAULT_TOKENS } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import GlobalSignatureModal from "$lib/components/wallet/GlobalSignatureModal.svelte";
  import { themeStore } from "$lib/stores/themeStore";
    import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  let { children } = $props<{
    children: any;
  }>();

  let initializationPromise = $state<Promise<void> | null>(null);
  let defaultTokens = $state<Kong.Token[]>([]);
  let themeReady = $state(false);
  let loadingTimeout: number | null = $state(null);

  // Create crossfade transition for smoother page transitions
  const [send, receive] = crossfade({
    duration: 300,
    easing: cubicOut,
    fallback: (node) => fade(node, { duration: 300 })
  });

  async function init() {
    const promise = (async () => {
      try {
        if (browser) {
          configureStorage();
          themeStore.initTheme();
          themeReady = true;
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
    // Initialize keyboard shortcuts
    keyboardShortcuts.initialize();

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


<div class="flex flex-col min-h-screen w-full origin-center app-content">
  {#if !themeReady}
  <LoadingIndicator message="Loading..." fullHeight />
{:else}
  <PageWrapper page={page.url.pathname}>
    <div class="ticker-section bg-kong-bg-primary">
      <TokenTicker />
    </div>
    <div class="bg-transparent navbar-section mb-4">
      <Navbar />
    </div>
    <main class="main-container flex justify-center w-full flex-grow">
      {#key page.url.pathname}
        <div 
          class="content-wrapper w-full px-2 mx-auto h-full" 
          in:receive={{ key: page.url.pathname }}
          out:send={{ key: page.url.pathname }}
        >
          {@render children?.()}
        </div>
      {/key}
    </main>

    <footer class="w-full h-6 bg-transparent absolute bottom-0 mx-auto">
      <div
        class="flex items-center justify-center opacity-60 transition-opacity duration-200"
      >
        <p class="text-xs text-kong-text-secondary">
          Powered by <button
            onclick={() => goto("/")}
            class="hover:opacity-90 text-kong-text-primary font-semibold hover:text-kong-primary"
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

<style>
  /* Ensure smooth transitions without layout shifts */
  .main-container {
    position: relative;
  }
  
  .content-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    min-height: 100%;
  }
</style>
