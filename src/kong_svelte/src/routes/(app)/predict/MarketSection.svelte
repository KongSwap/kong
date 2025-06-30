<script lang="ts">
  import AdminResolutionModal from "./AdminResolutionModal.svelte";
  import { auth } from "$lib/stores/auth";
  import { isAdmin } from "$lib/api/predictionMarket";
  import MarketCard from "./MarketCard.svelte";
  import { marketStore } from "$lib/stores/marketStore";
  import { commentsApi, contextId } from "$lib/api/comments";

  // Convert props to use $props
  let {
    markets,
    showEndTime = true,
    openBetModal,
    onMarketResolved,
    columns = { mobile: 1, tablet: 2, desktop: 3 },
    userClaims = [],
  } = $props<{
    markets: any[];
    showEndTime?: boolean;
    openBetModal: (market: any, outcomeIndex?: number) => void;
    onMarketResolved: () => Promise<void>;
    columns?: { mobile?: number; tablet?: number; desktop?: number };
    userClaims?: any[];
  }>();

  // Convert local state to use $state
  let showResolutionModal = $state(false);
  let selectedMarket = $state<any>(null);
  let isUserAdmin = $state(false);

  // Add state for dropdown - track which market ID has open dropdown
  let openDropdownMarketId = $state<string | null>(null);
  
  // Add state for comment counts
  let commentCounts = $state<Record<string, number>>({});

  // Helper function to get grid class
  function getGridClass(cols: number, prefix: string = ''): string {
    const classPrefix = prefix ? `${prefix}:grid-cols-` : 'grid-cols-';
    switch (cols) {
      case 1: return `${classPrefix}1`;
      case 2: return `${classPrefix}2`;
      case 3: return `${classPrefix}3`;
      case 4: return `${classPrefix}4`;
      default: return `${classPrefix}2`;
    }
  }
  
  // Compute grid columns class string
  const gridColumnClasses = $derived(
    `${getGridClass(columns.mobile || 1)} ${getGridClass(columns.tablet || 2, 'md')} ${getGridClass(columns.desktop || 3, 'lg')}`
  );

  // Check if user is admin using $effect (replacing onMount)
  $effect(() => {
    if ($auth.isConnected && $auth.account) {
      isAdmin($auth.account.owner).then((result) => {
        isUserAdmin = result;
      });
    }
  });

  // Fetch comment counts when markets change
  $effect(() => {
    if (markets.length > 0) {
      const marketContextIds = markets.map(m => contextId.market(m.id.toString()));
      
      commentsApi.getBatchContextCommentCounts(marketContextIds).then(counts => {
        const countsMap: Record<string, number> = {};
        counts.forEach(c => {
          // Extract market ID from context ID (format: "market:123")
          const marketId = c.context_id.replace('market:', '');
          countsMap[marketId] = c.count;
        });
        commentCounts = countsMap;
      }).catch(error => {
        console.error('Failed to fetch comment counts:', error);
      });
    }
  });

  async function handleResolved() {
    await onMarketResolved();
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // Check if the click is outside the dropdown button and menu
    const dropdownButton = target.closest('button[class*="rounded-full"]');
    const dropdownMenu = target.closest('div[class*="fixed w-48"]');
    
    if (!dropdownButton && !dropdownMenu) {
      openDropdownMarketId = null;
    }
  }

  // Add click outside listener
  $effect(() => {
    if (openDropdownMarketId !== null) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<AdminResolutionModal
  isOpen={showResolutionModal}
  market={selectedMarket}
  onClose={() => {
    showResolutionModal = false;
    selectedMarket = null;
  }}
  onResolved={handleResolved}
/>

<div class="mb-8 flex flex-col gap-4">
  {#if markets.length === 0}
    <div class="text-center py-6 text-kong-text-secondary">
      No markets in this category
    </div>
  {:else}
    <!-- Featured Markets Section -->
    {#if markets.some(m => m.featured)}
      <div>
        <!-- Featured Markets List -->
        <div
          class="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory lg:grid {gridColumnClasses} lg:gap-4 lg:overflow-visible"
        >
          {#each markets.filter(m => m.featured) as market (market.id)}
            <div
              class="flex-shrink-0 w-72 sm:w-96 snap-start lg:w-auto lg:flex-shrink-0 lg:col-span-1"
            >
              <MarketCard
                {market}
                {showEndTime}
                {openBetModal}
                {onMarketResolved}
                hasClaim={userClaims.some(claim => claim.market_id === market.id)}
                isDropdownOpen={openDropdownMarketId === market.id}
                onDropdownToggle={() => {
                  openDropdownMarketId = openDropdownMarketId === market.id ? null : market.id;
                }}
                {isUserAdmin}
                commentCount={commentCounts[market.id.toString()] || 0}
              />
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Regular Markets Section -->
    {#if markets.some(m => !m.featured)}
      <div>
        <div class="grid {gridColumnClasses} gap-3 sm:gap-4">
          {#each markets.filter(m => !m.featured) as market (market.id)}
            <MarketCard
              {market}
              {showEndTime}
              {openBetModal}
              {onMarketResolved}
              hasClaim={userClaims.some(claim => claim.market_id === market.id)}
              isDropdownOpen={openDropdownMarketId === market.id}
              onDropdownToggle={() => {
                openDropdownMarketId = openDropdownMarketId === market.id ? null : market.id;
              }}
              {isUserAdmin}
              commentCount={commentCounts[market.id.toString()] || 0}
            />
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Pagination Controls -->
{#if $marketStore.totalPages > 1 && markets.length > 0}
  <div class="mt-8">
    <!-- Pagination Container -->
    <div class="bg-kong-bg-secondary rounded-kong-roundness border border-kong-border/60 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 w-full">
      <!-- Page Info -->
      <div class="text-sm text-kong-text-secondary order-2 sm:order-1">
        <span class="hidden sm:inline">Page </span>
        <span class="font-medium text-kong-text-primary">{$marketStore.currentPage + 1}</span>
        <span class="text-kong-text-secondary/60 mx-1">/</span>
        <span class="font-medium text-kong-text-primary">{$marketStore.totalPages}</span>
        {#if $marketStore.totalCount > 0}
          <span class="hidden sm:inline text-kong-text-secondary/60 mx-2">•</span>
          <span class="hidden sm:inline">{$marketStore.totalCount} markets</span>
        {/if}
      </div>
      
      <!-- Pagination Buttons -->
      <div class="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
        <!-- Previous Button -->
        <button 
          class="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                 {($marketStore.currentPage > 0) 
                   ? 'hover:bg-kong-bg-tertiary text-kong-text-primary hover:shadow-sm' 
                   : 'text-kong-text-secondary'}"
          on:click={() => marketStore.goToPage($marketStore.currentPage - 1)}
          disabled={$marketStore.currentPage <= 0 || $marketStore.loading}
          aria-label="Previous page"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span class="hidden sm:inline">Previous</span>
        </button>
        
        <!-- Page Numbers -->
        <div class="flex items-center gap-1">
          {#each Array.from({ length: Math.min(7, $marketStore.totalPages) }, (_, i) => {
            const startPage = Math.max(0, Math.min($marketStore.totalPages - 7, $marketStore.currentPage - 3));
            const pageNum = startPage + i;
            if (pageNum >= $marketStore.totalPages) return null;
            return pageNum;
          }).filter(p => p !== null) as pageNum}
            <button 
              class="min-w-[36px] h-9 px-2 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-40
                     {(pageNum === $marketStore.currentPage)
                       ? 'bg-kong-accent-blue text-white shadow-md hover:bg-kong-accent-blue/90' 
                       : 'bg-kong-bg-tertiary text-kong-text-secondary hover:bg-kong-bg-tertiary hover:text-kong-text-primary border border-kong-border/40 hover:border-kong-border/60'}"
              on:click={() => marketStore.goToPage(pageNum)}
              disabled={$marketStore.loading}
              aria-label="Go to page {pageNum + 1}"
              aria-current={pageNum === $marketStore.currentPage ? 'page' : undefined}
            >
              {pageNum + 1}
            </button>
          {/each}
        </div>
        
        <!-- Next Button -->
        <button 
          class="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                 {($marketStore.currentPage < $marketStore.totalPages - 1) 
                   ? 'hover:bg-kong-bg-tertiary text-kong-text-primary hover:shadow-sm' 
                   : 'text-kong-text-secondary'}"
          on:click={() => marketStore.goToPage($marketStore.currentPage + 1)}
          disabled={$marketStore.currentPage >= $marketStore.totalPages - 1 || $marketStore.loading}
          aria-label="Next page"
        >
          <span class="hidden sm:inline">Next</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Custom scrollbar styling */
  .scrollbar-thin {
    scrollbar-width: thin;
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }

  .scrollbar-track-transparent::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thumb-kong-border::-webkit-scrollbar-thumb {
    background-color: var(--kong-border, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
  }

  .scrollbar-thumb-kong-border::-webkit-scrollbar-thumb:hover {
    background-color: var(--kong-border, rgba(255, 255, 255, 0.2));
  }

  /* Title text clamp to 2 lines */
  .title-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
