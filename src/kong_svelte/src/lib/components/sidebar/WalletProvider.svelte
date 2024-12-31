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

<div class="wallet-list">
  {#each filteredWallets as wallet}
    <button
      class="wallet-option {wallet.id === 'nfid' ? 'recommended' : ''}"
      on:click={() => handleConnect(wallet.id)}
      disabled={connecting}
    >
      <div class="wallet-content">
        <img src={wallet.icon} alt={wallet.name} class="wallet-icon" />
        <div class="wallet-info">
          <span class="wallet-name">{wallet.name}</span>
          {#if wallet.id === 'nfid'}
            <span class="wallet-description">Sign in with Google</span>
          {/if}
        </div>
      </div>
      <svg class="wallet-arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  {/each}
</div>

{#if plugDialog}
  <svelte:component 
    this={plugDialog} 
    bind:open={dialogOpen} 
  />
{/if}

<style lang="postcss">
  .wallet-list {
    @apply flex flex-col gap-3 px-1;
  }

  .wallet-option {
    @apply flex items-center justify-between w-full px-4 py-4;
    @apply bg-kong-bg-dark/10 rounded-xl border border-kong-text-primary/10;
    @apply transition-all duration-200;
    backdrop-filter: blur(2px);
  }

  .wallet-content {
    @apply flex items-center gap-4;
  }

  .wallet-option:hover:not(:disabled) {
    @apply border-kong-primary bg-kong-primary/25;
    box-shadow: 
      0 4px 24px -2px rgb(0 0 0 / 0.12),
      0 2px 8px -2px rgb(0 0 0 / 0.06);
  }

  .wallet-option:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .wallet-option.recommended {
    @apply bg-kong-primary/10 border-kong-primary/20;
  }

  .wallet-option.recommended:hover:not(:disabled) {
    @apply bg-kong-primary/25 border-kong-primary/30;
    box-shadow: 
      0 4px 24px -2px rgb(var(--primary) / 0.15),
      0 2px 8px -2px rgb(var(--primary) / 0.1);
  }

  .wallet-icon {
    @apply w-12 h-12 rounded-xl;
    @apply transition-transform duration-200;
    @apply dark:brightness-100 brightness-[0.85];
  }

  .wallet-option:hover .wallet-icon {
    @apply dark:brightness-100 brightness-90;
  }

  .wallet-info {
    @apply flex flex-col gap-1;
    @apply flex-1;
    @apply text-left;
  }

  .wallet-name {
    @apply text-kong-text-primary font-medium text-lg;
    @apply text-left;
  }

  .wallet-description {
    @apply text-kong-text-secondary text-sm;
  }

  .wallet-arrow {
    @apply text-kong-text-secondary opacity-50;
    @apply transition-transform duration-200;
  }

  .wallet-option:hover .wallet-arrow {
    @apply transform translate-x-1 opacity-100;
  }
</style>
