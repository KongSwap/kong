<script lang="ts">
  import { auth, isAuthenticating } from "$lib/stores/auth";
  import { fade, slide } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import { themeStore } from "$lib/stores/themeStore";
  import { navigationStore } from "$lib/stores/navigationStore";
  import { navActions } from "$lib/services/navActions";
  import { getThemeById } from "$lib/themes/themeRegistry";
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
  } from "lucide-svelte";
  import { app } from "$lib/state/app.state.svelte";
  import { settingsStore } from "$lib/stores/settingsStore";
  import { disableBodyScroll, enableBodyScroll } from "$lib/utils/scrollUtils";

  // Components
  import NavOption from "./NavOption.svelte";
  import MobileNavGroup from "./MobileNavGroup.svelte";
  import MobileMenuItem from "./MobileMenuItem.svelte";
  import NavbarButton from "./NavbarButton.svelte";
  import NavPanel from "./NavPanel.svelte";
  import WalletSidebar from "$lib/components/common/WalletSidebar.svelte";
  import TokenTicker from "./TokenTicker.svelte";

  // Types
  type NavTabId = "swap" | "pro" | "predict" | "pools" | "more";
  type WalletTab = "notifications" | "chat" | "wallet";

  // Navigation configuration
  type NavLinkConfig = {
    label: string;
    type: "link";
    defaultPath: string;
  };

  type NavDropdownConfig = {
    label: string;
    type: "dropdown";
    options: Array<{
      label: string;
      description: string;
      path: string;
      icon: any;
    }>;
    defaultPath: string;
  };

  type NavConfigItem = NavLinkConfig | NavDropdownConfig;

  const NAV_CONFIG: Record<string, NavConfigItem> = {
    swap: {
      label: "SWAP",
      type: "link" as const,
      defaultPath: "/",
    },
    pro: {
      label: "PRO",
      type: "link" as const,
      defaultPath: "/pro",
    },
    predict: {
      label: "PREDICT",
      type: "link" as const,
      defaultPath: "/predict",
    },
    pools: {
      label: "POOLS",
      type: "link" as const,
      defaultPath: "/pools",
    },
    more: {
      label: "MORE",
      type: "dropdown" as const,
      options: [
        {
          label: "Tokens",
          description: "View general statistics and platform metrics",
          path: "/stats",
          icon: ChartCandlestick,
        },
        {
          label: "Bubbles",
          description: "Visualize token price changes with bubbles",
          path: "/stats/bubbles",
          icon: ChartScatter,
        },
        {
          label: "Leaderboards",
          description: "View trading leaderboards",
          path: "/stats/leaderboard",
          icon: Trophy,
        },
        {
          label: "Airdrop Claims",
          description: "Claim your airdrop tokens",
          path: "/airdrop-claims",
          icon: Award,
        },
      ],
      defaultPath: "/stats",
    },
  };

  // Path to tab mapping
  const PATH_TO_TAB: Record<string, NavTabId> = {
    "/": "swap",
    "/pro": "pro",
    "/predict": "predict",
    "/pools": "pools",
    "/airdrop-claims": "more",
    "/stats": "more",
  };

  // State
  let isMobile = $derived(app.isMobile);
  let navState = $state($navigationStore);
  let activeDropdown = $derived(navState.activeDropdown);
  let showWalletSidebar = $derived(navState.walletSidebarOpen);
  let walletSidebarActiveTab = $derived(navState.walletSidebarTab);
  let closeTimeout: ReturnType<typeof setTimeout>;
  
  // Subscribe to navigation store updates
  $effect(() => {
    navigationStore.subscribe(state => {
      navState = state;
    });
  });
  
  // Track if settings are initialized
  let settingsInitialized = $state(false);
  let showTicker = $derived(settingsInitialized && $settingsStore.ticker_enabled === true);
  
  $effect(() => {
    const unsubscribe = settingsStore.initialized.subscribe(value => {
      settingsInitialized = value;
    });
    
    return unsubscribe;
  });
  let activeTab = $derived.by(() => {
    const path = page.url.pathname;

    if (path === "/") {
      return "swap";
    }

    const firstSegment = path.split("/")[1];
    if (firstSegment) {
      const key = `/${firstSegment}`;
      if (Object.hasOwn(PATH_TO_TAB, key)) {
        return PATH_TO_TAB[key];
      }
    }

    // Fallback for paths not found in the map
    return "null";
  });

  $effect(() => {
    if(showWalletSidebar) {
      disableBodyScroll();
    } else {
      enableBodyScroll();
    }
  });


  // Constants
  const SWIPE_THRESHOLD = 75;
  const EDGE_SWIPE_ZONE = 50;

  const walletButtonThemeProps = $derived({
    customBgColor: browser
      ? getThemeById($themeStore)?.colors?.primary
      : undefined,
    customTextColor: "var(--color-kong-text-primary)",
    customBorderStyle: browser
      ? getThemeById($themeStore)?.colors?.primaryButtonBorder
      : undefined,
    customBorderColor: browser
      ? getThemeById($themeStore)?.colors?.primaryButtonBorderColor
      : undefined,
  });

  const allTabs = Object.keys(NAV_CONFIG) as NavTabId[];

  // Functions
  function handleConnect() {
    if (!$auth.isConnected) {
      navActions.connectWallet();
      return;
    }
    navigationStore.toggleWalletSidebar();
  }

  function mobileMenuAction(action: () => void | Promise<void>) {
    return () => {
      action();
      navigationStore.closeMobileMenu();
    };
  }

  // Effects
  // Handle responsive layout and swipe gestures
  $effect(() => {
    if (!browser) return;

    let touchStartX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchEndX - touchStartX;

      // Swipe right to open menu (when closed)
      if (
        diffX > SWIPE_THRESHOLD &&
        touchStartX < EDGE_SWIPE_ZONE &&
        !navState.mobileMenuOpen
      ) {
        navigationStore.openMobileMenu();
      }
      // Swipe left to close menu (when open)
      else if (diffX < -SWIPE_THRESHOLD && navState.mobileMenuOpen) {
        navigationStore.closeMobileMenu();
      }
    };

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  });

  // Derived configuration
  const accountMenuItems = $derived([
    {
      label: "Settings",
      icon: SettingsIcon,
      onClick: mobileMenuAction(() => navActions.navigate("/settings")),
      show: true,
    },
    {
      label: "Search",
      icon: Search,
      onClick: mobileMenuAction(() => navActions.openSearch()),
      show: true,
    },
    {
      label: "Claim Tokens",
      icon: Droplet,
      onClick: mobileMenuAction(() => navActions.claimTokens()),
      show: navActions.isDevelopment() && $auth.isConnected,
    },
    {
      label: "Copy Principal ID",
      icon: Copy,
      onClick: mobileMenuAction(() => navActions.copyPrincipalId()),
      show: $auth.isConnected,
    },
    {
      label: "Copy Account ID",
      icon: Copy,
      onClick: mobileMenuAction(() => navActions.copyAccountId()),
      show: $auth.isConnected,
    },
    {
      label: "Notifications",
      icon: Bell,
      onClick: mobileMenuAction(() => navigationStore.toggleWalletSidebar("notifications")),
      badgeCount: $notificationsStore.unreadCount,
      show: true,
    },
  ]);

  const mobileNavGroups = $derived([
    {
      title: "SWAP",
      options: [
        {
          label: "Basic Swap",
          description: "Simple and intuitive token swapping interface",
          path: "/",
          icon: Wallet,
        },
        {
          label: "Pro Swap",
          description: "Advanced trading features with detailed market data",
          path: "/pro",
          icon: Coins,
        },
      ],
    },
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
    {
      title: "POOLS",
      options: [
        {
          label: "Liquidity Pools",
          description: "Provide liquidity and earn rewards",
          path: "/pools",
          icon: Droplet,
          comingSoon: false,
        }
      ],
    },
    {
      title: "MORE",
      options: NAV_CONFIG.more.type === "dropdown" 
        ? NAV_CONFIG.more.options.map((opt) => ({
            ...opt,
            comingSoon: false,
          }))
        : [],
    },
  ]);

  const desktopNavItems = $derived(
    allTabs.map((tabId) => {
      const config = NAV_CONFIG[tabId];
      if (config && config.type === "dropdown") {
        return {
          type: "dropdown" as const,
          label: config.label,
          tabId,
          options: config.options.map((opt) => ({ ...opt, comingSoon: false })),
          defaultPath: config.defaultPath,
        };
      } else if (config) {
        return {
          type: "link" as const,
          label: config.label,
          tabId,
          defaultPath: config.defaultPath,
        };
      }
      return null;
    }).filter(Boolean),
  );
</script>

<div id="navbar" class="w-full top-0 left-0 z-50 relative mb-4">
  {#if showTicker}
    <TokenTicker />
  {/if}
  <div class="mx-auto h-16 flex items-center justify-between md:px-6 px-4 py-2">
    <div class="flex items-center gap-4">
      {#if isMobile}
        <button
          class="h-[34px] w-[34px] flex items-center justify-center"
          onclick={() => navigationStore.toggleMobileMenu()}
        >
          <Menu size={20} class="text-kong-text-primary" />
        </button>
      {:else}
        <button
          class="flex items-center hover:opacity-90 transition-opacity"
          onclick={() => goto("/")}
          aria-label="Kong Logo"
        >
          <div class="h-[36px] w-[36px] kong-logo-mask"></div>
        </button>

        <nav class="flex items-center gap-0.5">
          {#each desktopNavItems as navItem (navItem.tabId)}
            {#if navItem.type === "dropdown"}
              <NavOption
                label={navItem.label}
                options={navItem.options}
                isActive={activeTab === navItem.tabId}
                activeDropdown={activeDropdown === navItem.tabId
                  ? navItem.tabId
                  : null}
                onShowDropdown={() => {
                  clearTimeout(closeTimeout);
                  navigationStore.showDropdown(navItem.tabId as NavTabId);
                }}
                onHideDropdown={() => {
                  closeTimeout = setTimeout(() => navigationStore.hideDropdown(), 150);
                }}
                onTabChange={(tab) => (activeTab = tab as NavTabId)}
                defaultPath={navItem.defaultPath}
              />
            {:else if navItem.type === "link"}
              <button
                class="relative h-16 px-5 flex items-center text-sm font-semibold text-kong-text-secondary tracking-wider transition-all duration-200 hover:text-kong-text-primary"
                class:nav-link={activeTab === navItem.tabId}
                class:active={activeTab === navItem.tabId}
                onclick={() => {
                  goto(navItem.defaultPath);
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
          <div class="h-8 w-8 kong-logo-mask"></div>
        </button>
      </div>
    {/if}

    <div class="flex items-center gap-2">
      <NavPanel {isMobile} onWalletClick={() => navigationStore.toggleWalletSidebar()} />
    </div>
  </div>
</div>

{#if navState.mobileMenuOpen && isMobile}
  <div class="fixed inset-0 z-50" transition:fade={{ duration: 200 }}>
    <div
      class="fixed inset-0 bg-kong-bg-primary/60 backdrop-blur-sm"
      onclick={() => navigationStore.closeMobileMenu()}
    ></div>
    <div
      class="fixed top-0 left-0 h-full w-[85%] max-w-[320px] flex flex-col bg-kong-bg-primary border-r border-kong-border shadow-lg max-[375px]:w-[90%] max-[375px]:max-w-[300px]"
      transition:slide={{ duration: 200, axis: "x" }}
    >
      <div
        class="flex items-center justify-between p-5 border-b border-kong-border max-[375px]:p-4"
      >
        <div class="h-9 w-9 kong-logo-mask"></div>
        <button
          class="w-9 h-9 flex items-center justify-center rounded-full text-kong-text-secondary hover:text-kong-text-primary bg-kong-text-primary/10 hover:bg-kong-text-primary/15 transition-colors duration-200"
          onclick={() => navigationStore.closeMobileMenu()}
        >
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
              onTabChange={(tab) => (activeTab = tab as NavTabId)}
              onClose={() => navigationStore.closeMobileMenu()}
            />
          {/each}
        </div>

        <div class="px-4 py-2 max-[375px]:px-3">
          <div
            class="text-xs font-semibold text-kong-text-secondary/70 px-2 mb-2 tracking-wider"
          >
            ACCOUNT
          </div>
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

      <div class="p-2 border-t border-kong-border">
        <NavbarButton
          icon={Wallet}
          label={$auth.isConnected ? "Wallet" : "Connect Wallet"}
          onClick={mobileMenuAction(handleConnect)}
          isSelected={showWalletSidebar && walletSidebarActiveTab === "wallet"}
          variant="primary"
          iconSize={20}
          class="w-full !py-5 justify-center"
          {...walletButtonThemeProps}
          isWalletButton={true}
          badgeCount={$notificationsStore.unreadCount}
          loading={$isAuthenticating}
        />
      </div>
    </div>
  </div>
{/if}

<WalletSidebar
  isOpen={navState.walletSidebarOpen}
  activeTab={navState.walletSidebarTab}
  onClose={() => navigationStore.closeWalletSidebar()}
/>

<style scoped lang="postcss">
  .kong-logo-mask {
    background-color: rgb(var(--text-primary));
    -webkit-mask-image: url('/images/kongface-white.svg');
    mask-image: url('/images/kongface-white.svg');
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    transition: background-color 0.2s ease;
  }

  .nav-link.active {
    @apply text-kong-primary;
  }

  :global(.navbar-icon svg) {
    width: 20px !important;
    height: 20px !important;
  }
</style>
