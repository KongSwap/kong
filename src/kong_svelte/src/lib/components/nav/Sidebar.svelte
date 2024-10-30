<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { walletStore } from "$lib/stores/walletStore";
  import Panel from "../common/Panel.svelte";
  import WalletProvider from "./sidebar/WalletProvider.svelte";
  import SidebarHeader from "./sidebar/SidebarHeader.svelte";
  import SocialSection from "./sidebar/SocialSection.svelte";
  import TokenList from "./sidebar/TokenList.svelte";

  export let sidebarOpen: boolean;
  export let onClose: () => void;

  let isLoggedIn = false;
  let isDragging = false;
  let startX: number;
  let startWidth: number;
  let activeTab: "tokens" | "pools" | "transactions" = "tokens";
  let isMobile = false;

  let sidebarWidth = 500;
  let initialWidth = 500;

  let dragTimeout: number;
  let resizeHandler: () => void;

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

  $: isLoggedIn = !!$walletStore.account;

  $: {
    if (browser) {
      isMobile = window.innerWidth <= 768;
      resizeHandler = () => {
        isMobile = window.innerWidth <= 768;
        if (isMobile) {
          sidebarWidth = window.innerWidth;
        } else {
          sidebarWidth = Math.min(500, window.innerWidth - 64);
        }
      };
      window.addEventListener("resize", resizeHandler);
    }
  }

  onDestroy(() => {
    if (browser) {
      document.removeEventListener("mousemove", handleDragging);
      document.removeEventListener("mouseup", stopDragging);
      document.body.style.cursor = "default";
      if (dragTimeout) window.cancelAnimationFrame(dragTimeout);
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
    }
  });
</script>

{#if sidebarOpen}
  <div
    class="sidebar-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Sidebar Menu"
    transition:fade={{ duration: 300, easing: cubicOut }}
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
        on:mousedown={startDragging}
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
            <SidebarHeader {isLoggedIn} {onClose} bind:activeTab />
          </header>

          <div class="sidebar-content">
            <div class="scroll-container">
              {#if !isLoggedIn}
                <WalletProvider on:login={() => {}} />
              {:else}
                <TokenList />
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

<style>
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
    height: 90vh;
    min-width: 420px;
    max-width: min(800px, calc(100vw - 50px));
    transform-origin: right center;
    will-change: transform;
    overflow: hidden;
    background-color: transparent;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .sidebar-layout {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
    gap: 16px;
    max-width: 100%;
    box-sizing: border-box;
    padding: 0 16px;
  }

  .sidebar-header {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 100%;
  }

  .sidebar-content {
    position: relative;
    min-height: 0;
    width: 100%;
    max-width: 100%;
  }

  .scroll-container {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
    width: calc(100% + 16px);
    max-width: calc(100% + 16px);
    padding-right: 4px;
    margin-right: -4px;
    box-sizing: border-box;
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

  .footer-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 8px;
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
      height: 100vh;
    }

    .resize-handle {
      display: none;
    }
  }
</style>
