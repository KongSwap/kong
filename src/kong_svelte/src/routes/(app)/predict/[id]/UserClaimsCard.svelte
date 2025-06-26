<script lang="ts">
  import { Gift, Award, ArrowRight } from "lucide-svelte";
  import Card from "$lib/components/common/Card.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { goto } from "$app/navigation";
  import confetti from "canvas-confetti";
  import { claimWinnings } from "$lib/api/predictionMarket";
  import { toastStore } from "$lib/stores/toastStore";
  import Dialog from "$lib/components/common/Dialog.svelte";

  let {
    claims = [],
    loading = false,
    marketTokenInfo = null,
    marketId = ""
  }: {
    claims: any[];
    loading: boolean;
    marketTokenInfo: any;
    marketId: string;
  } = $props();

  // Filter claims for this market
  let marketClaims = $derived(
    claims.filter(claim => claim.market_id.toString() === marketId)
  );

  $effect(() => {
    console.log("marketClaims", marketClaims);
  });

  let totalClaimable = $derived(
    marketClaims.reduce((sum, claim) => sum + Number(claim.claimable_amount), 0)
  );
  
  let hasShownConfetti = $state(false);
  let isClaiming = $state(false);
  
  // Trigger confetti when claims appear
  $effect(() => {
    if (marketClaims.length > 0 && !hasShownConfetti) {
      hasShownConfetti = true;
      
      // Wait a moment for the card to render
      setTimeout(() => {
        // Fire confetti from multiple angles
        const count = 200;
        const defaults = {
          origin: { y: 0.7 },
          colors: ['#22c55e', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0']
        };

        function fire(particleRatio: number, opts: any) {
          confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio)
          });
        }

        fire(0.25, {
          spread: 45,
          startVelocity: 55,
        });
        fire(0.2, {
          spread: 90,
        });
        fire(0.35, {
          spread: 150,
          decay: 0.91,
          scalar: 0.8
        });
        fire(0.1, {
          spread: 180,
          startVelocity: 25,
          decay: 0.92,
          scalar: 1.2
        });
        fire(0.1, {
          spread: 200,
          startVelocity: 45,
        });
      }, 100);
    }
  });
  
  async function handleClaimAll() {
    if (isClaiming || marketClaims.length === 0) return;
    
    try {
      isClaiming = true;
      
      // Get all claim IDs
      const claimIds = marketClaims.map(claim => claim.claim_id);
      
      // Claim all winnings
      await claimWinnings(claimIds);
      
      // Show success toast
      toastStore.add({
        title: "Success!",
        message: `Successfully claimed ${formatBalance(totalClaimable, marketTokenInfo?.decimals || 8, 2)} ${marketTokenInfo?.symbol || 'KONG'}`,
        type: "success",
      });
      
      // Fire celebration confetti
      const count = 300;
      const defaults = {
        origin: { y: 0.7 },
        colors: ['#22c55e', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0']
      };

      confetti({
        ...defaults,
        particleCount: count,
        spread: 200,
        startVelocity: 45,
      });
      
      // Remove claimed items from the list
      marketClaims = [];
      
      // Reload the page to refresh all data
      setTimeout(() => {
        location.reload();
      }, 2000);
      
    } catch (error) {
      console.error("Failed to claim winnings:", error);
      toastStore.add({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to claim rewards",
        type: "error",
      });
    } finally {
      isClaiming = false;
    }
  }
</script>

{#if marketClaims.length > 0}
  <Card hasHeader={true} className="relative overflow-hidden border-2 border-kong-success/50 animate-pulse-border">
      <svelte:fragment slot="header">
      <div class="flex items-center gap-2">
        <Gift class="w-5 h-5 text-kong-success animate-bounce" />
        <h3 class="text-base font-semibold text-kong-text-primary">Congratulations! You won!</h3>
      </div>
      <span class="text-xs text-kong-text-secondary bg-kong-bg-secondary/50 px-2 py-1 rounded-full">
        {marketClaims.length} reward{marketClaims.length > 1 ? 's' : ''}
      </span>
    </svelte:fragment>

    <div class="p-4">

      {#if loading}
        <div class="flex items-center justify-center py-4">
          <div class="animate-spin w-6 h-6 border-2 border-kong-primary rounded-full border-t-transparent" />
        </div>
      {:else}
        <div class="space-y-2 mb-3">
          {#each marketClaims as claim}
            <div class="flex items-center justify-between p-3 bg-kong-bg-primary rounded-lg">
              <div class="flex items-center gap-2">
                {#if claim.claim_type.WinningPayout}
                  <Award class="w-4 h-4 text-kong-success" />
                  <span class="text-xs text-kong-success">Win</span>
                {:else}
                  <Gift class="w-4 h-4 text-kong-accent-blue" />
                  <span class="text-xs text-kong-accent-blue">Refund</span>
                {/if}
              </div>
              <span class="text-sm font-medium text-kong-success">
                +{formatBalance(claim.claimable_amount, marketTokenInfo?.decimals || 8, 2)} {marketTokenInfo?.symbol || 'KONG'}
              </span>
            </div>
          {/each}
        </div>

        <div class="border-t border-kong-border/20 pt-3 mb-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-kong-text-secondary">Total</span>
            <span class="text-base font-bold text-kong-success">
              {formatBalance(totalClaimable, marketTokenInfo?.decimals || 8, 2)} {marketTokenInfo?.symbol || 'KONG'}
            </span>
          </div>
        </div>

        <ButtonV2
          onclick={handleClaimAll}
          theme="accent-green"
          size="md"
          className="w-full"
          disabled={isClaiming}
        >
          <div class="flex items-center justify-center gap-2">
            {#if isClaiming}
              <div class="animate-spin w-4 h-4 border-2 border-white rounded-full border-t-transparent" />
              <span>Claiming...</span>
            {:else}
              <span>Claim Rewards</span>
            {/if}
          </div>
        </ButtonV2>
      {/if}
    </div>
  </Card>
{/if}

<!-- Claiming Dialog -->
<Dialog
  open={isClaiming}
  title="Claiming Your Rewards"
  showClose={false}
>
  <div class="text-center space-y-4">
    <div class="relative">
      <div class="w-16 h-16 mx-auto">
        <div class="absolute inset-0 border-4 border-kong-success/20 rounded-full"></div>
        <div class="absolute inset-0 border-4 border-kong-success border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>
    <div class="space-y-2">
      <p class="text-sm text-kong-text-secondary">
        Processing {marketClaims.length} reward{marketClaims.length > 1 ? 's' : ''}... This may take a few moments.
      </p>
      <div class="flex items-center justify-center gap-2 text-kong-success font-medium text-lg">
        <Gift class="w-5 h-5" />
        <span>{formatBalance(totalClaimable, marketTokenInfo?.decimals || 8, 2)} {marketTokenInfo?.symbol || 'KONG'}</span>
      </div>
    </div>
  </div>
</Dialog>

<style lang="postcss">
  @keyframes pulse-border {
    0%, 100% {

      @apply border-kong-success/50;
      @apply shadow-[0_0_20px_rgba(34,197,94,0.3)];
    }
    50% {
      @apply border-kong-success/80;
      @apply shadow-[0_0_10px_rgba(34,197,94,0.6),0_0_20px_rgba(34,197,94,0.3)];
    }
  }
  
  :global(.animate-pulse-border) {
    animation: pulse-border 2s ease-in-out infinite;
  }
</style>