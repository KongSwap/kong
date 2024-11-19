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
    <div class="col-span-2 flex items-center">
      {#if isMobile}
        <button
          class="text-3xl text-gray-800 hover:text-gray-600 transition-colors"
          on:click={() => (navOpen = !navOpen)}
        >
          ☰
        </button>
      {/if}
      {#if !isMobile}
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
            class="object-contain max-h-16"
          />
        </a>
      </div>
    </div>

    <div class="col-span-2 flex gap-6 items-center justify-end mr-2">
      {#if !isMobile}
        <button
          class="p-2 flex items-center justify-center transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 hover:text-sky-400"
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

        <div class="flex items-center space-x-3 nav-buttons">
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
      class="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex flex-col items-center justify-center gap-8 z-[100]"
      transition:fade={{ duration: 150 }}
    >
      <button
        class="absolute top-6 right-6 text-white text-2xl hover:text-gray-300 transition-colors"
        on:click={() => (navOpen = false)}
      >
        ✕
      </button>

      <h2
        class="text-white text-2xl font-bold uppercase border-b-2 border-sky-300 pb-2"
      >
        {$t("common.navigation")}
      </h2>
      {#each [...tabs, "stats"] as tab}
        <Button
          text={tab.toUpperCase()}
          variant="blue"
          state={activeTab === tab ? "selected" : "default"}
          onClick={() => handleTabChange(tab as Tab)}
        />
      {/each}
      <Button
        text={$walletStore.isConnected
          ? $t("common.openDrawer")
          : $t("common.connect")}
        variant="yellow"
        state={sidebarOpen ? "selected" : "default"}
        onClick={handleConnect}
      />

      <button
        class="p-2 flex items-center justify-center transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 hover:text-sky-400"
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

  :global(.nav-buttons .pixel-button:hover:not(.selected) .button-text) {
    @apply text-black font-semibold;
  }

  :global(.nav-buttons .selected .button-text) {
    @apply text-white font-bold;
  }
</style>
