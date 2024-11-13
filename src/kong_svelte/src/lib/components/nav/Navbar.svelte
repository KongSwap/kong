<script lang="ts">
  import Button from "../common/Button.svelte";
  import Sidebar from "../sidebar/Sidebar.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { t } from "$lib/services/translations";
  import { walletStore } from "$lib/services/wallet/walletStore";
  import { fade } from 'svelte/transition';
  import Modal from "../common/Modal.svelte";
    import LanguageSelector from "../common/LanguageSelector.svelte";

  type Tab = "swap" | "pools" | "stats";

  let activeTab: Tab = "swap";
  let sidebarOpen = false;
  let isMobile = false;
  let isSpinning = false;
  let navOpen = false;
  let isModalOpen = false;
  const tabs: Tab[] = ["swap", "pools"];
  const titles = {
    swap: {
      desktop: "/titles/swap_title.webp",
      mobile: "/titles/swap_title.webp",
    },
    pools: {
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
    // If we're already on the current tab, just close the nav
    if (activeTab === tab && $page.url.pathname === `/${tab}`) {
      navOpen = false;
      return;
    }
    
    // Otherwise proceed with navigation
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
    return path.includes("stats") ? "stats" : path.includes("pools") ? "pools" : "swap";
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

  $: titleImage = isMobile ? titles[activeTab].mobile : titles[activeTab].desktop;
</script>

<nav>
  <div class="nav-grid">
    <div class="nav-left">
      {#if isMobile}
        <div class="mobile-controls gap-x-4">
          <button class="hamburger" on:click={() => (navOpen = !navOpen)}>
            ☰
          </button>

          <Button
            text={$walletStore.isConnected ? $t("common.open") : $t("common.connect")}
            variant="yellow"
            size="medium"
            state={sidebarOpen ? "selected" : "default"}
            onClick={handleConnect}
          />
        </div>
      {/if}
      {#if !isMobile}
        <div class="flex gap-x-4">
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

    <div class="nav-center">
      <div class="title-image-container">
        <img src={titleImage} alt={activeTab} class="title-image" />
      </div>
    </div>

    <div class="flex col-span-3 items-center justify-end gap-x-4 mb-2">
      {#if !isMobile}
        <button
          class="settings-button"
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
            class="settings-icon"
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
          text={$walletStore.isConnected ? $t("common.open") : $t("common.connect")}
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

      <h2 class="text-white text-2xl font-bold font-alumni uppercase border-b-2 border-b-sky-300">
        {$t("common.navigation")}
      </h2>
      {#each [...tabs, "stats"] as tab}
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
          class="settings-icon"
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
  isOpen={isModalOpen}
  onClose={handleCloseModal}
  title="Settings"
  width="550px"
>
  <LanguageSelector />
</Modal>

<style lang="postcss" scoped>
  nav {
    position: absolute;
    width: 100%;
    z-index: 50;
    padding: 1rem 2.5rem 0;
  }

  .nav-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    padding: 0 0.5rem;
  }

  .nav-left {
    grid-column: span 3;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
  }

  .nav-center {
    grid-column: span 6;
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }

  .mobile-controls {
    display: flex;
    justify-content: space-between;
    width: 100%;
    align-items: center;
  }

  .mobile-menu {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    z-index: 100;
  }

  .mobile-menu h2 {
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
    font-family: 'Alumni Sans', sans-serif;
    text-transform: uppercase;
    border-bottom: 2px solid rgb(125, 211, 252);
  }

  .title-image-container {
    width: 100%;
    height: 66px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .title-image {
    max-height: 100%;
    object-fit: contain;
  }

  .settings-button {
    cursor: pointer;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
  }

  .settings-button:hover {
    transform: scale(1.05);
  }

  .settings-button:active {
    transform: scale(0.95);
  }

  .settings-icon,
  .hamburger {
    font-size: 42px;
    cursor: pointer;
    color: white;
    align-items: center;
    filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
  }
  
  .hamburger {
    margin-top: -0.5rem;
  }

  .hamburger:hover {
    transform: scale(1.05);
  }

  .hamburger:active {
    transform: scale(0.95);
  }

  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    color: white;
    font-size: 2rem;
    cursor: pointer;
    padding: 0.5rem;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }

  .close-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 1024px) {
    nav {
      padding: 0.5rem 0;
    }
    
    .nav-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
