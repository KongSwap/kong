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
  import WalletProvider from "$lib/components/wallet/WalletProvider.svelte";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import { faucetClaim } from "$lib/api/tokens/TokenApiClient";

  // Computed directly where needed using themeStore rune
  let isWin98Theme = $derived(browser && $themeStore === "win98light");

  // Create a writable store for the logo source
  const logoSrcStore = writable("/titles/logo-white-wide.png");

  // Update the logo when theme changes
  function updateLogoSrc() {
    if (browser) {
      const cssLogoPath = getComputedStyle(document.documentElement)
        .getPropertyValue("--logo-path")
        .trim();
      const finalLogoPath = cssLogoPath || "/titles/logo-white-wide.png";
      logoSrcStore.set(finalLogoPath);
    }
  }

  // Initialize logo on first load
  if (browser) {
    updateLogoSrc();
  }

  let isMobile = $state(false);
  let activeTab = $state<"swap" | "predict" | "earn" | "stats">("swap");
  let navOpen = $state(false);
  let closeTimeout: ReturnType<typeof setTimeout>;
  let activeDropdown = $state<"swap" | "earn" | "stats" | null>(null);
  let showWalletSidebar = $state(false);
  let showWalletProvider = $state(false);
  let walletSidebarActiveTab = $state<"notifications" | "chat" | "wallet">(
    "notifications",
  );

  // Toggle wallet sidebar
  function toggleWalletSidebar(
    tab: "notifications" | "chat" | "wallet" = "notifications",
  ) {
    walletSidebarActiveTab = tab;
    showWalletSidebar = !showWalletSidebar;
  }

  // Close wallet sidebar
  function closeWalletSidebar() {
    showWalletSidebar = false;
  }

  function closeWalletProvider() {
    showWalletProvider = false;
  }

  // Filter tabs based on DFX_NETWORK
  const allTabs = ["swap", "predict", "earn", "stats"] as const;
  const tabs = process.env.DFX_NETWORK !== "ic" ? allTabs : allTabs;

  const dataOptions = [
    {
      label: "Overview",
      description: "View general statistics and platform metrics",
      path: "/stats",
      icon: ChartCandlestick,
      comingSoon: false,
    },
    {
      label: "Bubbles",
      description: "Visualize token price changes with bubbles",
      path: "/stats/bubbles",
      icon: ChartScatter,
      comingSoon: false,
    },
    {
      label: "Leaderboards",
      description: "View trading leaderboards",
      path: "/stats/leaderboard",
      icon: Trophy,
      comingSoon: false,
    },
  ];

  function handleConnect() {
    // If user is not authenticated, show the wallet provider
    if (!$auth.isConnected) {
      showWalletProvider = true;
      return;
    }

    // Otherwise, show the wallet sidebar
    // If there are unread notifications, open the notifications tab first
    // Otherwise, open the wallet tab
    const activeTab =
      $notificationsStore.unreadCount > 0 ? "notifications" : "wallet";
    toggleWalletSidebar(activeTab);
  }

  function checkMobile() {
    if (browser) {
      isMobile = window.innerWidth < 768;
    }
  }

  // Call checkMobile initially
  checkMobile();

  // Replace onMount with $effect for listeners and theme updates
  $effect(() => {
    if (browser) {
      // Update logo whenever the theme changes
      const currentTheme = $themeStore;
      setTimeout(updateLogoSrc, 50);

      // Add resize listener
      window.addEventListener("resize", checkMobile);

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
        window.removeEventListener("resize", checkMobile);
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  });

  function onTabChange(tab: "swap" | "earn" | "stats" | "predict") {
    activeTab = tab;
  }

  async function claimTokens() {
    await faucetClaim();
    // Use runes directly
    await loadBalances($userTokens.tokens, $auth.account.owner, true);
  }

  const earnOptions = [
    {
      label: "Liquidity Pools",
      description: "Provide liquidity to earn trading fees and rewards",
      path: "/pools",
      icon: Coins,
      comingSoon: false,
    },
    {
      label: "Airdrop Claims",
      description: "Claim your airdrop tokens",
      path: "/airdrop-claims",
      icon: Award,
      comingSoon: false,
    }
  ];

  function showDropdown(type: "swap" | "earn" | "stats") {
    clearTimeout(closeTimeout);
    activeDropdown = type;
  }

  function hideDropdown() {
    closeTimeout = setTimeout(() => {
      activeDropdown = null;
    }, 150);
  }

  const swapOptions = [
    {
      label: "Basic Swap",
      description: "Simple and intuitive token swapping interface",
      path: "/swap",
      icon: Wallet,
      comingSoon: false,
    },
    {
      label: "Pro Swap",
      description: "Advanced trading features with detailed market data",
      path: "/swap/pro",
      icon: Coins,
      comingSoon: false,
    },
  ];

  $effect(() => {
    // Use page rune directly
    const path = page.url.pathname;
    if (path.startsWith("/swap")) {
      activeTab = "swap";
    } else if (path.startsWith("/earn") || path.startsWith("/pools")) {
      activeTab = "earn";
    } else if (path.startsWith("/stats")) {
      activeTab = "stats";
    } else if (path.startsWith("/predict")) {
      activeTab = "predict";
    }
  });

  function handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    const textElement = img.nextElementSibling as HTMLElement;
    img.style.display = "none";
    if (textElement) {
      textElement.style.display = "block";
    }
  }

  function handleOpenSearch() {
    searchStore.open();
  }
</script>

<div class="mb-4 w-full top-0 left-0 z-50 relative pt-2">
  <div class="mx-auto h-16 flex items-center justify-between px-6">
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
            on:error={handleImageError}
          />
          <span
            class="hidden text-xl font-bold text-kong-text-primary"
            style="display: none;"
          >
            KONG
          </span>
        </button>

        <nav class="flex items-center gap-0.5">
          {#each tabs as tab}
            {#if tab === "earn"}
              <NavOption
                label="EARN"
                options={earnOptions}
                isActive={activeTab === "earn"}
                {activeDropdown}
                onShowDropdown={showDropdown}
                onHideDropdown={hideDropdown}
                {onTabChange}
                defaultPath="/pools"
              />
            {:else if tab === "swap"}
              <NavOption
                label="SWAP"
                options={swapOptions}
                isActive={activeTab === "swap"}
                {activeDropdown}
                onShowDropdown={showDropdown}
                onHideDropdown={hideDropdown}
                {onTabChange}
                defaultPath="/swap"
              />
            {:else if tab === "stats"}
              <NavOption
                label="STATS"
                options={dataOptions}
                isActive={activeTab === "stats"}
                {activeDropdown}
                onShowDropdown={showDropdown}
                onHideDropdown={hideDropdown}
                {onTabChange}
                defaultPath="/stats"
              />
            {:else if tab === "predict"}
              <button
                class="nav-link {activeTab === tab ? 'active' : ''}"
                on:click={() => {
                  goto("/predict");
                  onTabChange("predict");
                }}
              >
                {tab.toUpperCase()}
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
            on:error={handleImageError}
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
        <NavbarButton
          icon={SettingsIcon}
          onClick={() => goto("/settings")}
          tooltipText="Settings"
          useThemeBorder={isWin98Theme}
          customBgColor={browser && getThemeById($themeStore)?.colors?.buttonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.buttonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.buttonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.buttonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.buttonBorderColor}
          customShadow={browser &&
            getThemeById($themeStore)?.colors?.buttonShadow}
          class="navbar-icon"
        />

        <NavbarButton
          icon={Search}
          onClick={handleOpenSearch}
          tooltipText="Search"
          useThemeBorder={isWin98Theme}
          customBgColor={browser && getThemeById($themeStore)?.colors?.buttonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.buttonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.buttonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.buttonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.buttonBorderColor}
          customShadow={browser &&
            getThemeById($themeStore)?.colors?.buttonShadow}
          class="navbar-icon"
        />

        {#if $auth.isConnected}
          {#if process.env.DFX_NETWORK === "local" || process.env.DFX_NETWORK === "staging"}
            <NavbarButton
              icon={Droplet}
              onClick={claimTokens}
              tooltipText="Claim test tokens"
              useThemeBorder={isWin98Theme}
              customBgColor={browser &&
                getThemeById($themeStore)?.colors?.buttonBg}
              customHoverBgColor={browser &&
                getThemeById($themeStore)?.colors?.buttonHoverBg}
              customTextColor={browser &&
                getThemeById($themeStore)?.colors?.buttonText}
              customBorderStyle={browser &&
                getThemeById($themeStore)?.colors?.buttonBorder}
              customBorderColor={browser &&
                getThemeById($themeStore)?.colors?.buttonBorderColor}
              customShadow={browser &&
                getThemeById($themeStore)?.colors?.buttonShadow}
              class="navbar-icon"
            />
          {/if}

          <NavbarButton
            icon={Copy}
            label="PID"
            onClick={() => copyToClipboard($auth?.account?.owner)}
            tooltipText="Copy Principal ID"
            useThemeBorder={isWin98Theme}
            customBgColor={browser &&
              getThemeById($themeStore)?.colors?.buttonBg}
            customHoverBgColor={browser &&
              getThemeById($themeStore)?.colors?.buttonHoverBg}
            customTextColor={browser &&
              getThemeById($themeStore)?.colors?.buttonText}
            customBorderStyle={browser &&
              getThemeById($themeStore)?.colors?.buttonBorder}
            customBorderColor={browser &&
              getThemeById($themeStore)?.colors?.buttonBorderColor}
            customShadow={browser &&
              getThemeById($themeStore)?.colors?.buttonShadow}
            class="navbar-icon"
          />
        {/if}

        <NavbarButton
          icon={Wallet}
          label={$auth.isConnected ? null : "Connect"}
          onClick={handleConnect}
          isSelected={showWalletSidebar && walletSidebarActiveTab === "wallet"}
          variant="primary"
          useThemeBorder={isWin98Theme}
          customBgColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBorderColor}
          isWalletButton={true}
          badgeCount={$notificationsStore.unreadCount}
          class="navbar-icon"
        />
      {:else}
        <NavbarButton
          icon={Search}
          onClick={handleOpenSearch}
          variant="mobile"
          useThemeBorder={isWin98Theme}
          customBgColor={browser && getThemeById($themeStore)?.colors?.buttonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.buttonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.buttonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.buttonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.buttonBorderColor}
          customShadow={browser &&
            getThemeById($themeStore)?.colors?.buttonShadow}
          iconSize={14}
        />

        <NavbarButton
          icon={Wallet}
          onClick={handleConnect}
          isSelected={showWalletSidebar && walletSidebarActiveTab === "wallet"}
          variant="mobile"
          useThemeBorder={isWin98Theme}
          customBgColor={browser && getThemeById($themeStore)?.colors?.buttonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.buttonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.buttonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.buttonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.buttonBorderColor}
          customShadow={browser &&
            getThemeById($themeStore)?.colors?.buttonShadow}
          iconSize={14}
          isWalletButton={true}
          badgeCount={$notificationsStore.unreadCount}
        />
      {/if}
    </div>
  </div>
</div>

{#if navOpen && isMobile}
  <div class="mobile-menu" transition:fade={{ duration: 200 }}>
    <div class="mobile-menu-overlay" on:click={() => (navOpen = false)} />
    <div
      class="mobile-menu-content"
      transition:slide={{ duration: 200, axis: "x" }}
    >
      <div class="mobile-menu-header">
        <img
          src={$logoSrcStore}
          alt="Kong Logo"
          class="logo-wide navbar-logo h-8"
          class:light-logo={browser &&
            getThemeById($themeStore)?.colors?.logoInvert === 1}
        />
        <button class="mobile-close-btn" on:click={() => (navOpen = false)}>
          <X size={16} />
        </button>
      </div>

      <nav class="mobile-nav">
        <div class="mobile-nav-section">
          <MobileNavGroup
            title="SWAP"
            options={swapOptions}
            {activeTab}
            {onTabChange}
            onClose={() => (navOpen = false)}
          />

          <MobileNavGroup
            title="PREDICT"
            options={[
              {
                label: "Prediction Markets",
                description: "Trade on future outcomes",
                path: "/predict",
                icon: TrendingUpDown,
                comingSoon: false,
              },
            ]}
            {activeTab}
            {onTabChange}
            onClose={() => (navOpen = false)}
          />

          <MobileNavGroup
            title="EARN"
            options={earnOptions}
            {activeTab}
            {onTabChange}
            onClose={() => (navOpen = false)}
          />

          <MobileNavGroup
            title="STATS"
            options={dataOptions}
            {activeTab}
            {onTabChange}
            onClose={() => (navOpen = false)}
          />
        </div>

        <div class="mobile-nav-section">
          <div class="mobile-nav-section-title">ACCOUNT</div>
          <MobileMenuItem
            label="Settings"
            icon={SettingsIcon}
            onClick={() => {
              goto("/settings");
              navOpen = false;
            }}
            iconBackground="bg-kong-text-primary/10"
          />

          {#if process.env.DFX_NETWORK !== "ic"}
            <MobileMenuItem
              label="Search"
              icon={Search}
              onClick={() => {
                handleOpenSearch();
                navOpen = false;
              }}
              iconBackground="bg-kong-text-primary/10"
            />
          {/if}

          {#if $auth.isConnected}
            {#if process.env.DFX_NETWORK === "local" || process.env.DFX_NETWORK === "staging"}
              <MobileMenuItem
                label="Claim Tokens"
                icon={Droplet}
                onClick={() => {
                  claimTokens();
                  navOpen = false;
                }}
                iconBackground="bg-kong-text-primary/10"
              />
            {/if}

            <MobileMenuItem
              label="Copy Principal ID"
              icon={Copy}
              onClick={() => {
                copyToClipboard($auth?.account?.owner);
                navOpen = false;
              }}
              iconBackground="bg-kong-text-primary/10"
              badgeCount={$notificationsStore.unreadCount}
            />
          {/if}

          <MobileMenuItem
            label="Notifications"
            icon={Bell}
            onClick={() => {
              toggleWalletSidebar("notifications");
              navOpen = false;
            }}
            iconBackground="bg-kong-text-primary/10"
            badgeCount={$notificationsStore.unreadCount}
          />
        </div>
      </nav>

      <div class="mobile-menu-footer">
        <NavbarButton
          icon={Wallet}
          label={$auth.isConnected ? "Wallet" : "Connect Wallet"}
          onClick={() => {
            handleConnect();
            navOpen = false;
          }}
          isSelected={showWalletSidebar && walletSidebarActiveTab === "wallet"}
          variant="primary"
          iconSize={20}
          class="mobile-wallet-btn"
          useThemeBorder={isWin98Theme}
          customBgColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBg}
          customHoverBgColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonHoverBg}
          customTextColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonText}
          customBorderStyle={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBorder}
          customBorderColor={browser &&
            getThemeById($themeStore)?.colors?.primaryButtonBorderColor}
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
  onClose={closeWalletSidebar}
/>
{#if browser}
  <WalletProvider
    isOpen={showWalletProvider}
    onClose={closeWalletProvider}
    onLogin={() => {
      // Handle login if needed
    }}
  />
{/if}

<style scoped lang="postcss">
  /* Mobile Menu */
  .mobile-menu {
    @apply fixed inset-0 z-50;
  }

  .mobile-menu-overlay {
    @apply fixed inset-0 bg-black/50 backdrop-blur-sm;
  }

  .mobile-menu-content {
    @apply fixed top-0 left-0 h-full w-[85%] max-w-[320px] flex flex-col bg-kong-bg-dark border-r border-kong-border shadow-lg;
  }

  .mobile-menu-header {
    @apply flex items-center justify-between p-5 border-b border-kong-border;
  }

  .mobile-close-btn {
    @apply w-9 h-9 flex items-center justify-center rounded-full text-kong-text-secondary hover:text-kong-text-primary bg-kong-text-primary/10 hover:bg-kong-text-primary/15 transition-colors duration-200;
  }

  .mobile-nav {
    @apply flex-1 overflow-y-auto py-3;
  }

  .mobile-nav-section {
    @apply px-4 py-2;
  }

  .mobile-nav-section:not(:last-child) {
    @apply mb-3;
  }

  .mobile-nav-section-title {
    @apply text-xs font-semibold text-kong-text-secondary/70 px-2 mb-2 tracking-wider;
  }

  .mobile-menu-footer {
    @apply p-4 border-t border-kong-border;
  }

  /* Logo styles */
  .light-logo {
    @apply invert brightness-[var(--logo-brightness,0.8)] transition-all duration-200;
  }
  
  /* Bigger logo for mobile */
  .mobile-navbar-logo {
    height: 32px !important;
  }

  .mobile-menu-header .logo-wide {
    height: 36px !important;
    @apply transition-all duration-200;
  }

  .mobile-menu-header .logo-wide.light-logo {
    @apply invert brightness-[var(--logo-brightness,0.2)];
  }

  /* Basic nav link for predict tab */
  .nav-link {
    @apply relative h-16 px-5 flex items-center text-sm font-semibold text-kong-text-secondary tracking-wider transition-all duration-200;
  }

  .nav-link:hover {
    @apply text-kong-text-primary;
  }

  .nav-link.active {
    @apply text-kong-primary;
    text-shadow: 0 0px 30px theme(colors.kong.primary);
  }

  /* Responsive adjustments for mobile */
  @media (max-width: 375px) {
    .mobile-menu-content {
      @apply w-[90%] max-w-[300px];
    }
    
    .mobile-menu-header {
      @apply p-4;
    }
    
    .mobile-nav-section {
      @apply px-3;
    }
  }

  /* Desktop navbar icon size fix */
  :global(.navbar-icon svg) {
    width: 18px !important;
    height: 18px !important;
  }
</style>
