<script lang="ts">
  import Card from "$lib/components/common/Card.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import Dialog from "$lib/components/common/Dialog.svelte";
  import { Trophy, AlertCircle, CheckCircle, Info } from "lucide-svelte";
  import type { Market } from "$lib/types/predictionMarket";
  import { proposeResolution, getResolutionProposal } from "$lib/api/predictionMarket";
  import { toastStore } from "$lib/stores/toastStore";
  import { auth } from "$lib/stores/auth";
  import type { ResolutionProposalInfo } from "../../../../../../declarations/prediction_markets_backend/prediction_markets_backend.did";
  
  let {
    market,
    onMarketResolved,
    isAdmin = false
  } = $props<{
    market: Market;
    onMarketResolved: () => void;
    isAdmin?: boolean;
  }>();
  
  // Derive outcomes from market object
  let outcomes = $derived(market?.outcomes || []);
  
  let selectedOutcome = $state<number | null>(null);
  let resolving = $state(false);
  let resolutionError = $state<string | null>(null);
  let showConfirmDialog = $state(false);
  let loadingResolutionDetails = $state(false);
  let existingResolutionDetails = $state<ResolutionProposalInfo | null>(null);
  let hasExistingResolution = $derived(
    existingResolutionDetails !== null && (
      isAdmin 
        ? existingResolutionDetails.admin_vote.length > 0
        : existingResolutionDetails.creator_vote.length > 0
    )
  );
  
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
      
      // Resolution has already been submitted, don't allow changes
    } catch (error) {
      console.error("Failed to load resolution details:", error);
      existingResolutionDetails = null;
    } finally {
      loadingResolutionDetails = false;
    }
  }
  
  async function handleResolve() {
    if (selectedOutcome === null || hasExistingResolution) return;
    
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
        title: "Resolution Submitted",
        message: "Your resolution has been submitted for admin verification.",
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
  
</script>

<Card className="p-4 bg-kong-bg-primary/80 backdrop-blur-sm shadow-lg border-kong-border/10 animate-fadeIn">
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <div class="p-2 rounded-lg bg-kong-accent-yellow/20">
        <Trophy class="w-5 h-5 text-kong-accent-yellow" />
      </div>
      <div>
        <h2 class="text-lg font-semibold text-kong-text-primary">
          {isAdmin ? 'Admin Resolution Proposal' : 'Resolve Market'}
        </h2>
        <p class="text-sm text-kong-text-secondary">
          {isAdmin ? 'Submit your admin proposal for this market' : 'Select the winning outcome for this market'}
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
        <CheckCircle class="w-4 h-4 text-kong-accent-green mt-0.5 flex-shrink-0" />
        <div class="text-sm text-kong-text-secondary flex-1">
          <p class="font-medium text-kong-accent-green mb-1">Resolution Already Submitted</p>
          <p>{isAdmin ? 'You have already submitted an admin proposal for this market.' : 'You have already submitted a resolution for this market. Your selection is awaiting admin verification.'}</p>
          {#if existingResolutionDetails}
            {@const votes = isAdmin ? existingResolutionDetails.admin_vote : existingResolutionDetails.creator_vote}
            {#if votes.length > 0}
              {@const selectedOutcomeIndex = Number(votes[0].proposed_outcomes[0])}
              {@const selectedOutcomeText = outcomes[selectedOutcomeIndex]}
            <div class="mt-3 p-3 bg-kong-bg-secondary/50 rounded-lg border border-kong-border/50">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-kong-text-secondary uppercase tracking-wider">Your Selection</span>
                <div class="flex items-center gap-1.5">
                  <div class="w-2 h-2 bg-kong-accent-green rounded-full animate-pulse"></div>
                  <span class="text-xs text-kong-accent-green font-medium">Pending Review</span>
                </div>
              </div>
              <p class="text-kong-text-primary font-semibold text-base mt-1">
                {selectedOutcomeText}
              </p>
            </div>
            {/if}
          {/if}
          {#if existingResolutionDetails}
            <p class="mt-2 text-xs text-kong-text-secondary/70 flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Submitted: {new Date(Number(existingResolutionDetails.created_at) / 1_000_000).toLocaleString()}
            </p>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Creator's Proposal (for admin view) -->
      {#if isAdmin && existingResolutionDetails && existingResolutionDetails.creator_vote.length > 0}
        {@const creatorOutcomeIndex = Number(existingResolutionDetails.creator_vote[0].proposed_outcomes[0])}
        <div class="bg-kong-bg-secondary/50 rounded-lg p-3 border border-kong-border/50 mb-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-kong-text-secondary uppercase tracking-wider">Creator's Proposal</span>
            <div class="flex items-center gap-1.5">
              <div class="w-2 h-2 bg-kong-accent-yellow rounded-full animate-pulse"></div>
              <span class="text-xs text-kong-accent-yellow font-medium">Awaiting Admin</span>
            </div>
          </div>
          <p class="text-kong-text-primary font-semibold">
            {outcomes[creatorOutcomeIndex]}
          </p>
        </div>
      {/if}
      
      <!-- Info Alert -->
      <div class="flex items-start gap-2 p-3 rounded-lg bg-kong-accent-blue/10 border border-kong-accent-blue/20">
        <AlertCircle class="w-4 h-4 text-kong-accent-blue mt-0.5 flex-shrink-0" />
        <div class="text-sm text-kong-text-secondary">
          <p class="font-medium text-kong-accent-blue mb-1">Resolution Process</p>
          <p>{isAdmin ? 'As an admin, you can submit your proposal for the winning outcome. The market will be resolved based on both creator and admin proposals.' : 'As the market creator, you can select the winning outcome. Your selection will be submitted for admin verification before payouts are distributed.'}</p>
        </div>
      </div>
    {/if}
    
    <!-- Outcome Selection -->
    {#if !hasExistingResolution}
    <div class="space-y-2">
      <label class="text-sm font-medium text-kong-text-secondary">
        Select Winning Outcome
      </label>
      {#each outcomes as outcome, index}
        <ButtonV2
          theme={selectedOutcome === index ? "accent-green" : "secondary"}
          variant={selectedOutcome === index ? "outline" : "outline"}
          size="lg"
          fullWidth
          onclick={() => selectedOutcome = index}
          disabled={resolving}
          className="!justify-between !text-left"
        >
          <div class="flex items-center">
            {#if selectedOutcome === index}
               <CheckCircle class="w-5 h-5 mr-2" />
            {/if}
            <span class="font-medium">{outcome}</span>
          </div>
        </ButtonV2>
      {/each}
    </div>
    {/if}
    
    {#if resolutionError}
      <div class="p-3 rounded-lg bg-kong-error/10 border border-kong-error/20">
        <p class="text-sm text-kong-error">{resolutionError}</p>
      </div>
    {/if}
    
    <!-- Action Button - Only show if no existing resolution -->
    {#if !hasExistingResolution}
      <ButtonV2
        theme="accent-green"
        variant="solid"
        fullWidth
        size="lg"
        onclick={() => {
          if (selectedOutcome === null) {
            toastStore.add({
              title: "Select Outcome",
              message: "Please select a winning outcome before resolving",
              type: "warning",
            });
            return;
          }
          showConfirmDialog = true;
        }}
        disabled={resolving || selectedOutcome === null || loadingResolutionDetails}
      >
        {loadingResolutionDetails ? 'Loading...' : 
         resolving ? 'Submitting Resolution...' : 'Submit Resolution'}
      </ButtonV2>
    {/if}
  </div>
</Card>

<!-- Confirmation Dialog -->
<Dialog
  open={showConfirmDialog}
  onClose={() => showConfirmDialog = false}
  title="Confirm Resolution"
  showClose={false}
>
  <div class="space-y-4">
        <!-- Resolution Details -->
        <div class="bg-kong-bg-secondary/50 rounded-lg p-3 space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-kong-text-secondary">Market:</span>
            <span class="text-kong-text-primary font-medium truncate max-w-[60%]">{market.question}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-kong-text-secondary">Status after submission:</span>
            <span class="text-kong-accent-yellow font-medium">{isAdmin ? 'Pending Final Resolution' : 'Pending Admin Review'}</span>
          </div>
        </div>
    <!-- Selected Outcome Display -->
    <div class="bg-kong-accent-green/10 border-2 border-kong-accent-green p-4 rounded-lg">
      <p class="text-sm text-kong-text-secondary mb-2">
        Selected winning outcome:
      </p>
      <p class="font-bold text-lg text-kong-accent-green flex items-center gap-2">
        <CheckCircle class="w-5 h-5" />
        "{outcomes[selectedOutcome!]}"
      </p>
    </div>
    
    <!-- Warning Message -->
    <div class="border border-kong-warning/20 rounded-lg p-4">
      <div class="flex items-start gap-2">
        <AlertCircle class="w-5 h-5 text-kong-warning mt-0.5 flex-shrink-0" />
        <div class="text-sm">
          <p class="font-medium text-kong-warning mb-1">
            Important: This action cannot be undone
          </p>
          <p class="text-kong-text-secondary">
            Once submitted, this resolution will be sent for admin verification. You cannot change your selection after submission.
          </p>
        </div>
      </div>
    </div>

    
    <!-- Action Buttons -->
    <div class="flex gap-3 pt-2">
      <ButtonV2
        theme="secondary"
        variant="solid"
        fullWidth
        onclick={() => showConfirmDialog = false}
        disabled={resolving}
        size="lg"
      >
        Cancel
      </ButtonV2>
      <ButtonV2
        theme="accent-green"
        variant="solid"
        fullWidth
        onclick={handleResolve}
        disabled={resolving}
        size="lg"
      >
        {resolving ? 'Submitting...' : 'Confirm Resolution'}
      </ButtonV2>
    </div>
  </div>
</Dialog>

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