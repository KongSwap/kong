<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    auth,
    availableWallets,
    selectedWalletId,
  } from "$lib/services/auth";
  import { isPwa, isMobileBrowser, isPlugAvailable } from '$lib/utils/browser';
  
  const dispatch = createEventDispatcher();
  let connecting = false;
  let plugDialog: any;
  let dialogOpen = false;

  const isOnMobile = isMobileBrowser();

  // Filter out Plug wallet on mobile unless it's a PWA
  $: filteredWallets = isOnMobile && !isPwa() 
    ? availableWallets
    : availableWallets;

  async function handleConnect(walletId: string) {
    if (!walletId || connecting) return;

    // Show modal on mobile if IC object is not present
    if (isOnMobile && walletId === 'plug' && !isPlugAvailable()) {
      // Dynamically import the dialog component when needed
      if (!plugDialog) {
        const module = await import('$lib/components/wallet/PlugMobileDialog.svelte');
        plugDialog = module.default;
      }
      dialogOpen = true;
      return;
    }

    // Redirect to Plug website on desktop if Plug is not installed
    if (!isOnMobile && walletId === 'plug' && !isPlugAvailable()) {
      window.open('https://plugwallet.ooo/', '_blank');
      return;
    }

    try {
      connecting = true;
      selectedWalletId.set(walletId);
      localStorage.setItem("kongSelectedWallet", walletId);
      await auth.connect(walletId);
      if ($auth.isConnected) dispatch("login");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      selectedWalletId.set("");
      localStorage.removeItem("kongSelectedWallet");
    } finally {
      connecting = false;
    }
  }
</script>

<div class="wallet-provider">
  <div class="wallet-list">
    {#each filteredWallets as wallet}
      <button
        class="wallet-option {wallet.id === 'nfid' ? 'recommended' : ''}"
        on:click={() => handleConnect(wallet.id)}
        disabled={connecting}
      >
        <img src={wallet.icon} alt={wallet.name} class="wallet-icon" />
        <div class="wallet-info">
          <span class="wallet-name">{wallet.name}</span>
          {#if wallet.id === 'nfid'}
            <span class="wallet-description">Sign in with Google</span>
          {/if}
        </div>
      </button>
    {/each}
  </div>
</div>

{#if plugDialog}
  <svelte:component 
    this={plugDialog} 
    bind:open={dialogOpen} 
  />
{/if}

<style>
  .wallet-provider {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-top: 1.25rem;
  }

  .wallet-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }

  .wallet-option {
    display: flex;
    align-items: center;
    gap: 20px;
    width: 100%;
    padding: 16px 20px;
    background: rgba(30, 41, 59, 0.5);
    border-radius: 12px;
    border: 1px solid rgba(51, 65, 85, 0.3);
    backdrop-filter: blur(8px);
    text-align: left;
    position: relative;
    transition: all 0.2s;
  }

  .wallet-option:hover:not(:disabled) {
    background: rgba(51, 65, 85, 0.6);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .wallet-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wallet-option.recommended {
    background: rgba(79, 70, 229, 0.4);
    border-color: rgba(99, 102, 241, 0.4);
  }

  .wallet-option.recommended:hover:not(:disabled) {
    background: rgba(99, 102, 241, 0.5);
    border-color: rgba(129, 140, 248, 0.6);
    box-shadow: 0 4px 20px rgba(79, 70, 229, 0.3);
  }

  .wallet-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    transition: transform 0.2s;
  }

  .wallet-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .wallet-name {
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
    font-size: 18px;
    letter-spacing: 0.05em;
  }

  .wallet-description {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    transition: color 0.2s;
  }

  .wallet-option.recommended:hover .wallet-description {
    color: rgba(255, 255, 255, 0.9);
  }

  .wallet-list::-webkit-scrollbar {
    width: 6px;
  }

  .wallet-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .wallet-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 9999px;
  }

  .wallet-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.15);
  }
</style>
