<script lang="ts">
  import { auth, isAuthenticating } from "$lib/stores/auth";
  import { fade, slide } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import { themeStore } from "$lib/stores/themeStore";
  import { searchStore } from "$lib/stores/searchStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { logoPath } from "$lib/stores/derivedThemeStore";
  import { loadBalances } from "$lib/stores/balancesStore";
  import { getThemeById } from "$lib/themes/themeRegistry";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import { faucetClaim } from "$lib/api/tokens/TokenApiClient";
  import { getAccountIds } from "$lib/utils/accountUtils";
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
  let navOpen = $state(false);
  let activeDropdown = $state<Extract<NavTabId, "more"> | null>(null);
  let showWalletSidebar = $state(false);
  let walletSidebarActiveTab = $state<WalletTab>("notifications");
  let isClaiming = $state(false);
  let closeTimeout: ReturnType<typeof setTimeout>;
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
  const MOBILE_LOGO_PATH = "/titles/logo-white-wide.png";
  const SWIPE_THRESHOLD = 75;
  const EDGE_SWIPE_ZONE = 50;

  // Derived values
  const isLightTheme = $derived(
    browser &&
      (getThemeById($themeStore)?.colors?.logoInvert === 1 ||
        $themeStore.includes("light") ||
        $themeStore === "microswap"),
  );

  const showFaucetOption = $derived(
    $auth.isConnected &&
      (process.env.DFX_NETWORK === "local" ||
        process.env.DFX_NETWORK === "staging"),
  );

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
  function toggleWalletSidebar(tab: WalletTab = "notifications") {
    walletSidebarActiveTab = tab;
    showWalletSidebar = !showWalletSidebar;
  }

  function handleConnect() {
    if (!$auth.isConnected) {
      walletProviderStore.open();
      return;
    }
    const tab =
      $notificationsStore.unreadCount > 0 ? "notifications" : "wallet";
    toggleWalletSidebar(tab);
  }

  function handleOpenSearch() {
    searchStore.open();
  }

  function mobileMenuAction(action: () => void | Promise<void>) {
    return () => {
      action();
      navOpen = false;
    };
  }

  async function claimTokens() {
    if (isClaiming) return;
    isClaiming = true;
    try {
      await faucetClaim();
      await loadBalances($userTokens.tokens, $auth.account.owner, true);
    } finally {
      isClaiming = false;
    }
  }

  function copyPrincipalId() {
    const principalToCopy = $auth?.account?.owner;
    if (principalToCopy) {
      copyToClipboard(principalToCopy);
    }
  }

  function copyAccountId() {
    if ($auth.isConnected && $auth.account?.owner) {
      const accountId = getAccountIds(
        $auth.account.owner,
        $auth.account.subaccount,
      ).main;
      if (accountId) {
        copyToClipboard(accountId);
      }
    }
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
        !navOpen
      ) {
        navOpen = true;
      }
      // Swipe left to close menu (when open)
      else if (diffX < -SWIPE_THRESHOLD && navOpen) {
        navOpen = false;
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
      onClick: mobileMenuAction(() => goto("/settings")),
      show: true,
    },
    {
      label: "Search",
      icon: Search,
      onClick: mobileMenuAction(handleOpenSearch),
      show: true,
    },
    {
      label: "Claim Tokens",
      icon: Droplet,
      onClick: mobileMenuAction(async () => {
        if (isClaiming) return;
        await claimTokens();
      }),
      show: showFaucetOption,
    },
    {
      label: "Copy Principal ID",
      icon: Copy,
      onClick: mobileMenuAction(copyPrincipalId),
      show: $auth.isConnected,
    },
    {
      label: "Copy Account ID",
      icon: Copy,
      onClick: mobileMenuAction(copyAccountId),
      show: $auth.isConnected,
    },
    {
      label: "Notifications",
      icon: Bell,
      onClick: mobileMenuAction(() => toggleWalletSidebar("notifications")),
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
  {#if $settingsStore.ticker_enabled}
    <TokenTicker />
  {/if}
  <div class="mx-auto h-16 flex items-center justify-between md:px-6 px-4 py-2">
    <div class="flex items-center gap-4">
      {#if isMobile}
        <button
          class="h-[34px] w-[34px] flex items-center justify-center"
          onclick={() => (navOpen = !navOpen)}
        >
          <Menu size={20} color={isLightTheme ? "black" : "white"} />
        </button>
      {:else}
        <button
          class="flex items-center hover:opacity-90 transition-opacity"
          onclick={() => goto("/")}
        >
          {#key $logoPath}
            <img
              src={$logoPath}
              alt="Kong Logo"
              class="h-[36px] max-w-full inline-block"
              class:light-logo={isLightTheme}
            />
          {/key}
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
                  activeDropdown = navItem.tabId as Extract<NavTabId, "more">;
                }}
                onHideDropdown={() => {
                  closeTimeout = setTimeout(() => (activeDropdown = null), 150);
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
          {#key $logoPath}
            <img
              src={$logoPath}
              alt="Kong Logo"
              class="h-8 w-auto inline-block"
              class:light-logo={isLightTheme}
            />
          {/key}
        </button>
      </div>
    {/if}

    <div class="flex items-center gap-2">
      <NavPanel {isMobile} />
    </div>
  </div>
</div>

{#if navOpen && isMobile}
  <div class="fixed inset-0 z-50" transition:fade={{ duration: 200 }}>
    <div
      class="fixed inset-0 bg-kong-bg-primary/60 backdrop-blur-sm"
      onclick={() => (navOpen = false)}
    ></div>
    <div
      class="fixed top-0 left-0 h-full w-[85%] max-w-[320px] flex flex-col bg-kong-bg-primary border-r border-kong-border shadow-lg max-[375px]:w-[90%] max-[375px]:max-w-[300px]"
      transition:slide={{ duration: 200, axis: "x" }}
    >
      <div
        class="flex items-center justify-between p-5 border-b border-kong-border max-[375px]:p-4"
      >
        <img
          src={MOBILE_LOGO_PATH}
          alt="Kong Logo"
          class="h-9"
          class:light-logo={isLightTheme}
        />
        <button
          class="w-9 h-9 flex items-center justify-center rounded-full text-kong-text-secondary hover:text-kong-text-primary bg-kong-text-primary/10 hover:bg-kong-text-primary/15 transition-colors duration-200"
          onclick={() => (navOpen = false)}
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
              onClose={() => (navOpen = false)}
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
  isOpen={showWalletSidebar}
  activeTab={walletSidebarActiveTab}
  onClose={() => (showWalletSidebar = false)}
/>

<style scoped lang="postcss">
  .light-logo {
    filter: invert(1) brightness(0.2);
    @apply transition-all duration-200;
  }

  .nav-link.active {
    @apply text-kong-primary;
  }

  :global(.navbar-icon svg) {
    width: 20px !important;
    height: 20px !important;
  }
</style>
