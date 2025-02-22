<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { resolveMarketViaAdmin } from "$lib/api/predictionMarket";
  import { toastStore } from "$lib/stores/toastStore";

  export let isOpen = false;
  export let market: any = null;

  const dispatch = createEventDispatcher();

  let selectedOutcome: number | null = null;
  let isSubmitting = false;

  function close() {
    selectedOutcome = null;
    isSubmitting = false;
    dispatch("close");
  }

  async function handleResolve() {
    if (selectedOutcome === null) {
      toastStore.error("Please select a winning outcome");
      return;
    }

    try {
      isSubmitting = true;
      await resolveMarketViaAdmin(market.id, selectedOutcome);
      toastStore.success("Market resolved successfully");
      dispatch("resolved");
      close();
    } catch (error) {
      console.error("Failed to resolve market:", error);
      toastStore.error(error instanceof Error ? error.message : "Failed to resolve market");
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Modal {isOpen} on:close={close}>
  <div class="p-4">
    <h2 class="text-lg font-semibold mb-4">Resolve Market</h2>
    <p class="text-sm text-kong-pm-text-secondary mb-4">{market?.question}</p>
    
    <div class="space-y-2">
      <h3 class="text-sm font-medium mb-2">Select Winning Outcome:</h3>
      {#each market?.outcomes || [] as outcome, index}
        <button
          class="w-full p-2 text-left rounded border {selectedOutcome === index ? 'border-kong-accent-green bg-kong-accent-green/10' : 'border-kong-pm-border hover:border-kong-accent-green/50'} transition-colors"
          on:click={() => selectedOutcome = index}
        >
          {outcome}
        </button>
      {/each}
    </div>

    <div class="mt-6 flex justify-end space-x-3">
      <button
        class="px-4 py-2 text-sm font-medium text-kong-pm-text-secondary hover:text-kong-text-primary transition-colors"
        on:click={close}
        disabled={isSubmitting}
      >
        Cancel
      </button>
      <button
        class="px-4 py-2 text-sm font-medium bg-kong-accent-green text-white rounded hover:bg-kong-accent-green/90 disabled:opacity-50 transition-colors"
        on:click={handleResolve}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Resolving...' : 'Resolve Market'}
      </button>
    </div>
  </div>
</Modal> 