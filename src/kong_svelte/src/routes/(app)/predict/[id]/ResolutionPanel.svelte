<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { Trophy, AlertCircle, CheckCircle, Info } from "lucide-svelte";
  import type { Market } from "$lib/types/predictionMarket";
  import { proposeResolution, getResolutionProposal } from "$lib/api/predictionMarket";
  import { toastStore } from "$lib/stores/toastStore";
  import { auth } from "$lib/stores/auth";
  import type { ResolutionProposalInfo } from "../../../../../../declarations/prediction_markets_backend/prediction_markets_backend.did";
  
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
  let loadingResolutionDetails = $state(false);
  let existingResolutionDetails = $state<ResolutionProposalInfo | null>(null);
  let hasExistingResolution = $derived(existingResolutionDetails !== null && existingResolutionDetails.creator_vote.length > 0);
  
  // Load existing resolution details when component mounts
  $effect(() => {
    if (market?.id) {
      loadResolutionDetails();
    }
  });
  
  async function loadResolutionDetails() {
    try {
      loadingResolutionDetails = true;
      const details = await getResolutionProposal(BigInt(market.id));
      console.log("details", details);
      existingResolutionDetails = details;
      
      // If there are existing resolution details, prefill the form
      if (details && details.creator_vote.length > 0) {
        selectedOutcome = Number(details.creator_vote[0].proposed_outcomes[0]);
      }
    } catch (error) {
      console.error("Failed to load resolution details:", error);
      existingResolutionDetails = null;
    } finally {
      loadingResolutionDetails = false;
    }
  }
  
  async function handleResolve() {
    if (selectedOutcome === null) return;
    
    try {
      resolving = true;
      resolutionError = null;
      
      console.log("Debug - Market creator:", market.creator?.toText());
      console.log("Debug - Current user:", $auth.account?.owner);
      console.log("Debug - Are they equal?", market.creator?.toText() === $auth.account?.owner);
      
      await proposeResolution(
        BigInt(market.id),
        BigInt(selectedOutcome)
      );
      
      toastStore.add({
        title: hasExistingResolution ? "Resolution Updated" : "Resolution Submitted",
        message: hasExistingResolution 
          ? "Your resolution has been updated and is awaiting admin verification."
          : "Your resolution has been submitted for admin verification.",
        type: "success",
      });
      
      // Notify parent to refresh market data
      onMarketResolved();
      
      // Reload resolution details to show updated state
      await loadResolutionDetails();
      
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
    
    <!-- Loading Resolution Details -->
    {#if loadingResolutionDetails}
      <div class="flex items-start gap-2 p-3 rounded-lg bg-kong-bg-secondary/30 border border-kong-border/50">
        <div class="w-4 h-4 mt-0.5 flex-shrink-0">
          <div class="w-4 h-4 border-2 border-kong-text-secondary/30 border-t-kong-text-secondary rounded-full animate-spin"></div>
        </div>
        <div class="text-sm text-kong-text-secondary">
          <p class="font-medium mb-1">Loading Resolution Details...</p>
          <p>Checking for existing resolution submissions.</p>
        </div>
      </div>
    {:else if hasExistingResolution}
      <!-- Existing Resolution Info -->
      <div class="flex items-start gap-2 p-3 rounded-lg bg-kong-accent-green/10 border border-kong-accent-green/20">
        <Info class="w-4 h-4 text-kong-accent-green mt-0.5 flex-shrink-0" />
        <div class="text-sm text-kong-text-secondary">
          <p class="font-medium text-kong-accent-green mb-1">Resolution Already Submitted</p>
          <p>You have already submitted a resolution for this market. Your selection is awaiting admin verification.</p>
          {#if existingResolutionDetails && existingResolutionDetails.creator_vote.length > 0}
            {@const selectedOutcomeIndex = Number(existingResolutionDetails.creator_vote[0].proposed_outcomes[0])}
            {@const selectedOutcomeText = outcomes[selectedOutcomeIndex]}
            <p class="mt-2 p-2 bg-kong-bg-secondary/20 rounded border-l-2 border-kong-accent-green">
              <span class="font-medium text-kong-accent-green">Your Selection:</span>
              <span class="text-kong-text-primary ml-2">"{selectedOutcomeText}"</span>
            </p>
          {/if}
          {#if existingResolutionDetails}
            <p class="mt-1 text-xs text-kong-text-secondary/80">
              Submitted: {new Date(Number(existingResolutionDetails.created_at) / 1_000_000).toLocaleString()}
            </p>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Info Alert -->
      <div class="flex items-start gap-2 p-3 rounded-lg bg-kong-accent-blue/10 border border-kong-accent-blue/20">
        <AlertCircle class="w-4 h-4 text-kong-accent-blue mt-0.5 flex-shrink-0" />
        <div class="text-sm text-kong-text-secondary">
          <p class="font-medium text-kong-accent-blue mb-1">Resolution Process</p>
          <p>As the market creator, you can select the winning outcome. Your selection will be submitted for admin verification before payouts are distributed.</p>
        </div>
      </div>
    {/if}
    
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
      disabled={resolving || selectedOutcome === null || loadingResolutionDetails}
    >
      {loadingResolutionDetails ? 'Loading...' : 
       resolving ? 'Submitting Resolution...' : 
       hasExistingResolution ? 'Update Resolution' : 'Submit Resolution'}
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
        {hasExistingResolution ? 'Update Resolution' : 'Confirm Resolution'}
      </h3>
      <p class="text-kong-text-secondary mb-4">
        Are you sure you want to {hasExistingResolution ? 'update' : 'resolve'} this market with <span class="font-medium text-kong-accent-green">"{outcomes[selectedOutcome!]}"</span> as the winner?
      </p>
      <p class="text-sm text-kong-text-secondary/80 mb-6">
        {hasExistingResolution 
          ? 'This will update your previous resolution submission and reset the admin verification process.'
          : 'This action will be submitted for admin verification and cannot be undone.'}
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