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
  import IdentityPanel from "$lib/components/sidebar/account/IdentityPanel.svelte";

  export let sidebarOpen: boolean;
  export let onClose: () => void;

  let isExpanded = false;
  let isMobile = false;
  let activeTab = 'tokens';

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

  function setActiveTab(tab: string) {
    activeTab = tab;
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
          <nav class="nav-tabs">
            <button 
              class="nav-tab {activeTab === 'tokens' ? 'active' : ''}" 
              on:click={() => setActiveTab('tokens')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
              </svg>
              Tokens
            </button>
            <button 
              class="nav-tab {activeTab === 'history' ? 'active' : ''}" 
              on:click={() => setActiveTab('history')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              History
            </button>
            <button 
              class="nav-tab {activeTab === 'details' ? 'active' : ''}" 
              on:click={() => setActiveTab('details')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Account
            </button>
            <button
              class="nav-tab close-tab"
              on:click={handleClose}
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </nav>
        </header>

        <div class="modal-body">
          {#if !$auth.isConnected}
            <WalletProvider />
          {:else}
            {#if activeTab === 'tokens'}
              <TokenList tokens={$tokens || []} />
            {:else if activeTab === 'history'}
              <div class="coming-soon">History feature coming soon</div>
            {:else if activeTab === 'details'}
              <div class="account-wrapper">
                <IdentityPanel />
              </div>
            {/if}
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
    border-bottom: 1px solid #2a2d3d;
    background: #15161c;
  }

  .nav-tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.55rem;
    padding: 1rem 0.75rem;
  }

  .nav-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: transparent;
    border: none;
    color: #8890a4;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
    border-radius: 0.5rem;
  }

  .nav-tab:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.05);
  }

  .nav-tab.active {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }

  .close-tab {
    color: #8890a4;
  }

  .close-tab:hover {
    color: #ffffff;
    background: rgba(255, 0, 0, 0.1);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
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

  .coming-soon {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
    color: #8890a4;
    font-size: 1.1rem;
  }
</style>
