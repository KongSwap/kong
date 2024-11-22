<!-- src/kong_svelte/src/lib/components/nav/Sidebar.svelte -->
<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import Panel from "$lib/components/common/Panel.svelte";
  import WalletProvider from "$lib/components/sidebar/WalletProvider.svelte";
  import SidebarHeader from "$lib/components/sidebar/SidebarHeader.svelte";
  import TokenList from "./TokenList.svelte";
  import SocialSection from "./SocialSection.svelte";
  import TransactionHistory from "./TransactionHistory.svelte";
  import PoolList from "./PoolList.svelte";
  import { kongDB } from "$lib/services/db";
  import { liveQuery } from "dexie";
  import { auth } from "$lib/services/auth";
  import { tick } from "svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";

  // Exported props
  export let sidebarOpen: boolean;
  export let onClose: () => void;

  // Reactive variables
  let isDragging = false;
  let startX: number;
  let startWidth: number;
  let activeTab: "tokens" | "pools" | "history" = browser
    ? (localStorage.getItem("sidebarActiveTab") as
        | "tokens"
        | "pools"
        | "history") || "tokens"
    : "tokens";
  let isMobile = false;
  let sidebarWidth = 500;
  let isExpanded = false;

  sidebarStore.subscribe(state => {
    isExpanded = state.isExpanded;
    sidebarWidth = state.width;
  });

  // Live database subscriptions
  const tokens = liveQuery(async () => {
    return await kongDB.tokens.toArray();
  });

  const pools = liveQuery(async () => {
    return await kongDB.pools.toArray();
  });

  const transactions = liveQuery(async () => {
    return await kongDB.transactions.toArray();
  });

  // Pass live data to child components
  $: tokensData = $tokens || [];
  $: poolsData = $pools || [];
  $: transactionsData = $transactions || [];

  onMount(() => {
    const updateDimensions = () => {
      isMobile = window.innerWidth <= 768;
      if (isMobile) {
        sidebarStore.setWidth(window.innerWidth);
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  });

  function startResize(event: MouseEvent) {
    if (isExpanded) return; // Disable resizing when expanded
    isDragging = true;
    startX = event.pageX;
    startWidth = sidebarWidth;
    window.addEventListener("mousemove", handleResize);
    window.addEventListener("mouseup", stopResize);
  }

  function handleResize(event: MouseEvent) {
    if (!isDragging) return;
    const delta = startX - event.pageX;
    const newWidth = Math.max(400, Math.min(800, startWidth - delta));
    sidebarStore.setWidth(newWidth);
  }

  function stopResize() {
    isDragging = false;
    window.removeEventListener("mousemove", handleResize);
    window.removeEventListener("mouseup", stopResize);
  }

  function handleClose() {
    sidebarStore.collapse();
    onClose();
  }

  function setActiveTab(tab: "tokens" | "pools" | "history") {
    activeTab = tab;
    if (browser) {
      localStorage.setItem("sidebarActiveTab", tab);
    }
  }

  $: console.log("ISCONNECTED", $auth.isConnected);
</script>

{#if sidebarOpen}
  <div
    class="sidebar-overlay"
    role="dialog"
    aria-modal="true"
    transition:fade={{ duration: 200 }}
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <button
      class="overlay-close"
      on:click={handleClose}
      aria-label="Close sidebar"
    />
    <div
      class="sidebar-wrapper"
      transition:fly={{ x: 300, duration: 200, easing: cubicOut }}
      style="width: {sidebarWidth}px"
    >
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <div
        class="resize-handle"
        class:hidden={isExpanded}
        use:startResize
        aria-label="Resize sidebar"
      >
        <div class="resize-line" />
      </div>

      <Panel
        width={isMobile ? "100%" : `${sidebarWidth}px`}
        height="100%"
        className="sidebar-panel"
      >
        <div class="sidebar-layout">
          <header class="sidebar-header">
            <SidebarHeader {onClose} {activeTab} {setActiveTab} />
          </header>

          <div class="sidebar-content">
            {#if !$auth.isConnected}
              <WalletProvider
                on:login={async () => {
                  // Wait for next tick to ensure auth state is updated
                  await tick();
                  // Switch to tokens tab after login
                  setActiveTab("tokens");
                }}
              />
            {:else if activeTab === "tokens"}
              <TokenList tokens={tokensData} />
            {:else if activeTab === "pools"}
              <PoolList pools={poolsData} />
            {:else if activeTab === "history"}
              <TransactionHistory transactions={transactionsData} />
            {/if}
          </div>

          <footer class="sidebar-footer">
            <SocialSection />
          </footer>
        </div>
      </Panel>
    </div>
  </div>
{/if}

<style>
  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 50;
  }

  .sidebar-wrapper {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    transition: all 0.3s ease-out;
  }

  .sidebar-wrapper :global(.panel) {
    background-color: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(20px);
  }

  .sidebar-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 100vh;
  }

  .sidebar-header {
    flex-shrink: 0;
  }

  .sidebar-content {
    flex-grow: 1;
    overflow-y: auto;
    position: relative;
  }

  .resize-handle {
    position: absolute;
    top: 0;
    left: -4px;
    width: 8px;
    height: 100%;
    cursor: col-resize;
    z-index: 60;
  }

  .resize-handle.hidden {
    display: none;
  }

  .resize-line {
    position: absolute;
    top: 0;
    left: 50%;
    width: 2px;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.1);
    transform: translateX(-50%);
  }

  .overlay-close {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .sidebar-footer {
    flex-shrink: 0;
    padding: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 768px) {
    .sidebar-wrapper {
      width: 100% !important;
    }

    .resize-handle {
      display: none;
    }
  }
</style>
