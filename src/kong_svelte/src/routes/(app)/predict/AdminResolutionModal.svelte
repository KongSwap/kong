<script lang="ts">
  import Dialog from "$lib/components/common/Dialog.svelte";
  import { resolveMarketViaAdmin } from "$lib/api/predictionMarket";
  import { toastStore } from "$lib/stores/toastStore";
  import { Quote } from "lucide-svelte";

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

<Dialog
  open={isOpen}
  title="Resolve Market"
  onClose={close}
  showClose={false}
>
  <div class="flex flex-col gap-4">
    <div class="text-kong-text-primary text-lg font-semibold">
      Select the winning outcome for this market
    </div>
    <div class="text-kong-text-secondary text-sm">
      Resolving a market is <span class="font-bold text-kong-error">irreversible</span> and will distribute winnings to users. This action cannot be undone.
    </div>
    <div class="text-kong-text-primary text-base font-medium">
      {market?.question}
    </div>
    <div class="bg-kong-bg-secondary border border-kong-border rounded p-3 text-kong-text-secondary text-sm">
      <span class="font-semibold">Market Rules:</span> {market?.rules}
    </div>
    <div class="flex flex-col gap-2">
      {#each market?.outcomes || [] as outcome, index}
        <button
          class="w-full p-2 rounded border transition-colors text-left
            {selectedOutcome === BigInt(index)
              ? 'border-kong-success bg-kong-success/10 font-semibold text-kong-success'
              : 'border-kong-border hover:border-kong-success hover:bg-kong-success/5'}"
          on:click={() => selectedOutcome = BigInt(index)}
        >
          {outcome}
        </button>
      {/each}
    </div>
    <div class="flex gap-3 justify-end pt-2">
      <button
        class="px-4 py-2 rounded bg-kong-bg-secondary text-kong-text-primary hover:bg-kong-bg-primary/40 transition-colors"
        on:click={close}
        disabled={isSubmitting}
      >
        Cancel
      </button>
      <button
        class="px-4 py-2 rounded bg-kong-success text-kong-text-on-primary font-bold hover:bg-kong-success/90 disabled:opacity-50 transition-colors"
        on:click={handleResolve}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Resolving...' : 'Resolve Market'}
      </button>
    </div>
  </div>
</Dialog> 