<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { resolveMarketViaAdmin } from "$lib/api/predictionMarket";
  import { toastStore } from "$lib/stores/toastStore";

  let { isOpen = false, market = null, onClose = () => {}, onResolved = () => {} } = $props<{
    isOpen: boolean;
    market: any;
    onClose: () => void;
    onResolved: () => void;
  }>();

  let selectedOutcome: bigint | null = $state(null);
  let isSubmitting = $state(false);

  function close() {
    selectedOutcome = null;
    isSubmitting = false;
    onClose();
  }

  async function handleResolve() {
    if (selectedOutcome === null) {
      toastStore.error("Please select a winning outcome");
      return;
    }

    try {
      isSubmitting = true;
      await resolveMarketViaAdmin(market.id, selectedOutcome);
      toastStore.success(`Market "${market.question}" resolved to ${selectedOutcome} successfully`);
      onResolved();
      close();
    } catch (error) {
      console.error("Failed to resolve market:", error);
      toastStore.error(error instanceof Error ? error.message : "Failed to resolve market");
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Modal {isOpen} onClose={close} variant="transparent" title="Resolve Market">
  <div class="p-4">
    <p class="text-lg text-kong-text-secondary mb-4">{market?.question}</p>
    
    <div class="space-y-2">
      <h3 class="text-sm font-medium mb-2">Select Winning Outcome:</h3>
      {#each market?.outcomes || [] as outcome, index}
        <button
          class="w-full p-2 text-left rounded border {selectedOutcome === BigInt(index) ? 'border-kong-accent-green bg-kong-accent-green/10' : 'border-kong-border hover:border-kong-accent-green/50'} transition-colors"
          onclick={() => selectedOutcome = BigInt(index)}
        >
          {outcome}
        </button>
      {/each}
    </div>

    <div class="mt-6 flex justify-end space-x-3">
      <button
        class="px-4 py-2 text-sm font-medium text-kong-text-secondary hover:text-kong-text-primary transition-colors"
        onclick={close}
        disabled={isSubmitting}
      >
        Cancel
      </button>
      <button
        class="px-4 py-2 text-sm font-medium bg-kong-accent-green text-white rounded hover:bg-kong-accent-green/90 disabled:opacity-50 transition-colors"
        onclick={handleResolve}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Resolving...' : 'Resolve Market'}
      </button>
    </div>
  </div>
</Modal> 