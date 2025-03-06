<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import AccountDetails from "./AccountDetails.svelte";
  import { accountStore } from "$lib/stores/accountStore";
  import {
    RefreshCw,
    IdCard,
    Coins,
    History,
    Droplets,
    X,
    Power,
    Loader2,
  } from "lucide-svelte";
  import {
    loadBalances,
    portfolioValue,
    isUpdatingPortfolio
  } from "$lib/stores/tokenStore";
  import { auth } from "$lib/services/auth";
  import { tooltip } from "$lib/actions/tooltip";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { onDestroy, onMount } from "svelte";
  import { startPolling, stopPolling } from "$lib/utils/pollingService";
  import { goto } from "$app/navigation";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { get } from "svelte/store";

  export let onClose: () => void;
  export let activeTab: "tokens" | "pools" | "history";
  export let setActiveTab: (tab: "tokens" | "pools" | "history") => void;

  let windowWidth: number;
  let isRefreshing = false;

  const tabs: { id: "tokens" | "pools" | "history"; icon: any }[] = [
    { id: "tokens", icon: Coins },
    { id: "pools", icon: Droplets },
    { id: "history", icon: History },
  ];

  // Initialize both token and pool data when component mounts
  onMount(async () => {
    if ($auth.isConnected) {
      isRefreshing = true;
      try {
        const currentWalletId = $auth?.account?.owner?.toString();
        if (currentWalletId) {
          // Load both tokens and pools in parallel on first load
          await Promise.all([
            loadBalances(get(userTokens).tokens, currentWalletId, true),
            currentUserPoolsStore.initialize()
          ]);
        }
      } finally {
        isRefreshing = false;
      }
    }
  });

  async function handleReload(isPolling = false) {
    if (!isRefreshing) {
      isRefreshing = isPolling === true ? false : true;
      try {
        const currentWalletId = $auth?.account?.owner?.toString();
        if (currentWalletId) {
          // Set the updating flag to true before starting updates
          isUpdatingPortfolio.set(true);
          
          // Load balances and pool data in parallel
          await Promise.all([
            // Load balances and update stores
            loadBalances(get(userTokens).tokens, currentWalletId, true),
            
            // Initialize pool data to ensure portfolio value is accurate
            currentUserPoolsStore.initialize()
          ]);
          
          // Both operations are now complete, set updating flag to false
          isUpdatingPortfolio.set(false);
        }
      } finally {
        isRefreshing = false;
      }
    }
  }

  async function handleDisconnect() {
    await auth.disconnect();
    onClose();
  }

  function handlePortfolioClick() {
    goto(`/wallets/${$auth?.account?.owner?.toString()}`);
    sidebarStore.collapse();
  }

  // Use the generic polling service in a reactive block
  $: {
    if ($sidebarStore.isOpen) {
      startPolling("sidebarHeader", () => handleReload(true), 20000);
    } else {
      stopPolling("sidebarHeader");
    }
  }

  // Cleanup on component destruction
  onDestroy(() => {
    stopPolling("sidebarHeader");
  });
</script>

<svelte:window bind:innerWidth={windowWidth} />

<header class="header pt-1.5">
  <div class="header-content px-1 flex items-center justify-between">
    <!-- Left Section -->
    <div class="left-section flex items-center gap-2 text-sm">
      <button
        class="wallet-button text-nowrap flex gap-x-1 items-center text-kong-text-primary hover:text-kong-primary transition-colors"
        on:click={() => accountStore.showAccountDetails()}
        use:tooltip={{ text: "View Account Details", direction: "bottom" }}
      >
        <IdCard size={18} />
        My Addresses
      </button>

      <button
        class="portfolio-button flex items-center font-medium text-kong-text-primary hover:text-kong-primary transition-colors"
        on:click={handlePortfolioClick}
        use:tooltip={{
          text: "View Portfolio Distribution",
          direction: "bottom",
        }}
      >
        {#if isRefreshing || $isUpdatingPortfolio}
          <span class="animate-spin mr-1">
            <Loader2 size={18} />
          </span>
        {:else}
          {formatUsdValue($portfolioValue || 0)}
        {/if}
      </button>

      <button
        class="refresh-button text-gray-400 hover:text-white transition-colors !px-1 !py-2"
        on:click={() => handleReload(false)}
        disabled={isRefreshing || $isUpdatingPortfolio}
        use:tooltip={{ text: "Refresh Portfolio", direction: "bottom" }}
      >
          <RefreshCw size={18} />
      </button>
    </div>

    <!-- Right Section -->
    <div class="right-section flex items-center gap-1.5">
      <button
        class="action-button !px-2 !py-2"
        aria-label="Disconnect Wallet"
        on:click={handleDisconnect}
        use:tooltip={{ text: "Disconnect Wallet", direction: "bottom" }}
      >
        <Power size={20} />
      </button>
      <button
        class="action-button !px-2 !py-2"
        aria-label="Close Sidebar"
        on:click={onClose}
        use:tooltip={{ text: "Close Sidebar", direction: "bottom" }}
      >
        <X size={22} />
      </button>
    </div>
  </div>

  <!-- Tabs Navigation -->

  <nav
    class="flex rounded-t-lg bg-kong-bg-light/50 border border-kong-border mx-2"
  >
    {#each tabs as { id, icon } (id)}
      <button
        class="tab-button flex-1 relative"
        class:active={activeTab === id}
        on:click={() => setActiveTab(id)}
        role="tab"
        aria-selected={activeTab === id}
        aria-controls={`${id}-panel`}
        id={`${id}-tab`}
      >
        <div class="flex items-center justify-center gap-1.5 py-2">
          {#if activeTab === id}
            <div class="absolute inset-0 bg-kong-accent-blue/5" />
            <div
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-kong-accent-blue"
            />
          {/if}
          <svelte:component this={icon} size={14} />
          <span class="relative z-10 text-sm">
            {id.charAt(0).toUpperCase() + id.slice(1)}
          </span>
        </div>
      </button>
    {/each}
  </nav>
</header>

<AccountDetails />

<style scoped lang="postcss">
  .header {
    @apply min-w-[250px] shadow-sm w-full
           bg-gradient-to-b from-kong-bg-dark/30 to-transparent;
  }

  .header-content {
    @apply flex items-center justify-between;
  }

  .left-section {
    @apply flex items-center gap-1;
  }

  .right-section {
    @apply flex items-center gap-1.5;
  }

  /* Unified button styles */
  .wallet-button,
  .portfolio-button,
  .refresh-button,
  .action-button {
    @apply px-1 pt-2 pb-3 rounded-t-lg text-kong-text-secondary text-base
           hover:bg-kong-bg-light/50 hover:text-kong-text-primary 
           transition-all duration-200;
  }

  .portfolio-button {
    @apply px-2.5 font-medium;
  }

  .tab-button {
    @apply py-1 px-2 text-kong-text-secondary font-medium
           transition-all duration-200 border-r border-kong-border/50
           hover:text-kong-text-primary relative overflow-hidden;
  }

  .tab-button:last-child {
    @apply border-r-0;
  }

  .tab-button.active {
    @apply text-kong-accent-blue font-semibold;
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  :global(.header-content) {
    padding-bottom: 0 !important;
  }
</style>
