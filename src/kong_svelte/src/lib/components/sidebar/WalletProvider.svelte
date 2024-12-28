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

<style lang="postcss">
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
    @apply flex items-center gap-5 w-full p-5;
    @apply bg-kong-text-primary/5 rounded-xl border border-kong-border;
    backdrop-filter: blur(8px);
    text-align: left;
    position: relative;
    transition: all 0.2s;
  }

  .wallet-option:hover:not(:disabled) {
    @apply bg-kong-text-primary/10 border-kong-border-light;
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.1);
  }

  .wallet-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wallet-option.recommended {
    @apply bg-kong-primary/20 border-kong-primary/30;
  }

  .wallet-option.recommended:hover:not(:disabled) {
    @apply bg-kong-primary/30 border-kong-primary/40;
    box-shadow: 0 4px 20px rgb(var(--primary) / 0.2);
  }

  .wallet-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    transition: transform 0.2s;
    @apply dark:brightness-100 brightness-[0.85];
  }

  .wallet-option:hover .wallet-icon {
    @apply dark:brightness-100 brightness-90;
  }

  .wallet-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .wallet-name {
    @apply text-kong-text-primary;
    font-weight: 500;
    font-size: 18px;
    letter-spacing: 0.05em;
  }

  .wallet-description {
    @apply text-kong-text-secondary;
    font-size: 14px;
    transition: color 0.2s;
  }

  .wallet-option.recommended:hover .wallet-description {
    @apply text-kong-text-primary;
  }

  .wallet-list::-webkit-scrollbar {
    width: 6px;
  }

  .wallet-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .wallet-list::-webkit-scrollbar-thumb {
    @apply bg-kong-text-primary/5;
    border-radius: 9999px;
  }

  .wallet-list::-webkit-scrollbar-thumb:hover {
    @apply bg-kong-text-primary/10;
  }
</style>
