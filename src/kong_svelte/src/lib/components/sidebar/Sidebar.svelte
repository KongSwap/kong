<!-- src/kong_svelte/src/lib/components/nav/Sidebar.svelte -->
<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { walletStore } from "$lib/services/wallet/walletStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import WalletProvider from "$lib/components/sidebar/WalletProvider.svelte";
  import SidebarHeader from "$lib/components/sidebar/SidebarHeader.svelte";
  import TokenList from "./TokenList.svelte";
  import SocialSection from "./SocialSection.svelte";
  import TransactionHistory from "./TransactionHistory.svelte";
  import PoolList from "./PoolList.svelte";
  import { kongDB } from "$lib/services/db";
  import { liveQuery } from "dexie";

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
  let dragTimeout: number;

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

  // Debounce utility
  function debounce(fn: Function, ms: number) {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  const debouncedResize = debounce(() => {
    isMobile = window.innerWidth <= 768;
    sidebarWidth = isMobile
      ? window.innerWidth
      : Math.min(500, window.innerWidth - 64);
  }, 100);

  // Drag event handlers
  function startDragging(event: MouseEvent) {
    isDragging = true;
    startX = event.clientX;
    startWidth = sidebarWidth;
    document.addEventListener("mousemove", handleDragging, { passive: true });
    document.addEventListener("mouseup", stopDragging);
    document.body.style.cursor = "ew-resize";
    event.stopPropagation();
  }

  function handleDragging(event: MouseEvent) {
    if (!isDragging) return;
    if (dragTimeout) window.cancelAnimationFrame(dragTimeout);
    dragTimeout = window.requestAnimationFrame(() => {
      const delta = event.clientX - startX;
      sidebarWidth = Math.max(400, Math.min(800, startWidth - delta));
    });
  }

  function stopDragging() {
    isDragging = false;
    if (dragTimeout) window.cancelAnimationFrame(dragTimeout);
    document.removeEventListener("mousemove", handleDragging);
    document.removeEventListener("mouseup", stopDragging);
    document.body.style.cursor = "default";
  }

  // Custom action for resize handle
  function resizeHandle(node) {
    const handleMouseDown = (event: MouseEvent) => startDragging(event);
    node.addEventListener("mousedown", handleMouseDown);

    return {
      destroy() {
        node.removeEventListener("mousedown", handleMouseDown);
      },
    };
  }

  // Combine all onMount logic
  onMount(async () => {
    if (browser) {
      window.addEventListener("resize", debouncedResize, { passive: true });
    }

    // Initialize resize on mount
    debouncedResize();
  });

  // Clean up on destroy
  onDestroy(() => {
    if (browser) {
      document.removeEventListener("mousemove", handleDragging);
      document.removeEventListener("mouseup", stopDragging);
      document.body.style.cursor = "default";
      if (dragTimeout) window.cancelAnimationFrame(dragTimeout);
      window.removeEventListener("resize", debouncedResize);
    }
  });

  function setActiveTab(tab: "tokens" | "pools" | "history") {
    activeTab = tab;
    if (browser) {
      localStorage.setItem("sidebarActiveTab", tab);
    }
  }
</script>

{#if sidebarOpen}
  <div
    class="sidebar-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Sidebar Menu"
    transition:fade|local={{ duration: 300, easing: cubicOut }}
  >
    <button
      class="overlay-button"
      on:click={onClose}
      aria-label="Close sidebar"
    />

    <div
      class="sidebar-wrapper"
      class:is-dragging={isDragging}
      style="width: {sidebarWidth}px"
      in:fly={{ x: 500, duration: 300, easing: cubicOut }}
      out:fly={{ x: 500, duration: 300, easing: cubicOut }}
    >
      <div class="resize-handle" use:resizeHandle aria-label="Resize sidebar">
        <div class="resize-line" />
        <div class="resize-dots" />
        <div class="resize-line" />
      </div>

      <Panel
        variant="green"
        type="main"
        width={isMobile ? "100%" : `${sidebarWidth}px`}
        height={isMobile ? "100vh" : "90vh"}
        className="sidebar-panel"
      >
        <div class="sidebar-layout">
          <header class="sidebar-header">
            <SidebarHeader {onClose} {activeTab} {setActiveTab} />
          </header>

          <div class="sidebar-content">
            <div class="scroll-container">
              {#if !$walletStore.isConnected}
                <WalletProvider on:login={() => {}} />
              {:else if activeTab === "tokens"}
                <TokenList tokens={tokensData} />
              {:else if activeTab === "pools"}
                <PoolList pools={poolsData} />
              {:else if activeTab === "history"}
                <TransactionHistory transactions={transactionsData} />
              {/if}
            </div>
          </div>

          <footer class="sidebar-footer">
            <div class="footer-actions">
              <SocialSection />
            </div>
          </footer>
        </div>
      </Panel>
    </div>
  </div>
{/if}

<style scoped lang="postcss">
  .sidebar-overlay {
    @apply fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 grid place-items-center overflow-hidden;
  }

  .overlay-button {
    @apply absolute inset-0 bg-transparent border-none cursor-pointer;
  }

  .sidebar-wrapper {
    @apply absolute top-[5vh] right-8 h-[90vh] min-w-[420px] max-w-[min(800px,calc(100vw-50px))] origin-right bg-transparent flex flex-col grid-rows-[auto_1fr_auto] box-border p-2;
  }

  .sidebar-layout {
    @apply flex flex-col h-full;
  }

  .sidebar-header {
    @apply flex flex-col gap-4 w-full max-w-full;
  }

  .sidebar-content {
    @apply flex flex-col flex-1 w-full relative mb-1;
  }

  .scroll-container {
    @apply absolute inset-0 overflow-y-auto;
  }

  .scroll-container::-webkit-scrollbar {
    @apply w-1.5;
  }

  .scroll-container::-webkit-scrollbar-thumb {
    @apply bg-white bg-opacity-20 rounded;
  }

  .resize-handle {
    @apply absolute left-0 top-1/2 transform -translate-y-1/2 w-3 h-32 cursor-ew-resize flex flex-col items-center justify-center gap-1 z-50 p-1 transition-colors duration-200 rounded-r;
  }

  .resize-handle:hover {
    @apply bg-white bg-opacity-10;
  }

  .resize-line {
    @apply w-px h-4 bg-white bg-opacity-30 transition-colors duration-200;
  }

  .resize-dots {
    @apply w-0.5 h-3 bg-center bg-no-repeat opacity-50 transition-opacity duration-200;
    background-image: radial-gradient(circle, rgba(255, 255, 255, 0.5) 1px, transparent 1px);
    background-size: 2px 2px;
  }

  .resize-handle:hover .resize-dots {
    @apply opacity-100;
  }

  .resize-handle:hover .resize-line {
    @apply bg-opacity-50;
  }

  .sidebar-footer {
    @apply flex justify-center items-center p-3 mt-auto rounded w-full box-border bg-black bg-opacity-10 border-t border-white border-opacity-10;
  }

  .footer-actions {
    @apply flex justify-center items-center rounded w-full box-border;
  }

  @media (max-width: 768px) {
    .sidebar-wrapper {
      @apply top-0 right-0 w-full min-w-full max-w-full h-screen;
    }

    .resize-handle {
      display: none;
    }
  }
</style>
