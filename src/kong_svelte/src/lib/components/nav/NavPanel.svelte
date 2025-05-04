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
  import { loadBalances } from "$lib/stores/tokenStore";
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

  // Props
  let { isMobile = false } = $props();

  // Base config for standard desktop icon buttons
  const baseDesktopIconButton = {
    variant: 'icon' as const,
    isWalletButton: false,
    badgeCount: null,
    label: null,
    type: 'standard' as const,
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
      : ""
  );

  const showFaucetOption = $derived(
    $auth.isConnected && (process.env.DFX_NETWORK === "local" || process.env.DFX_NETWORK === "staging")
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

  function copyAccountId() {
    if (accountId) {
      copyToClipboard(accountId);
    }
  }

  function handleConnect() {
    if (!$auth.isConnected) {
      walletProviderStore.open();
      return;
    }
    const activeTab = $notificationsStore.unreadCount > 0 ? "notifications" : "wallet";
    toggleWalletSidebar(activeTab);
  }

  function toggleWalletSidebar(tab: "notifications" | "chat" | "wallet" = "notifications") {
    walletSidebarActiveTab = tab;
    showWalletSidebar = !showWalletSidebar;
  }

  let showWalletSidebar = $state(false);
  let walletSidebarActiveTab = $state<"notifications" | "chat" | "wallet">("notifications");

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
    }
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
      type: 'copy',
      icon: Copy,
      onClick: copyPrincipalId,
      tooltipText: "Copy Principal ID",
      show: $auth.isConnected,
      label: null,
      class: "",
    },
    // Wallet Button (Specific properties)
    {
      type: 'wallet' as const,
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
    }
  ]);

  // Use the appropriate buttons based on mobile state
  const buttons = $derived(isMobile ? mobileHeaderButtons : desktopButtons);
</script>

<div class="flex items-center {isMobile ? '' : 'bg-kong-bg-dark/50 border border-kong-border/50'} {$panelRoundness} overflow-hidden">
  {#each buttons as button}
    {#if button.show !== false}
      <button
        class="nav-panel-button {button.class || ''} {button.isSelected ? 'selected' : ''} {button.isWalletButton ? 'wallet-button' : ''} {isMobile ? 'mobile' : ''}"
        on:click={button.onClick}
        use:tooltip={button.tooltipText ? { text: button.tooltipText, direction: 'bottom' } : null}
        aria-label={button.tooltipText || button.label || "Button"}
      >
        <div class="relative">
          {#if button.loading}
            <div class="spinner">
              {#if button.isWalletButton}
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <X size={button.iconSize || 18} />
                </div>
                <div class="absolute inset-0 opacity-100 group-hover:opacity-0 transition-opacity duration-200">
                  <div class="spinner-inner"></div>
                </div>
              {/if}
            </div>
          {:else}
            {@const Icon = button.icon}
            <Icon size={button.iconSize || 18} />
            {#if button.badgeCount > 0}
              <span class="absolute {isMobile ? '-top-2 -left-2' : '-top-3 -left-3'} w-4 h- z-20 rounded-full bg-kong-accent-red text-white text-[10px] font-medium flex items-center justify-center z-10">
                {button.badgeCount}
              </span>
            {/if}
          {/if}
        </div>
        
        {#if button.label && !isMobile}
          <span>{button.loading ? undefined : button.label}</span>
        {/if}
      </button>
    {/if}
  {/each}
</div>

<WalletSidebar
  isOpen={showWalletSidebar}
  activeTab={walletSidebarActiveTab}
  onClose={() => showWalletSidebar = false}
/>

<style scoped lang="postcss">
  .nav-panel-button {
    @apply h-[34px] px-3 flex items-center gap-1.5 text-xs font-medium text-kong-text-secondary bg-kong-bg-dark border-none transition-all duration-150;
  }

  .nav-panel-button:not(:last-child) {
    @apply border-r border-kong-border/50;
  }

  .nav-panel-button:hover {
    @apply bg-kong-primary text-kong-text-light;
  }

  .nav-panel-button.selected {
    @apply bg-kong-primary/40 text-kong-text-primary;
  }

  .nav-panel-button.wallet-button {
    @apply text-kong-primary hover:bg-kong-primary hover:text-kong-text-light;
  }

  .nav-panel-button.mobile {
    @apply h-[34px] w-[34px] flex items-center justify-center;
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
    to { transform: rotate(360deg); }
  }
</style> 