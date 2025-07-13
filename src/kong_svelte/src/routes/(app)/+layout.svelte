<script lang="ts">
  import { page } from "$app/stores";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import QRModal from "$lib/components/common/QRModal.svelte";
  import GlobalSearch from "$lib/components/search/GlobalSearch.svelte";
  import { searchStore } from "$lib/stores/searchStore";
  import KeyboardShortcutsHelp from "$lib/components/common/KeyboardShortcutsHelp.svelte";
  import GlobalWalletProvider from "$lib/components/wallet/GlobalWalletProvider.svelte";
  import { browser } from "$app/environment";
  import { auth } from "$lib/stores/auth";
  import { keyboardShortcuts } from "$lib/services/keyboardShortcuts";
  import GlobalSignatureModal from "$lib/components/wallet/GlobalSignatureModal.svelte";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import { settingsStore } from "$lib/stores/settingsStore";
  import { fade } from "svelte/transition";

  let { children } = $props<{
    children: any;
  }>();

  let initializationPromise = $state<Promise<void> | null>(null);
  let themeReady = $state(false);
  let loadingTimeout: number | null = $state(null);

  // Track background transition state
  let backgroundTransitioning = $state(false);
  let previousPath = $state("");
  let pageKey = $state(0);

  // Determine if current page should have themed background
  const hasThemedBackground = $derived(
    $page.url.pathname === "/" ||
      $page.url.pathname.startsWith("/pro") ||
      $page.url.pathname.includes("/competition"),
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

  // Default tokens are automatically loaded and enabled by userTokens store
  // No need for additional logic here since store handles this internally

  // Handle page transitions
  $effect(() => {
    const currentPath = $page.url.pathname;
    if (previousPath && previousPath !== currentPath) {
      // Increment key to trigger transition
      pageKey++;

      // Check if we're transitioning between themed and non-themed pages
      const wasThemed =
        previousPath === "/" ||
        previousPath.startsWith("/pro") ||
        previousPath.includes("/competition");
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

<div
  class="flex flex-col min-h-screen w-full origin-center app-container pre-theme-bg"
  class:bg-transition={backgroundTransitioning}
>
  {#if !themeReady}
    <LoadingIndicator message="Loading..." fullHeight />
  {:else}
    <!-- Plasma Effect - Only on root page -->
    {#if $page.url.pathname === '/'}
      <div class="plasma-effect-wrapper">
        <div class="plasma-effect-container">
          <div class="plasma-glow-wrapper">
            <div class="plasma-glow-container">
              <div class="plasma-glow"></div>
            </div>
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Texture Overlay - Always visible -->
    <div class="texture-overlay" aria-hidden="true"></div>
    
    <div id="navbar-section" class="bg-transparent navbar-section">
      <Navbar />
    </div>
    {#key $page.url.pathname}
      <main
        class="w-full mx-auto relative"
        in:fade={{ duration: 250, delay: 100 }}
      >
        {@render children?.()}
      </main>
    {/key}
    <Toast />
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
  /* Fallback background before theme loads */
  .pre-theme-bg {
    background-color: rgb(9, 12, 23); /* Dark fallback matching --bg-primary */
  }
  
  .app-container.bg-transition {
    transition-duration: 0.8s;
  }
  
  /* Plasma Effect Wrapper - Scrolls with content */
  .plasma-effect-wrapper {
    position: absolute;
    top: -5vh; /* Position near top behind swap section */
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 80vh; /* Reduced height to focus on swap area */
    pointer-events: none;
    z-index: 1;
    display: flex;
    align-items: flex-start; /* Align to top instead of center */
    justify-content: center;
  }
  
  /* Plasma Effect Container - Centered within wrapper */
  .plasma-effect-container {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  
  /* Plasma Glow System */
  .plasma-glow-wrapper {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(120vw, 1200px);
    height: min(120vh, 1200px);
    pointer-events: none;
  }
  
  .plasma-glow-container {
    position: absolute;
    width: 100%;
    height: 100%;
    animation: plasmaRotate 20s linear infinite;
  }
  
  .plasma-glow {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
    background: 
      radial-gradient(ellipse 600px 800px at 30% 40%, rgb(var(--brand-primary) / 0.4) 0%, transparent 40%),
      radial-gradient(ellipse 800px 600px at 70% 60%, rgb(var(--brand-secondary) / 0.3) 0%, transparent 45%),
      radial-gradient(ellipse 700px 900px at 50% 50%, rgb(var(--brand-primary) / 0.25) 0%, transparent 50%);
    animation: 
      plasmaFloat 8s ease-in-out infinite,
      plasmaMorph 12s ease-in-out infinite,
      plasmaShift 25s linear infinite;
    filter: blur(60px) contrast(1.2) saturate(1.3);
    transform-origin: center;
    opacity: 0.7;
  }
  
  .plasma-glow::before {
    content: '';
    position: absolute;
    top: 20%;
    left: 70%;
    width: 40%;
    height: 35%;
    max-width: 400px;
    max-height: 350px;
    border-radius: 50% 80% 30% 60% / 40% 70% 50% 80%;
    background: 
      radial-gradient(ellipse 100% 70% at 30% 70%, rgb(var(--brand-primary) / 0.6) 0%, transparent 50%),
      radial-gradient(ellipse 70% 120% at 80% 20%, rgb(var(--brand-secondary) / 0.4) 0%, transparent 45%);
    animation: 
      plasmaFloat 6s ease-in-out infinite reverse,
      plasmaMorph 10s ease-in-out infinite reverse,
      plasmaDrift 18s ease-in-out infinite;
    filter: blur(50px) contrast(1.3) hue-rotate(20deg);
    opacity: 0.8;
  }
  
  .plasma-glow::after {
    content: '';
    position: absolute;
    top: 60%;
    left: 25%;
    width: 35%;
    height: 30%;
    max-width: 350px;
    max-height: 300px;
    border-radius: 40% 60% 80% 30% / 70% 40% 60% 80%;
    background: 
      radial-gradient(ellipse 90% 140% at 60% 40%, rgb(var(--brand-secondary) / 0.5) 0%, transparent 45%),
      radial-gradient(ellipse 130% 80% at 20% 90%, rgb(var(--brand-primary) / 0.4) 0%, transparent 40%);
    animation: 
      plasmaFloat 9s ease-in-out infinite,
      plasmaMorph 7s ease-in-out infinite,
      plasmaWave 20s ease-in-out infinite reverse;
    filter: blur(45px) contrast(1.4) hue-rotate(-10deg);
    opacity: 0.75;
  }
  
  @keyframes plasmaFloat {
    0%, 100% {
      transform: translate(0, 0) scale(1) rotate(0deg);
    }
    25% {
      transform: translate(8%, -10%) scale(1.2) rotate(10deg);
    }
    50% {
      transform: translate(-6%, 5%) scale(0.85) rotate(-5deg);
    }
    75% {
      transform: translate(10%, -4%) scale(1.1) rotate(15deg);
    }
  }
  
  @keyframes plasmaMorph {
    0%, 100% {
      border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
    }
    20% {
      border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%;
    }
    40% {
      border-radius: 70% 30% 60% 40% / 40% 70% 60% 30%;
    }
    60% {
      border-radius: 40% 70% 30% 60% / 70% 40% 50% 70%;
    }
    80% {
      border-radius: 50% 50% 60% 40% / 30% 50% 40% 60%;
    }
  }
  
  @keyframes plasmaRotate {
    from {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }
  
  @keyframes plasmaShift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
  
  @keyframes plasmaDrift {
    0%, 100% {
      transform: translate(0, 0);
    }
    33% {
      transform: translate(-15%, 10%);
    }
    66% {
      transform: translate(20%, -5%);
    }
  }
  
  @keyframes plasmaWave {
    0%, 100% {
      transform: translateY(0) translateX(0);
    }
    25% {
      transform: translateY(-20px) translateX(10px);
    }
    50% {
      transform: translateY(0) translateX(-15px);
    }
    75% {
      transform: translateY(20px) translateX(5px);
    }
  }
  
  /* Reduce motion for accessibility */
  @media (prefers-reduced-motion: reduce) {
    .plasma-glow,
    .plasma-glow::before,
    .plasma-glow::after,
    .plasma-glow-container {
      animation: none;
    }
  }
  
  /* Ensure content appears above plasma and texture */
  #navbar-section {
    position: relative;
    z-index: 100; /* Navbar needs higher z-index for dropdowns */
  }
  
  main {
    position: relative;
    z-index: 10;
  }
  
  /* Ensure all content has proper stacking */
  .navbar-section {
    position: relative;
    z-index: 100; /* High z-index to ensure dropdowns appear above all content */
    isolation: isolate; /* Create new stacking context for navbar */
  }
  
  /* Ensure app container allows scrolling */
  .app-container {
    position: relative;
    overflow-x: hidden;
    overflow-y: auto;
    min-height: 100vh;
  }
  
  /* Texture Overlay */
  .texture-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 2;
    opacity: 0.4; /* Increased for better visibility */
    background-image: 
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 35px,
        rgba(255, 255, 255, 0.3) 35px,
        rgba(255, 255, 255, 0.3) 36px /* Thin lines with higher opacity */
      ),
      repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 35px,
        rgba(0, 0, 0, 0.4) 35px,
        rgba(0, 0, 0, 0.4) 36px /* Thin lines with higher opacity */
      ),
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255, 255, 255, 0.2) 2px,
        rgba(255, 255, 255, 0.2) 4px
      );
    mix-blend-mode: overlay;
  }
  
  /* Add noise texture */
  .texture-overlay::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: 0.7; /* Increased from 0.5 for better visibility */
    background-image: 
      url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E");
    mix-blend-mode: soft-light;
  }
  
  /* Light theme adjustments */
  :global(:root.light) .texture-overlay {
    opacity: 0.35; /* Increased significantly for light theme visibility */
    background-image: 
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 40px,
        rgba(0, 0, 0, 0.25) 40px,
        rgba(0, 0, 0, 0.25) 41px /* Thin lines with much higher opacity */
      ),
      repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 40px,
        rgba(0, 0, 0, 0.2) 40px,
        rgba(0, 0, 0, 0.2) 41px /* Using dark lines for better contrast on light background */
      );
  }
  
  :global(:root.light) .texture-overlay::after {
    opacity: 0.5; /* Increased from 0.3 for better visibility */
  }
</style>
