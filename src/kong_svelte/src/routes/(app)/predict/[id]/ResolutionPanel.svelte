<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { Trophy, AlertCircle, CheckCircle } from "lucide-svelte";
  import type { Market } from "$lib/types/predictionMarket";
  import { resolveMarketViaAdmin } from "$lib/api/predictionMarket";
  import { toastStore } from "$lib/stores/toastStore";
  
  let {
    market,
    outcomes,
    onMarketResolved
  } = $props<{
    market: Market;
    outcomes: string[];
    onMarketResolved: () => void;
  }>();
  
  let selectedOutcome = $state<number | null>(null);
  let resolving = $state(false);
  let resolutionError = $state<string | null>(null);
  let showConfirmDialog = $state(false);
  
  async function handleResolve() {
    if (selectedOutcome === null) return;
    
    try {
      resolving = true;
      resolutionError = null;
      
      await resolveMarketViaAdmin(
        BigInt(market.id),
        BigInt(selectedOutcome)
      );
      
      toastStore.add({
        title: "Resolution Submitted",
        message: "Your resolution has been submitted for admin verification.",
        type: "success",
      });
      
      // Notify parent to refresh market data
      onMarketResolved();
      
    } catch (error) {
      console.error("Resolution error:", error);
      resolutionError = error instanceof Error ? error.message : "Failed to resolve market";
      toastStore.add({
        title: "Resolution Failed",
        message: resolutionError,
        type: "error",
      });
    } finally {
      resolving = false;
      showConfirmDialog = false;
    }
  }
  
  function openConfirmDialog() {
    if (selectedOutcome === null) {
      toastStore.add({
        title: "Select Outcome",
        message: "Please select a winning outcome before resolving",
        type: "warning",
      });
      return;
    }
    showConfirmDialog = true;
  }
</script>

<Panel
  variant="transparent"
  className="bg-kong-bg-primary/80 backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn"
>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <div class="p-2 rounded-lg bg-kong-accent-yellow/20">
        <Trophy class="w-5 h-5 text-kong-accent-yellow" />
      </div>
      <div>
        <h2 class="text-lg font-semibold text-kong-text-primary">
          Resolve Market
        </h2>
        <p class="text-sm text-kong-text-secondary">
          Select the winning outcome for this market
        </p>
      </div>
    </div>
    
    <!-- Info Alert -->
    <div class="flex items-start gap-2 p-3 rounded-lg bg-kong-accent-blue/10 border border-kong-accent-blue/20">
      <AlertCircle class="w-4 h-4 text-kong-accent-blue mt-0.5 flex-shrink-0" />
      <div class="text-sm text-kong-text-secondary">
        <p class="font-medium text-kong-accent-blue mb-1">Resolution Process</p>
        <p>As the market creator, you can select the winning outcome. Your selection will be submitted for admin verification before payouts are distributed.</p>
      </div>
    </div>
    
    <!-- Outcome Selection -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-kong-text-secondary">
        Select Winning Outcome
      </label>
      {#each outcomes as outcome, index}
        <button
          class="w-full p-3 rounded-lg border transition-all text-left
            {selectedOutcome === index 
              ? 'bg-kong-accent-green/10 border-kong-accent-green text-kong-accent-green' 
              : 'bg-kong-bg-secondary/30 border-kong-border/50 hover:border-kong-border hover:bg-kong-bg-secondary/50'}"
          onclick={() => selectedOutcome = index}
          disabled={resolving}
        >
          <div class="flex items-center justify-between">
            <span class="font-medium">{outcome}</span>
            {#if selectedOutcome === index}
              <CheckCircle class="w-5 h-5" />
            {/if}
          </div>
        </button>
      {/each}
    </div>
    
    {#if resolutionError}
      <div class="p-3 rounded-lg bg-kong-error/10 border border-kong-error/20">
        <p class="text-sm text-kong-error">{resolutionError}</p>
      </div>
    {/if}
    
    <!-- Action Button -->
    <ButtonV2
      theme="accent-green"
      variant="solid"
      fullWidth
      onclick={openConfirmDialog}
      disabled={resolving || selectedOutcome === null}
    >
      {resolving ? 'Submitting Resolution...' : 'Submit Resolution'}
    </ButtonV2>
  </div>
</Panel>

<!-- Confirmation Dialog -->
{#if showConfirmDialog}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div 
      class="absolute inset-0 bg-black/50 backdrop-blur-sm"
      onclick={() => showConfirmDialog = false}
    ></div>
    <div class="relative bg-kong-bg-primary border border-kong-border rounded-lg p-6 max-w-md w-full shadow-xl">
      <h3 class="text-lg font-semibold text-kong-text-primary mb-2">
        Confirm Resolution
      </h3>
      <p class="text-kong-text-secondary mb-4">
        Are you sure you want to resolve this market with <span class="font-medium text-kong-accent-green">"{outcomes[selectedOutcome!]}"</span> as the winner?
      </p>
      <p class="text-sm text-kong-text-secondary/80 mb-6">
        This action will be submitted for admin verification and cannot be undone.
      </p>
      <div class="flex gap-3">
        <ButtonV2
          theme="secondary"
          variant="solid"
          fullWidth
          onclick={() => showConfirmDialog = false}
          disabled={resolving}
        >
          Cancel
        </ButtonV2>
        <ButtonV2
          theme="accent-green"
          variant="solid"
          fullWidth
          onclick={handleResolve}
          disabled={resolving}
        >
          {resolving ? 'Submitting...' : 'Confirm'}
        </ButtonV2>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
</style>