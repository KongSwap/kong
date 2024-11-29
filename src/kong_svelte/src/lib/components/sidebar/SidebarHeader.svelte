<script lang="ts">
  import AccountDetails from "./AccountDetails.svelte";
  import { accountStore } from "$lib/stores/accountStore";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import "./colors.css";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import { RefreshCw, Maximize2, Minimize2 } from "lucide-svelte";
  import { tokenStore, portfolioValue } from "$lib/services/tokens/tokenStore";
  import { auth } from "$lib/services/auth";

  export let onClose: () => void;
  export let activeTab: "tokens" | "pools" | "history";
  export let setActiveTab: (tab: "tokens" | "pools" | "history") => void;

  let windowWidth: number;
  let isRefreshing = false;
  let isExpanded = false;
  let showAccountDetails = false;

  sidebarStore.subscribe(state => {
    isExpanded = state.isExpanded;
  });

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

<header class="min-w-[250px] backdrop-blur-md">
  <div class="flex flex-col gap-2 py-2">
    {#if $auth.isConnected}
      <div class="flex items-center justify-between gap-2 flex-nowrap" role="group" aria-label="Wallet information">
        <div class="flex items-center gap-2 flex-1 max-w-[calc(100%-144px)]">
          <button
            class="flex items-center bg-black/25 p-2 rounded-md border border-gray-700 w-full h-10 text-white font-mono text-sm transition-all duration-200 ease-in-out shadow-inner"
            on:click={() => accountStore.showAccountDetails()}
            aria-label="View account details"
          >
            <span class="flex items-center justify-between w-full">
              Account Details
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="ml-2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          </button>
        </div>
        <div class="flex gap-2">
          <button
            class="expand-btn border border-gray-700 p-1.5 rounded-md text-white cursor-pointer flex items-center justify-center transition-all duration-150 ease shadow-sm w-10 h-10 hover:transform hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-700"
            on:click={() => sidebarStore.toggleExpand()}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {#if isExpanded}
              <Minimize2 size={22} />
            {:else}
              <Maximize2 size={22} />
            {/if}
          </button>
          <button
            class="border border-gray-700 p-1.5 rounded-md text-white cursor-pointer flex items-center justify-center transition-all duration-150 ease shadow-sm w-10 h-10 hover:transform hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-700"
            on:click={handleDisconnect}
            aria-label="Disconnect wallet"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
              <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
          </button>
          <button
            class="border border-gray-700 p-1.5 rounded-md text-white cursor-pointer flex items-center justify-center transition-all duration-150 ease shadow-sm w-10 h-10 hover:transform hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-700"
            on:click={onClose}
            aria-label="Close sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="#b53f3f"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="portfolio-value mt-2">
        <button
          class="portfolio-refresh-button"
          on:click={handleReload}
          aria-label="Refresh Portfolio Value"
        >
          <h3 class="text-xs uppercase font-semibold">Total Value</h3>
          <p class="text-2xl font-bold font-mono">
            {#if isRefreshing}
              <LoadingIndicator />
            {:else}
              {$portfolioValue}
            {/if}
          </p>
          <div class="refresh-overlay glow-box">
            <RefreshCw size={24} class="text-lime-400 glow" />
          </div>
        </button>
      </div>
      <nav class="grid grid-cols-3 rounded-lg overflow-hidden">
        {#each tabs as tab (tab)}
          <button
            class="tab-button relative py-2.5 px-4 text-gray-300 font-semibold text-lg transition-all duration-200 hover:text-white"
            class:active-tab={activeTab === tab}
            on:click={() => setActiveTab(tab)}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${tab}-panel`}
            id={`${tab}-tab`}
          >
            <div class="flex items-center justify-center gap-2">
              {#if activeTab === tab}
                <img src={`/stats/banana.webp`} class="w-5 h-5 object-contain" alt="" />
              {/if}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {#if activeTab === tab}
                <img src={`/stats/banana.webp`} class="w-5 h-5 object-contain" alt="" />
              {/if}
            </div>
          </button>
        {/each}
      </nav>
    {:else}
      <div class="flex items-center justify-between gap-2 flex-nowrap" role="group" aria-label="Wallet selection">
        <h1 id="wallet-select-title" class="font-mono text-lg text-gray-500 m-0 font-semibold py-1.5">Select Wallet</h1>
        <div class="flex gap-2">
          <button
            class="border border-gray-700 p-1.5 rounded-md text-white cursor-pointer flex items-center justify-center transition-all duration-150 ease shadow-sm w-10 h-10 hover:transform hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-700"
            on:click={onClose}
            aria-label="Close sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="#ff4444"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    {/if}
  </div>
</header>

<AccountDetails 
  onClose={() => showAccountDetails = false}
/>

<style scoped>
    .portfolio-value {
    position: relative;
    text-align: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    transition: transform 0.2s ease;
    :hover {
      backdrop-filter: blur(10px);
    }
  }

  .portfolio-value:hover {
    transform: scale(1.02);
  }

  .portfolio-refresh-button {
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    padding: 8px;
    border-radius: 6px;
    transition: all 0.2s ease;
    z-index: 0;
  }

  .portfolio-refresh-button:active {
    transform: scale(0.98);
  }

  .refresh-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(7px);
    opacity: 0;
    transition: all 0.3s ease;
    color: white;
    gap: 8px;
    z-index: 1;
  }

  .refresh-overlay :global(svg) {
    transition: transform 0.3s ease;
  }

  .portfolio-refresh-button:hover .refresh-overlay :global(svg) {
    transform: rotate(180deg);
  }

  .portfolio-refresh-button:hover .refresh-overlay,
  .portfolio-refresh-button:focus-visible .refresh-overlay {
    opacity: 0.85;
    backdrop-filter: blur(7px);
  }

  .tab-button {
    background: rgba(0, 0, 0, 0.1);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tab-button:last-child {
    border-right: none;
  }

  .tab-button:hover {
    background: rgba(0, 0, 0, 0.2);
  }

  .active-tab {
    background: rgba(59, 130, 246, 0.2) !important;
    color: #3b82f6 !important;
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
  }

  @keyframes glow {
    0% {
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.3),
                  0 0 20px rgba(59, 130, 246, 0.2);
    }
    50% {
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.6),
                  0 0 40px rgba(59, 130, 246, 0.4);
    }
    100% {
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.3),
                  0 0 20px rgba(59, 130, 246, 0.2);
    }
  }

  .glow-box {
    animation: glow 2s ease-in-out infinite;
    border-radius: 6px;
    z-index: 2;
  }

  .portfolio-refresh-button:hover .refresh-overlay {
    opacity: 0.85;
  }

  @keyframes glow-animation {
    from {
      filter: drop-shadow(0 0 5px #a3e635) drop-shadow(0 0 10px #a3e635);
    }
    to {
      filter: drop-shadow(0 0 15px #a3e635) drop-shadow(0 0 20px #a3e635);
    }
  }

  @media (max-width: 768px) {
    .expand-btn {
      display: none;
    }
  }
</style>
