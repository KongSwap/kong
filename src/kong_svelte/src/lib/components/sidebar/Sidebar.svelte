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
  import Modal from "$lib/components/common/Modal.svelte";

  export let isOpen: boolean;
  export let onClose: () => void;

  let isExpanded = false;
  let isMobile = false;
  let activeTab = 'tokens';
  let showAccountModal = false;
  let identityPanelRef: any;
  let sidebarElement: HTMLElement;
  let startX: number;
  let currentX: number;
  let isDragging = false;

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

  function handleShowAccountDetails() {
    showAccountModal = true;
    setTimeout(() => {
      if (identityPanelRef) {
        identityPanelRef.loadIdentityData();
      }
    }, 100);
  }

  function handleCloseAccountModal() {
    showAccountModal = false;
  }

  function handleClose() {
    sidebarStore.collapse();
    onClose();
  }

  function setActiveTab(tab: string) {
    activeTab = tab;
  }

  async function handleLogout() {
    try {
      await auth.disconnect();
      window.location.reload();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }

  function handleTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    currentX = startX;
    isDragging = true;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    
    currentX = e.touches[0].clientX;
    const deltaX = currentX - startX;
    
    if (deltaX > 0) {
      requestAnimationFrame(() => {
        if (sidebarElement) {
          sidebarElement.style.transform = `translateX(${deltaX}px)`;
        }
      });
    }
  }

  function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    
    const deltaX = currentX - startX;
    const threshold = window.innerWidth * 0.3;
    
    if (deltaX >= threshold) {
      onClose();
    } else {
      if (sidebarElement) {
        sidebarElement.style.transform = 'translateX(0)';
      }
    }
  }

  // Live database subscription for tokens
  const tokens = liveQuery(() => kongDB.tokens.toArray());
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={sidebarElement}
    class="modal-backdrop"
    on:touchstart|passive={handleTouchStart}
    on:touchmove|passive={handleTouchMove}
    on:touchend={handleTouchEnd}
    on:touchcancel={handleTouchEnd}
    on:click={handleClose}
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="modal-container"
      on:click|stopPropagation
      in:fly|local={{ x: 300, duration: 200, easing: cubicOut }}
    >
      <div class="modal-content">
        <header class="modal-header">
          {#if $auth.isConnected}
            <div class="header-actions">
              <button 
                class="show-details-btn"
                on:click={handleShowAccountDetails}
              >
                Show Account Details
              </button>
              <div class="divider"></div>
              <button 
                class="logout-btn"
                on:click={handleLogout}
              >
                Log Out
              </button>
              <div class="divider"></div>
              <button
                class="close-btn"
                on:click={handleClose}
                title="Close sidebar"
              >
                ✕
              </button>
            </div>
          {/if}
          <nav class="nav-tabs">
            <button 
              class="nav-tab {activeTab === 'tokens' ? 'active' : ''}" 
              on:click={() => setActiveTab('tokens')}
            >
              Tokens
            </button>
            <button 
              class="nav-tab {activeTab === 'liquidity' ? 'active' : ''}" 
              on:click={() => setActiveTab('liquidity')}
            >
              Liquidity
            </button>
            <button 
              class="nav-tab {activeTab === 'history' ? 'active' : ''}" 
              on:click={() => setActiveTab('history')}
            >
              History
            </button>
          </nav>
        </header>

        <div class="modal-body">
          {#if !$auth.isConnected}
            <WalletProvider />
          {:else}
            {#if activeTab === 'tokens'}
              <TokenList tokens={$tokens || []} />
            {:else if activeTab === 'liquidity'}
              <div class="coming-soon">Liquidity feature coming soon</div>
            {:else if activeTab === 'history'}
              <div class="coming-soon">Transaction history coming soon</div>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showAccountModal}
  <Modal 
    isOpen={showAccountModal} 
    onClose={handleCloseAccountModal}
    title="Account Details"
    width="min(600px, 95vw)"
  >
    <div class="account-details-container">
      <IdentityPanel bind:this={identityPanelRef} />
    </div>
  </Modal>
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
    transform: translateX(0);
    transition: transform 0.2s ease-out;
  }

  .modal-content {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .modal-header {
    border-bottom: 2px solid #2a2d3d;
    background: #15161c;
  }

  .nav-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }

  .nav-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
    background: transparent;
    border: none;
    color: #8890a4;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
    width: 100%;
  }

  .nav-tab:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.05);
  }

  .nav-tab.active {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
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

  .header-actions {
    @apply flex items-center gap-px bg-white/5 ;
  }

  .divider {
    @apply w-px h-7 bg-white/10;
  }

  .show-details-btn {
    @apply flex-1 px-4 py-2
           bg-transparent hover:bg-white/10
           text-white/90 hover:text-white
           transition-all
           text-sm font-medium
           ;
  }

  .logout-btn {
    @apply px-4 py-2
           bg-transparent hover:bg-red-500/10
           text-red-400 hover:text-red-300
           text-sm font-medium
           transition-all
           whitespace-nowrap
           ;
  }

  .close-btn {
    @apply px-4 py-2
           bg-transparent hover:bg-white/10
           text-white/70 hover:text-white
           text-sm font-medium
           transition-all
           ;
  }

  .account-details-container {
    padding: 1rem;
    background: #1a1b23;
    border-radius: 0.5rem;
  }
</style>
