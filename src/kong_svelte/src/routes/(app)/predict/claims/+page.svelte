<script lang="ts">
  import { onMount } from "svelte";
  import { getUserPendingClaims, claimWinnings } from "$lib/api/predictionMarket";
  import { auth } from "$lib/stores/auth";
  import { goto } from "$app/navigation";
  import { ArrowLeft, Gift, Award } from "lucide-svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import { fade } from "svelte/transition";
  import { notificationsStore } from "$lib/stores/notificationsStore";
    import ButtonV2 from "$lib/components/common/ButtonV2.svelte";

  let claims: any[] = [];
  let loading = true;
  let error: string | null = null;
  let claimingRewards = false;
  let claimError: string | null = null;

  onMount(async () => {
    try {
      if ($auth.isConnected) {
        claims = await getUserPendingClaims($auth.account.owner);
      }
    } catch (e) {
      console.error("Failed to load claims:", e);
      error = e instanceof Error ? e.message : "Failed to load claims";
    } finally {
      loading = false;
    }
  });

  $: if ($auth.isConnected) {
    getClaims();
  }

  async function getClaims() {
    try {
      loading = true;
      claims = await getUserPendingClaims($auth.account.owner);
    } catch (e) {
      console.error("Failed to load claims:", e);
      error = e instanceof Error ? e.message : "Failed to load claims";
    } finally {
      loading = false;
    }
  }

  async function handleClaimRewards() {
    if (!claims?.length) return;
    
    try {
      claimingRewards = true;
      claimError = null;
      
      // Get all claim IDs from claims
      const claimIds = claims.map(claim => claim.claim_id);
      
      // Call the claim function
      await claimWinnings(claimIds);
      
      // Refresh data after successful claim
      await getClaims();
      
      // Show success notification
      notificationsStore.add({
        title: "Rewards Claimed",
        message: "Successfully claimed your prediction rewards",
        type: "success",
      });
    } catch (e) {
      console.error("Failed to claim rewards:", e);
      claimError = e instanceof Error ? e.message : "Failed to claim rewards";
    } finally {
      claimingRewards = false;
    }
  }

  // Calculate total claimable amount
  $: totalClaimable = claims.reduce((sum, claim) => sum + Number(claim.claimable_amount), 0);
</script>

<svelte:head>
  <title>Claim Rewards - KongSwap</title>
  <meta name="description" content="Claim your prediction market rewards" />
</svelte:head>

<div class="min-h-screen text-kong-text-primary px-4">
  <div class="max-w-4xl mx-auto">
    <div class="mb-8">
      <h1 class="text-2xl md:text-3xl font-bold mb-2">Claim Rewards</h1>
      <p class="text-kong-text-secondary">Claim your prediction market winnings and refunds</p>
    </div>

    {#if error}
      <Panel className="!rounded">
        <div class="text-center py-8 text-kong-error">
          <p class="text-lg">{error}</p>
        </div>
      </Panel>
    {:else if loading}
      <Panel className="!rounded">
        <div class="text-center py-8">
          <div class="animate-spin w-8 h-8 border-4 border-kong-success rounded-full border-t-transparent mx-auto" />
          <p class="mt-4 text-kong-text-secondary">Loading your claimable rewards...</p>
        </div>
      </Panel>
    {:else if !claims?.length}
      <Panel className="!rounded">
        <div class="text-center py-12">
          <div class="max-w-md mx-auto">
            <Award class="w-16 h-16 text-kong-text-secondary mx-auto mb-4" />
            <p class="text-lg mb-2">No rewards to claim</p>
            <p class="text-sm text-kong-text-secondary mb-6">
              You don't have any pending rewards at the moment. Make predictions and win to earn rewards!
            </p>
            <ButtonV2
              onclick={() => goto("/predict")}
              theme="accent-green"
              size="lg"
            >
              Start Predicting
            </ButtonV2>
          </div>
        </div>
      </Panel>
    {:else}
      <!-- Summary Stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Panel className="!rounded">
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <Gift class="w-5 h-5 text-kong-primary" />
              <h3 class="text-sm text-kong-text-secondary">Total Claimable</h3>
            </div>
            <p class="text-xl font-medium">{formatBalance(totalClaimable, 8, 2)} KONG</p>
          </div>
        </Panel>
        <Panel className="!rounded">
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <Award class="w-5 h-5 text-kong-success" />
              <h3 class="text-sm text-kong-text-secondary">Available Claims</h3>
            </div>
            <p class="text-xl font-medium">{claims.length}</p>
          </div>
        </Panel>
      </div>

      <!-- Claims List -->
      <div class="mb-8" in:fade>
        <h2 class="text-xl font-bold mb-4">Available Rewards</h2>
        <Panel className="!rounded">
          <div class="p-4">
            <div class="space-y-4 mb-6">
              {#each claims as claim}
                <div class="flex items-center justify-between p-4 bg-kong-bg-primary rounded-lg border border-kong-border">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      {#if claim.claim_type.WinningPayout}
                        <Award class="w-4 h-4 text-kong-success" />
                        <span class="text-sm font-medium text-kong-success">Winning Payout</span>
                      {:else}
                        <Gift class="w-4 h-4 text-kong-accent-blue" />
                        <span class="text-sm font-medium text-kong-accent-blue">Refund</span>
                      {/if}
                    </div>
                    <p class="font-medium text-kong-text-primary">Market #{claim.market_id}</p>
                    <p class="text-sm text-kong-text-secondary">
                      Claim ID: {claim.claim_id}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-kong-success font-bold text-lg">
                      +{formatBalance(claim.claimable_amount, 8, 2)} KONG
                    </p>
                  </div>
                </div>
              {/each}
            </div>

            {#if claimError}
              <div class="mb-4 p-3 bg-kong-error/10 text-kong-error rounded-lg border border-kong-error/20">
                <p class="font-medium">Claim Failed</p>
                <p class="text-sm">{claimError}</p>
              </div>
            {/if}

            <button
              onclick={handleClaimRewards}
              disabled={claimingRewards}
              class="w-full py-4 px-6 bg-kong-success hover:bg-kong-success/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
            >
              {#if claimingRewards}
                <div class="animate-spin w-5 h-5 border-2 border-white rounded-full border-t-transparent" />
                <span>Claiming Rewards...</span>
              {:else}
                <Gift class="w-5 h-5" />
                <span>Claim All Rewards ({formatBalance(totalClaimable, 8, 2)} KONG)</span>
              {/if}
            </button>

            <p class="text-xs text-kong-text-secondary text-center mt-3">
              All rewards will be claimed to your connected wallet
            </p>
          </div>
        </Panel>
      </div>

      <!-- Additional Actions -->
      <div class="flex flex-col sm:flex-row gap-4">
        <button
          onclick={() => goto("/predict/history")}
          class="flex-1 py-3 px-4 bg-kong-secondary hover:bg-kong-secondary-hover text-kong-text-primary font-medium rounded-lg transition-colors"
        >
          View Prediction History
        </button>
        <button
          onclick={() => goto("/predict")}
          class="flex-1 py-3 px-4 bg-kong-accent-blue hover:bg-kong-accent-blue-hover text-white font-medium rounded-lg transition-colors"
        >
          Make New Predictions
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Add any custom styles here if needed */
</style>
