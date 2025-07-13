<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import { auth, isAuthenticating } from "$lib/stores/auth";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import { navActions } from "$lib/services/navActions";
  import { ACTION_BUTTONS, shouldShowAction } from "$lib/config/navigation";
  import type { NavAction } from "$lib/config/navigation";
  import { X } from "lucide-svelte";

  // Props
  let { 
    isMobile = false,
    onWalletClick = () => {}
  } = $props();

  // Filter and process buttons based on current state
  let visibleButtons = $derived.by(() => {
    const isDev = navActions.isDevelopment();
    const isConnected = $auth.isConnected;
    
    return ACTION_BUTTONS
      .filter(button => {
        // Filter out mobile-specific buttons for desktop and vice versa
        if (!isMobile) {
          // Desktop: Hide copy account ID and notifications (they're in dropdown/sidebar)
          if (button.id === 'copy-account' || button.id === 'notifications') return false;
        } else {
          // Mobile: Show only essential buttons
          const mobileButtons = ['search', 'copy-principal', 'wallet'];
          if (!mobileButtons.includes(button.id)) return false;
        }
        
        return shouldShowAction(button, isConnected, isDev);
      })
      .map(button => ({
        ...button,
        onClick: () => handleButtonClick(button),
        isLoading: button.id === 'wallet' && $isAuthenticating,
        badgeCount: getBadgeCount(button)
      }));
  });

  function handleButtonClick(action: NavAction) {
    switch (action.id) {
      case 'settings':
        navActions.navigate(action.path!);
        break;
      case 'search':
        navActions.openSearch();
        break;
      case 'faucet':
        navActions.claimTokens();
        break;
      case 'copy-principal':
        navActions.copyPrincipalId();
        break;
      case 'copy-account':
        navActions.copyAccountId();
        break;
      case 'notifications':
        onWalletClick();
        break;
      case 'wallet':
        if ($isAuthenticating) {
          navActions.disconnectWallet();
        } else if (!$auth.isConnected) {
          navActions.connectWallet();
        } else {
          onWalletClick();
        }
        break;
    }
  }

  function getBadgeCount(button: NavAction): number {
    if (button.badge === 'notifications') {
      return $notificationsStore.unreadCount;
    }
    return 0;
  }
</script>

<div
  class="flex items-center overflow-hidden {isMobile
    ? ''
    : 'bg-kong-bg-primary border border-kong-border'} rounded-kong-roundness"
>
  {#each visibleButtons as button, i}
    <button
      class="nav-panel-button {button.id === 'wallet' ? 'wallet-button' : ''} {isMobile
        ? 'mobile'
        : ''} {i === 0 ? 'rounded-l-kong-roundness' : ''} {i === visibleButtons.length - 1 ? 'rounded-r-kong-roundness' : ''}"
      onclick={button.onClick}
      use:tooltip={button.tooltip
        ? { text: button.tooltip, direction: "bottom" }
        : null}
      aria-label={button.tooltip || button.label || "Button"}
    >
      <div class="relative z-10">
        {#if button.isLoading}
          <div class="spinner">
            {#if button.id === 'wallet'}
              <div
                class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                <X size={isMobile ? 14 : 18} />
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
          <Icon size={isMobile ? 14 : 18} />
          {#if button.badgeCount > 0}
            <span
              class="notification-badge absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-kong-error text-white text-[10px] font-medium flex items-center justify-center"
            >
              {button.badgeCount}
            </span>
          {/if}
        {/if}
      </div>

      {#if button.label && !isMobile}
        <span>{button.isLoading ? undefined : button.label}</span>
      {/if}
    </button>
  {/each}
</div>


<style scoped lang="postcss">
  .nav-panel-button {
    @apply h-[34px] px-3 flex items-center gap-1 text-xs font-medium text-kong-text-secondary bg-kong-bg-primary border-none transition-all duration-150 relative overflow-visible rounded-kong-roundness;
  }

  .nav-panel-button:not(:last-child):not(.last-button) {
    @apply border-r border-kong-border/50 rounded-r-kong-roundness;
  }

  /* Use pseudo-element for background to ensure proper clipping */
  .nav-panel-button::before {
    @apply absolute bg-kong-bg-primary transition-all duration-150 -z-10 rounded-l-kong-roundness;
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
    @apply bg-kong-primary text-kong-text-on-primary rounded-kong-roundness;
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
