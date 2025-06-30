<script lang="ts">
  import { page } from "$app/state";
  import SideNav from "./SideNav.svelte";
  import ValueOverview from "./ValueOverview.svelte";
  import { WalletDataService, walletDataStore } from "$lib/services/wallet";
  import Card from "$lib/components/common/Card.svelte";
  import { Copy, CheckCircle } from "lucide-svelte";

  let { children } = $props<{ children: any }>();

  // Track display state
  let showCopiedIndicator = $state(false);
  
  // Get principal from the URL params
  let principal = $derived(page.params.principalId);

  // Get loading state from store (pages will update this)
  let isLoading = $derived($walletDataStore.isLoading);
  let error = $derived($walletDataStore.error);

  // Monitor principal changes to reset wallet data
  $effect(() => {
    const currentPrincipal = principal;
    const currentWallet = $walletDataStore.currentWallet;
    
    // If principal changed and we have data for a different wallet, reset the store
    if (currentPrincipal && currentWallet && currentPrincipal !== currentWallet) {
      WalletDataService.reset();
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
      <ValueOverview {principal} />
      
      <!-- Principal ID Card with Copy Button -->
      <Card isPadded={true}>
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
      </Card>
      
      <SideNav {principal} />
    </div>
    <!-- Content Area -->
    <div class="lg:col-span-3 space-y-6">
      <!-- Pass principal to child components via slot props -->
      {@render children?.({principal})}
    </div>
  </div>
</div>
