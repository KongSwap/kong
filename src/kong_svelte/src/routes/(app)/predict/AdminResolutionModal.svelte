<script lang="ts">
  import Dialog from "$lib/components/common/Dialog.svelte";
  import { proposeResolution, getResolutionProposal } from "$lib/api/predictionMarket";
  import { toastStore } from "$lib/stores/toastStore";
  import { CheckCircle, AlertCircle } from "lucide-svelte";
  import type { ResolutionProposalInfo } from "../../../../../declarations/prediction_markets_backend/prediction_markets_backend.did";

  let { isOpen = false, market = null, onClose = () => {}, onResolved = () => {} } = $props<{
    isOpen: boolean;
    market: any;
    onClose: () => void;
    onResolved: () => void;
  }>();

  let selectedOutcome: bigint | null = $state(null);
  let isSubmitting = $state(false);
  let loadingProposal = $state(false);
  let existingProposal = $state<ResolutionProposalInfo | null>(null);
  let hasCreatorProposal = $derived(existingProposal !== null && existingProposal.creator_vote.length > 0);
  let hasAdminProposal = $derived(existingProposal !== null && existingProposal.admin_vote.length > 0);
  
  // Load existing proposal when dialog opens
  $effect(() => {
    if (isOpen && market?.id) {
      loadProposalDetails();
    }
  });
  
  async function loadProposalDetails() {
    try {
      loadingProposal = true;
      const proposal = await getResolutionProposal(market.id);
      existingProposal = proposal;
    } catch (error) {
      console.error("Failed to load resolution proposal:", error);
      existingProposal = null;
    } finally {
      loadingProposal = false;
    }
  }

  function close() {
    selectedOutcome = null;
    isSubmitting = false;
    existingProposal = null;
    onClose();
  }

  async function handlePropose() {
    if (selectedOutcome === null) {
      toastStore.error("Please select a winning outcome");
      return;
    }

    try {
      isSubmitting = true;
      await proposeResolution(market.id, selectedOutcome);
      toastStore.success(`Your resolution proposal has been submitted`);
      onResolved();
      close();
    } catch (error) {
      console.error("Failed to propose resolution:", error);
      toastStore.error(error instanceof Error ? error.message : "Failed to propose resolution");
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Dialog
  open={isOpen}
  title="Admin Resolution Proposal"
  onClose={close}
  showClose={false}
>
  <div class="flex flex-col gap-4">
    {#if loadingProposal}
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 border-2 border-kong-text-secondary/30 border-t-kong-text-secondary rounded-full animate-spin"></div>
        <span class="text-sm text-kong-text-secondary">Loading resolution details...</span>
      </div>
    {:else}
      {#if hasCreatorProposal}
        <div class="bg-kong-bg-secondary/50 rounded-lg p-3 border border-kong-border/50">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-kong-text-secondary uppercase tracking-wider">Creator's Proposal</span>
            <div class="flex items-center gap-1.5">
              <div class="w-2 h-2 bg-kong-accent-yellow rounded-full animate-pulse"></div>
              <span class="text-xs text-kong-accent-yellow font-medium">Pending</span>
            </div>
          </div>
          {#if existingProposal && existingProposal.creator_vote.length > 0}
            {@const creatorOutcomeIndex = Number(existingProposal.creator_vote[0].proposed_outcomes[0])}
            <p class="text-kong-text-primary font-semibold">
              {market?.outcomes[creatorOutcomeIndex]}
            </p>
          {/if}
        </div>
      {/if}
      
      {#if hasAdminProposal}
        <div class="bg-kong-accent-green/10 border border-kong-accent-green/20 rounded-lg p-3">
          <CheckCircle class="w-4 h-4 text-kong-accent-green mb-2" />
          <p class="text-sm text-kong-text-secondary">
            You have already submitted an admin resolution proposal.
          </p>
          {#if existingProposal && existingProposal.admin_vote.length > 0}
            {@const adminOutcomeIndex = Number(existingProposal.admin_vote[0].proposed_outcomes[0])}
            <p class="text-kong-text-primary font-semibold mt-2">
              Your selection: {market?.outcomes[adminOutcomeIndex]}
            </p>
          {/if}
        </div>
      {:else if hasCreatorProposal}
        <div class="bg-kong-accent-blue/10 border border-kong-accent-blue/20 rounded-lg p-3">
          <AlertCircle class="w-4 h-4 text-kong-accent-blue mb-2" />
          <p class="text-sm text-kong-text-secondary">
            The market creator has proposed a resolution. As an admin, you can now submit your own proposal.
          </p>
        </div>
      {:else}
        <div class="bg-kong-warning/10 border border-kong-warning/20 rounded-lg p-3">
          <AlertCircle class="w-4 h-4 text-kong-warning mb-2" />
          <p class="text-sm text-kong-text-secondary">
            The market creator has not yet proposed a resolution. Please wait for the creator to submit their proposal first.
          </p>
        </div>
      {/if}
      
      <div class="text-kong-text-primary text-lg font-semibold">
        {hasAdminProposal ? 'Your Admin Proposal' : 'Select the winning outcome'}
      </div>
    <div class="text-kong-text-primary text-base font-medium">
      {market?.question}
    </div>
    <div class="bg-kong-bg-secondary border border-kong-border rounded p-3 text-kong-text-secondary text-sm">
      <span class="font-semibold">Market Rules:</span> {market?.rules}
    </div>
      {#if !hasAdminProposal && hasCreatorProposal}
        <div class="flex flex-col gap-2">
          {#each market?.outcomes || [] as outcome, index}
            <button
              class="w-full p-2 rounded border transition-colors text-left
                {selectedOutcome === BigInt(index)
                  ? 'border-kong-success bg-kong-success/10 font-semibold text-kong-success'
                  : 'border-kong-border hover:border-kong-success hover:bg-kong-success/5'}"
              onclick={() => selectedOutcome = BigInt(index)}
              disabled={isSubmitting}
            >
              {outcome}
            </button>
          {/each}
        </div>
      {/if}
    {/if}
    <div class="flex gap-3 justify-end pt-2">
      <button
        class="px-4 py-2 rounded bg-kong-bg-secondary text-kong-text-primary hover:bg-kong-bg-primary/40 transition-colors"
        onclick={close}
        disabled={isSubmitting}
      >
        {hasAdminProposal || !hasCreatorProposal ? 'Close' : 'Cancel'}
      </button>
      {#if hasCreatorProposal && !hasAdminProposal}
        <button
          class="px-4 py-2 rounded bg-kong-success text-kong-text-on-primary font-bold hover:bg-kong-success/90 disabled:opacity-50 transition-colors"
          onclick={handlePropose}
          disabled={isSubmitting || selectedOutcome === null}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Admin Proposal'}
        </button>
      {/if}
    </div>
  </div>
</Dialog> 