<script lang="ts">
  import { Check } from "lucide-svelte";
  import Dialog from "$lib/components/common/Dialog.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  
  export let open = false;
  export let onClose: () => void;
  export let onInitialize: (outcomeIndex: number) => void;
  export let outcomes: string[] = [];
  export let activating = false;
  export let formattedMinInitialBetString = "";
  export let preselectedOutcome: number | null = null;
  
  let selectedOutcome: number | null = null;
  
  // Use preselected outcome if provided
  $: if (preselectedOutcome !== null && open) {
    selectedOutcome = preselectedOutcome;
  }
  
</script>

<Dialog
  title="Confirm Market Activation"
  open={open}
  onClose={() => {
    selectedOutcome = null;
    onClose();
  }}
  showClose={false}
>
  <div class="flex flex-col gap-4">
    {#if preselectedOutcome !== null}
      <!-- Confirmation view when outcome is preselected -->
      <div class="text-kong-text-primary text-base">
        You are about to activate this market with a {formattedMinInitialBetString} bet on:
      </div>
      <div class="p-4 bg-kong-accent-green/10 border-2 border-kong-accent-green rounded-lg">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-kong-accent-green/20">
            <Check class="w-6 h-6 text-kong-accent-green" />
          </div>
          <div>
            <span class="text-xs text-kong-text-secondary block">Selected outcome</span>
            <span class="text-lg font-semibold text-kong-text-primary">{outcomes[selectedOutcome || 0]}</span>
          </div>
        </div>
      </div>
      <div class="text-kong-text-secondary text-sm">
        This will place a {formattedMinInitialBetString} bet and make the market publicly visible. This action cannot be undone.
      </div>
    {:else}
      <!-- Original selection view -->
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
    {/if}
    <div class="flex gap-3 justify-end pt-2">
      <ButtonV2
        theme="secondary"
        size="lg"
        onclick={() => {
          selectedOutcome = null;
          onClose();
        }}
        disabled={activating}
      >
        Cancel
      </ButtonV2>
      <ButtonV2
        theme="accent-green"
        size="lg"
        onclick={() => {
          if (selectedOutcome !== null) {
            onInitialize(selectedOutcome);
          }
        }}
        disabled={selectedOutcome === null || activating}
      >
        {activating ? 'Activating...' : 'Activate Market'}
      </ButtonV2>
    </div>
  </div>
</Dialog> 