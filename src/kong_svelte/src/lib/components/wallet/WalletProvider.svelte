<script lang="ts">
	import { walletsList } from '@windoge98/plug-n-play';
  import { auth, selectedWalletId } from "$lib/stores/auth";
  import { isPwa, isMobileBrowser, isPlugAvailable } from "$lib/utils/browser";
  import Modal from "$lib/components/common/Modal.svelte";
  import { browser } from "$app/environment";
  import { createNamespacedStore } from "$lib/config/localForage.config";

  const AUTH_NAMESPACE = 'auth';
  const authStorage = createNamespacedStore(AUTH_NAMESPACE);
  const SELECTED_WALLET_KEY = 'selectedWallet';

  interface WalletInfo {
    id: string;
    name: string;
    icon: string;
    description?: string;
    recommended?: boolean;
  }

  // Map available wallets to our WalletInfo structure
  const walletList: WalletInfo[] = walletsList.map(wallet => ({
    id: wallet.id,
    name: wallet.name === "Oisy Wallet" ? "OISY Wallet" : wallet.name,
    icon: wallet.icon,
    description: wallet.id === 'nfid' ? 'Sign in with Google' : undefined,
    recommended: wallet.id === 'oisy' // Mark Plug as recommended
  }));

  // Props
  const { 
    isOpen = false,
    onClose = () => {},
    onLogin = () => {}
  } = $props<{ 
    isOpen?: boolean; 
    onClose?: () => void;
    onLogin?: () => void;
  }>();
  
  // State
  let connecting = $state(false);
  let connectingWalletId = $state<string | null>(null);
  let plugDialog = $state<any>(null);
  let dialogOpen = $state(false);
  let abortController = $state(new AbortController());
  let isOnMobile = $state(false);
  let filteredWallets = $state(walletList);
  let errorMessage = $state<string | null>(null);
  
  function closeModal() {
    // Reset state when closing
    errorMessage = null;
    connecting = false;
    connectingWalletId = null;
    onClose();
  }

  // Initialize on mount
  $effect(() => {
    // Only run browser-specific code after component is mounted
    if (browser) {
      isOnMobile = isMobileBrowser();
      updateFilteredWallets();
    }
  });

  function updateFilteredWallets() {
    if (browser) {
      filteredWallets = isPlugAvailable() ? walletList : walletList.filter(w => w.id !== 'plug');
    }
  }

  // Cleanup on destroy
  $effect(() => {
    // This cleanup will run when the component is destroyed
    return () => {
      // Clean up any pending connection state
      if (connecting) {
        connecting = false;
        abortController.abort();
      }
    }
  });

  async function handleConnect(walletId: string) {
    if (!walletId || connecting || !browser) return;
    
    errorMessage = null;
    connectingWalletId = walletId;

    // Reset abort controller for new connection attempt
    abortController = new AbortController();

    // Show modal on mobile if IC object is not present
    if (isOnMobile && walletId === "plug" && !isPlugAvailable()) {
      // Dynamically import the dialog component when needed
      if (!plugDialog) {
        const module = await import(
          "$lib/components/wallet/PlugMobileDialog.svelte"
        );
        plugDialog = module.default;
      }
      dialogOpen = true;
      return;
    }

    // Redirect to Plug website on desktop if Plug is not installed
    if (!isOnMobile && walletId === "plug" && !isPlugAvailable()) {
      window.open("https://plugwallet.ooo/", "_blank");
      return;
    }

    try {
      connecting = true;
      selectedWalletId.set(walletId);
      
      // Save wallet ID to storage
      try {
        await authStorage.setItem(SELECTED_WALLET_KEY, walletId);
      } catch (error) {
        console.warn("Could not save selected wallet to storage:", error);
      }
      
      // Add timeout to prevent hanging connections
      const timeoutId = setTimeout(() => abortController.abort(), 30000);
      
      await auth.connect(walletId);
      clearTimeout(timeoutId);
      
      if ($auth.isConnected) {
        onLogin();
        closeModal();
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error("Failed to connect wallet:", error);
        errorMessage = error instanceof Error ? error.message : "Failed to connect wallet";
        selectedWalletId.set("");
        
        // Remove from storage
        try {
          await authStorage.removeItem(SELECTED_WALLET_KEY);
        } catch (storageError) {
          console.warn("Could not remove wallet from storage:", storageError);
        }
      }
    } finally {
      connecting = false;
      connectingWalletId = null;
    }
  }
</script>

<Modal
  {isOpen}
  title="Connect Wallet"
  onClose={closeModal}
  width="440px"
  height="auto"
  variant="solid"
  closeOnEscape={!connecting}
  closeOnClickOutside={!connecting}
>
  <div class="flex flex-col gap-6 pt-2">
    <div class="wallet-connect-body">
      {#if errorMessage}
        <div class="error-message" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{errorMessage}</span>
        </div>
      {/if}
      
      <div class="wallet-list">
        {#each filteredWallets as wallet}
          <button
            class="wallet-option 
              {connectingWalletId === wallet.id ? 'connecting' : ''} 
              {wallet.recommended && connectingWalletId !== wallet.id && connectingWalletId !== null ? '' : (wallet.recommended ? 'recommended' : '')}"
            on:click={() => handleConnect(wallet.id)}
            disabled={connecting}
            aria-busy={connectingWalletId === wallet.id}
          >
            <div class="wallet-content">
              <div class="wallet-icon-container">
                <img src={wallet.icon} alt={wallet.name} class="wallet-icon" />
                {#if connectingWalletId === wallet.id}
                  <div class="loading-spinner"></div>
                {/if}
              </div>
              <div class="wallet-info">
                <span class="wallet-name">{wallet.name}</span>
                {#if wallet.description}
                  <span class="wallet-description">{wallet.description}</span>
                {/if}
                {#if wallet.recommended}
                  <span class="recommended-badge">Recommended</span>
                {/if}
              </div>
            </div>
            <svg
              class="wallet-arrow"
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
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        {/each}
      </div>
    </div>
    
    <div class="flex flex-col gap-2">
      <p class="text-xs text-kong-text-secondary text-center pb-4">
        Rumble in the crypto jungle at <a
          href="#"
          class="text-kong-primary hover:text-kong-primary-hover transition-colors duration-200">KongSwap.io</a
        >.
      </p>
    </div>
  </div>
</Modal>

{#if plugDialog}
  <svelte:component this={plugDialog} bind:open={dialogOpen} />
{/if}

<style lang="postcss">
  .wallet-list {
    @apply flex flex-col gap-3 px-1;
  }

  .wallet-option {
    @apply flex items-center justify-between w-full px-4 py-4;
    @apply bg-kong-bg-dark/10 rounded-xl border border-kong-text-primary/10;
    position: relative;
    will-change: transform;
    backface-visibility: hidden;
    transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  }

  .wallet-option:focus-visible {
    @apply outline-none ring-2 ring-kong-primary;
  }

  .wallet-option::before {
    content: '';
    position: absolute;
    inset: 0;
    backdrop-filter: blur(2px);
    border-radius: inherit;
    z-index: -1;
  }

  .wallet-content {
    @apply flex items-center gap-4;
  }

  .wallet-option:hover:not(:disabled) {
    @apply border-kong-primary bg-kong-primary/25;
    transform: translateY(-1px);
    box-shadow: 0 4px 24px -2px rgb(0 0 0 / 0.12),
                0 2px 8px -2px rgb(0 0 0 / 0.06);
  }

  .wallet-option:active:not(:disabled) {
    @apply text-kong-bg-light;
    transform: translateY(0);
    transition: transform 0.1s ease;
  }

  .wallet-option:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .wallet-option.connecting {
    @apply border-kong-primary bg-kong-primary/15 text-kong-bg-light;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  /* Override any recommended styles when connecting */
  .wallet-option.connecting.recommended {
    @apply border-kong-primary bg-kong-primary/15 text-kong-bg-light;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  /* Only apply recommended styles when not connecting */
  .wallet-option.recommended:not(.connecting) {
    @apply bg-kong-primary/10 border-kong-primary/20;
  }

  .wallet-option.recommended:hover:not(:disabled):not(.connecting) {
    @apply bg-kong-primary/25 border-kong-primary/30;
    box-shadow:
      0 4px 24px -2px rgb(var(--primary) / 0.15),
      0 2px 8px -2px rgb(var(--primary) / 0.1);
  }

  .wallet-icon-container {
    position: relative;
    width: 48px;
    height: 48px;
  }

  .wallet-icon {
    @apply w-12 h-12 rounded-xl;
    @apply transition-transform duration-200;
    @apply dark:brightness-100 brightness-[0.85];
    transform: translateZ(0);
  }

  .wallet-option:hover .wallet-icon {
    @apply dark:brightness-100 brightness-90;
  }


  .loading-spinner {
    @apply rounded-full;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: 2px solid transparent;
    border-top-color: rgb(var(--accent-green));
    border-right-color: rgb(var(--accent-green) / 0.3);
    border-bottom-color: rgb(var(--accent-green) / 0.1);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  .wallet-info {
    @apply flex flex-col gap-1;
    @apply flex-1;
    @apply text-left;
  }

  .wallet-name {
    @apply font-medium text-lg;
    @apply text-left;
  }

  .wallet-description {
    @apply text-kong-text-secondary text-sm;
  }

  .recommended-badge {
    @apply text-kong-primary text-xs font-medium;
    @apply bg-kong-primary/10 px-2 py-0.5 rounded-full;
    @apply inline-block w-fit mt-1;
  }

  .wallet-arrow {
    @apply text-kong-text-secondary opacity-50;
    @apply transition-transform duration-200;
  }

  .wallet-option:hover .wallet-arrow {
    @apply transform translate-x-1 opacity-100;
  }

  .error-message {
    @apply flex items-center gap-2 p-3 mb-3 rounded-lg;
    @apply bg-kong-accent-red/10 text-kong-accent-red border border-kong-accent-red/20;
    @apply text-sm;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
