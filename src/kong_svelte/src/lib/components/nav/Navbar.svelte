<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { fade, slide } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import {
    Droplet,
    Settings as SettingsIcon,
    Copy,
    ChartScatter,
    Menu,
    ChartCandlestick,
    X,
    Wallet,
    Coins,
    Award,
    TrendingUpDown,
    Search,
    Trophy,
    Bell,
    Joystick,
    ChevronDown,
  } from "lucide-svelte";
  import { loadBalances } from "$lib/stores/tokenStore";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { themeStore } from "$lib/stores/themeStore";
  import NavOption from "./NavOption.svelte";
  import MobileNavGroup from "./MobileNavGroup.svelte";
  import MobileMenuItem from "./MobileMenuItem.svelte";
  import { searchStore } from "$lib/stores/searchStore";
  import { userTokens } from "$lib/stores/userTokens";
  import WalletSidebar from "$lib/components/common/WalletSidebar.svelte";
  import { getThemeById } from "$lib/themes/themeRegistry";
  import { writable } from "svelte/store";
  import NavbarButton from "./NavbarButton.svelte";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import { faucetClaim } from "$lib/api/tokens/TokenApiClient";
  import { getAccountIds, getPrincipalString } from "$lib/utils/accountUtils";

  // Computed directly where needed using themeStore rune
  let isWin98Theme = $derived(browser && $themeStore === "win98light");

  // Create a writable store for the logo source
  const logoSrcStore = writable("/titles/logo-white-wide.png");

  // Update the logo when theme changes
  function updateLogoSrc() {
    if (browser) {
      // Use setTimeout to ensure CSS variables are updated after theme change
      setTimeout(() => {
        const cssLogoPath = getComputedStyle(document.documentElement)
          .getPropertyValue("--logo-path")
          .trim();
        const finalLogoPath = cssLogoPath || "/titles/logo-white-wide.png";
        logoSrcStore.set(finalLogoPath);
      }, 50); // Small delay
    }
  }

  // Initialize logo on first load
  if (browser) {
    updateLogoSrc();
  }

  // Define a type for valid tab IDs
  type NavTabId = 'swap' | 'predict' | 'earn' | 'stats';

  let isMobile = $state(false);
  let activeTab = $state<NavTabId>("swap");
  let navOpen = $state(false);
  let closeTimeout: ReturnType<typeof setTimeout>;
  let activeDropdown = $state<Extract<NavTabId, 'swap' | 'earn' | 'stats'> | null>(null);
  let showWalletSidebar = $state(false);
  let walletSidebarActiveTab = $state<"notifications" | "chat" | "wallet">(
    "notifications",
  );

  // Compute account ID reactively
  let accountId = $derived(
    $auth.isConnected && $auth.account?.owner
      ? getAccountIds(getPrincipalString($auth.account.owner), $auth.account.subaccount).main
      : ""
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
  const allTabs = ["swap", "predict", "earn", "stats"] as const;

  function handleConnect() {
    // If user is not authenticated, show the wallet provider
    if (!$auth.isConnected) {
      walletProviderStore.open();
      return;
    }

    // Otherwise, show the wallet sidebar
    // If there are unread notifications, open the notifications tab first
    // Otherwise, open the wallet tab
    const activeTab =
      $notificationsStore.unreadCount > 0 ? "notifications" : "wallet";
    toggleWalletSidebar(activeTab);
  }

  // Replace onMount with $effect for listeners and theme updates
  $effect(() => {
    if (browser) {
      // Update logo whenever the theme changes
      const unsub = themeStore.subscribe(updateLogoSrc);

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
        if (diffX > 75 && touchStartX < 50 && !navOpen) {
          navOpen = true;
        }

        // Swipe left to close menu (when open)
        if (diffX < -75 && navOpen) {
          navOpen = false;
        }
      };

      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });

      // Cleanup function
      return () => {
        unsub(); // Unsubscribe from theme store
        window.removeEventListener("resize", handleResize);
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  });

  const standardButtonThemeProps = $derived({
    useThemeBorder: isWin98Theme,
    customBgColor: browser ? getThemeById($themeStore)?.colors?.buttonBg : undefined,
    customShadow: browser ? getThemeById($themeStore)?.colors?.buttonShadow : undefined
  });

  const walletButtonThemeProps = $derived({
    useThemeBorder: isWin98Theme,
    customBgColor: browser ? getThemeById($themeStore)?.colors?.primaryButtonBg : undefined,
    customBorderStyle: browser ? getThemeById($themeStore)?.colors?.primaryButtonBorder : undefined,
    customBorderColor: browser ? getThemeById($themeStore)?.colors?.primaryButtonBorderColor : undefined
  });

  // Define base config for standard desktop icon buttons
  const baseDesktopIconButton = {
    variant: 'icon' as const,
    isWalletButton: false,
    badgeCount: null,
    label: null,
    type: 'standard' as const,
    isSelected: false,
  };

  const desktopNavButtons = $derived([
    {
      ...baseDesktopIconButton,
      icon: SettingsIcon,
      onClick: () => goto("/settings"),
      tooltipText: "Settings",
      show: true,
      themeProps: standardButtonThemeProps, // Theme props are reactive
    },
    {
      ...baseDesktopIconButton,
      icon: Search,
      onClick: handleOpenSearch,
      tooltipText: "Search",
      show: true,
      themeProps: standardButtonThemeProps,
    },
    {
      ...baseDesktopIconButton,
      icon: Droplet,
      onClick: claimTokens,
      tooltipText: "Claim test tokens",
      show: showFaucetOption,
      themeProps: standardButtonThemeProps,
    },
    {
      ...baseDesktopIconButton,
      type: 'copy',
      icon: Copy,
      onClick: copyPrincipalId,
      tooltipText: "Copy Principal ID",
      show: $auth.isConnected,
      themeProps: standardButtonThemeProps,
    },
    // Wallet Button (Specific properties)
    {
      type: 'wallet' as const,
      icon: Wallet,
      label: $auth.isConnected ? null : "Connect",
      onClick: handleConnect,
      isSelected: showWalletSidebar && walletSidebarActiveTab === "wallet",
      show: true,
      themeProps: walletButtonThemeProps, // Theme props are reactive
      variant: 'primary' as const,
      isWalletButton: true,
      badgeCount: $notificationsStore.unreadCount,
      tooltipText: $auth.isConnected ? "Wallet / Notifications" : "Connect Wallet"
    }
  ]);

  // Base config for mobile header buttons
  const baseMobileHeaderButton = {
    variant: "mobile" as const,
    iconSize: 14,
    isSelected: false,
    isWalletButton: false,
    badgeCount: null,
    show: true,
  };

  const mobileHeaderButtons = $derived([
    {
      ...baseMobileHeaderButton,
      icon: Search,
      onClick: handleOpenSearch,
    },
    {
      ...baseMobileHeaderButton,
      icon: Wallet,
      onClick: handleConnect,
      isSelected: showWalletSidebar && walletSidebarActiveTab === "wallet",
      isWalletButton: true,
      badgeCount: $notificationsStore.unreadCount,
    }
  ]);

  // --- Start Refactoring: Mobile Account Menu Items ---
  const accountMenuItems = $derived([
    {
      label: "Settings",
      icon: SettingsIcon,
      onClick: mobileMenuAction(() => goto("/settings")),
      show: true
    },
    {
      label: "Search",
      icon: Search,
      onClick: mobileMenuAction(handleOpenSearch),
      show: process.env.DFX_NETWORK !== "ic"
    },
    {
      label: "Claim Tokens",
      icon: Droplet,
      onClick: mobileMenuAction(claimTokens),
      show: showFaucetOption
    },
    {
      label: "Copy Principal ID",
      icon: Copy,
      onClick: mobileMenuAction(copyPrincipalId),
      show: $auth.isConnected
    },
    {
      label: "Copy Account ID",
      icon: Copy,
      onClick: mobileMenuAction(copyAccountId),
      show: $auth.isConnected
    },
    {
      label: "Notifications",
      icon: Bell,
      onClick: mobileMenuAction(() => toggleWalletSidebar("notifications")),
      badgeCount: $notificationsStore.unreadCount,
      show: true
    }
  ]);
  // --- End Refactoring ---

  // --- Start Refactoring: Mobile Nav Groups ---
  const mobileNavGroups = $derived([
    { title: "SWAP", options: [
      { label: "Basic Swap", description: "Simple and intuitive token swapping interface", path: "/swap", icon: Wallet, comingSoon: false },
      { label: "Pro Swap", description: "Advanced trading features with detailed market data", path: "/swap/pro", icon: Coins, comingSoon: false },
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
      { label: "Airdrop Claims", description: "Claim your airdrop tokens", path: "/airdrop-claims", icon: Award, comingSoon: false },
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
        case "swap":
          return {
            type: "dropdown" as const,
            label: "SWAP",
            tabId: "swap" as const,
            options: [
              { label: "Basic Swap", description: "Simple and intuitive token swapping interface", path: "/swap", icon: Wallet, comingSoon: false },
              { label: "Pro Swap", description: "Advanced trading features with detailed market data", path: "/swap/pro", icon: Coins, comingSoon: false },
            ],
            defaultPath: "/swap",
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
      | { type: 'dropdown'; label: string; tabId: 'swap' | 'earn' | 'stats'; options: any[]; defaultPath: string; }
      | { type: 'link'; label: string; tabId: 'predict'; defaultPath: string; }
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
    const pathMap: { [key: string]: NavTabId } = {
      "/swap": "swap",
      "/earn": "earn",
      "/pools": "earn",
      "/stats": "stats",
      "/predict": "predict",
    };
    for (const prefix in pathMap) {
      if (path.startsWith(prefix)) {
        activeTab = pathMap[prefix];
        break; // Exit loop once found
      }
    }
  });

  function handleOpenSearch() {
    searchStore.open();
  }

  // --- Start New Copy Functions ---
  function copyPrincipalId() {
    const principalToCopy = getPrincipalString($auth?.account?.owner);
    if (principalToCopy) {
      copyToClipboard(principalToCopy);
    } else {
      console.error("Could not get Principal ID to copy.");
    }
  }

  function copyAccountId() {
    const currentAccountId = $auth.isConnected && $auth.account?.owner
      ? getAccountIds(getPrincipalString($auth.account.owner), $auth.account.subaccount).main
      : "";
    if (currentAccountId) {
      copyToClipboard(currentAccountId);
    } else {
      console.error("Could not get Account ID to copy.");
    }
  }
  // --- End New Copy Functions ---

  // Helper for mobile menu item clicks
  function mobileMenuAction(action: () => void) {
    return () => {
      action();
      navOpen = false;
    };
  }
</script>

<div class="relative top-0 left-0 z-50 w-full pt-2 mb-4">
  <div class="flex items-center justify-between h-16 px-6 mx-auto">
    <div class="flex items-center gap-10">
      {#if isMobile}
        <button
          class="h-[34px] w-[34px] flex items-center justify-center"
          on:click={() => (navOpen = !navOpen)}
        >
          <Menu
            size={20}
            color={browser &&
            getThemeById($themeStore)?.colors?.logoInvert === 1
              ? "black"
              : "white"}
          />
        </button>
      {:else}
        <button
          class="flex items-center hover:opacity-90 transition-opacity"
          on:click={() => goto("/")}
        >
          <img
            src={$logoSrcStore}
            alt="Kong Logo"
            class="h-[30px] transition-all duration-200 navbar-logo"
            class:light-logo={browser &&
              getThemeById($themeStore)?.colors?.logoInvert === 1}
            on:error={(e) => {
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
                class="relative h-16 px-5 flex items-center text-sm font-semibold text-kong-text-secondary tracking-wider transition-all duration-200 hover:text-kong-text-primary"
                class:text-kong-primary={activeTab === navItem.tabId}
                class:nav-link={activeTab === navItem.tabId}
                class:active={activeTab === navItem.tabId}
                on:click={() => {
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
          on:click={() => goto("/")}
        >
          <img
            src={$logoSrcStore}
            alt="Kong Logo"
            class="h-8 transition-all duration-200 navbar-logo mobile-navbar-logo"
            class:light-logo={browser &&
              getThemeById($themeStore)?.colors?.logoInvert === 1}
            on:error={(e) => {
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

    <div class="flex items-center gap-1.5">
      {#if !isMobile}
        <!-- Refactored Icon Buttons -->
        {#each desktopNavButtons as button (button.tooltipText)}
          {#if button.show}
            <NavbarButton
              icon={button.icon}
              label={button.label}
              onClick={button.onClick}
              isSelected={button.isSelected}
              variant={button.variant}
              {...button.themeProps}
              isWalletButton={button.isWalletButton}
              badgeCount={button.badgeCount}
              tooltipText={button.tooltipText}
              class="navbar-icon !px-3"
            />
          {/if}
        {/each}

      {:else}
        <!-- Mobile Header Buttons -->
        {#each mobileHeaderButtons as button}
          {#if button.show}
            <NavbarButton
              icon={button.icon}
              onClick={button.onClick}
              variant={button.variant}
              iconSize={button.iconSize}
              {...standardButtonThemeProps}
              isSelected={button.isSelected ?? false}
              isWalletButton={button.isWalletButton ?? false}
              badgeCount={button.badgeCount ?? null}
            />
          {/if}
        {/each}
      {/if}
    </div>
  </div>
</div>

{#if navOpen && isMobile}
  <div class="fixed inset-0 z-50" transition:fade={{ duration: 200 }}>
    <div class="fixed inset-0 bg-kong-bg-dark" on:click={() => (navOpen = false)} />
    <div
      class="fixed top-0 left-0 h-full w-[85%] max-w-[320px] flex flex-col bg-kong-bg-dark border-r border-kong-border shadow-lg max-[375px]:w-[90%] max-[375px]:max-w-[300px]"
      transition:slide={{ duration: 200, axis: "x" }}
    >
      <div class="flex items-center justify-between p-5 border-b border-kong-border max-[375px]:p-4">
        <img
          src={$logoSrcStore}
          alt="Kong Logo"
          class="navbar-logo h-9 !transition-all !duration-200"
          class:light-logo={browser &&
            getThemeById($themeStore)?.colors?.logoInvert === 1}
          style={browser && getThemeById($themeStore)?.colors?.logoInvert === 1 ? '--logo-brightness: 0.2' : ''}
        />
        <button class="w-9 h-9 flex items-center justify-center rounded-full text-kong-text-secondary hover:text-kong-text-primary bg-kong-text-primary/10 hover:bg-kong-text-primary/15 transition-colors duration-200" on:click={() => (navOpen = false)}>
          <X size={16} />
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto py-3 space-y-3">
        <div class="px-4 py-2 max-[375px]:px-3">
          {#each mobileNavGroups as group (group.title)}
            <MobileNavGroup
              title={group.title}
              options={group.options}
              {activeTab}
              onTabChange={(tab) => activeTab = tab as NavTabId}
              onClose={() => (navOpen = false)}
            />
          {/each}
        </div>

        <div class="px-4 py-2 max-[375px]:px-3">
          <div class="text-xs font-semibold text-kong-text-secondary/70 px-2 mb-2 tracking-wider">ACCOUNT</div>
          {#each accountMenuItems as item}
            {#if item.show}
              <MobileMenuItem
                label={item.label}
                icon={item.icon}
                onClick={item.onClick}
                iconBackground="bg-kong-text-primary/10"
                badgeCount={item.badgeCount ?? null}
              />
            {/if}
          {/each}
        </div>
      </nav>

      <div class="p-4 border-t border-kong-border">
        <NavbarButton
          icon={Wallet}
          label={$auth.isConnected ? "Wallet" : "Connect Wallet"}
          onClick={mobileMenuAction(handleConnect)}
          isSelected={showWalletSidebar && walletSidebarActiveTab === "wallet"}
          variant="primary"
          iconSize={20}
          class="mobile-wallet-btn"
          {...walletButtonThemeProps}
          isWalletButton={true}
          badgeCount={$notificationsStore.unreadCount}
        />
      </div>
    </div>
  </div>
{/if}

<WalletSidebar
  isOpen={showWalletSidebar}
  activeTab={walletSidebarActiveTab}
  onClose={() => showWalletSidebar = false}
/>

<style scoped lang="postcss">
  /* Logo styles using CSS vars - Keep */
  .light-logo {
    @apply invert brightness-[var(--logo-brightness,0.8)] transition-all duration-200;
  }

  /* Keep only for text-shadow on active state */
  .nav-link.active {
    text-shadow: 0 0px 30px theme(colors.kong.primary);
  }

  /* Global style - Keep */
  :global(.navbar-icon svg) {
    width: 20px !important;
    height: 20px !important;
  }
</style>
