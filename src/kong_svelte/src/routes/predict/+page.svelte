<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    placeBet,
    getAllBets,
    isAdmin,
  } from "$lib/api/predictionMarket";
  import { AlertTriangle, ChevronDown } from "lucide-svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { toScaledAmount } from "$lib/utils/numberFormatUtils";
  import MarketSection from "./MarketSection.svelte";
  import BetModal from "./BetModal.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { auth } from "$lib/services/auth";
  import { marketStore, filteredMarkets, type SortOption, type StatusFilter } from "$lib/stores/marketStore";
  import { debounce } from "lodash-es";
  import { startPolling, stopPolling } from "$lib/utils/pollingService";
  import { clickOutside } from "$lib/actions/clickOutside";

  // Modal state
  let showBetModal = false;
  let selectedMarket: any = null;
  let betAmount = 0;
  let selectedOutcome: number | null = null;
  let betError: string | null = null;
  let isBetting = false;
  let isApprovingAllowance = false;

  let recentBets: any[] = [];
  let previousBets: any[] = [];
  let newBetIds = new Set<string>();
  let isInitialLoad = true;
  let loadingBets = false;
  let isUserAdmin = false;
  
  // UI state for dropdowns
  let statusDropdownOpen = false;
  let sortDropdownOpen = false;

  onDestroy(() => {
    // Stop the polling task
    stopPolling("recentBets");
  });

  async function loadRecentBets() {
    // Prevent concurrent calls
    if (loadingBets) return;
    try {
      loadingBets = true;
      const startTime = Date.now();
      
      // Store previous bets before updating
      previousBets = [...recentBets];
      
      try {
        recentBets = await getAllBets(0, 5);
        
        // Minimum loading time of 500ms to prevent flash
        const elapsed = Date.now() - startTime;
        if (elapsed < 500) {
          await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
        }
        
        // Only identify new bets if it's not the initial load
        if (!isInitialLoad) {
          newBetIds = new Set(
            recentBets
              .filter(
                (newBet) =>
                  !previousBets.some(
                    (oldBet) =>
                      getBetId(oldBet) === getBetId(newBet)
                  ),
              )
              .map(getBetId)
          );
        } else {
          isInitialLoad = false;
        }
      } catch (error) {
        console.error("Error fetching bets data:", error);
        toastStore.add({
          title: "Error Loading Bets",
          message: "Could not load recent bets. Please try again later.",
          type: "error",
        });
        recentBets = [];
      }
    } finally {
      loadingBets = false;
    }
  }

  function getBetId(bet: any) {
    return `${bet.timestamp}-${bet.user}`;
  }

  $: if ($auth.isConnected) {
    isAdmin($auth.account.owner).then((isAdmin) => {
      isUserAdmin = isAdmin;
    });
  }

  onMount(async () => {
    // Initialize market store
    await marketStore.init();

    // Initial bets load
    await loadRecentBets();

    // Start polling for recent bets and refresh markets using the generic polling service
    startPolling("recentBets", () => {
      loadRecentBets();
      debouncedRefreshMarkets();
    }, 30000);
  });

  // Debounced market refresh to prevent too frequent updates
  const debouncedRefreshMarkets = debounce(() => {
    marketStore.refreshMarkets();
  }, 1000);

  function openBetModal(market: any, outcomeIndex?: number) {
    // First set all the values to initial state
    showBetModal = false;
    selectedMarket = null;
    betAmount = 0;
    selectedOutcome = null;
    betError = null;
    
    // Short delay to ensure clean state before opening
    setTimeout(() => {
      selectedMarket = market;
      // Make sure we always have a selected outcome
      selectedOutcome = outcomeIndex !== undefined ? outcomeIndex : 0;
      showBetModal = true;
    }, 50);
  }

  function closeBetModal() {
    showBetModal = false;
    // Don't immediately set selectedMarket to null, small delay to ensure proper cleanup
    setTimeout(() => {
      selectedMarket = null;
      betAmount = 0;
      selectedOutcome = null;
      betError = null;
    }, 100);
  }

  async function handleBet(amount: number) {
    if (!selectedMarket || selectedOutcome === null) return;

    try {
      isBetting = true;
      betError = null;

      const tokens = await fetchTokensByCanisterId([KONG_LEDGER_CANISTER_ID]);
      const kongToken = tokens[0];

      if (!kongToken) {
        throw new Error("Failed to fetch KONG token information");
      }

      // Convert bet amount to scaled token units
      const scaledAmount = toScaledAmount(amount, kongToken.decimals);

      await placeBet(
        kongToken,
        Number(selectedMarket.id),
        selectedOutcome,
        scaledAmount,
      );

      toastStore.add({
        title: "Bet Placed",
        message: `You bet ${amount} KONG on ${selectedMarket.outcomes[selectedOutcome]}`,
        type: "success",
      });

      closeBetModal();
      
      // Refresh markets after successful bet
      await marketStore.refreshMarkets();
      
    } catch (e) {
      console.error("Bet error:", e);
      betError = e instanceof Error ? e.message : "Failed to place bet";
    } finally {
      isBetting = false;
    }
  }
  
  // Status display mapping
  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'expired', label: 'Pending' },
    { value: 'resolved', label: 'Resolved' }
  ];
  
  // Sort options mapping
  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'pool_desc', label: 'Pool Size (High to Low)' },
    { value: 'pool_asc', label: 'Pool Size (Low to High)' }
  ];
  
  // Get current option label
  function getCurrentStatusLabel() {
    return statusOptions.find(option => option.value === $marketStore.statusFilter)?.label || 'All';
  }
  
  function getCurrentSortLabel() {
    return sortOptions.find(option => option.value === $marketStore.sortOption)?.label || 'Newest';
  }
</script>

<svelte:head>
  <title>Prediction Markets - KongSwap</title>
  <meta name="description" content="Predict the future and earn rewards" />
</svelte:head>

<div class="min-h-screen text-kong-text-primary px-4">
  <div class="max-w-7xl mx-auto">
    <div class="text-center mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-6">
      <div class="flex flex-col gap-2">
        <h1
          class="text-2xl flex items-center gap-3 justify-center md:justify-start drop-shadow-lg md:text-3xl font-bold text-kong-text-primary/80 bg-300"
        >
          Prediction Markets
        </h1>

        <p
          class="text-kong-pm-text-secondary flex items-center gap-2 justify-center md:justify-start text-sm md:text-base"
        >
          Predict the future and earn rewards.
        </p>
      </div>

      <!-- Category Filters and Sorting Controls -->
      <div class="flex flex-col items-center justify-center md:justify-end gap-4">
        <!-- Category Filters -->
        <div class="w-full flex flex-wrap gap-2 justify-center max-w-full overflow-x-auto pb-2 md:pb-0">
          {#each $marketStore.categories as category}
            <button
              class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                            {$marketStore.selectedCategory === category ||
              (category === 'All' && !$marketStore.selectedCategory)
                ? 'bg-kong-pm-accent text-white'
                : 'bg-kong-pm-dark text-kong-pm-text-secondary hover:bg-kong-pm-accent/20'}"
              on:click={() => marketStore.setCategory(category === "All" ? null : category)}
            >
              {category}
            </button>
          {/each}
        </div>
        
        <!-- Status and Sorting Controls Row -->
        <div class="flex flex-col sm:flex-row items-center gap-3 w-full justify-center md:justify-end">
          <!-- Status Filter Dropdown -->
          <div class="relative status-dropdown" use:clickOutside={() => statusDropdownOpen = false}>
            <div class="flex items-center gap-2 justify-center">
              <span class="text-xs text-kong-pm-text-secondary">Status:</span>
              
              <button
                class="flex items-center px-3 py-1.5 rounded text-xs font-medium bg-kong-surface-dark text-kong-text-primary hover:bg-kong-bg-light/30 transition-colors border border-kong-border/50"
                on:click={(e) => {
                  e.stopPropagation();
                  statusDropdownOpen = !statusDropdownOpen;
                  sortDropdownOpen = false;
                }}
              >
                {getCurrentStatusLabel()}
                <ChevronDown class="w-3 h-3 ml-1" />
              </button>
            </div>
            
            {#if statusDropdownOpen}
              <div class="absolute top-full left-0 mt-1 z-30 bg-kong-surface-dark border border-kong-border rounded-md shadow-lg py-1 min-w-[120px] backdrop-blur-sm">
                {#each statusOptions as option}
                  <button
                    class="w-full text-left px-3 py-2 text-xs hover:bg-kong-bg-light/30 {$marketStore.statusFilter === option.value ? 'bg-kong-accent-green/20 text-kong-accent-green font-medium' : 'text-kong-text-primary'}"
                    on:click={() => {
                      marketStore.setStatusFilter(option.value as StatusFilter);
                      statusDropdownOpen = false;
                    }}
                  >
                    {option.label}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          
          <!-- Divider for small screens -->
          <div class="hidden sm:block w-px h-6 bg-kong-border"></div>
          
          <!-- Sorting Dropdown -->
          <div class="relative sort-dropdown" use:clickOutside={() => sortDropdownOpen = false}>
            <div class="flex items-center gap-2 justify-center">
              <span class="text-xs text-kong-pm-text-secondary">Sort by:</span>
              
              <button
                class="flex items-center px-3 py-1.5 rounded text-xs font-medium bg-kong-surface-dark text-kong-text-primary hover:bg-kong-bg-light/30 transition-colors border border-kong-border/50"
                on:click={(e) => {
                  e.stopPropagation();
                  sortDropdownOpen = !sortDropdownOpen;
                  statusDropdownOpen = false;
                }}
              >
                {getCurrentSortLabel()}
                <ChevronDown class="w-3 h-3 ml-1" />
              </button>
            </div>
            
            {#if sortDropdownOpen}
              <div class="absolute top-full right-0 mt-1 z-30 bg-kong-surface-dark border border-kong-border rounded-md shadow-lg py-1 min-w-[180px] backdrop-blur-sm">
                {#each sortOptions as option}
                  <button
                    class="w-full text-left px-3 py-2 text-xs hover:bg-kong-bg-light/30 {$marketStore.sortOption === option.value ? 'bg-kong-accent-green/20 text-kong-accent-green font-medium' : 'text-kong-text-primary'}"
                    on:click={() => {
                      marketStore.setSortOption(option.value as SortOption);
                      sortDropdownOpen = false;
                    }}
                  >
                    {option.label}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- New grid layout for markets and recent bets -->
    <div class="lg:grid lg:grid-cols-5 lg:gap-6">
      <!-- Markets column - takes up 4/5 of the space -->
      <div class="lg:col-span-5">
        <!-- Market Sections -->
        {#if $marketStore.error}
          <div class="text-center py-12 text-kong-accent-red">
            <AlertTriangle class="w-12 h-12 mx-auto mb-4" />
            <p class="text-lg font-medium">{$marketStore.error}</p>
          </div>
        {:else}
          <div class="relative">
            <!-- Display markets based on status filter -->
            {#if ($filteredMarkets.active && $filteredMarkets.active.length > 0) || 
                 ($marketStore.statusFilter !== 'open' && 
                 (($filteredMarkets.expired_unresolved && $filteredMarkets.expired_unresolved.length > 0) || 
                  ($filteredMarkets.resolved && $filteredMarkets.resolved.length > 0)))}
              <MarketSection
                title="Markets"
                statusColor="bg-kong-accent-green"
                markets={$filteredMarkets.active}
                openBetModal={openBetModal}
                onMarketResolved={async () => await marketStore.refreshMarkets()}
              />
            {:else}
              <!-- No Markets Message -->
              <div class="text-center py-12">
                <div class="max-w-md mx-auto text-kong-pm-text-secondary">
                  <div class="mb-4 text-2xl">📉</div>
                  <p class="text-lg">No markets available</p>
                  <p class="text-sm mt-2">
                    {$marketStore.statusFilter !== 'all' 
                      ? `Try changing the status filter from "${getCurrentStatusLabel()}" to "All".` 
                      : "Check back later for new prediction markets."}
                  </p>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

    </div>
  </div>
</div>

<!-- Betting Modal -->
<BetModal
  {showBetModal}
  {selectedMarket}
  {isBetting}
  {isApprovingAllowance}
  {betError}
  {selectedOutcome}
  bind:betAmount
  onClose={closeBetModal}
  onBet={handleBet}
  onOutcomeSelect={(index) => (selectedOutcome = index)}
/>

<style lang="postcss" scoped>
  /* Gradient Animation */
  :global(.animate-gradient) {
    background-size: 300% 300%;
    animation: gradient 8s ease infinite;
  }

  :global(.bg-300) {
    background-size: 300% 300%;
  }

  @keyframes gradient {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 8px rgba(255, 69, 0, 0.7);
    }
    50% {
      transform: scale(1.1);
      box-shadow: 0 0 16px rgba(255, 69, 0, 0.9);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 8px rgba(255, 69, 0, 0.7);
    }
  }

  /* Update flame rendering in the trending market section */
  .flame-icon {
    width: 28px;
    height: 28px;
    color: #ff4500;
    stroke: #ff4500;
    animation: flameFlicker 2s infinite;
    border-radius: 50%;
  }

  @keyframes flameFlicker {
    0%,
    100% {
      transform: scale(1);
      filter: brightness(1);
      box-shadow: 0 0 8px rgba(255, 69, 0, 0.7);
    }
    50% {
      transform: scale(1.15);
      filter: brightness(1.2);
      box-shadow: 0 0 16px rgba(255, 69, 0, 0.9);
    }
  }

  @keyframes flameGradient {
    0% {
      color: #ff4500;
      stroke: #ff4500;
    }
    33% {
      color: #ff6f00;
      stroke: #ff6f00;
    }
    66% {
      color: #ffa500;
      stroke: #ffa500;
    }
    100% {
      color: #ff4500;
      stroke: #ff4500;
    }
  }

  :global(.gradient-icon) {
    background: linear-gradient(
      to right,
      var(--kong-accent-blue),
      var(--kong-accent-green),
      var(--kong-accent-purple)
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: gradient 8s ease infinite;
    background-size: 300% 300%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.gradient-icon svg) {
    stroke: currentColor;
  }

  :global(.gradient-stroke) {
    stroke: var(--kong-accent-green);
    animation: strokeGradient 8s ease infinite;
  }

  @keyframes strokeGradient {
    0% {
      stroke: rgb(var(--accent-blue));
    }
    33% {
      stroke: rgb(var(--accent-green));
    }
    66% {
      stroke: rgb(var(--accent-purple));
    }
    100% {
      stroke: rgb(var(--accent-blue));
    }
  }

  /* Flash animation for new bets */
  @keyframes flashNewBet {
    0% {
      background-color: rgb(34, 197, 94);
      transform: scale(1.02);
    }
    50% {
      background-color: rgba(34, 197, 94, 0.2);
      transform: scale(1.02);
    }
    100% {
      background-color: transparent;
      transform: scale(1);
    }
  }

  .flash-new-bet {
    animation: flashNewBet 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    border-radius: 0.375rem;
  }
</style>
