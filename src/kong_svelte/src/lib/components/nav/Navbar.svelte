<script lang="ts">
  import { auth } from "$lib/stores/auth";

  import { goto } from "$app/navigation";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import {
    Droplet,
    Settings as SettingsIcon,
    Copy,
    ChartScatter,
    Menu,
    ChartCandlestick,
    Wallet,
    Coins,
    Award,
    TrendingUpDown,
    Search,
    Trophy,
    Bell,
  } from "lucide-svelte";
  import { loadBalances } from "$lib/stores/tokenStore";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { themeStore } from "$lib/stores/themeStore";
  import NavOption from "./NavbarOption.svelte";
  import { searchStore } from "$lib/stores/searchStore";
  import { userTokens } from "$lib/stores/userTokens";
  import WalletSidebar from "$lib/components/common/WalletSidebar.svelte";
  import { getThemeById } from "$lib/themes/themeRegistry";
  import NavbarButton from "./NavbarButton.svelte";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import { faucetClaim } from "$lib/api/tokens/TokenApiClient";
  import { getAccountIds, getPrincipalString } from "$lib/utils/accountUtils";
  import { isAuthenticating } from "$lib/stores/auth";
  import TopRightNavPanel from "./NavbarPanel.svelte";
  import NavbarMobileSidebar from "./NavbarMobileSidebar.svelte";

  // Computed directly where needed using themeStore rune
  let isWin98Theme = $derived(browser && $themeStore === "win98light");
  
  // Define if current theme is light and should have inverted logo
  const isLightTheme = $derived(browser && 
    (getThemeById($themeStore)?.colors?.logoInvert === 1 || 
     $themeStore.includes('light') ||
     $themeStore === 'win98light'));
  
  // Define logo paths - use only one logo path
  const logoPath = "/images/kongface-white.svg";

  // No longer need logoSrc as we'll use the single path directly
  // and apply CSS inversion when needed via the light-logo class

  // Define a type for valid tab IDs
  type NavTabId = null | 'pro' | 'predict' | 'earn' | 'stats';

  let isMobile = $state(false);
  let activeTab = $state<NavTabId>(null);
  let mobileNavSideBarOpen = $state(false); // Mobile sidemenu
  let closeTimeout: ReturnType<typeof setTimeout>;
  let activeDropdown = $state<Extract<NavTabId, 'earn' | 'stats'> | null>(null);
  let showWalletSidebar = $state(false);
  let walletSidebarActiveTab = $state<"notifications" | "chat" | "wallet">(
    "notifications",
  );

  const showFaucetOption = $derived(
    $auth.isConnected && (process.env.DFX_NETWORK === "local" || process.env.DFX_NETWORK === "staging")
  );

  // Toggle wallet sidebar
  function toggleWalletSidebar(
    tab: "notifications" | "chat" | "wallet" = "notifications",
  ) {
    walletSidebarActiveTab = tab;
    showWalletSidebar = !showWalletSidebar;
  }

  // Filter tabs based on DFX_NETWORK
  const allTabs = ["pro", "predict", "earn", "stats"] as const;

  function handleConnect() {
    if (!$auth.isConnected) {
      walletProviderStore.open();
      return;
    }
    const activeTab = $notificationsStore.unreadCount > 0 ? "notifications" : "wallet";
    toggleWalletSidebar(activeTab);
  }

  // Replace onMount with $effect for listeners and theme updates
  $effect(() => {
    if (browser) {
      // Initial mobile check
      isMobile = window.innerWidth < 768;

      // Add resize listener
      const handleResize = () => {
        isMobile = window.innerWidth < 768;
      };
      window.addEventListener("resize", handleResize);

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
        window.removeEventListener("resize", handleResize);
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  });

  const walletButtonThemeProps = $derived({
    useThemeBorder: isWin98Theme,
    customBgColor: browser ? getThemeById($themeStore)?.colors?.primary : undefined,
    customTextColor: 'var(--color-kong-text-light)',
    customBorderStyle: browser ? getThemeById($themeStore)?.colors?.primaryButtonBorder : undefined,
    customBorderColor: browser ? getThemeById($themeStore)?.colors?.primaryButtonBorderColor : undefined
  });

  // --- Start Refactoring: Mobile Account Menu Items ---
  const accountMenuItems = $derived([
    {
      label: "Settings",
      icon: SettingsIcon,
      onClick: () => goto("/settings"),
      show: true
    },
    {
      label: "Search",
      icon: Search,
      onClick: handleOpenSearch,
      show: process.env.DFX_NETWORK !== "ic"
    },
    {
      label: "Claim Tokens",
      icon: Droplet,
      onClick: claimTokens,
      show: showFaucetOption
    },
    {
      label: "Copy Principal ID",
      icon: Copy,
      onClick: copyPrincipalId,
      show: $auth.isConnected
    },
    {
      label: "Copy Account ID",
      icon: Copy,
      onClick: copyAccountId,
      show: $auth.isConnected
    },
    {
      label: "Notifications",
      icon: Bell,
      onClick: () => toggleWalletSidebar("notifications"),
      badgeCount: $notificationsStore.unreadCount,
      show: true
    }
  ]);
  // --- End Refactoring ---

  // --- Start Refactoring: Mobile Nav Groups ---
  const mobileNavGroups = $derived([
    { title: "SWAP", options: [
      { label: "Basic Swap", description: "Simple and intuitive token swapping interface", path: "/", icon: Wallet, comingSoon: false },
      { label: "Pro Swap", description: "Advanced trading features with detailed market data", path: "/pro", icon: Coins, comingSoon: false },
    ] },
    {
      title: "PREDICT",
      options: [
        {
          label: "Prediction Markets",
          description: "Trade on future outcomes",
          path: "/predict",
          icon: TrendingUpDown,
          comingSoon: false,
        },
      ],
    },
    { title: "EARN", options: [
      { label: "Liquidity Pools", description: "Provide liquidity to earn trading fees and rewards", path: "/pools", icon: Coins, comingSoon: false },
      { label: "Airdrop", description: "Claim your airdrop tokens", path: "/airdrop-claims", icon: Award, comingSoon: false },
    ] },
    { title: "STATS", options: [
      { label: "Overview", description: "View general statistics and platform metrics", path: "/stats", icon: ChartCandlestick, comingSoon: false },
      { label: "Bubbles", description: "Visualize token price changes with bubbles", path: "/stats/bubbles", icon: ChartScatter, comingSoon: false },
      { label: "Leaderboards", description: "View trading leaderboards", path: "/stats/leaderboard", icon: Trophy, comingSoon: false },
    ] },
  ]);
  // --- End Refactoring ---

  // --- Start Refactoring: Desktop Nav Items Configuration ---
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
        // case "swap":
        //   return {
        //     type: "dropdown" as const,
        //     label: "SWAP",
        //     tabId: "swap" as const,
        //     options: [
        //       { label: "Basic Swap", description: "Simple and intuitive token swapping interface", path: "/swap", icon: Wallet, comingSoon: false },
        //       { label: "Pro Swap", description: "Advanced trading features with detailed market data", path: "/swap/pro", icon: Coins, comingSoon: false },
        //     ],
        //     defaultPath: "/swap",
        //   };
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
  // --- End Refactoring ---

  async function claimTokens() {
    await faucetClaim();
    // Use runes directly
    await loadBalances($userTokens.tokens, $auth.account.owner, true);
  }

  $effect(() => {
    // Use page rune directly
    const path = page.url.pathname;
    // Use a mapping for clarity and potential extension
    // Ensure all paths from desktopNavItems and mobileNavGroups are covered
    const pathMap: { [key: string]: NavTabId } = {
      // "/": null,
      "/pro": "pro",
      "/predict": "predict",
      "/earn": "earn",       // Base path might not be used, but good to have
      "/pools": "earn",
      "/airdrop-claims": "earn",
      "/stats": "stats",
      "/stats/bubbles": "stats",
      "/stats/leaderboard": "stats",
    };
    let found = false;
    for (const prefix in pathMap) {
      if (path.startsWith(prefix)) {
        activeTab = pathMap[prefix];
        found = true;
        break; // Exit loop once found
      }
    }
  });

  function handleOpenSearch() {
    searchStore.open();
  }

  // --- Start New Copy Functions ---
  function copyPrincipalId() {
    const principalToCopy = $auth?.account?.owner;
    if (principalToCopy) {
      copyToClipboard(principalToCopy);
    } else {
      console.error("Could not get Principal ID to copy.");
    }
  }

  function copyAccountId() {
    const currentAccountId = $auth.isConnected && $auth.account?.owner
      ? getAccountIds($auth.account.owner, $auth.account.subaccount).main
      : "";
    if (currentAccountId) {
      copyToClipboard(currentAccountId);
    } else {
      console.error("Could not get Account ID to copy.");
    }
  }
  // --- End New Copy Functions ---
</script>

<div id="navbar" class="mb-4 w-full top-0 left-0 z-50 relative py-2">
  <div class="mx-auto h-12 flex items-center justify-between md:px-6 px-4">
    <div class="flex items-center gap-4">
      {#if isMobile}
        <button
          class="h-[34px] w-[34px] flex items-center justify-center"
          onclick={() => (mobileNavSideBarOpen = !mobileNavSideBarOpen)}
        >
          <Menu
            size={20}
            color={isLightTheme ? "black" : "white"}
          />
        </button>
      {:else}
        <button
          class="flex items-center hover:opacity-90 transition-opacity"
          onclick={() => goto("/")}
        >
          <img
            src={logoPath}
            alt="Kong Logo"
            class="h-[32px] transition-all duration-200 navbar-logo"
            class:light-logo={isLightTheme}
            onerror={(e) => {
              const img = e.target as HTMLImageElement;
              const textElement = img.nextElementSibling as HTMLElement;
              img.style.display = "none";
              if (textElement) { textElement.style.display = "block"; }
            }}
          />
          <span
            class="hidden text-xl font-bold text-kong-text-primary"
            style="display: none;"
          >
            KONG
          </span>
        </button>

        <nav class="flex items-center gap-0.5">
          {#each desktopNavItems as navItem (navItem.tabId)}
            {#if navItem.type === "dropdown"}
              <NavOption
                label={navItem.label}
                options={navItem.options}
                isActive={activeTab === navItem.tabId}
                activeDropdown={activeDropdown === navItem.tabId ? navItem.tabId : null}
                onShowDropdown={() => { clearTimeout(closeTimeout); activeDropdown = navItem.tabId; }}
                onHideDropdown={() => { closeTimeout = setTimeout(() => { activeDropdown = null; }, 150); }}
                onTabChange={(tab) => activeTab = tab as NavTabId}
                defaultPath={navItem.defaultPath}
              />
            {:else if navItem.type === "link"}
              <button
                class="relative h-12 px-4 flex items-center text-sm font-semibold text-kong-text-secondary tracking-wider transition-all duration-200 hover:text-kong-text-primary"
                class:nav-link={activeTab === navItem.tabId}
                class:active={activeTab === navItem.tabId}
                onclick={() => {
                  goto(navItem.defaultPath);
                  activeTab = navItem.tabId as NavTabId;
                }}
              >
                {navItem.label}
              </button>
            {/if}
          {/each}
        </nav>
      {/if}
    </div>

    {#if isMobile}
      <div
        class="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
      >
        <button
          class="flex items-center hover:opacity-90 transition-opacity"
          onclick={() => goto("/")}
        >
          <img
            src={logoPath}
            alt="Kong Logo"
            class="h-6 transition-all duration-200 navbar-logo mobile-navbar-logo"
            class:light-logo={isLightTheme}
            onerror={(e) => {
              const img = e.target as HTMLImageElement;
              const textElement = img.nextElementSibling as HTMLElement;
              img.style.display = "none";
              if (textElement) { textElement.style.display = "block"; }
            }}
          />
          <span
            class="hidden text-lg font-bold text-kong-text-primary"
            style="display: none;"
          >
            KONG
          </span>
        </button>
      </div>
    {/if}

    <div class="flex items-center gap-2">
      {#if !isMobile}
        <TopRightNavPanel />
      {:else}
        <TopRightNavPanel isMobile={true} />
      {/if}
    </div>
  </div>
</div>

<NavbarMobileSidebar
  isOpen={mobileNavSideBarOpen}
  onClose={() => mobileNavSideBarOpen = false}
  {isLightTheme}
  {mobileNavGroups}
  {accountMenuItems}
  {activeTab}
  onTabChange={(tab) => activeTab = tab as NavTabId}
  {walletButtonThemeProps}
  auth={$auth}
  notificationsStore={$notificationsStore}
  isAuthenticating={$isAuthenticating}
  {showWalletSidebar}
  {walletSidebarActiveTab}
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

  /* Keep only for text-shadow on active state */
  .nav-link.active {
    @apply text-kong-primary;
  }

  /* Global style - Keep */
  :global(.navbar-icon svg) {
    width: 20px !important;
    height: 20px !important;
  }
</style>
