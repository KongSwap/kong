<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { goto } from "$app/navigation";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import {
    ChartScatter,
    Menu,
    ChartCandlestick,
    Coins,
    Award,
    Trophy,
  } from "lucide-svelte";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { themeStore } from "$lib/stores/themeStore";
  import NavOption from "./NavbarOption.svelte";

  import WalletSidebar from "$lib/components/common/WalletSidebar.svelte";
  import { getThemeById } from "$lib/themes/themeRegistry";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { isAuthenticating } from "$lib/stores/auth";
  import TopRightNavPanel from "./NavbarPanel.svelte";
  import NavbarMobileSidebar from "./NavbarMobileSidebar.svelte";
  import { NAV_PATH_MAP } from "$lib/constants/appConstants";

  // Set theme for logo and navbar
  let isWin98Theme = $derived(browser && $themeStore === "win98light");
  const isLightTheme = $derived(browser && 
    (getThemeById($themeStore)?.colors?.logoInvert === 1 || 
     $themeStore.includes('light') ||
     $themeStore === 'win98light'));
  const walletButtonThemeProps = $derived({
    useThemeBorder: isWin98Theme,
    customBgColor: browser ? getThemeById($themeStore)?.colors?.primary : undefined,
    customTextColor: 'var(--color-kong-text-light)',
    customBorderStyle: browser ? getThemeById($themeStore)?.colors?.primaryButtonBorder : undefined,
    customBorderColor: browser ? getThemeById($themeStore)?.colors?.primaryButtonBorderColor : undefined
  });
  
  // Define logo paths - use only one logo path
  const logoPath = "/images/kongface-white.svg";
  let isMobile = $state(false);
  let mobileNavSideBarOpen = $state(false); // Mobile sidemenu
  let showWalletSidebar = $state(false);
  let walletSidebarActiveTab = $state<"notifications" | "chat" | "wallet">(
    "notifications",
  );

  // Replace onMount with $effect for listeners and theme updates
  $effect(() => {
    if (browser) {
      // Add event listener to handle swipe gestures for mobile menu
      let touchStartX = 0;
      const handleTouchStart = (e: TouchEvent) => {
        touchStartX = e.touches[0].clientX;
      };

      const handleTouchEnd = (e: TouchEvent) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diffX = touchEndX - touchStartX;

        // Swipe right to open menu (when closed)
        if (diffX > 75 && touchStartX < 50 && !mobileNavSideBarOpen) {
          mobileNavSideBarOpen = true;
        }

        // Swipe left to close menu (when open)
        if (diffX < -75 && mobileNavSideBarOpen) {
          mobileNavSideBarOpen = false;
        }
      };

      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });

      // Cleanup function
      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  });

  // Define a type for valid tab IDs
  type NavTabId = null | 'pro' | 'predict' | 'earn' | 'stats';
  const allTabs = ["pro", "predict", "earn", "stats"] as const;
  let activeTab = $derived.by(() => {
    const path = page.url.pathname;
    
    // Check for exact matches in NAV_PATH_MAP first
    for (const mappedPath in NAV_PATH_MAP) {
      if (path.startsWith(mappedPath)) {
        return NAV_PATH_MAP[mappedPath] as NavTabId;
      }
    }
    
    // Fall back to first path segment (excluding root)
    const firstSegment = path.split("/")[1];
    return firstSegment || null as NavTabId;
  });

  const desktopNavItems = $derived(
    allTabs.map(tab => {
      switch (tab as NavTabId) {
        case "earn":
          return {
            type: "dropdown" as const,
            label: "EARN",
            tabId: "earn" as const,
            options: [
              { label: "Liquidity Pools", description: "Provide liquidity to earn trading fees and rewards", path: "/pools", icon: Coins, comingSoon: false },
              { label: "Airdrop Claims", description: "Claim your airdrop tokens", path: "/airdrop-claims", icon: Award, comingSoon: false },
            ],
            defaultPath: "/pools",
          };
        case "pro":
          return {
            type: "link" as const,
            label: "PRO",
            tabId: "pro" as const,
            defaultPath: "/pro",
          };
        case "stats":
          return {
            type: "dropdown" as const,
            label: "STATS",
            tabId: "stats" as const,
            options: [
              { label: "Overview", description: "View general statistics and platform metrics", path: "/stats", icon: ChartCandlestick, comingSoon: false },
              { label: "Bubbles", description: "Visualize token price changes with bubbles", path: "/stats/bubbles", icon: ChartScatter, comingSoon: false },
              { label: "Leaderboards", description: "View trading leaderboards", path: "/stats/leaderboard", icon: Trophy, comingSoon: false },
            ],
            defaultPath: "/stats",
          };
        case "predict":
          return {
            type: "link" as const,
            label: "PREDICT",
            tabId: "predict" as const,
            defaultPath: "/predict",
          };
        default:
          return null; // Should not happen with current 'tabs' definition
      }
    }).filter(item => item !== null) as Array<
      | { type: 'dropdown'; label: string; tabId: 'earn' | 'stats'; options: any[]; defaultPath: string; }
      | { type: 'link'; label: string; tabId: 'pro' | 'predict'; defaultPath: string; }
    >
  );

  function toggleWalletSidebar(
    tab: "notifications" | "chat" | "wallet" = "notifications",
  ) {
    walletSidebarActiveTab = tab;
    showWalletSidebar = !showWalletSidebar;
  }

  function handleConnect() {
    if (!$auth.isConnected) {
      walletProviderStore.open();
      return;
    }
    const activeTab = $notificationsStore.unreadCount > 0 ? "notifications" : "wallet";
    toggleWalletSidebar(activeTab);
  }
</script>

{#snippet logoButton()}
  <button
    class="flex items-center hover:opacity-90 transition-opacity"
    onclick={() => goto("/")}
  >
    <img
      src={logoPath}
      alt="Kong Logo"
      class="transition-all duration-200 navbar-logo h-6"
      class:light-logo={isLightTheme}
    />
  </button>
{/snippet}

{#snippet mobileMenuButton()}
  <button class="h-[34px] w-[34px] flex items-center justify-center" onclick={() => (mobileNavSideBarOpen = !mobileNavSideBarOpen)}>
    <Menu size={20} color={isLightTheme ? "black" : "white"} />
  </button>
{/snippet}

{#snippet desktopNavigation()}
  <nav class="flex items-center gap-0.5">
    {#each desktopNavItems as navItem (navItem.tabId)}
      <NavOption {navItem} isActive={activeTab === navItem.tabId} />
    {/each}
  </nav>
{/snippet}

<div id="navbar" class="mb-4 w-full top-0 left-0 z-50 relative py-2">
  <div class="mx-auto h-12 flex items-center justify-between md:px-6 px-4">
    <!-- Single consolidated mobile/desktop logic -->
    <div class="flex items-center gap-4">
      {#if isMobile}
        {@render mobileMenuButton()}
      {:else}
        {@render logoButton()}
        {@render desktopNavigation()}
      {/if}
    </div>

    {#if isMobile}
      <div class="absolute left-1/2 -translate-x-1/2">
        {@render logoButton()}
      </div>
    {/if}

    <div class="flex items-center gap-2">
      <TopRightNavPanel {isMobile} />
    </div>
  </div>
</div>

<NavbarMobileSidebar
  isOpen={mobileNavSideBarOpen}
  onClose={() => mobileNavSideBarOpen = false}
  {isLightTheme}
  {activeTab}
  {walletButtonThemeProps}
  isAuthenticating={$isAuthenticating}
  {showWalletSidebar}
  {walletSidebarActiveTab}
  toggleWalletSidebar={toggleWalletSidebar}
  onConnect={handleConnect}
/>

<WalletSidebar
  isOpen={showWalletSidebar}
  activeTab={walletSidebarActiveTab}
  onClose={() => showWalletSidebar = false}
/>

<style scoped lang="postcss">
  /* Logo styles using CSS vars - Keep */
  .light-logo {
    @apply invert brightness-[var(--logo-brightness,0.8)] transition-all duration-200;
    filter: invert(1) brightness(var(--logo-brightness, 0.2));
  }

  /* Global style - Keep */
  :global(.navbar-icon svg) {
    width: 20px !important;
    height: 20px !important;
  }
</style>
