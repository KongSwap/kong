<script lang="ts">
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { walletStore, disconnectWallet } from "$lib/services/wallet/walletStore";
  import AccountDetails from "$lib/components/sidebar/AccountDetails.svelte";
  import "./colors.css";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import { RefreshCw } from "lucide-svelte";
  import { tokenStore, portfolioValue } from "$lib/services/tokens/tokenStore";
  import { onMount } from "svelte";

  export let onClose: () => void;
  export let activeTab: "tokens" | "pools" | "history";
  export let setActiveTab: (tab: "tokens" | "pools" | "history") => void;

  let showAccountDetails = false;
  let windowWidth: number;
  let isRefreshing = false;
  let isLoggedIn = false;

  walletStore.subscribe(async value => {
    isLoggedIn = value.isConnected;
    if (isLoggedIn) {
      await tokenStore.loadBalances()
    }
  });


  onMount(async () => {
    if (isLoggedIn) {
      await tokenStore.loadBalances();
    }
  });

  const tabs: ("tokens" | "pools" | "history")[] = [
    "tokens",
    "pools",
    "history",
  ];

  async function handleReload() {
    isRefreshing = true;
    await tokenStore.loadBalances();
    isRefreshing = false;
  }
</script>

<svelte:window bind:innerWidth={windowWidth} />

<header class="min-w-[250px] backdrop-blur-md">
  <div
    class="flex flex-col gap-3 p-3"
    in:fly={{ x: 400, duration: 300, easing: cubicOut }}
  >
    {#if isLoggedIn}
      <div class="flex items-center justify-between gap-2 flex-nowrap" role="group" aria-label="Wallet information">
        <div class="flex items-center gap-2 flex-1 max-w-[calc(100%-96px)]">
          <button
            class="flex items-center bg-black/25 p-2 rounded-md border border-gray-700 w-full h-10 text-white font-mono text-sm transition-all duration-200 ease-in-out shadow-inner"
            on:click={() => showAccountDetails = true}
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
            class="border border-gray-700 p-1.5 rounded-md text-white cursor-pointer flex items-center justify-center transition-all duration-150 ease shadow-sm w-10 h-10 hover:transform hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-700 group relative"
            on:click={disconnectWallet}
            aria-label="Disconnect wallet"
          >
            <span
              class="pointer-events-none absolute -top-8 z-[1000] left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition before:absolute before:left-1/2 before:bottom-[-6px] before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-900 before:rotate-180 before:content-[''] group-hover:opacity-100"
            >
              Disconnect
            </span>
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
            class="border border-gray-700 p-1.5 rounded-md text-white cursor-pointer flex items-center justify-center transition-all duration-150 ease shadow-sm w-10 h-10 hover:transform hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-700 group relative"
            on:click={onClose}
            aria-label="Close sidebar"
          >
            <span
              class="pointer-events-none absolute -top-8 z-[1000] left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition before:absolute before:left-1/2 before:bottom-[-6px] before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-900 before:rotate-180 before:content-[''] group-hover:opacity-100"
            >
              Close
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="#b53f3f"
              stroke="currentColor"
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
      <div class="portfolio-value mt-4">
        <button
          class="portfolio-refresh-button"
          on:click={handleReload}
          aria-label="Refresh Portfolio Value"
        >
          <h3 class="text-xs uppercase font-semibold">Portfolio Value</h3>
          <p class="text-3xl font-bold font-mono">
            {#if isRefreshing}
              <LoadingIndicator />
            {:else}
              ${$portfolioValue}
            {/if}
          </p>
          <div class="refresh-overlay glow-box">
            <RefreshCw size={24} class="text-lime-400 glow" />
          </div>
        </button>
      </div>
      <nav class="grid grid-cols-3 gap-2 p-1">
        {#each tabs as tab (tab)}
          <button
            class="self-center text-center justify-center bg-transparent w-full flex items-center border-none p-2 text-gray-100 font-alumni text-xl font-semibold cursor-pointer transition-all duration-200 ease-in-out relative"
            class:bg-black={activeTab === tab}
            class:text-lime-300={activeTab === tab}
            on:click={() => setActiveTab(tab)}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${tab}-panel`}
            id={`${tab}-tab`}
          >
            {#if activeTab === tab}
                <img src={`/stats/banana.webp`} class="w-5 h-5 mr-1.5 object-contain" />
            {/if}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {#if activeTab === tab}
                <img src={`/stats/banana.webp`} class="w-5 h-5 ml-1.5 object-contain" />
            {/if}
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
  show={showAccountDetails} 
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
    padding: 12px;
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


  @keyframes glow {
    0% {
      box-shadow: 0 0 10px rgba(163, 230, 53, 0.3),
                  0 0 20px rgba(163, 230, 53, 0.2);
    }
    50% {
      box-shadow: 0 0 20px rgba(163, 230, 53, 0.6),
                  0 0 40px rgba(163, 230, 53, 0.4);
    }
    100% {
      box-shadow: 0 0 10px rgba(163, 230, 53, 0.3),
                  0 0 20px rgba(163, 230, 53, 0.2);
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

  .glow {
    animation: glow-animation 2s infinite alternate;
  }

  @keyframes glow-animation {
    from {
      filter: drop-shadow(0 0 5px #a3e635) drop-shadow(0 0 10px #a3e635);
    }
    to {
      filter: drop-shadow(0 0 15px #a3e635) drop-shadow(0 0 20px #a3e635);
    }
  }
</style>
