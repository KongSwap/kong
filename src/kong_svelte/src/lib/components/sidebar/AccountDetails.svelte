<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import IdentityPanel from "./account/IdentityPanel.svelte";
  import WalletInfoPanel from "./account/WalletInfoPanel.svelte";
  import ConnectionPanel from "./account/ConnectionPanel.svelte";
  import UserDetailsPanel from "./account/UserDetailsPanel.svelte";
  import { accountStore } from "$lib/stores/accountStore";

  export let show = false;
  let activeTab = 'identity';
  export let onClose = () => {};

  accountStore.subscribe(state => {
    show = state.showDetails;
    activeTab = state.activeTab;
  });

  const tabs = [
    { id: 'identity', label: 'Identity' },
    { id: 'wallet', label: 'Wallet Info' },
    { id: 'connection', label: 'Connection' },
  ];
</script>

<Modal 
  isOpen={show} 
  title="Account Details" 
  onClose={() => accountStore.hideAccountDetails()}
  height="min(700px, 90vh)"
  width="min(600px, 95vw)"
>
  <div class="account-details">
    <div class="tabs">
      {#each tabs as tab}
        <button
          class="tab-button"
          class:active={activeTab === tab.id}
          on:click={() => accountStore.setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="content-wrapper">
      <div class="tab-content">
        {#if activeTab === 'identity'}
          <IdentityPanel />
        {:else if activeTab === 'wallet'}
          <WalletInfoPanel />
        {:else if activeTab === 'connection'}
          <ConnectionPanel />
        {:else if activeTab === 'details'}
          <UserDetailsPanel />
        {/if}
      </div>
    </div>
  </div>
</Modal>

<style>
  .account-details {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-height: 500px;
    height: 100%;
  }

  .content-wrapper {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
    min-height: 400px;
  }

  .content-wrapper::-webkit-scrollbar {
    width: 6px;
  }

  .content-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }

  .content-wrapper::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .tabs {
    position: sticky;
    top: 0;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 2px;
    background: rgba(255, 255, 255, 0.1);
    padding: 2px;
    border-radius: 6px;
    width: 100%;
  }

  .tab-button {
    flex: 1;
    padding: 0.75rem 0.5rem;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: clamp(0.75rem, 2vw, 0.875rem);
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 4px;
    white-space: nowrap;
  }

  .tab-button.active {
    background-color: rgba(0, 0, 0, 0.48);
    color: white;
  }
</style>
