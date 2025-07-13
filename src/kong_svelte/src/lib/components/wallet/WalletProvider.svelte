
<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { walletProviderStore as store, filteredWallets, groupedWallets, getAllWalletsFlat } from "$lib/stores/walletProviderStore";
  import { recentWalletsStore, type RecentWallet } from "$lib/stores/recentWalletsStore";
  import { keyboardNavigation } from "$lib/actions/keyboardNavigation";
  import Modal from "$lib/components/common/Modal.svelte";
  import { modalFactory } from "$lib/components/common/modals";
  import WalletSearch from "./WalletSearch.svelte";
  import RecentWalletsSection from "./RecentWalletsSection.svelte";
  import WalletGrid from "./WalletGrid.svelte";
  import WalletEmptyState from "./WalletEmptyState.svelte";
  import ErrorMessage from "$lib/components/common/ErrorMessage.svelte";
  import { LogIn } from "lucide-svelte";

  // Props
  const {
    isOpen = false,
    onClose = () => {},
    onLogin = () => {},
  } = $props<{
    isOpen?: boolean;
    onClose?: () => void;
    onLogin?: () => void;
  }>();

  // Reactive state
  let storeState = $state<any>({});
  let filtered = $state<any[]>([]);
  let grouped = $state<any>({});
  let recentWallets = $state<RecentWallet[]>([]);
  
  // Subscribe to stores
  $effect(() => {
    const unsubscribe1 = store.subscribe(s => {
      storeState = s;
    });
    const unsubscribe2 = filteredWallets.subscribe(f => {
      filtered = f;
    });
    const unsubscribe3 = groupedWallets.subscribe(g => {
      grouped = g;
    });
    const unsubscribe4 = recentWalletsStore.subscribe(r => {
      recentWallets = r;
    });
    
    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
      unsubscribe4();
    };
  });

  let searchRef = $state<any>(null);
  let containerRef = $state<HTMLDivElement | null>(null);

  // Handler functions
  async function handleClearAllWallets() {
    try {
      const confirmed = await modalFactory.confirmations.destructive(
        'clear all recent wallets',
        'This will remove all your recently used wallets from history'
      );
      
      if (confirmed) {
        recentWalletsStore.clearAll();
      }
    } catch (error) {
      // User cancelled - no action needed
      console.log('Clear wallets cancelled');
    }
  }

  // Initialize
  onMount(async () => {
    if (browser) {
      await recentWalletsStore.initialize();
    }
  });

  // Sync with props
  $effect(() => {
    if (isOpen && !storeState.isOpen) {
      store.open(onLogin);
    } else if (!isOpen && storeState.isOpen) {
      store.close();
    }
  });

  // Keyboard navigation
  const navigationOptions = $derived({
    items: getAllWalletsFlat(),
    focusedIndex: storeState.focusedWalletIndex,
    onNavigate: (index: number) => store.setFocusedWalletIndex(index),
    onSelect: (index: number) => {
      const wallet = getAllWalletsFlat()[index];
      if (wallet) store.connectWallet(wallet.id, 'all');
    },
    onEscape: () => {
      if (storeState.showClearConfirm) {
        store.setShowClearConfirm(false);
      } else {
        closeModal();
      }
    },
    onSearch: () => searchRef?.focus()
  });

  // Handlers
  function closeModal() {
    store.close();
    onClose();
  }

  function getWalletById(walletId: string) {
    return filtered.find((w: any) => w.id === walletId);
  }

  function getFocusedWalletId(): string | undefined {
    const wallets = getAllWalletsFlat();
    return wallets[storeState.focusedWalletIndex]?.id;
  }
</script>

<Modal
  isOpen={storeState.isOpen}
  onClose={closeModal}
  closeOnEscape={!storeState.connecting}
  closeOnClickOutside={!storeState.connecting}
  className="!p-0 md:!p-4"
  width="min(800px, 95vw)"
  height="auto"
  minHeight="min(600px, 95vh)"
  isPadded={false}
>
  {#snippet titleSlot()}
    <h2 class="text-2xl font-semibold modal-title flex items-center gap-2">
      <LogIn size={20} class="text-kong-primary" />
      Connect Wallet
    </h2>
  {/snippet}

  <div 
    bind:this={containerRef}
    class="wallet-provider-content"
    use:keyboardNavigation={navigationOptions}
  >
    <!-- Error Message -->
    {#if storeState.errorMessage && !storeState.connecting}
      <div class="px-4 py-3">
        <ErrorMessage 
          message={storeState.errorMessage}
          onDismiss={() => store.setErrorMessage(null)}
        />
      </div>
    {/if}


    <!-- Main Content -->
    <div class="wallet-list-container">
      <div class="wallet-list">
        <!-- Recent Wallets -->
        <RecentWalletsSection
          {recentWallets}
          {getWalletById}
          isConnecting={storeState.connecting}
          clickedWalletInfo={storeState.clickedWalletInfo}
          onConnect={(walletId: string) => store.connectWallet(walletId, 'recent')}
          onRemove={(walletId) => recentWalletsStore.remove(walletId)}
          onClearAll={handleClearAllWallets}
        />

        <!-- Search -->
        <WalletSearch
          bind:this={searchRef}
          value={storeState.searchQuery}
          onInput={(value) => store.setSearchQuery(value)}
          onKeyDown={(e) => containerRef?.dispatchEvent(new KeyboardEvent('keydown', e))}
          autoFocus={true}
        />

        <!-- Results -->
        {#if filtered.length === 0}
          <WalletEmptyState
            hasSearchQuery={!!storeState.searchQuery}
            onClearSearch={() => store.setSearchQuery("")}
          />
        {:else}
          <WalletGrid
            groupedWallets={grouped}
            {recentWallets}
            isConnecting={storeState.connecting}
            clickedWalletInfo={storeState.clickedWalletInfo}
            focusedWalletId={getFocusedWalletId()}
            onConnect={(walletId: string) => store.connectWallet(walletId, 'all')}
          />
        {/if}
      </div>
    </div>
  </div>
</Modal>

<style lang="postcss">
  .wallet-provider-content {
    @apply w-full h-full flex flex-col overflow-hidden;
  }

  .wallet-list-container {
    @apply flex-1 flex flex-col;
  }

  .wallet-list {
    @apply overflow-y-auto flex-1 px-1 sm:px-2 pb-4;
    scrollbar-gutter: stable;
    max-height: 80vh;
    scrollbar-width: thin;
    scrollbar-color: rgba(var(--primary), 0.5) rgba(var(--bg-dark), 0.2);
  }

  .wallet-list::-webkit-scrollbar {
    width: 8px;
  }

  .wallet-list::-webkit-scrollbar-track {
    background: rgba(var(--bg-dark), 0.2);
    border-radius: 0;
  }

  .wallet-list::-webkit-scrollbar-thumb {
    background-color: rgba(var(--primary), 0.5);
    border-radius: 3px;
    border: 2px solid rgb(var(--bg-dark));
  }
</style>
