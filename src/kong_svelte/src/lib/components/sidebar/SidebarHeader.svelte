<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import AccountDetails from "./AccountDetails.svelte";
  import { accountStore } from "$lib/stores/accountStore";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import { RefreshCw, IdCard, Coins, History, Droplets } from "lucide-svelte";
  import {
    loadBalances,
    portfolioValue,
  } from "$lib/services/tokens/tokenStore";
  import { auth } from "$lib/services/auth";
  import PortfolioModal from "$lib/components/portfolio/PortfolioModal.svelte";
  import { tooltip } from "$lib/actions/tooltip";

  export let onClose: () => void;
  export let activeTab: "tokens" | "pools" | "history";
  export let setActiveTab: (tab: "tokens" | "pools" | "history") => void;

  let windowWidth: number;
  let isRefreshing = false;
  let showPortfolioModal = false;

  const tabs: { id: "tokens" | "pools" | "history"; icon: any }[] = [
    { id: "tokens", icon: Coins },
    { id: "pools", icon: Droplets },
    { id: "history", icon: History },
  ];

  async function handleReload() {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        await loadBalances($auth?.account?.owner, { forceRefresh: true });
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
</script>

<svelte:window bind:innerWidth={windowWidth} />

<header class="header">
  <div class="header-content p-2 flex items-center justify-between">
    <!-- Left Section -->
    <div class="left-section flex items-center gap-2">
      <button
        class="wallet-button flex gap-x-1 items-center text-kong-text-primary hover:text-kong-primary transition-colors"
        on:click={() => accountStore.showAccountDetails()}
        use:tooltip={{ text: "View Account Details", direction: "bottom" }}
      >
        <IdCard size={18} />
      </button>

      <button
        class="portfolio-button flex items-center text-sm font-mono font-medium text-kong-text-primary hover:text-kong-primary transition-colors"
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
        class="refresh-button text-gray-400 hover:text-white transition-colors"
        on:click={handleReload}
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
        class="action-button"
        aria-label="Disconnect Wallet"
        on:click={handleDisconnect}
        use:tooltip={{ text: "Disconnect Wallet", direction: "bottom" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
          <line x1="12" y1="2" x2="12" y2="12"></line>
        </svg>
      </button>
      <button
        class="action-button !p-1"
        aria-label="Close Sidebar"
        on:click={onClose}
        use:tooltip={{ text: "Close Sidebar", direction: "bottom" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
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
          <span class="relative z-10 text-xs font-semibold">
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
    @apply flex items-center gap-2;
  }

  .right-section {
    @apply flex items-center gap-1.5;
  }

  /* Unified button styles */
  .wallet-button,
  .portfolio-button,
  .refresh-button,
  .action-button {
    @apply p-2 rounded-t-lg text-kong-text-secondary
           hover:bg-kong-bg-light/50 hover:text-kong-text-primary 
           transition-all duration-200;
  }

  .portfolio-button {
    @apply px-2.5 font-mono font-medium;
  }

  /* Tab styles */
  .tab-button {
    @apply py-1 px-2 text-kong-text-secondary font-medium text-base
           transition-all duration-200 border-r border-kong-border/50
           hover:text-kong-text-primary relative overflow-hidden uppercase;
  }

  .tab-button:last-child {
    @apply border-r-0;
  }

  .tab-button.active {
    @apply text-kong-accent-blue font-semibold;
  }

  /* Animation */
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

  /* Override only the bottom padding for the header-content */
  :global(.header-content) {
    padding-bottom: 0 !important;
  }
</style>
