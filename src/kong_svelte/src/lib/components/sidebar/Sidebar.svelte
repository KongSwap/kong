<!-- src/kong_svelte/src/lib/components/nav/Sidebar.svelte -->
<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { walletStore } from "$lib/stores/walletStore";
  import { tokenStore } from "$lib/stores/tokenStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import WalletProvider from "$lib/components/sidebar/WalletProvider.svelte";
  import SidebarHeader from "$lib/components/sidebar/SidebarHeader.svelte";

  // Lazy-loaded components
  let SocialSection;
  let TokenList;
  let TransactionHistory;

  // Exported props
  export let sidebarOpen: boolean;
  export let onClose: () => void;

  // Reactive variables
  let isDragging = false;
  let startX: number;
  let startWidth: number;
  let activeTab: "tokens" | "pools" | "transactions" = 
      browser ? 
          (localStorage.getItem('sidebarActiveTab') as "tokens" | "pools" | "transactions") || "tokens" 
          : "tokens";
  let isMobile = false;
  let sidebarWidth = 500;
  let dragTimeout: number;

  // Reactive subscription to walletStore
  $: if ($walletStore.isConnected) {
    tokenStore.loadBalances();
  }

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
    sidebarWidth = isMobile ? window.innerWidth : Math.min(500, window.innerWidth - 64);
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
      }
    };
  }

  // Combine all onMount logic
  onMount(async () => {
    await tokenStore.loadBalances();
    await tokenStore.loadTokens();

    if (browser) {
      window.addEventListener("resize", debouncedResize, { passive: true });
    }

    // Lazy load components
    const [tokenListModule, socialSectionModule, transactionHistoryModule] = await Promise.all([
      import("./TokenList.svelte"),
      import("./SocialSection.svelte"),
      import("./TransactionHistory.svelte")
    ]);
    TokenList = tokenListModule.default;
    SocialSection = socialSectionModule.default;
    TransactionHistory = transactionHistoryModule.default;
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

  function setActiveTab(tab: "tokens" | "pools" | "transactions") {
    activeTab = tab;
    if (browser) {
      localStorage.setItem('sidebarActiveTab', tab);
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
      <div
        class="resize-handle"
        use:resizeHandle
        aria-label="Resize sidebar"
      >
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
            <div class="scroll-container p-2">
              {#if !$walletStore.isConnected}
                <WalletProvider on:login={() => {}} />
              {:else}
                {#if activeTab === "tokens" && TokenList}
                  <TokenList />
                {:else if activeTab === "pools" && SocialSection  }
                  <!-- Add your pools component here -->
                {:else if activeTab === "transactions"}
                  <TransactionHistory />
                {/if}
              {/if}
            </div>
          </div>

          <footer class="sidebar-footer">
            <div class="footer-actions">
              {#if SocialSection}
                <SocialSection />
              {/if}
            </div>
          </footer>
        </div>
      </Panel>
    </div>
  </div>
{/if}

<style scoped>
  .sidebar-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 50;
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .overlay-button {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .sidebar-wrapper {
    position: absolute;
    top: 5vh;
    right: 32px;
    height: 90vh; /* Default height */
    min-width: 420px;
    max-width: min(800px, calc(100vw - 50px));
    transform-origin: right center;
    background-color: transparent;
    display: flex;
    flex-direction: column;
    grid-template-rows: auto 1fr auto;
    box-sizing: border-box;
    padding: 0 8px;
  }

  @media (max-width: 768px) {
    .sidebar-wrapper {
      top: 0; /* Align to the very top */
      right: 0;
      width: 100% !important;
      min-width: 100%;
      max-width: 100%;
      height: 100vh; /* Full viewport height */
    }

    .resize-handle {
      display: none;
    }
  }

  .sidebar-layout {
    display: flex;
    flex-direction: column;
    height: 100%; /* Ensure layout fills the sidebar */
  }

  .sidebar-header {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 100%;
  }

  .sidebar-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    width: 100%;
    position: relative;
    width: 100%;
    max-width: 100%;
    margin-bottom: 4px;
  }

  .scroll-container {
    position: absolute;
    inset: 0;
    overflow-y: auto;

  }

  .scroll-container::-webkit-scrollbar {
    width: 6px;
  }

  .scroll-container::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .resize-handle {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 120px;
    cursor: ew-resize;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    z-index: 51;
    padding: 0 4px;
    transition: background-color 0.2s;
    border-radius: 0 4px 4px 0;
  }

  .resize-handle:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .resize-line {
    width: 1px;
    height: 16px;
    background-color: rgba(255, 255, 255, 0.3);
    transition: background-color 0.2s;
  }

  .resize-dots {
    width: 2px;
    height: 12px;
    background-image: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.5) 1px,
      transparent 1px
    );
    background-size: 2px 2px;
    background-position: center;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .resize-handle:hover .resize-dots {
    opacity: 1;
  }

  .resize-handle:hover .resize-line {
    background-color: rgba(255, 255, 255, 0.5);
  }

  .sidebar-footer {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 12px;
    margin-top: auto;
    border-radius: 4px;
    width: 100%;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.1);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .footer-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 4px;
    width: 100%;
    box-sizing: border-box;
  }

  @media (max-width: 768px) {
    .sidebar-wrapper {
      top: 0;
      right: 0;
      width: 100% !important;
      min-width: 100%;
      max-width: 100%;
      height: 100vh; /* Full viewport height */
    }

    .resize-handle {
      display: none;
    }
  }
</style>
