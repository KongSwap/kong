<script lang="ts">
	import { walletsList } from '@windoge98/plug-n-play';
  import { auth, selectedWalletId } from "$lib/stores/auth";
  import { isMobileBrowser, isPlugAvailable } from "$lib/utils/browser";
  import Modal from "$lib/components/common/Modal.svelte";
  import { browser } from "$app/environment";
  import { createNamespacedStore } from "$lib/config/localForage.config";
  import { tooltip } from '$lib/actions/tooltip';
  import Badge from '$lib/components/common/Badge.svelte';

  const AUTH_NAMESPACE = 'auth';
  const authStorage = createNamespacedStore(AUTH_NAMESPACE);
  const SELECTED_WALLET_KEY = 'selectedWallet';

  interface WalletInfo {
    id: string;
    name: string;
    icon: string;
    description?: string;
    recommended?: boolean;
    unsupported?: boolean;
  }

  // Map available wallets to our WalletInfo structure
  const walletList: WalletInfo[] = walletsList.map(wallet => ({
    id: wallet.id,
    name: wallet.name === "Oisy Wallet" ? "OISY Wallet" : wallet.name,
    icon: wallet.icon,
    description: wallet.id === 'nfid' ? 'Sign in with Google' : undefined,
    recommended: wallet.id === 'oisy', // Mark OISY as recommended
    unsupported: wallet.id === 'plug' // Mark Plug as unsupported
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
      await auth.connect(walletId);

      // Save wallet ID to storage
      try {
        await authStorage.setItem(SELECTED_WALLET_KEY, walletId);
      } catch (error) {
        console.warn("Could not save selected wallet to storage:", error);
      }
      
      // Add timeout to prevent hanging connections
      const timeoutId = setTimeout(() => abortController.abort(), 30000);
      
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
        <div 
          class="flex items-center gap-2 p-3 mb-3 rounded-lg bg-kong-accent-red/10 text-kong-accent-red border border-kong-accent-red/20 text-sm animate-fadeIn" 
          role="alert"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{errorMessage}</span>
        </div>
      {/if}
      
      <div class="flex flex-col gap-3 px-1">
        {#each filteredWallets as wallet}
          <button
            class="relative flex items-center justify-between w-full px-4 py-4 rounded-xl border border-kong-text-primary/10 bg-kong-bg-dark/10 
                   will-change-transform backface-hidden transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out 
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kong-primary 
                   disabled:opacity-50 disabled:cursor-not-allowed 
                   hover:not(:disabled):border-kong-primary hover:not(:disabled):bg-kong-primary/25 hover:not(:disabled):translate-y-[-1px] hover:not(:disabled):shadow-[0_4px_24px_-2px_rgb(0_0_0_/_0.12),0_2px_8px_-2px_rgb(0_0_0_/_0.06)]
                   active:not(:disabled):text-kong-bg-light active:not(:disabled):translate-y-0 active:not(:disabled):transition-transform active:not(:disabled):duration-100 active:not(:disabled):ease-linear
                   {connectingWalletId === wallet.id ? 'border-kong-primary bg-kong-primary/15 text-kong-bg-light animate-pulse-slow' : ''}
                   {wallet.recommended && connectingWalletId !== wallet.id && connectingWalletId !== null ? '' : 
                     (wallet.recommended && connectingWalletId !== wallet.id ? 'recommended not-connecting bg-kong-primary/10 border-kong-primary/20 hover:not(:disabled):not(.connecting):bg-kong-primary/25 hover:not(:disabled):not(.connecting):border-kong-primary/30 hover:not(:disabled):not(.connecting):shadow-[0_4px_24px_-2px_rgb(var(--primary)/_0.15),0_2px_8px_-2px_rgb(var(--primary)/_0.1)]' : '')}"
            on:click={() => handleConnect(wallet.id)}
            disabled={connecting}
            aria-busy={connectingWalletId === wallet.id}
          >
            <div class="flex items-center gap-4">
              <div class="relative w-12 h-12">
                <img 
                  src={wallet.icon} 
                  alt={wallet.name} 
                  class="w-12 h-12 rounded-xl transition-transform duration-200 dark:brightness-100 brightness-[0.85] transform translate-Z-0 group-hover:dark:brightness-100 group-hover:brightness-90" 
                />
                {#if connectingWalletId === wallet.id}
                  <div class="absolute top-0 left-0 w-full h-full rounded-full border-2 border-transparent border-t-kong-accent-green border-r-kong-accent-green/30 border-b-kong-accent-green/10 animate-spin"></div>
                {/if}
              </div>
              <div class="flex flex-col gap-1 flex-1 text-left">
                <span class="font-medium text-lg text-left flex items-center gap-2">
                  {wallet.name}
                  {#if wallet.unsupported}
                    <span 
                      class="text-xs font-semibold px-1.5 py-0.5 rounded bg-kong-accent-yellow/20 text-kong-accent-yellow"
                      use:tooltip={{ text: 'The Plug website is no longer available. Use with caution. We recommend migrating to a different wallet.', direction: 'top' }}
                    >
                      Unsupported
                    </span>
                  {/if}
                  {#if wallet.recommended && !wallet.unsupported}
                    <Badge variant="blue" size="xs">Recommended</Badge>
                  {/if}
                </span>
                {#if wallet.description}
                  <span class="text-kong-text-secondary text-sm">{wallet.description}</span>
                {/if}
              </div>
            </div>
            <svg
              class="text-kong-text-secondary opacity-50 transition-transform duration-200 group-hover:transform group-hover:translate-x-1 group-hover:opacity-100"
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
  /* Removed styles that are now inline */
  
  /* Keep keyframes if they are used by inline classes */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
