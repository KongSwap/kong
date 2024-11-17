<script lang="ts">
  import Button from "../common/Button.svelte";
  import Sidebar from "../sidebar/Sidebar.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { t } from "$lib/services/translations";
  import { walletStore } from "$lib/services/wallet/walletStore";
  import { fade } from "svelte/transition";
  import Modal from "../common/Modal.svelte";
  import Settings from "../settings/Settings.svelte";

  type Tab = "swap" | "earn" | "stats";

  let activeTab: Tab = "swap";
  let sidebarOpen = false;
  let isMobile = false;
  let isSpinning = false;
  let navOpen = false;
  let isModalOpen = false;
  const tabs: Tab[] = ["swap", "earn"];
  const titles = {
    swap: {
      desktop: "/titles/swap_title.webp",
      mobile: "/titles/swap_title.webp",
    },
    earn: {
      desktop: "/titles/swap_title.webp",
      mobile: "/titles/swap_title.webp",
    },
    stats: {
      desktop: "/titles/stats_title.webp",
      mobile: "/titles/stats_title.webp",
    },
  };

  $: activeTab = determineActiveTab($page.url.pathname);

  function handleTabChange(tab: Tab) {
    if (activeTab === tab && $page.url.pathname === `/${tab}`) {
      navOpen = false;
      return;
    }
    goto(`/${tab}`);
    navOpen = false;
  }

  function handleConnect() {
    sidebarOpen = !sidebarOpen;
  }

  function handleResize() {
    if (browser) {
      isMobile = window.innerWidth <= 1024;
    }
  }

  function determineActiveTab(path: string): Tab {
    return path.includes("stats")
      ? "stats"
      : path.includes("earn")
        ? "earn"
        : "swap";
  }

  onMount(() => {
    const path = $page.url.pathname;
    activeTab = determineActiveTab(path);
    handleResize();

    if (browser) {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  });

  function handleCloseModal() {
    isModalOpen = false;
  }

  $: {
    const path = $page.url.pathname;
    activeTab = determineActiveTab(path);
  }

  $: titleImage = isMobile
    ? titles[activeTab].mobile
    : titles[activeTab].desktop;
</script>

<nav class="w-full z-50 px-1 py-4 max-w-6xl mx-auto">
  <div class="grid grid-cols-12 gap-4">
    <div class="col-span-2 flex items-center h-16">
      {#if isMobile}
        <button
          class="text-3xl text-white hover:text-gray-300 transition-colors nav-icon h-full flex items-center px-2"
          on:click={() => (navOpen = !navOpen)}
        >
          ☰
        </button>
      {:else}
        <div class="flex gap-6 ml-2">
          {#each tabs as tab}
            <Button
              text={tab.toUpperCase()}
              variant="blue"
              size="medium"
              state={activeTab === tab ? "selected" : "default"}
              onClick={() => handleTabChange(tab)}
            />
          {/each}
        </div>
      {/if}
    </div>

    <div class="col-span-8 flex justify-center items-center">
      <div class="w-full flex items-center justify-center">
        <a href={`/${activeTab}`} class="hover:opacity-90 transition-opacity">
          <img
            src={titleImage}
            alt={activeTab}
            class="object-contain h-16"
          />
        </a>
      </div>
    </div>

    <div class="col-span-2 flex items-center justify-end h-16">
      {#if isMobile}
        <button
          class="text-white hover:text-gray-300 transition-colors nav-icon h-full flex items-center px-2"
          on:click={handleConnect}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 7h-3V6c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v1H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM9 6h6v1H9V6zm11 14H4V9h16v11z"/>
            <path d="M12 12c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3zm0 4c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z"/>
          </svg>
        </button>
      {:else}
        <div class="flex gap-6 items-center justify-end mr-2">
          <button
            class="p-2 flex items-center justify-center transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 hover:text-sky-400 nav-icon"
            class:spinning={isSpinning}
            aria-label="Settings"
            on:mouseenter={() => (isSpinning = true)}
            on:mouseleave={() => (isSpinning = false)}
            on:click={() => (isModalOpen = true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="text-white"
            >
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"
              />
            </svg>
          </button>

          <Button
            text="STATS"
            variant="blue"
            size="medium"
            state={activeTab === "stats" ? "selected" : "default"}
            onClick={() => handleTabChange("stats")}
          />

          <Button
            text={$walletStore.isConnected
              ? $t("common.openDrawer")
              : $t("common.connect")}
            variant="yellow"
            size="medium"
            state={sidebarOpen ? "selected" : "default"}
            onClick={handleConnect}
          />
        </div>
      {/if}
    </div>
  </div>

  {#if navOpen && isMobile}
    <div
      class="fixed inset-0 z-[100]"
      transition:fade={{ duration: 200 }}
      on:click={() => (navOpen = false)}
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-md" />
      
      <!-- Menu Content -->
      <div 
        class="absolute inset-y-0 left-0 w-80 bg-gradient-to-br from-gray-900 to-gray-800 shadow-2xl"
        on:click|stopPropagation
        transition:fade={{ duration: 150 }}
      >
        <div class="flex flex-col h-full p-6">
          <!-- Header -->
          <div class="flex items-center justify-between mb-8">
            <h2 class="text-2xl font-bold text-white">
              <span class="text-sky-400">{$t("common.navigation")}</span>
            </h2>
            <button
              class="p-2 rounded-full hover:bg-white/10 transition-colors"
              on:click={() => (navOpen = false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Navigation Links -->
          <div class="space-y-4 flex-1">
            {#each [...tabs, "stats"] as tab}
              <button
                class="w-full px-4 py-3 rounded-xl text-left text-lg font-medium transition-all duration-200
                  {activeTab === tab 
                    ? 'bg-sky-500/20 text-sky-400' 
                    : 'text-white hover:bg-white/10'}"
                on:click={() => handleTabChange(tab as Tab)}
              >
                {tab.toUpperCase()}
              </button>
            {/each}
          </div>

          <!-- Bottom Actions -->
          <div class="space-y-4 pt-4 border-t border-white/10">
            <button
              class="w-full px-4 py-3 rounded-xl bg-yellow-500/20 text-yellow-400 text-lg font-medium
                hover:bg-yellow-500/30 transition-colors"
              on:click={handleConnect}
            >
              {$walletStore.isConnected
                ? $t("common.openDrawer")
                : $t("common.connect")}
            </button>

            <button
              class="w-full px-4 py-3 rounded-xl bg-white/10 text-white text-lg font-medium
                hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
              on:click={() => (isModalOpen = true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"
                />
              </svg>
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</nav>

<Sidebar {sidebarOpen} onClose={() => (sidebarOpen = false)} />

<Modal
  show={isModalOpen}
  onClose={handleCloseModal}
  title="Settings"
  width="550px"
  height="auto"
>
  <Settings />
</Modal>

<style lang="postcss">
  :global(.spinning) {
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

  :global(.nav-icon) {
    @apply text-white;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.8));
  }

  :global(.nav-icon svg) {
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.8));
  }

  /* Add smooth slide animation for mobile menu */
  .mobile-menu-enter {
    transform: translateX(-100%);
  }

  .mobile-menu-enter-active {
    transform: translateX(0);
    transition: transform 200ms ease-out;
  }

  .mobile-menu-exit {
    transform: translateX(0);
  }

  .mobile-menu-exit-active {
    transform: translateX(-100%);
    transition: transform 200ms ease-in;
  }

  /* Enhance backdrop blur effect */
  .backdrop {
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
</style>
