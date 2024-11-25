<script lang="ts">
  import AccountDetails from "./AccountDetails.svelte";
  import { accountStore } from "$lib/stores/accountStore";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import "./colors.css";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import { RefreshCw, Maximize2, Minimize2 } from "lucide-svelte";
  import { tokenStore, portfolioValue } from "$lib/services/tokens/tokenStore";
  import { auth } from "$lib/services/auth";
  import { onMount } from "svelte";

  export let onClose: () => void;
  export let activeTab: "tokens" | "pools" | "history";
  export let setActiveTab: (tab: "tokens" | "pools" | "history") => void;

  let windowWidth: number;
  let isRefreshing = false;
  let loadingInitialBalances = true;
  let isLoggedIn = false;
  let isExpanded = false;
  let showAccountDetails = false;

  sidebarStore.subscribe(state => {
    isExpanded = state.isExpanded;
  });

  // Subscribe to auth changes to reload balances when needed
  $: if ($auth.isConnected) {
    loadInitialBalances();
  }

  onMount(() => {
    if ($auth.isConnected) {
      loadInitialBalances();
    }
  });

  async function loadInitialBalances() {
    if (loadingInitialBalances) {
      try {
        await tokenStore.loadBalances($auth?.account?.owner);
      } finally {
        loadingInitialBalances = false;
      }
    }
  }

  const tabs: ("tokens" | "pools" | "history")[] = [
    "tokens",
    "pools",
    "history",
  ];

  async function handleReload() {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        await tokenStore.loadBalances($auth?.account?.owner);
      } finally {
        isRefreshing = false;
      }
    }
  }

  async function handleDisconnect() {
    await auth.disconnect();
    showAccountDetails = false;
    onClose();
  }
</script>

<svelte:window bind:innerWidth={windowWidth} />

<header class="sidebar-header-root">
  <div class="header-container">
    {#if $auth.isConnected}
      <div class="header-content" role="group" aria-label="Wallet information">
        <button
          class="account-button"
          on:click={() => accountStore.showAccountDetails()}
          aria-label="View account details"
        >
          <div class="status-indicator" />
          <span class="account-text">Account Details</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="chevron-icon"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <div class="action-buttons">
          <button
            class="icon-button"
            on:click={handleReload}
            disabled={isRefreshing}
            aria-label="Refresh balances"
          >
            <RefreshCw
              size={18}
              class={isRefreshing ? 'animate-spin' : ''}
            />
          </button>
          
          <button
            class="icon-button"
            on:click={() => sidebarStore.toggle()}
            aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {#if isExpanded}
              <Minimize2 size={18} />
            {:else}
              <Maximize2 size={18} />
            {/if}
          </button>
        </div>
      </div>

      <nav class="tab-navigation" role="tablist">
        {#each tabs as tab}
          <button
            role="tab"
            class="tab-button"
            class:active={activeTab === tab}
            on:click={() => setActiveTab(tab)}
            aria-selected={activeTab === tab}
            aria-controls={`${tab}-panel`}
          >
            {tab}
          </button>
        {/each}
      </nav>
    {:else}
      <div class="header-content" role="group" aria-label="Wallet selection">
        <h1 class="wallet-title">Select Wallet</h1>
        <div class="action-buttons">
          <button
            class="icon-button"
            on:click={() => sidebarStore.toggle()}
            aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {#if isExpanded}
              <Minimize2 size={18} />
            {:else}
              <Maximize2 size={18} />
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</header>

<AccountDetails 
  onClose={() => showAccountDetails = false}
/>

<style lang="postcss">
  .sidebar-header-root {
    @apply min-w-[250px] backdrop-blur-md border-b border-white/5;
  }

  .header-container {
    @apply flex flex-col gap-4 p-4;
  }

  .header-content {
    @apply flex items-center justify-between gap-3 flex-nowrap;
  }

  .account-button {
    @apply flex items-center flex-1 max-w-[calc(100%-88px)]
           bg-black/20 hover:bg-black/30 px-4 py-2.5 rounded-xl
           border border-white/5 text-white font-mono text-sm
           transition-all duration-200;
  }

  .status-indicator {
    @apply w-2 h-2 rounded-full bg-green-400 
           shadow-lg shadow-green-400/20 mr-3;
  }

  .account-text {
    @apply flex-1 text-left font-medium text-white/90;
  }

  .chevron-icon {
    @apply opacity-50;
  }

  .action-buttons {
    @apply flex items-center gap-2;
  }

  .icon-button {
    @apply p-2.5 rounded-xl bg-black/20 hover:bg-black/30
           border border-white/5 text-white/70 hover:text-white
           transition-all duration-200 disabled:opacity-50;
  }

  .tab-navigation {
    @apply flex gap-2 px-1;
  }

  .tab-button {
    @apply flex-1 px-4 py-2 rounded-lg text-sm font-medium
           text-white/50 hover:text-white/70 transition-all
           capitalize;
  }

  .tab-button.active {
    @apply bg-white/5 text-white;
  }

  .wallet-title {
    @apply font-mono text-lg text-white/50 m-0 font-semibold py-1.5;
  }
</style>
