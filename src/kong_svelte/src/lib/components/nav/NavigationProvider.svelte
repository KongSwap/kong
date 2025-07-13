<script lang="ts">
  /**
   * Navigation Provider Component
   * Main orchestrator for the navigation system
   * Replaces the monolithic Navbar.svelte with focused components
   */
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { auth, isAuthenticating } from "$lib/stores/auth";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import { themeStore } from "$lib/stores/themeStore";
  import { settingsStore } from "$lib/stores/settingsStore";
  import { getThemeById } from "$lib/themes/themeRegistry";
  import { navActions } from "$lib/services/navActions";
  import { app } from "$lib/state/app.state.svelte";
  import { disableBodyScroll, enableBodyScroll } from "$lib/utils/scrollUtils";
  import { navigationState } from "$lib/state/navigation.state.svelte";
  import { 
    Settings as SettingsIcon,
    Copy,
    Search,
    Droplet,
    Bell,
    Wallet
  } from "lucide-svelte";
  import { touchGestures, createNavigationGestureOptions } from "$lib/actions/touchGestures";
  import { NAVIGATION_CONFIG } from "$lib/config/navigation";
  import { get } from "svelte/store";

  // Components
  import DesktopNavbar from "./DesktopNavbar.svelte";
  import MobileNavbar from "./MobileNavbar.svelte";
  import NavPanel from "./NavPanel.svelte";
  import TokenTicker from "./TokenTicker.svelte";
  import WalletSidebar from "$lib/components/common/WalletSidebar.svelte";
  import NavbarButton from "./NavbarButton.svelte";
  import { Menu } from "lucide-svelte";

  // Props
  let { 
    class: className = ""
  } = $props();

  // Reactive state
  let isMobile = $derived(app.isMobile);
  let { mobileMenuOpen, walletSidebarOpen, walletSidebarTab } = $derived(navigationState.state);

  // Touch gesture configuration
  let gestureOptions = $derived(
    createNavigationGestureOptions(
      () => navigationState.openMobileMenu(),
      () => navigationState.closeMobileMenu(),
      mobileMenuOpen,
      NAVIGATION_CONFIG.mobile.swipeGestures
    )
  );
  
  // Settings and ticker
  let settingsInitialized = $state(false);
  let showTicker = $derived(settingsInitialized && get(settingsStore).ticker_enabled === true);

  // Theme-based wallet button styling
  let walletButtonThemeProps = $derived({
    customBgColor: browser
      ? getThemeById(get(themeStore))?.colors?.primary
      : undefined,
    customTextColor: "var(--color-kong-text-primary)",
    customBorderStyle: browser
      ? getThemeById(get(themeStore))?.colors?.primaryButtonBorder
      : undefined,
    customBorderColor: browser
      ? getThemeById(get(themeStore))?.colors?.primaryButtonBorderColor
      : undefined,
  });

  // Account menu items for mobile
  let accountMenuItems = $derived([
    {
      label: "Settings",
      icon: SettingsIcon,
      onClick: () => navActions.navigate("/settings"),
      show: true,
    },
    {
      label: "Search",
      icon: Search,
      onClick: () => navActions.openSearch(),
      show: true,
    },
    {
      label: "Claim Tokens",
      icon: Droplet,
      onClick: () => navActions.claimTokens(),
      show: navActions.isDevelopment() && get(auth).isConnected,
    },
    {
      label: "Copy Principal ID",
      icon: Copy,
      onClick: () => navActions.copyPrincipalId(),
      show: get(auth).isConnected,
    },
    {
      label: "Copy Account ID",
      icon: Copy,
      onClick: () => navActions.copyAccountId(),
      show: get(auth).isConnected,
    },
    {
      label: "Notifications",
      icon: Bell,
      onClick: () => navigationState.toggleWalletSidebar("notifications"),
      badgeCount: get(notificationsStore).unreadCount,
      show: true,
    },
  ]);

  // Settings initialization effect
  $effect(() => {
    const unsubscribe = settingsStore.initialized.subscribe(value => {
      settingsInitialized = value;
    });
    
    return unsubscribe;
  });

  // Body scroll management for mobile menu and wallet sidebar
  $effect(() => {
    if (walletSidebarOpen || mobileMenuOpen) {
      disableBodyScroll();
    } else {
      enableBodyScroll();
    }
  });

  // Wallet connection handler
  function handleConnect() {
    if (!get(auth).isConnected) {
      navActions.connectWallet();
      return;
    }
    navigationState.toggleWalletSidebar();
  }

  // Logo click handler
  function handleLogoClick() {
    goto("/");
  }

  // Cleanup on unmount
  $effect(() => {
    return () => {
      navigationState.cleanup();
    };
  });
</script>

<header id="navbar" class="navbar-header {className}" role="banner">
  <!-- Token Ticker (optional) -->
  {#if showTicker}
    <TokenTicker />
  {/if}

  <!-- Main Navigation Container -->
  <div 
    class="navbar-container"
    use:touchGestures={gestureOptions}
  >
    <div class="navbar-content">
      <!-- Left Section: Navigation -->
      <div class="navbar-left">
        {#if isMobile}
          <!-- Mobile hamburger menu button -->
          <button
            class="h-[34px] w-[34px] flex items-center justify-center text-kong-text-primary hover:text-kong-primary transition-colors"
            onclick={() => navigationState.toggleMobileMenu()}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            <Menu size={20} />
          </button>
        {:else}
          <DesktopNavbar 
            onLogoClick={handleLogoClick}
          />
        {/if}
      </div>

      <!-- Mobile Logo (centered) -->
      {#if isMobile}
        <div class="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
          <button
            class="flex items-center hover:opacity-90 transition-opacity"
            onclick={handleLogoClick}
            aria-label="Kong Logo - Go to homepage"
          >
            <div class="h-8 w-8 kong-logo-mask"></div>
          </button>
        </div>
      {/if}

      <!-- Right Section: Actions -->
      <div class="navbar-right">
        <NavPanel 
          {isMobile} 
          onWalletClick={() => navigationState.toggleWalletSidebar()} 
        />
      </div>
    </div>
  </div>

</header>

<!-- Mobile Menu Overlay -->
{#if isMobile && mobileMenuOpen}
  <MobileNavbar 
    onLogoClick={handleLogoClick}
    {accountMenuItems}
    {walletButtonThemeProps}
  />
{/if}

<!-- Wallet Sidebar -->
<WalletSidebar
  isOpen={walletSidebarOpen}
  activeTab={walletSidebarTab}
  onClose={() => navigationState.closeWalletSidebar()}
/>

<style lang="postcss">
  .navbar-header {
    @apply w-full top-0 left-0 z-50 relative mb-4;
  }

  .navbar-container {
    @apply mx-auto h-16 flex items-center justify-between md:px-6 px-4 py-2;
  }

  .navbar-content {
    @apply flex items-center justify-between w-full relative;
  }

  .navbar-left {
    @apply flex items-center gap-4;
  }

  .navbar-right {
    @apply flex items-center gap-2;
  }

  .mobile-wallet-section {
    @apply p-2 border-t border-kong-border;
  }

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

  /* Ensure proper stacking context */
  :global(.navbar-header) {
    position: relative;
    z-index: 100;
  }

  /* Performance optimization for touch devices */
  @media (hover: none) {
    .navbar-header {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
  }
</style>