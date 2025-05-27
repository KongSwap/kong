<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import AdminResolutionModal from "../AdminResolutionModal.svelte";
  import { createEventDispatcher } from "svelte";
  import { getMarket } from "$lib/api/predictionMarket";
  import { page } from "$app/stores";
  import { get } from "svelte/store";

  export let isUserAdmin: boolean;
  export let loadingAdmin: boolean;
  export let adminError: string | null = null;
  export let isMarketResolved: boolean;
  export let isMarketVoided: boolean;
  export let onOpenVoidDialog: () => void;
  export let market: any;

  let showAdminResolutionModal = false;

  const dispatch = createEventDispatcher();

  async function handleAdminResolved() {
    // Refresh market data after resolution
    const marketId = BigInt(get(page).params.id);
    const marketData = await getMarket(marketId);
    dispatch('marketUpdated', { market: marketData[0] });
  }

  function openResolutionModal() {
    showAdminResolutionModal = true;
  }
  function closeResolutionModal() {
    showAdminResolutionModal = false;
  }
</script>

{#if loadingAdmin}
  <Panel variant="transparent" className="backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn">
    <div class="text-sm text-kong-text-secondary">Checking admin status...</div>
  </Panel>
{:else if isUserAdmin}
  <Panel variant="transparent" className="backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn">
    <h3 class="text-sm font-bold text-kong-error mb-2">Admin Controls</h3>
    <div class="text-xs text-kong-text-secondary mb-2">You are an admin. Use these tools with caution.</div>
    <!-- Admin actions -->
    {#if !isMarketResolved && !isMarketVoided}
      <button class="bg-kong-accent-yellow text-kong-text-on-primary px-3 py-2 rounded mb-2 hover:bg-yellow-700 transition-colors w-full" on:click={openResolutionModal}>
        Resolve Market
      </button>
      <button class="bg-kong-error text-kong-text-on-primary px-3 py-2 rounded hover:bg-red-400 transition-colors w-full" on:click={onOpenVoidDialog}>
        Void Market
      </button>
    {/if}
  </Panel>
  <AdminResolutionModal
    isOpen={showAdminResolutionModal}
    {market}
    onClose={closeResolutionModal}
    onResolved={handleAdminResolved}
  />
{:else if adminError}
  <Panel variant="transparent" className="backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn">
    <div class="text-sm text-kong-error">{adminError}</div>
  </Panel>
{/if} 