<script lang="ts">
  import { onMount } from 'svelte';
  import { snsService, type SNSProposal } from '$lib/services/sns/snsService';
  import Panel from '$lib/components/common/Panel.svelte';
  
  export let governanceCanisterId: string;
  
  let proposals: SNSProposal[] = [];
  let loading = true;
  let loadingMore = false;
  let error: string | null = null;
  let hasMore = true;
  let scrollContainer: HTMLDivElement;
  const LIMIT = 10;

  function formatDate(timestamp: bigint): string {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  }

  function formatStatus(status: string): string {
    const statusColors = {
      open: 'text-yellow-400',
      accepted: 'text-green-400',
      rejected: 'text-red-400',
      executing: 'text-blue-400',
      executed: 'text-green-400',
      failed: 'text-red-400'
    };
    return `<span class="${statusColors[status] || ''}">${
      status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
    }</span>`;
  }

  function calculateVotePercentage(yes?: bigint, total?: bigint): number {
    if (!yes || !total || total === BigInt(0)) return 0;
    return Number((yes * BigInt(100)) / total);
  }

  async function loadMoreProposals() {
    if (loadingMore || !hasMore) return;
    
    try {
      loadingMore = true;
      const lastProposal = proposals[proposals.length - 1];
      const result = await snsService.getProposals(
        governanceCanisterId,
        LIMIT,
        lastProposal?.id
      );
      
      proposals = [...proposals, ...result.proposals];
      hasMore = result.hasMore;
    } catch (e) {
      console.error('Error loading more proposals:', e);
    } finally {
      loadingMore = false;
    }
  }

  function handleScroll(e: Event) {
    const target = e.target as HTMLDivElement;
    const bottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (bottom < 50) { // Load more when within 50px of bottom
      loadMoreProposals();
    }
  }

  onMount(async () => {
    try {
      const result = await snsService.getProposals(governanceCanisterId, LIMIT);
      proposals = result.proposals;
      hasMore = result.hasMore;
    } catch (e) {
      error = 'Failed to load proposals';
      console.error(e);
    } finally {
      loading = false;
    }
  });
</script>

<Panel variant="transparent" type="main" >
  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-semibold">Governance Proposals</h2>
    
    {#if loading}
      <div class="flex justify-center py-4">
        <div class="loader"></div>
      </div>
    {:else if error}
      <div class="text-red-500 text-center py-4">{error}</div>
    {:else if proposals.length === 0}
      <div class="text-kong-text-secondary text-center py-4">
        No proposals found
      </div>
    {:else}
      <div
        class="space-y-4 max-h-[365px] overflow-y-auto"
        bind:this={scrollContainer}
        on:scroll={handleScroll}
      >
        {#each proposals as proposal}
          <div class="bg-kong-bg-secondary rounded-lg p-2">
            <div class="flex flex-col gap-2">
              <div class="flex justify-between items-center gap-2">
                <h3 class="font-medium text-kong-text-primary overflow-hidden text-ellipsis flex-1">
                  {proposal.title}
                </h3>
                <div class="flex flex-col items-end gap-1 ml-2 min-w-[80px]">
                  <div class="text-sm font-medium whitespace-nowrap">
                    Yes: {calculateVotePercentage(proposal.tally.yes, proposal.tally.total).toFixed(1)}%
                  </div>
                  <div class="w-20 h-2 bg-kong-bg-dark rounded-full overflow-hidden">
                    <div
                      class="h-full bg-green-500"
                      style="width: {calculateVotePercentage(proposal.tally.yes, proposal.tally.total)}%"
                    />
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs text-kong-text-secondary">
                <span class="truncate">ID: {proposal.id.toString()}</span>
                <span class="text-right truncate">Status: {@html formatStatus(proposal.status)}</span>
                <span class="truncate">Created: {formatDate(proposal.created)}</span>
                <a
                  href={`https://nns.ic0.app/proposal/?u=${governanceCanisterId}&proposal=${proposal.id.toString()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-right text-kong-primary hover:underline"
                >
                  View →
                </a>
              </div>
            </div>
          </div>
        {/each}
        {#if loadingMore}
          <div class="flex justify-center py-2">
            <div class="loader"></div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</Panel>

<style>
  .loader {
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top: 3px solid #ffffff;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Custom scrollbar for the proposals list */
  div::-webkit-scrollbar {
    width: 6px;
  }
  
  div::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 3px;
  }
  
  div::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  
  div::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.15);
  }
</style> 