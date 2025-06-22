<script lang="ts">
  import { onMount } from 'svelte';
  import { snsService, icpGovernanceService, type GovernanceProposal } from '$lib/utils/snsUtils';
  import { formatNumber } from '$lib/utils/formatUtils';
  import { formatDistanceToNow } from 'date-fns';
  import Panel from '$lib/components/common/Panel.svelte';
  
  export let governanceCanisterId: string;
  export let type: 'sns' | 'icp' = 'sns';
  export let token: Kong.Token;
  export let limit: number = 10;
  export let debug: boolean = false;
  
  let proposals: GovernanceProposal[] = [];
  let loading = true;
  let loadingMore = false;
  let error: string | null = null;
  let errorDetails: any = null;
  let hasMore = false;
  let scrollContainer: HTMLDivElement;
  let lastProposalId: bigint | undefined;

  async function loadProposals(isLoadMore = false) {
    try {
      if (isLoadMore) {
        loadingMore = true;
      } else {
        loading = true;
      }
      error = null;
      errorDetails = null;

      console.log('Loading proposals with params:', {
        governanceCanisterId,
        type,
        limit,
        lastProposalId,
        isLoadMore
      });

      const service = type === 'sns' ? snsService : icpGovernanceService;
      const result = await service.getProposals(governanceCanisterId, limit, lastProposalId);

      if (lastProposalId) {
        proposals = [...proposals, ...result.proposals];
      } else {
        proposals = result.proposals;
      }

      hasMore = result.hasMore;
      if (result.proposals.length > 0) {
        lastProposalId = result.proposals[result.proposals.length - 1].id;
      }
    } catch (err) {
      console.error('Error loading proposals:', err);
      error = 'Failed to load proposals';
      errorDetails = err;
    } finally {
      if (isLoadMore) {
        loadingMore = false;
      } else {
        loading = false;
      }
    }
  }

  function formatTimestamp(timestamp: bigint): string {
    const date = new Date(Number(timestamp) * 1000);
    return formatDistanceToNow(date, { addSuffix: true });
  }

  function getStatusColor(status: GovernanceProposal['status']): string {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'executing':
        return 'bg-yellow-100 text-yellow-800';
      case 'executed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function handleScroll(e: Event) {
    if (loading || loadingMore || !hasMore) {
      return;
    }
    
    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const bottom = scrollHeight - scrollTop - clientHeight;
    
    if (bottom <= 100) {
      loadProposals(true);
    }
  }

  onMount(() => {
    loadProposals(false);
  });
</script>

<Panel type="main" className="!bg-kong-bg-secondary !p-0" >
  <div class="flex flex-col gap-4">
    <h2 class="text-sm font-semibold uppercase px-4 pt-4">
      {token.symbol} Governance Proposals
    </h2>
  
    
    {#if loading}
      <div class="flex justify-center py-4">
        <div class="loader"></div>
      </div>
    {:else if error}
      <div class="text-red-500 text-center py-4">
        <p>{error}</p>
        {#if debug && errorDetails}
          <pre class="mt-2 text-left text-xs bg-red-50 p-2 rounded">
            {JSON.stringify(errorDetails, null, 2)}
          </pre>
        {/if}
      </div>
    {:else if proposals.length === 0}
      <div class="text-kong-text-secondary text-center py-4">
        No proposals found
      </div>
    {:else}
      <div
        class="space-y-4 overflow-y-auto pr-1  h-[400px]"
        bind:this={scrollContainer}
        on:scroll={handleScroll}
      >
        {#each proposals as proposal}
          <div class="bg-kong-bg-secondary rounded-lg p-3 hover:bg-kong-bg-secondary/80 transition-colors">
            <div class="flex flex-col gap-2">
              <div class="flex justify-between items-center gap-2">
                <h3 class="font-medium text-kong-text-primary overflow-hidden text-ellipsis flex-1">
                  <a href={proposal.url} target="_blank" rel="noopener noreferrer" class="hover:text-kong-primary">
                    {proposal.title}
                  </a>
                </h3>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(proposal.status)}">
                  {proposal.status}
                </span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs text-kong-text-secondary">
                <span class="truncate">Created: {formatTimestamp(proposal.created)}</span>
                <span class="text-right truncate">Deadline: {formatTimestamp(proposal.deadline)}</span>
                <span class="truncate">Votes: {formatNumber(Number(proposal.tally.yes || 0))} Yes / {formatNumber(Number(proposal.tally.no || 0))} No</span>
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

<style lang="postcss" scoped>
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