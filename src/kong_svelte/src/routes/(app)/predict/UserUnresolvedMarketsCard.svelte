<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Market } from "../../../../declarations/prediction_markets_backend/prediction_markets_backend.did";

  let { markets = [] }: { markets: Market[] } = $props();

  function getResolutionStatus(proposal: any) {
    const status = Object.keys(proposal.status)[0];
    
    const statusConfig = {
      'AwaitingAdminVote': {
        color: 'kong-warning',
        label: 'Awaiting Admin',
        title: 'Waiting for admin approval'
      },
      'AwaitingCreatorVote': {
        color: 'kong-warning',
        label: 'Awaiting Your Vote',
        title: 'Waiting for your vote'
      },
      'VotesAgree': {
        color: 'kong-success',
        label: 'Resolution Agreed',
        title: 'Resolution has been agreed upon'
      },
      'VotesDisagree': {
        color: 'kong-error',
        label: 'Resolution Disputed',
        title: 'Resolution is disputed'
      }
    };

    return statusConfig[status] || null;
  }
</script>

{#if markets.length > 0}
  <div class="mb-4 bg-kong-bg-secondary rounded-kong-roundness border border-kong-border/60 p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-base font-semibold text-kong-text-primary">Your Unresolved Markets</h3>
    </div>
    <div class="space-y-2 overflow-y-auto max-h-64">
      {#each markets as market}
        <button
          class="w-full text-left p-3 bg-kong-bg-tertiary rounded-lg hover:bg-kong-bg-tertiary/80 transition-colors"
          onclick={() => goto(`/predict/${market.id}`)}
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1">
              <p class="text-sm text-kong-text-primary font-medium line-clamp-2">{market.question}</p>
              <p class="text-xs text-kong-text-secondary mt-1">
                Expired {new Date(Number(market.end_time) / 1_000_000).toLocaleDateString()}
              </p>
            </div>
            {#if market.resolution_proposal && market.resolution_proposal.length > 0}
              {@const statusInfo = getResolutionStatus(market.resolution_proposal[0])}
              {#if statusInfo}
                <div class="flex-shrink-0">
                  <span 
                    class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-{statusInfo.color}/20 text-{statusInfo.color}"
                    title={statusInfo.title}
                  >
                    {statusInfo.label}
                  </span>
                </div>
              {/if}
            {/if}
          </div>
        </button>
      {/each}
    </div>
  </div>
{/if}