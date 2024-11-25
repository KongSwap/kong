<!-- src/kong_svelte/src/lib/components/nav/Sidebar.svelte -->
<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import WalletProvider from "$lib/components/sidebar/WalletProvider.svelte";
  import TokenList from "./TokenList.svelte";
  import { kongDB } from "$lib/services/db";
  import { liveQuery } from "dexie";
  import { auth } from "$lib/services/auth";
  import { sidebarStore } from "$lib/stores/sidebarStore";

  export let sidebarOpen: boolean;
  export let onClose: () => void;

  let isExpanded = false;
  let isMobile = false;

  // Subscribe to sidebar store
  sidebarStore.subscribe(state => {
    isExpanded = state.isExpanded;
  });

  onMount(() => {
    if (browser) {
      const updateDimensions = () => {
        isMobile = window.innerWidth <= 768;
      };
      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => window.removeEventListener("resize", updateDimensions);
    }
  });

  // Live database subscription for tokens
  const tokens = liveQuery(() => kongDB.tokens.toArray());

  function handleClose() {
    sidebarStore.collapse();
    onClose();
  }

  function toggleSidebar() {
    sidebarStore.toggle();
  }
</script>

{#if sidebarOpen}
  <div
    class="modal-backdrop"
    on:click={handleClose}
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
  >
    <div
      class="modal-container"
      on:click|stopPropagation
      in:fly|local={{ x: 300, duration: 200, easing: cubicOut }}
      out:fly|local={{ x: 300, duration: 200, easing: cubicOut }}
    >
      <div class="modal-content">
        <header class="modal-header">
          <h2 id="modal-title" class="modal-title">Wallet</h2>
          <button
            class="close-button"
            on:click={handleClose}
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div class="modal-body">
          {#if !$auth.isConnected}
            <WalletProvider />
          {:else}
            <TokenList tokens={$tokens || []} />
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 9999;
    display: flex;
    justify-content: flex-end;
    overflow-y: auto;
  }

  .modal-container {
    position: relative;
    background: #1a1b23;
    border-left: 1px solid #2a2d3d;
    width: min(500px, 95vw);
    height: 100vh;
  }

  .modal-content {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem;
    border-bottom: 1px solid #2a2d3d;
    background: #15161c;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
    line-height: 1.2;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #2a2d3d;
    border: none;
    border-radius: 6px;
    color: #ffffff;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: #3a3e52;
    transform: translateY(-1px);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 0.69rem;
    scrollbar-width: thin;
    scrollbar-color: #2a2d3d transparent;
  }

  .modal-body::-webkit-scrollbar {
    width: 6px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: #15161c;
    border-radius: 3px;
  }

  .modal-body::-webkit-scrollbar-thumb {
    background-color: #2a2d3d;
    border-radius: 3px;
  }

  @media (max-width: 768px) {
    .modal-container {
      width: 100% !important;
      border-left: none;
    }
  }
</style>
