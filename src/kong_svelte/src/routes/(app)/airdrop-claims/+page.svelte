<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/stores/auth";
  import { ClaimsService } from "$lib/services/claims";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import ClaimCard from "./ClaimCard.svelte";
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import { Loader2, Award } from "lucide-svelte";
  import type { Claim } from "$lib/types/claims";

  // State
  let claims = $state<Claim[]>([]);
  let isLoading = $state(true);
  let isProcessing = $state(false);
  let processingClaimId = $state<bigint | null>(null);
  let isProcessingAll = $state(false);
  let error = $state<string | null>(null);
  let hasAccess = $state(false);

  // Fetch claims
  async function fetchClaims() {
    isLoading = true;
    const result = await ClaimsService.fetchClaims();
    claims = result.claims;
    error = result.error;
    hasAccess = !error && claims.length > 0;
    isLoading = false;
  }

  // Process a single claim
  async function processClaim(claimId: bigint) {
    if (isProcessing || !hasAccess) return;

    isProcessing = true;
    processingClaimId = claimId;

    const result = await ClaimsService.processClaim(claimId);
    if (result.success) {
      await fetchClaims();
    }

    isProcessing = false;
    processingClaimId = null;
  }

  // Process all claims
  async function processAllClaims() {
    if (isProcessingAll || isProcessing || claims.length === 0 || !hasAccess)
      return;

    isProcessingAll = true;
    const result = await ClaimsService.processAllClaims(claims);

    if (result.successCount > 0) {
      await fetchClaims();
    }

    isProcessingAll = false;
  }

  onMount(() => {
    fetchClaims();
  });

  $effect(() => {
    if ($auth.isConnected) fetchClaims();
  });
</script>

<svelte:head>
  <title>Airdrop Claims - KongSwap</title>
  <meta
    name="description"
    content="View and process your claimable airdrop tokens"
  />
</svelte:head>

<div class="container mx-auto max-w-[1300px]">
  <PageHeader
    title="Airdrop Claims"
    description="View and process your claimable airdrop tokens"
    icon={Award}
  >
    <svelte:fragment slot="buttons">
      {#if $auth.isConnected && !isLoading && !error && claims.length > 0}
        <div class="flex flex-row gap-3">
          <!-- Claim All button -->
          <ButtonV2
            theme="accent-green"
            variant={isProcessingAll ? "solid" : "outline"}
            size="sm"
            onclick={processAllClaims}
            isDisabled={isProcessingAll || isProcessing || !hasAccess}
            className="w-auto"
          >
            <div class="flex items-center justify-center">
              {#if isProcessingAll}
                <Loader2 class="animate-spin mr-2" size={16} />
                <span>Processing...</span>
              {:else}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Claim All
              {/if}
            </div>
          </ButtonV2>

          <!-- Refresh button -->
          <ButtonV2
            theme="secondary"
            variant="outline"
            size="sm"
            onclick={fetchClaims}
            isDisabled={isLoading || isProcessingAll}
            className="w-auto"
          >
            <div class="flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </div>
          </ButtonV2>
        </div>
      {/if}
    </svelte:fragment>
  </PageHeader>

  {#if !$auth.isConnected}
    <Panel variant="solid" type="main" className="max-w-lg mx-auto mt-4">
      <div class="p-6 text-center">
        <p class="mb-4">Please connect your wallet to view your claims</p>
        <ButtonV2 theme="accent-blue" onclick={() => auth.initialize()}>
          Connect Wallet
        </ButtonV2>
      </div>
    </Panel>
  {:else if isLoading}
    <div class="flex justify-center items-center py-12">
      <LoadingIndicator message="Loading claims..." />
    </div>
  {:else if error}
    <Panel variant="solid" type="main" className="max-w-lg mx-auto mt-4">
      <div class="p-6 text-center">
        <p class="text-red-500 mb-4">{error}</p>
        <ButtonV2 theme="primary" onclick={fetchClaims}>Try Again</ButtonV2>
      </div>
    </Panel>
  {:else if claims.length === 0}
    <Panel variant="solid" type="main" className="max-w-lg mx-auto mt-4">
      <div class="p-6 text-center">
        <p>You don't have any claimable tokens at the moment</p>
      </div>
    </Panel>
  {:else}
    <div
      class="grid px-4 gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in mt-4"
    >
      {#each claims as claim (claim.claim_id)}
        <Panel
          variant="solid"
          type="main"
          className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1 backdrop-blur-sm"
        >
          <ClaimCard
            {claim}
            {isProcessing}
            {isProcessingAll}
            {processingClaimId}
            onProcess={processClaim}
          />
        </Panel>
      {/each}
    </div>
  {/if}
</div>
