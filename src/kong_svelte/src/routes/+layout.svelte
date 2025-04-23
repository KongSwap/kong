<script lang="ts">
	import { fade } from 'svelte/transition';
  import "../app.css";
  import { page } from "$app/state";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import AddToHomeScreen from "$lib/components/common/AddToHomeScreen.svelte";
  import QRModal from "$lib/components/common/QRModal.svelte";
  import MetaTags from "$lib/components/common/MetaTags.svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import { browser } from "$app/environment";
  import TokenTicker from "$lib/components/nav/TokenTicker.svelte";
  import { auth } from "$lib/stores/auth";
  import { userTokens } from "$lib/stores/userTokens";
  import GlobalSearch from "$lib/components/search/GlobalSearch.svelte";
  import { searchStore } from "$lib/stores/searchStore";
  import { keyboardShortcuts } from "$lib/services/keyboardShortcuts";
  import KeyboardShortcutsHelp from "$lib/components/common/KeyboardShortcutsHelp.svelte";
  import { configureStorage } from "$lib/config/localForage.config";
  import { allowanceStore } from "$lib/stores/allowanceStore";
  import { DEFAULT_TOKENS } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import type { LayoutData } from './$types';
  import GlobalWalletProvider from "$lib/components/wallet/GlobalWalletProvider.svelte";

  let { data, children } = $props<{ 
    data: LayoutData & { metadata: { url: string } },
    children: any 
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
      if (document.documentElement.getAttribute('data-theme-ready') === 'true') {
        themeReady = true;
      } else {
        // Setup a timeout to hide loading spinner if it takes too long
        loadingTimeout = window.setTimeout(() => {
          // Force show content after 2 seconds even if theme isn't fully ready
          themeReady = true;
          document.documentElement.setAttribute('data-theme-ready', 'true');
          console.log('[Layout] Forced theme ready due to timeout');
        }, 2000);
        
        // Start theme initialization 
        themeStore.initTheme();
        
        // Check if theme is ready
        const checkThemeReady = () => {
          if (document.documentElement.getAttribute('data-theme-ready') === 'true') {
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

<svelte:head>
  <style>
    body {
      width: 100%;
      height: 100%;
      display: flex;
    }
    
    /* Hide app until theme is ready */
    html:not([data-theme-ready="true"]) .app-content {
      visibility: hidden;
    }
    
    /* Simple loading indicator */
    .theme-loading {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--bg-dark, #0D111F);
      z-index: 9999;
      opacity: 1;
      transition: opacity 0.2s ease-out;
    }
    
    html[data-theme-ready="true"] .theme-loading {
      opacity: 0;
      pointer-events: none;
    }

    /* Faster fade-out for loading spinner */
    @media (prefers-reduced-motion: no-preference) {
      html[data-theme-ready="true"] .theme-loading {
        animation: fadeOut 0.2s forwards;
      }
      
      @keyframes fadeOut {
        to { opacity: 0; visibility: hidden; }
      }
    }
  </style>
</svelte:head>

<MetaTags 
  title={data.metadata.title} 
  description={data.metadata.description} 
  image={data.metadata.image} 
  url={data.metadata.url} 
/>

{#if browser && !themeReady}
  <div class="theme-loading">
    <!-- Simple loading spinner -->
    <div class="loading-spinner"></div>
  </div>
{/if}

<div class="flex flex-col min-h-screen w-full origin-center app-content">
  <PageWrapper page={page.url.pathname}>
    {#if page.url.pathname !== '/'}
    <div class="ticker-section">
      <TokenTicker />
    </div>
    {/if}
    {#if page.url.pathname !== '/'}
    <div class="bg-transparent navbar-section">
      <Navbar />
    </div>
    {/if}
    <main class="flex flex-col items-center w-full flex-grow">
      <div class="w-full h-full" transition:fade>
        {@render children?.()}
      </div>
    </main>
    
  </PageWrapper>
  <Toast />
  <AddToHomeScreen />
  <QRModal />
  <GlobalSearch isOpen={$searchStore.isOpen} on:close={() => searchStore.close()} />
  <KeyboardShortcutsHelp />
  <GlobalWalletProvider />
  <div id="modals"></div>
</div>

<style lang="postcss">
  .loading-spinner {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #0095EB;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
