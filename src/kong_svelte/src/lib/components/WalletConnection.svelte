<script lang="ts">
  import {
    walletStore,
    connectWallet,
    disconnectWallet,
    availableWallets,
    selectedWalletId,
  } from '$lib/stores/walletStore';
  import { t } from '$lib/translations';
  import { onMount } from 'svelte';
  import { uint8ArrayToHexString } from "@dfinity/utils";

  // Initialize selectedWalletId from localStorage inside onMount
  onMount(() => {
    if (typeof window !== 'undefined') {
      const storedWalletId = localStorage.getItem('selectedWalletId');
      if (storedWalletId) {
        selectedWalletId.set(storedWalletId);
      }
    }

    // Log available wallets to debug
    console.log('Available Wallets on mount:', availableWallets);
  });

  // Function to handle wallet connection
  async function handleConnect(walletId: string) {
    if (!walletId) {
      return console.error('No wallet selected');
    }

    try {
      selectedWalletId.set(walletId);
      localStorage.setItem('selectedWalletId', walletId);
      await connectWallet(walletId);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  }

  // Function to handle wallet disconnection
  async function handleDisconnect() {
    try {
      await disconnectWallet();
      selectedWalletId.set('');
      localStorage.removeItem('selectedWalletId');
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  }
</script>

<div class="wallet-section">
  {#if $walletStore.isConnecting}
    <p>{$t('common.connecting')}</p>
  {:else if $walletStore.account}
    <p>
      {$t('common.connectedTo')}: {$walletStore.account.owner.toString()}
      <br/>
      {$t('common.subaccount')}: {uint8ArrayToHexString($walletStore.account.subaccount)}
    </p>
    <button on:click={handleDisconnect}>
      {$t('common.disconnectWallet')}
    </button>
  {:else}
    <p>{$t('common.notConnected')}</p>
    <div class="wallet-list">
      {#if availableWallets && availableWallets.length > 0}
        {#each availableWallets as wallet}
          <div class="wallet-item">
            <button on:click={() => handleConnect(wallet.id)}>
              {wallet.name}
            </button>
          </div>
        {/each}
      {:else}
        <p>{$t('common.noWalletsAvailable')}</p>
      {/if}
    </div>
  {/if}

  {#if $walletStore.error}
    <p class="text-red-500">
      {$t('common.error')}: {$walletStore.error.message}
    </p>
  {/if}
</div>
