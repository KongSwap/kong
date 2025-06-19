<script lang="ts">
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { tooltip } from "$lib/actions/tooltip";
  import { auth } from "$lib/stores/auth";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import { isAuthenticating } from "$lib/stores/auth";
  import { goto } from "$app/navigation";
  import { searchStore } from "$lib/stores/searchStore";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import { faucetClaim } from "$lib/api/tokens/TokenApiClient";
  import { getAccountIds } from "$lib/utils/accountUtils";
  import { loadBalances } from "$lib/stores/balancesStore";
  import { userTokens } from "$lib/stores/userTokens";
  import {
    Droplet,
    Settings as SettingsIcon,
    Copy,
    Search,
    Wallet,
    X,
  } from "lucide-svelte";
  import WalletSidebar from "$lib/components/common/WalletSidebar.svelte";
  import { walletSidebarStore } from "$lib/stores/walletSidebarStore";

  // Props
  let { isMobile = false } = $props();

  // Helper function to get the directional rounding class part
  function getRoundingSuffix(roundness: string | null): string {
    if (!roundness || roundness === 'rounded-none') return 'none';
    if (roundness === 'rounded') return ''; // For base 'rounded', suffix is empty -> rounded-l/rounded-r
    return `-${roundness.substring(8)}`; // e.g., "rounded-lg" -> "-lg"
  }
  
  // Compute directional classes reactively
  let roundingSuffix = $derived(getRoundingSuffix($panelRoundness));
  let leftRoundnessClass = $derived(roundingSuffix === 'none' ? '' : `rounded-l${roundingSuffix}`);
  let rightRoundnessClass = $derived(roundingSuffix === 'none' ? '' : `rounded-r${roundingSuffix}`);

  // Base config for standard desktop icon buttons
  const baseDesktopIconButton = {
    variant: "icon" as const,
    isWalletButton: false,
    badgeCount: null,
    label: null,
    type: "standard" as const,
    isSelected: false,
    loading: false,
    iconSize: 18,
    class: "",
  };

  // Base config for mobile header buttons
  const baseMobileHeaderButton = {
    variant: "mobile" as const,
    iconSize: 14,
    isSelected: false,
    isWalletButton: false,
    badgeCount: null,
    show: true,
    loading: false,
    clickableDuringLoading: false,
  };

  // Compute account ID reactively
  let accountId = $derived(
    $auth.isConnected && $auth.account?.owner
      ? getAccountIds($auth.account.owner, $auth.account.subaccount).main
      : "",
  );

  const showFaucetOption = $derived(
    $auth.isConnected &&
      (process.env.DFX_NETWORK === "local" ||
        process.env.DFX_NETWORK === "staging"),
  );

  async function claimTokens() {
    await faucetClaim();
    await loadBalances($userTokens.tokens, $auth.account.owner, true);
  }

  function handleOpenSearch() {
    searchStore.open();
  }

  function copyPrincipalId() {
    const principalToCopy = $auth?.account?.owner;
    if (principalToCopy) {
      copyToClipboard(principalToCopy);
    }
  }

  function handleConnect() {
    if (!$auth.isConnected) {
      walletProviderStore.open();
      return;
    }
    const activeTab =
      $notificationsStore.unreadCount > 0 ? "notifications" : "wallet";
    toggleWalletSidebar(activeTab);
  }

  function toggleWalletSidebar(tab: "notifications" | "chat" | "wallet" = "notifications") {
    walletSidebarStore.setActiveTab(tab);
    walletSidebarStore.toggle();
  }

  // Subscribe to wallet sidebar store
  const showWalletSidebar = $derived($walletSidebarStore.isOpen);
  const walletSidebarActiveTab = $derived($walletSidebarStore.activeTab);

  const mobileHeaderButtons = $derived([
    {
      ...baseMobileHeaderButton,
      icon: Search,
      onClick: handleOpenSearch,
      tooltipText: "",
      label: null,
      class: "",
    },
    {
      ...baseMobileHeaderButton,
      icon: Copy,
      onClick: copyPrincipalId,
      tooltipText: "Copy Principal ID",
      show: $auth.isConnected,
      label: null,
      class: "",
    },
    {
      ...baseMobileHeaderButton,
      icon: Wallet,
      onClick: () => {
        if ($isAuthenticating) {
          auth.disconnect();
        } else {
          handleConnect();
        }
      },
      isSelected: showWalletSidebar && walletSidebarActiveTab === "wallet",
      isWalletButton: true,
      badgeCount: $notificationsStore.unreadCount,
      loading: $isAuthenticating,
      disabled: false,
      tooltipText: "",
      label: null,
      class: "",
    },
  ]);

  const desktopButtons = $derived([
    {
      ...baseDesktopIconButton,
      icon: SettingsIcon,
      onClick: () => goto("/settings"),
      tooltipText: "",
      show: true,
      label: null,
      class: "",
    },
    {
      ...baseDesktopIconButton,
      icon: Search,
      onClick: handleOpenSearch,
      tooltipText: "",
      show: true,
      label: null,
      class: "",
    },
    {
      ...baseDesktopIconButton,
      icon: Droplet,
      onClick: claimTokens,
      tooltipText: "Claim test tokens",
      show: showFaucetOption,
      label: null,
      class: "",
    },
    {
      ...baseDesktopIconButton,
      type: "copy",
      icon: Copy,
      onClick: copyPrincipalId,
      tooltipText: "Copy Principal ID",
      show: $auth.isConnected,
      label: null,
      class: "",
    },
    // Wallet Button (Specific properties)
    {
      type: "wallet" as const,
      icon: Wallet,
      onClick: () => {
        if ($isAuthenticating) {
          auth.disconnect();
        } else {
          handleConnect();
        }
      },
      isSelected: showWalletSidebar && walletSidebarActiveTab === "wallet",
      show: true,
      isWalletButton: true,
      badgeCount: $notificationsStore.unreadCount,
      tooltipText: null,
      loading: $isAuthenticating,
      disabled: false,
      label: null,
      class: "",
      iconSize: 18,
    },
  ]);

  // Use the appropriate buttons based on mobile state
  const buttons = $derived(isMobile ? mobileHeaderButtons : desktopButtons);
  
  // Filter visible buttons for proper indexing
  const visibleButtons = $derived(buttons.filter(button => button.show !== false));
</script>

<div
  class="flex items-center overflow-hidden {isMobile
    ? ''
    : 'bg-kong-bg-primary/50 border border-kong-border/50'} {$panelRoundness}"
>
  {#each visibleButtons as button, i}
    <button
      class="nav-panel-button {button.class || ''} {button.isSelected
        ? 'selected'
        : ''} {button.isWalletButton ? 'wallet-button' : ''} {isMobile
        ? 'mobile'
        : ''} {i === 0 ? 'first-button' : ''} {i === visibleButtons.length - 1 ? 'last-button' : ''} {i === 0 ? leftRoundnessClass : ''} {i === visibleButtons.length - 1 ? rightRoundnessClass : ''}"
      onclick={button.onClick}
      use:tooltip={button.tooltipText
        ? { text: button.tooltipText, direction: "bottom" }
        : null}
      aria-label={button.tooltipText || button.label || "Button"}
    >
        <div class="relative z-10">
          {#if button.loading}
            <div class="spinner">
              {#if button.isWalletButton}
                <div
                  class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  <X size={button.iconSize || 18} />
                </div>
                <div
                  class="absolute inset-0 opacity-100 group-hover:opacity-0 transition-opacity duration-200"
                >
                  <div class="spinner-inner"></div>
                </div>
              {/if}
            </div>
          {:else}
            {@const Icon = button.icon}
            <Icon size={button.iconSize || 18} />
            {#if button.badgeCount > 0}
              <span
                class="notification-badge absolute {isMobile
                  ? '-top-2 -right-2'
                  : '-top-2 -right-2'} min-w-[16px] h-4 px-1 rounded-full bg-kong-error text-white text-[10px] font-medium flex items-center justify-center"
              >
                {button.badgeCount}
              </span>
            {/if}
          {/if}
        </div>

        {#if button.label && !isMobile}
          <span>{button.loading ? undefined : button.label}</span>
        {/if}
      </button>
  {/each}
</div>

<WalletSidebar
  isOpen={showWalletSidebar}
  activeTab={walletSidebarActiveTab}
  onClose={() => walletSidebarStore.close()}
/>

<style scoped lang="postcss">
  .nav-panel-button {
    @apply h-[34px] px-3 flex items-center gap-1 text-xs font-medium text-kong-text-secondary bg-kong-bg-primary border-none transition-all duration-150 relative overflow-visible rounded-xl;
  }

  .nav-panel-button:not(:last-child):not(.last-button) {
    @apply border-r border-kong-border/50;
  }

  /* Use pseudo-element for background to ensure proper clipping */
  .nav-panel-button::before {
    @apply absolute bg-kong-bg-primary transition-all duration-150 -z-10;
    content: '';
    border-radius: inherit;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .nav-panel-button:hover::before {
    @apply bg-kong-primary;
  }

  .nav-panel-button:hover {
    @apply bg-kong-primary text-kong-text-on-primary rounded-xl;
  }

  .nav-panel-button.selected {
    @apply text-kong-text-on-primary;
  }

  .nav-panel-button.wallet-button {
    @apply text-kong-primary;
  }

  .nav-panel-button.wallet-button:hover::before {
    @apply bg-kong-primary;
  }

  .nav-panel-button.wallet-button:hover {
    @apply text-kong-text-on-primary;
  }

  .nav-panel-button.mobile {
    @apply h-[34px] w-[34px] flex items-center justify-center;
  }
  
  /* Allow notification badge to overflow */
  .notification-badge {
    @apply z-50;
  }

  .spinner {
    width: 18px;
    height: 18px;
    position: relative;
  }

  .spinner-inner {
    width: 100%;
    height: 100%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: currentColor;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
