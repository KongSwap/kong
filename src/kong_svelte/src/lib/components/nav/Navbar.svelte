<script lang="ts">
  import Button from "../common/Button.svelte";
  import Sidebar from "./Sidebar.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { t } from "$lib/locales/translations";
  import { walletStore } from "$lib/stores/walletStore";
  import { fade, slide } from 'svelte/transition'; // Import transition functions

  type Tab = "swap" | "pool" | "stats";

  let activeTab: "swap" | "pool" | "stats" = "swap";
  let sidebarOpen = false;
  let isMobile = false;
  let isSpinning = false;
  let navOpen = false;
  const tabs: Tab[] = ["swap", "pool", "stats"];
  const titles = {
    swap: {
      desktop: "/titles/titleKingKongSwap.png",
      mobile: "/titles/titleKingKongSwap.png",
    },
    pool: {
      desktop: "/titles/titleKingKongStats.png",
      mobile: "/titles/titleKingKongStats.png",
    },
    stats: {
      desktop: "/titles/stats_title.webp",
      mobile: "/titles/stats_title.webp",
    },
  };

  function handleTabChange(tab: "swap" | "pool" | "stats") {
    activeTab = tab;
    goto(`/${tab}`);
    navOpen = false;
  }

  function handleConnect() {
    sidebarOpen = !sidebarOpen;
  }

  function handleResize() {
    if (browser) {
      isMobile = window.innerWidth <= 768;
    }
  }

  function determineActiveTab(path: string) {
    return path === "/stats" ? "stats" : path === "/pool" ? "pool" : "swap";
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

  $: {
    const path = $page.url.pathname;
    activeTab = determineActiveTab(path);
  }

  $: titleImage = isMobile
    ? titles[activeTab].mobile
    : titles[activeTab].desktop;
</script>

<nav class="absolute w-full z-50 md:px-10 pt-4">
  <div class="grid grid-cols-12 px-2 md:px-10">
    <div class="flex col-span-3 items-center justify-center gap-x-4 mb-2">
      {#if isMobile}
        <div class="flex justify-between w-full mb-4 items-center">
          <button class="hamburger" on:click={() => (navOpen = !navOpen)}>
            ☰
          </button>

          <Button
            text={$walletStore.isConnected ? $t("common.open") : $t("common.connect")}
            variant="yellow"
            size="small"
            state={sidebarOpen ? "selected" : "default"}
            onClick={handleConnect}
          />
        </div>
      {/if}
      {#if !isMobile}
        {#each tabs as tab}
          <Button
            text={tab.toUpperCase()}
            variant="blue"
            size="medium"
            state={activeTab === tab ? "selected" : "default"}
            onClick={() => handleTabChange(tab)}
          />
        {/each}
      {/if}
    </div>

    <div class="col-span-6 flex justify-center items-end">
      <img src={titleImage} alt={activeTab} class="w-3/4" />
    </div>

    <div class="col-span-3 flex justify-end items-center gap-x-4 mb-2">
      <!-- svelte-ignore a11y_consider_explicit_label -->
      {#if !isMobile}
        <button
          class="settings-button"
          class:spinning={isSpinning}
          on:mouseenter={() => (isSpinning = true)}
          on:mouseleave={() => (isSpinning = false)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
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
        </button>
        <Button
          text="CONNECT"
          variant="yellow"
          size="medium"
          state={sidebarOpen ? "selected" : "default"}
          onClick={handleConnect}
        />
      {/if}
    </div>
  </div>

  {#if navOpen && isMobile}
    <div
      class="mobile-menu open gap-y-6"
      transition:fade={{ duration: 100 }}
    >
      <button class="close-button" on:click={() => (navOpen = false)}>
        ✕
      </button>

      <h2 class="text-white text-2xl font-bold font-alumni uppercase border-b-2 border-b-sky-300
      ">{$t("common.navigation")}</h2>
      {#each tabs as tab}
        <Button
          text={tab.toUpperCase()}
          variant="blue"
          state={activeTab === tab ? "selected" : "default"}
          onClick={() => handleTabChange(tab)}
        />
      {/each}

      <button
        class="settings-button"
        class:spinning={isSpinning}
        aria-label="Settings"
        on:mouseenter={() => (isSpinning = true)}
        on:mouseleave={() => (isSpinning = false)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
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
      </button>
    </div>
  {/if}
</nav>

<Sidebar {sidebarOpen} onClose={() => (sidebarOpen = false)} />

<style lang="postcss" scoped>
  .settings-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s ease;
  }

  .settings-button.spinning {
    animation: spin 2s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .hamburger {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #fff;
  }

  .mobile-menu {
    @apply fixed top-0 left-0 w-full h-full bg-black bg-opacity-60 backdrop-blur-lg	flex flex-col items-center justify-center;
    z-index: 100;
  }

  .mobile-menu button {
    @apply my-2;
  }

  .close-button {
    @apply absolute top-5 right-5 bg-none border-none text-white text-2xl cursor-pointer;
  }

  @media (max-width: 768px) {
    nav {
      padding: 8px 0;
    }
    .grid {
      grid-template-columns: 1fr;
    }
    .left-nav {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
