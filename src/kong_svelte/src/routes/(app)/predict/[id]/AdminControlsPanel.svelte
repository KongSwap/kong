<script lang="ts">
  import Card from "$lib/components/common/Card.svelte";
  import AdminResolutionModal from "../AdminResolutionModal.svelte";
  import { createEventDispatcher } from "svelte";
  import { getMarket } from "$lib/api/predictionMarket";
  import { page } from "$app/stores";
  import { get } from "svelte/store";
  import { Shield } from "lucide-svelte";

  let { isUserAdmin, loadingAdmin, adminError = null, onOpenVoidDialog, market } = $props<{
    isUserAdmin: boolean;
    loadingAdmin: boolean;
    adminError?: string | null;
    onOpenVoidDialog: () => void;
    market: any;
  }>();
  
  // Derive values from market
  let isMarketClosed = $derived(market?.status?.Closed !== undefined);
  let isMarketResolved = $derived(isMarketClosed);
  let isMarketVoided = $derived(market?.status?.Voided !== undefined);

  let showAdminResolutionModal = $state(false);

  const dispatch = createEventDispatcher();

  async function handleAdminResolved() {
    // Refresh market data after resolution
    const marketId = BigInt(get(page).params.id);
    const marketData = await getMarket(marketId);
    dispatch('marketUpdated', { market: marketData[0] });
  }
</script>

{#if loadingAdmin}
  <Card>
    <div class="p-4 text-sm text-kong-text-secondary">Checking admin status...</div>
  </Card>
{:else if isUserAdmin}
  <Card hasHeader={true}>
    <svelte:fragment slot="header">
      <div class="flex items-center gap-2">
        <Shield class="w-5 h-5 text-kong-error" />
        <h3 class="text-base font-semibold text-kong-text-primary">Admin Controls</h3>
      </div>
      <span class="text-xs text-kong-error bg-kong-error/10 px-2 py-1 rounded-full">
        Admin Only
      </span>
    </svelte:fragment>
    
    <div class="p-4">
      <div class="text-xs text-kong-text-secondary mb-3">Use these tools with caution.</div>
      <!-- Admin actions -->
      {#if !isMarketResolved && !isMarketVoided}
        <div class="space-y-2">
          <button class="bg-kong-accent-yellow text-kong-text-on-primary px-3 py-2 rounded hover:bg-yellow-700 transition-colors w-full text-sm font-medium" on:click={() => showAdminResolutionModal = true}>
            Force Resolution
          </button>
          <button class="bg-kong-error text-kong-text-on-primary px-3 py-2 rounded hover:bg-red-400 transition-colors w-full text-sm font-medium" on:click={onOpenVoidDialog}>
            Void Market
          </button>
        </div>
      {:else}
        <div class="text-sm text-kong-text-secondary text-center">
          Market already {isMarketResolved ? 'resolved' : 'voided'}
        </div>
      {/if}
    </div>
  </Card>
  <AdminResolutionModal
    isOpen={showAdminResolutionModal}
    {market}
    onClose={() => showAdminResolutionModal = false}
    onResolved={handleAdminResolved}
  />
{:else if adminError}
  <Card>
    <div class="p-4 text-sm text-kong-error">{adminError}</div>
  </Card>
{/if} 