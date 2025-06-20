<script lang="ts">
  import { page } from "$app/state";
  import SideNav from "./SideNav.svelte";
  import ValueOverview from "./ValueOverview.svelte";
  import { WalletDataService, walletDataStore } from "$lib/services/wallet";
  import Panel from "$lib/components/common/Panel.svelte";
  import { Copy, CheckCircle } from "lucide-svelte";

  let { children } = $props<{ children: any }>();

  // Track initialization state
  let isLoading = $derived($walletDataStore.isLoading);
  let error = $state<string | null>(null);
  let showCopiedIndicator = $state(false);
  
  // Get principal from the URL params
  let principal = $derived(page.params.principalId);

  // Keep track of the last loaded principal to prevent repeated loading
  let lastLoadedPrincipal = $state<string | null>(null);

  // Single function to load wallet data
  async function loadWalletData() {
    try {
      // Update local error state
      error = null;
      
      // Skip if no principal or anonymous
      if (!principal || principal === "anonymous") {
        throw new Error("No wallet connected");
      }
            
      // This will handle loading state internally in the store
      await WalletDataService.initializeWallet(principal);
    } catch (err) {
      console.error("Failed to load wallet data:", err);
      error = err instanceof Error ? err.message : "Failed to load wallet data";
    }
  }

  // Monitor wallet data changes
  $effect(() => {
    const walletData = $walletDataStore;
    // Update local error state only when it changes
    if (walletData.error) {
      error = walletData.error;
    }
  });

  // Load data when principalId changes
  $effect(() => {
    // Make a stable non-reactive check by getting values once at the start of the effect
    const currentPrincipal = principal;
    const previousPrincipal = lastLoadedPrincipal;
    const isAlreadyLoading = $walletDataStore.isLoading;
    const currentWallet = $walletDataStore.currentWallet;
    const hasBalances = Object.keys($walletDataStore.balances || {}).length > 0;
    
    if (currentPrincipal && currentPrincipal !== previousPrincipal) {
      // Always load data if the principal changed or we don't have balances
      // But avoid reloading if we're already loading for this principal
      if ((currentWallet !== currentPrincipal || !hasBalances) && 
          !(isAlreadyLoading && currentWallet === currentPrincipal)) {
        lastLoadedPrincipal = currentPrincipal;
        loadWalletData();
      } else {
        lastLoadedPrincipal = currentPrincipal;
      }
    } else if (!currentPrincipal && previousPrincipal) {
      // Reset wallet data if no principal
      WalletDataService.reset();
      lastLoadedPrincipal = null;
    }
  });

  // Format short address for display
  function formatShortAddress(address: string): string {
    if (address.length > 15) {
      return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
    }
    return address;
  }

  // Copy principal ID to clipboard with visual feedback
  function copyPrincipalToClipboard() {
    if (principal) {
      navigator.clipboard.writeText(principal);
      showCopiedIndicator = true;
      setTimeout(() => {
        showCopiedIndicator = false;
      }, 2000);
    }
  }

</script>

<svelte:head>
  <title>Wallet Data - KongSwap</title>
  <meta name="description" content="View wallet data and portfolio distributions" />
</svelte:head>

<div class="container mx-auto max-w-[1300px] text-kong-text-primary my-4 px-4">
  <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
    <!-- Navigation Column -->
    <div class="space-y-6">
      <ValueOverview {principal} {isLoading} {error} />
      
      <!-- Principal ID Panel with Copy Button -->
      <Panel>
        <div class="flex flex-col gap-3">
          <h3 class="text-sm uppercase font-medium text-kong-text-primary">Wallet ID</h3>
          
          <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-kong-bg-primary/30">
            <div class="text-sm font-mono text-kong-text-secondary truncate">
              {formatShortAddress(principal || '')}
            </div>
            
            <button 
              class="p-1.5 rounded-md hover:bg-kong-bg-primary/80 transition-colors text-kong-text-secondary hover:text-kong-primary flex items-center"
              onclick={copyPrincipalToClipboard}
              title="Copy principal ID to clipboard"
              disabled={!principal}
            >
              {#if showCopiedIndicator}
                <CheckCircle size={16} class="text-green-500" />
              {:else}
                <Copy size={16} />
              {/if}
            </button>
          </div>
          
          {#if showCopiedIndicator}
            <div class="text-xs text-center text-kong-success">
              Copied to clipboard!
            </div>
          {/if}
        </div>
      </Panel>
      
      <SideNav {principal} />
    </div>
    <!-- Content Area -->
    <div class="lg:col-span-3 space-y-6">
      <!-- Pass isLoading and error to child components via slot props -->
      {@render children?.({initialDataLoading: isLoading, initError: error})}
    </div>
  </div>
</div>
