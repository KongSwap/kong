<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import AccountDetails from "./AccountDetails.svelte";
  import { accountStore } from "$lib/stores/accountStore";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import { RefreshCw, IdCard, Coins, History, Droplets, X, Power } from "lucide-svelte";
  import {
    loadBalances,
    portfolioValue,
  } from "$lib/services/tokens/tokenStore";
  import { auth } from "$lib/services/auth";
  import PortfolioModal from "$lib/components/portfolio/PortfolioModal.svelte";
  import { tooltip } from "$lib/actions/tooltip";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { onDestroy } from "svelte";

  export let onClose: () => void;
  export let activeTab: "tokens" | "pools" | "history";
  export let setActiveTab: (tab: "tokens" | "pools" | "history") => void;

  let windowWidth: number;
  let isRefreshing = false;
  let showPortfolioModal = false;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const tabs: { id: "tokens" | "pools" | "history"; icon: any }[] = [
    { id: "tokens", icon: Coins },
    { id: "pools", icon: Droplets },
    { id: "history", icon: History },
  ];

  async function handleReload(isPolling = false) {
    if (!isRefreshing) {
      isRefreshing = isPolling === true ? false : true;
      try {
        const currentWalletId = $auth?.account?.owner?.toString();
        if (currentWalletId) {
          // Load balances and update stores
          await loadBalances(currentWalletId, { forceRefresh: true });
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
    showPortfolioModal = true;
  }

  function startPolling() {
    // Don't start a new poll if one is already running
    if (pollInterval) return;
  
    
    // Set up new interval
    pollInterval = setInterval(() => handleReload(true), 20000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  // Modify the reactive statement to prevent unnecessary polling restarts
  $: if ($sidebarStore.isOpen && !pollInterval) {
    startPolling();
  } else if (!$sidebarStore.isOpen && pollInterval) {
    stopPolling();
  }

  // Cleanup on component destruction
  onDestroy(() => {
    stopPolling();
  });
</script>

<svelte:window bind:innerWidth={windowWidth} />

<header class="header pt-1.5">
  <div class="header-content px-1 flex items-center justify-between">
    <!-- Left Section -->
    <div class="left-section flex items-center gap-2 text-sm">
      <button
        class="wallet-button flex gap-x-1 items-center text-kong-text-primary hover:text-kong-primary transition-colors"
        on:click={() => accountStore.showAccountDetails()}
        use:tooltip={{ text: "View Account Details", direction: "bottom" }}
      >
        <IdCard size={18} />
        My Addresses
      </button>

      <button
        class="portfolio-button flex items-center font-medium text-kong-text-primary hover:text-kong-primary transition-colors"
        on:click={handlePortfolioClick}
        use:tooltip={{ text: "View Portfolio Distribution", direction: "bottom" }}
      >
        {#if isRefreshing}
          <LoadingIndicator />
        {:else}
          {formatUsdValue($portfolioValue || 0)}
        {/if}
      </button>

      <button
        class="refresh-button text-gray-400 hover:text-white transition-colors !px-2 !py-2"
        on:click={() => handleReload(false)}
        disabled={isRefreshing}
        use:tooltip={{ text: "Refresh Portfolio", direction: "bottom" }}
      >
        <span class:animate-spin={isRefreshing}>
          <RefreshCw size={18} />
        </span>
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

<PortfolioModal
  isOpen={showPortfolioModal}
  onClose={() => (showPortfolioModal = false)}
/>

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
