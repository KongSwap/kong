<script lang="ts">
  import { Check } from "lucide-svelte";
  import Dialog from "$lib/components/common/Dialog.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  
  export let open = false;
  export let onClose: () => void;
  export let onInitialize: (outcomeIndex: number) => void;
  export let outcomes: string[] = [];
  export let initializing = false;
  export let formattedMinInitialBetString = "";
  
  let selectedOutcome: number | null = null;
  
  function handleInitialize() {
    if (selectedOutcome !== null) {
      onInitialize(selectedOutcome);
    }
  }
  
  function handleClose() {
    selectedOutcome = null;
    onClose();
  }
</script>

<Dialog
  title="Confirm Market Initialization"
  open={open}
  onClose={handleClose}
  showClose={false}
>
  <div class="flex flex-col gap-4">
    <div class="text-kong-text-primary text-base font-semibold">
      Choose an outcome to place your initial {formattedMinInitialBetString} bet and initialize this market.
    </div>
    <div class="text-kong-text-secondary text-sm">
      This action is <span class="font-bold text-kong-error">irreversible</span> and will make the market public.
    </div>
    <div class="flex flex-col gap-2">
      {#each outcomes as outcome, index}
        <button
          class="w-full p-4 flex justify-between items-center rounded border transition-colors text-left
            {selectedOutcome === index
              ? 'border-kong-primary bg-kong-primary/10 font-semibold text-kong-primary'
              : 'border-kong-border hover:border-kong-primary hover:bg-kong-primary/5'}"
          onclick={() => selectedOutcome = index}
        >
        <div class="flex flex-col gap-2">
          <span class="text-xs text-kong-text-secondary">Outcome {index + 1}</span>
            <span class="text-kong-text-primary font-medium">{outcome}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-kong-text-secondary">
            {#if selectedOutcome === index}
              <span class="text-kong-success flex items-center gap-1 bg-kong-success/10 px-2 py-1 rounded-md font-bold">
                <Check class="w-3 h-3" />
                Selected
              </span>
            {/if}
          </span>
        </div>
        </button>
      {/each}
    </div>
    <div class="flex gap-3 justify-end pt-2">
      <ButtonV2
        theme="secondary"
        onclick={handleClose}
        disabled={initializing}
      >
        Cancel
      </ButtonV2>
      <ButtonV2
        theme="accent-green"
        onclick={handleInitialize}
        disabled={selectedOutcome === null || initializing}
      >
        {initializing ? 'Initializing...' : 'Initialize Market'}
      </ButtonV2>
    </div>
  </div>
</Dialog> 