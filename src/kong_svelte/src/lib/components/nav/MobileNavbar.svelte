<script lang="ts">
  /**
   * Mobile Navigation Component
   * Focused component for mobile navigation UI
   */
  import { page } from "$app/state";
  import { fade, slide } from "svelte/transition";
  import { X, Wallet } from "lucide-svelte";
  import { get } from "svelte/store";
  import { auth, isAuthenticating } from "$lib/stores/auth";
  import { navActions } from "$lib/services/navActions";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import type { NavTabId } from "$lib/config/navigation";
  import { getMobileNavGroups, getActiveTabFromPath } from "$lib/config/navigation";
  import { navigationState } from "$lib/state/navigation.state.svelte";
  import MobileNavGroup from "./MobileNavGroup.svelte";
  import MobileMenuItem from "./MobileMenuItem.svelte";
  import NavbarButton from "./NavbarButton.svelte";

  // Props
  let { 
    onLogoClick = () => {},
    accountMenuItems = [],
    walletButtonThemeProps = {},
    class: className = ""
  } = $props<{
    onLogoClick?: () => void;
    accountMenuItems?: Array<{
      label: string;
      icon: any;
      onClick: () => void;
      show: boolean;
      badgeCount?: number;
    }>;
    walletButtonThemeProps?: Record<string, any>;
    class?: string;
  }>();

  // State
  let activeTab = $derived(getActiveTabFromPath(page.url.pathname) || "swap");
  let mobileNavGroups = $derived(getMobileNavGroups());
  let { mobileMenuOpen } = $derived(navigationState.state);

  function handleTabChange(tab: string): void {
    // Placeholder for future tab change logic
  }

  function wrapForMobile(action: () => void | Promise<void>) {
    return () => {
      action();
      navigationState.closeMobileMenu();
    };
  }

  // Wallet connection handler
  function handleConnect() {
    if (!get(auth).isConnected) {
      navActions.connectWallet();
      return;
    }
    navigationState.toggleWalletSidebar();
    navigationState.closeMobileMenu();
  }
</script>

<!-- Mobile Menu Overlay -->
{#if mobileMenuOpen}
  <div 
    class="mobile-menu-overlay" 
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="mobile-menu-title"
    id="mobile-menu"
  >
    <!-- Backdrop -->
    <div
      class="menu-backdrop"
      onclick={() => navigationState.closeMobileMenu()}
      aria-hidden="true"
    ></div>

    <!-- Menu Content -->
    <div
      class="menu-content"
      transition:slide={{ duration: 200, axis: "x" }}
    >
      <!-- Menu Header -->
      <div class="menu-header">
        <div class="kong-logo-mask" aria-hidden="true"></div>
        <button
          class="close-button"
          onclick={() => navigationState.closeMobileMenu()}
          aria-label="Close menu"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <!-- Navigation Content -->
      <nav class="menu-nav" role="navigation">
        <div class="nav-section">
          <h2 id="mobile-menu-title" class="sr-only">Main Navigation</h2>
          {#each mobileNavGroups as group (group.title)}
            <MobileNavGroup
              title={group.title}
              options={group.options}
              {activeTab}
              onTabChange={handleTabChange}
              onClose={() => navigationState.closeMobileMenu()}
            />
          {/each}
        </div>

        <!-- Account Section -->
        {#if accountMenuItems.length > 0}
          <div class="account-section">
            <h3 class="section-title">ACCOUNT</h3>
            {#each accountMenuItems as item}
              {#if item.show}
                <MobileMenuItem
                  label={item.label}
                  icon={item.icon}
                  onClick={wrapForMobile(item.onClick)}
                  iconBackground="bg-kong-text-primary/10"
                  badgeCount={item.badgeCount ?? null}
                />
              {/if}
            {/each}
          </div>
        {/if}
      </nav>

      <!-- Mobile Wallet Button -->
      <div class="mobile-wallet-section">
        <NavbarButton
          icon={Wallet}
          label={get(auth).isConnected ? "Wallet" : "Connect Wallet"}
          onClick={handleConnect}
          isSelected={false}
          variant="primary"
          iconSize={20}
          class="w-full !py-5 justify-center"
          {...walletButtonThemeProps}
          isWalletButton={true}
          badgeCount={get(notificationsStore).unreadCount}
          loading={get(isAuthenticating)}
        />
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">

  .mobile-menu-overlay {
    @apply fixed inset-0 z-50;
  }

  .menu-backdrop {
    @apply fixed inset-0 bg-kong-bg-primary/60 backdrop-blur-sm;
  }

  .menu-content {
    @apply fixed top-0 left-0 h-full w-[85%] max-w-[320px] flex flex-col bg-kong-bg-primary border-r border-kong-border shadow-lg;
  }

  @media (max-width: 375px) {
    .menu-content {
      @apply w-[90%] max-w-[300px];
    }
  }

  .menu-header {
    @apply flex items-center justify-between p-5 border-b border-kong-border;
  }

  @media (max-width: 375px) {
    .menu-header {
      @apply p-4;
    }
  }

  .kong-logo-mask {
    @apply h-9 w-9;
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

  .close-button {
    @apply w-9 h-9 flex items-center justify-center rounded-full text-kong-text-secondary hover:text-kong-text-primary bg-kong-text-primary/10 hover:bg-kong-text-primary/15 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kong-primary focus:ring-offset-2;
  }

  .menu-nav {
    @apply flex-1 overflow-y-auto py-3 space-y-3;
  }

  .nav-section {
    @apply px-4 py-2;
  }

  @media (max-width: 375px) {
    .nav-section {
      @apply px-3;
    }
  }

  .account-section {
    @apply px-4 py-2;
  }

  @media (max-width: 375px) {
    .account-section {
      @apply px-3;
    }
  }

  .section-title {
    @apply text-xs font-semibold text-kong-text-secondary/70 px-2 mb-2 tracking-wider;
  }

  .mobile-wallet-section {
    @apply p-2 border-t border-kong-border;
  }

  /* Screen reader only utility */
  .sr-only {
    @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
    clip: rect(0, 0, 0, 0);
  }
</style>