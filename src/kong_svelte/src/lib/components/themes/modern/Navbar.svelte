<script lang="ts">
  import Button from "$lib/components/common/Button.svelte";
  import Panel from "./Panel.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { t } from "$lib/services/translations";
  import { walletStore } from "$lib/services/wallet/walletStore";
  import { fade } from "svelte/transition";
  import Settings from "$lib/components/settings/Settings.svelte";

  export let activeTab: "swap" | "earn" | "stats";
  export let sidebarOpen: boolean;
  export let isModalOpen: boolean;
  export let isMobile: boolean;
  export let onTabChange: (tab: "swap" | "earn" | "stats") => void;
  export let onConnect: () => void;
  export let onOpenSettings: () => void;

  let isSpinning = false;
  let navOpen = false;
  const tabs = ["swap", "earn"] as const;

  function handleNavClose() {
    navOpen = false;
  }
</script>

<div class="navbar-wrapper">
  <Panel variant="blue" type="main" className="modern-nav">
    <div class="nav-container">
      <div class="left-section">
        <a href="/" class="logo-link">
          <img src="/titles/kong_logo.png" alt="Kong Logo" class="logo" />
        </a>
        {#if !isMobile}
          <div class="tab-buttons">
            {#each tabs as tab}
              <button
                class="nav-tab"
                class:active={activeTab === tab}
                on:click={() => onTabChange(tab)}
              >
                {tab.toUpperCase()}
              </button>
            {/each}
            <button
              class="nav-tab"
              class:active={activeTab === "stats"}
              on:click={() => onTabChange("stats")}
            >
              STATS
            </button>
          </div>
        {/if}
      </div>

      <div class="right-section">
        {#if !isMobile}
          <button
            class="settings-btn"
            class:spinning={isSpinning}
            aria-label="Settings"
            on:mouseenter={() => (isSpinning = true)}
            on:mouseleave={() => (isSpinning = false)}
            on:click={onOpenSettings}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
            </svg>
          </button>

          <Button
            text={$walletStore.isConnected ? $t("common.openDrawer") : $t("common.connect")}
            variant="yellow"
            size="medium"
            state={sidebarOpen ? "selected" : "default"}
            onClick={onConnect}
          />
        {/if}
        {#if isMobile}
          <button
            class="mobile-menu-btn"
            on:click={() => (navOpen = !navOpen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="4" y1="12" x2="20" y2="12"></line>
              <line x1="4" y1="6" x2="20" y2="6"></line>
              <line x1="4" y1="18" x2="20" y2="18"></line>
            </svg>
          </button>
        {/if}
      </div>
    </div>
  </Panel>
</div>

{#if navOpen && isMobile}
  <div class="mobile-menu" transition:fade={{ duration: 150 }}>
    <Panel variant="blue" type="main" className="mobile-menu-panel">
      <button class="close-btn" on:click={handleNavClose}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="mobile-content">
        <h2 class="mobile-title">{$t("common.navigation")}</h2>
        {#each [...tabs, "stats"] as tab}
          <button
            class="nav-tab"
            class:active={activeTab === tab}
            on:click={() => {
              onTabChange(tab as "swap" | "earn" | "stats");
              handleNavClose();
            }}
          >
            {tab.toUpperCase()}
          </button>
        {/each}
        <Button
          text={$walletStore.isConnected ? $t("common.openDrawer") : $t("common.connect")}
          variant="yellow"
          state={sidebarOpen ? "selected" : "default"}
          onClick={() => {
            onConnect();
            handleNavClose();
          }}
        />
      </div>
    </Panel>
  </div>
{/if}

<style lang="postcss">
  .navbar-wrapper {
    @apply fixed top-0 left-0 right-0 z-50;
  }

  .modern-nav {
    @apply w-full backdrop-blur-lg;
    background: rgba(17, 25, 40, 0.75);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .nav-container {
    @apply max-w-7xl mx-auto px-6 py-4 flex justify-between items-center;
  }

  .left-section {
    @apply flex items-center gap-8;
  }

  .right-section {
    @apply flex items-center gap-4;
  }

  .logo-link {
    @apply flex items-center transition-opacity hover:opacity-90;
  }

  .logo {
    @apply h-8 w-auto;
    filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.2));
  }

  .tab-buttons {
    @apply flex gap-1;
  }

  .nav-tab {
    @apply px-4 py-2 rounded-lg text-sm font-medium text-white/70 transition-all duration-200
           hover:text-white hover:bg-white/5;
  }

  .nav-tab.active {
    @apply text-white bg-white/10;
  }

  .settings-btn {
    @apply p-2.5 rounded-lg bg-white/5 text-white/70 transition-all duration-200
           hover:text-white hover:bg-white/10 hover:scale-105 active:scale-95;
  }

  .mobile-menu-btn {
    @apply p-2 rounded-lg bg-white/5 text-white/70 transition-all duration-200
           hover:text-white hover:bg-white/10;
  }

  .mobile-menu {
    @apply fixed inset-0 z-[100];
  }

  .mobile-menu-panel {
    @apply h-full w-full flex items-center justify-center;
  }

  .close-btn {
    @apply absolute top-6 right-6 p-2 rounded-lg bg-white/5 text-white/70 
           transition-all duration-200 hover:text-white hover:bg-white/10;
  }

  .mobile-content {
    @apply flex flex-col items-center gap-6 p-8;
  }

  .mobile-title {
    @apply text-2xl font-bold text-white mb-4;
  }

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
</style>
