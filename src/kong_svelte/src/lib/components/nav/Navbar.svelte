<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import Modal from "../common/Modal.svelte";
  import Settings from "../settings/Settings.svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import ModernNavbar from "../themes/modern/Navbar.svelte";
  import PixelNavbar from "../themes/pixel/Navbar.svelte";
  import Sidebar from "$lib/components/sidebar/Sidebar.svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";

  type Tab = "swap" | "earn" | "stats";

  let activeTab: Tab = "swap";
  let isModalOpen = false;
  let isMobile = false;

  // Subscribe to sidebar store
  $: sidebarOpen = $sidebarStore.isOpen;

  onMount(() => {
    const updateMobileState = () => {
      isMobile = window.innerWidth < 768;
    };
    updateMobileState();
    window.addEventListener("resize", updateMobileState);
    return () => window.removeEventListener("resize", updateMobileState);
  });

  function handleTabChange(tab: Tab) {
    activeTab = tab;
    goto(`/${tab}`);
  }

  function handleConnect() {
    sidebarStore.toggleOpen();
  }

  function handleOpenSettings() {
    isModalOpen = true;
  }

  $: activeTab = determineActiveTab($page.url.pathname);

  function determineActiveTab(path: string): Tab {
    return path.includes("stats")
      ? "stats"
      : path.includes("earn")
      ? "earn"
      : "swap";
  }

  $: {
    const path = $page.url.pathname;
    activeTab = determineActiveTab(path);
  }
</script>

<div class="nav-wrapper">
  <div class="nav-container">
    {#if $themeStore === "modern"}
      <ModernNavbar
        {activeTab}
        {sidebarOpen}
        {isMobile}
        onTabChange={handleTabChange}
        onConnect={handleConnect}
        onOpenSettings={handleOpenSettings}
      />
    {:else}
      <PixelNavbar
        {activeTab}
        {sidebarOpen}
        {isModalOpen}
        {isMobile}
        onTabChange={handleTabChange}
        onConnect={handleConnect}
        onOpenSettings={handleOpenSettings}
      />
    {/if}
  </div>

  <Sidebar
    isOpen={$sidebarStore.isOpen}
    onClose={() => sidebarStore.close()}
  />

  <Modal
    bind:isOpen={isModalOpen}
    onClose={() => (isModalOpen = false)}
    title="Settings"
  >
    <Settings />
  </Modal>
</div>

<style>
  .nav-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
  }
  .nav-container {
    width: 100%;
  }
</style>
