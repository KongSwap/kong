<script lang="ts">
  import { Gift, Award, ArrowRight } from "lucide-svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { goto } from "$app/navigation";

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
    claims.filter(claim => claim.market_id === marketId)
  );

  let totalClaimable = $derived(
    marketClaims.reduce((sum, claim) => sum + Number(claim.claimable_amount), 0)
  );
</script>

{#if marketClaims}
  <Panel variant="transparent" className="backdrop-blur-sm !rounded shadow-lg border border-kong-border/10">
    <div class="p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <Gift class="w-5 h-5 text-kong-primary" />
          <h3 class="text-base font-semibold">Your Claimable Rewards</h3>
        </div>
      </div>

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
          onclick={() => goto("/predict/claims")}
          theme="accent-green"
          size="md"
          className="w-full"
        >
          <div class="flex items-center justify-center gap-2">
            <span>Claim Rewards</span>
            <ArrowRight class="w-4 h-4" />
          </div>
        </ButtonV2>
      {/if}
    </div>
  </Panel>
{/if}