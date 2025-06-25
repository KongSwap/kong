<script lang="ts">
  import AdminResolutionModal from "./AdminResolutionModal.svelte";
  import { auth } from "$lib/stores/auth";
  import { isAdmin } from "$lib/api/predictionMarket";
  import MarketCard from "./MarketCard.svelte";
  import { Star } from "lucide-svelte";

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

  // Add state for dropdown
  let showDropdown = $state<number | null>(null);

  // Compute grid columns class string
  const gridColumnClasses = $derived(`grid-cols-${columns.mobile || 1} md:grid-cols-${columns.tablet || 2} lg:grid-cols-${columns.desktop || 3}`);

  // Check if user is admin using $effect (replacing onMount)
  $effect(() => {
    if ($auth.isConnected && $auth.account) {
      isAdmin($auth.account.owner).then((result) => {
        isUserAdmin = result;
      });
    }
  });

  async function handleResolved() {
    await onMarketResolved();
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.admin-dropdown')) {
      showDropdown = null;
    }
  }

  // Add click outside listener
  $effect(() => {
    if (showDropdown !== null) {
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
  onClose={() => (showResolutionModal = false)}
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
                {columns}
                hasClaim={userClaims.some(claim => claim.market_id === market.id)}
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
              {columns}
              hasClaim={userClaims.some(claim => claim.market_id === market.id)}
            />
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Smooth hover transitions */
  .group\/outcome:hover :global(.bg-kong-success\/40) {
    @apply bg-kong-success/60;
  }

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
