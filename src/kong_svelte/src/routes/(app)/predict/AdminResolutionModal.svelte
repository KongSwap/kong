<script lang="ts">
  import Dialog from "$lib/components/common/Dialog.svelte";
  import { forceResolveMarket } from "$lib/api/predictionMarket";
  import { toastStore } from "$lib/stores/toastStore";
  import { AlertTriangle } from "lucide-svelte";

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

  async function handleForceResolve() {
    if (selectedOutcome === null) {
      toastStore.error("Please select a winning outcome");
      return;
    }

    try {
      isSubmitting = true;
      await forceResolveMarket(market.id, selectedOutcome);
      toastStore.success(`Market has been force resolved successfully`);
      onResolved();
      close();
    } catch (error) {
      console.error("Failed to force resolve market:", error);
      toastStore.error(error instanceof Error ? error.message : "Failed to force resolve market");
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Dialog
  open={isOpen}
  title="Force Resolution"
  onClose={close}
  showClose={false}
>
  <div class="flex flex-col gap-4">
    <div class="bg-kong-warning/10 border border-kong-warning/20 rounded-lg p-3">
      <div class="flex items-center gap-2 mb-2">
        <AlertTriangle class="w-4 h-4 text-kong-warning" />
        <span class="text-sm font-medium text-kong-warning">Force Resolution Warning</span>
      </div>
      <p class="text-sm text-kong-text-secondary">
        This action will immediately resolve the market and distribute payouts. 
        This bypasses the normal dual approval process and should only be used in exceptional circumstances.
      </p>
    </div>
    
    <div class="text-kong-text-primary text-lg font-semibold">
      Select the winning outcome
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
          on:click={() => {
            selectedOutcome = BigInt(index);
          }}
          disabled={isSubmitting}
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
        class="px-4 py-2 rounded bg-kong-warning text-kong-text-on-primary font-bold hover:bg-kong-warning/90 disabled:opacity-50 transition-colors"
        on:click={handleForceResolve}
        disabled={isSubmitting || selectedOutcome === null}
      >
        {isSubmitting ? 'Force Resolving...' : 'Force Resolve Market'}
      </button>
    </div>
  </div>
</Dialog> 