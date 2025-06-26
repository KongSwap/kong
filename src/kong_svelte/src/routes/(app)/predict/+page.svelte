<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { getLatestBets } from "$lib/api/predictionMarket";
  import { AlertTriangle } from "lucide-svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import MarketSection from "./MarketSection.svelte";
  import BetModal from "./BetModal.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { auth } from "$lib/stores/auth";
  import {
    marketStore,
    filteredMarkets,
    type SortOption,
    type StatusFilter,
  } from "$lib/stores/marketStore";
  import { debounce } from "lodash-es";
  import { startPolling, stopPolling } from "$lib/utils/pollingService";
  import DropdownSelect from "$lib/components/common/DropdownSelect.svelte";
  import { syncURLParams, getURLParams } from "$lib/utils/urlUtils";
  import type { LatestBets } from "../../../../../declarations/prediction_markets_backend/prediction_markets_backend.did";
  import RecentPredictions from "./RecentPredictions.svelte";
  import PredictionMarketsHeader from "$lib/components/predict/PredictionMarketsHeader.svelte";
  import { useBetModal } from "$lib/composables/useBetModal.svelte";
  import { useUserMarketData } from "$lib/composables/useUserMarketData.svelte";
  import UserUnresolvedMarketsCard from "./UserUnresolvedMarketsCard.svelte";

  // Recent bets state
  let recentBets = $state<LatestBets[]>([]);
  let previousBets: any[] = [];
  let isInitialLoad = true;
  let loadingBets = $state(false);

  // UI state
  let selectedLayout = $state(3); // Default to 3 markets

  // Tokens
  let kongToken = $state<any>(null);
  
  // Initialize composables
  const betModal = useBetModal(kongToken);
  const userData = useUserMarketData();

  // Constants
  const VALID_STATUS_FILTERS: StatusFilter[] = [
    "all", "active", "pending", "closed", "disputed", "voided", "myMarkets"
  ];
  
  const VALID_SORT_OPTIONS: SortOption[] = [
    "newest", "pool_asc", "pool_desc", "end_time_asc", "end_time_desc"
  ];

  const LAYOUT_OPTIONS = [
    { value: 1, label: "1 Market" },
    { value: 2, label: "2 Markets" },
    { value: 3, label: "3 Markets" },
    { value: 4, label: "4 Markets" },
  ];

  // Validation helpers
  const isValidStatusFilter = (filter: string | null): filter is StatusFilter => 
    !!filter && VALID_STATUS_FILTERS.includes(filter as StatusFilter);

  const isValidSortOption = (option: string | null): option is SortOption => 
    !!option && VALID_SORT_OPTIONS.includes(option as SortOption);

  onDestroy(() => {
    // Stop the polling task
    stopPolling("recentBets");
  });

  async function loadRecentBets() {
    if (loadingBets) return;
    
    try {
      loadingBets = true;
      const startTime = Date.now();
      previousBets = [...recentBets];

      const bets = await getLatestBets();
      recentBets = bets;
      
      // Minimum loading time to prevent flash
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
      }

      if (!isInitialLoad) {
        // Track new bets logic can be added here if needed
        isInitialLoad = false;
      }
    } catch (error) {
      console.error("Error fetching bets data:", error);
      toastStore.add({
        title: "Error Loading Predictions",
        message: "Could not load recent predictions. Please try again later.",
        type: "error",
      });
      recentBets = [];
    } finally {
      loadingBets = false;
    }
  }

  onMount(async () => {
    // Parse URL parameters
    const urlParams = getURLParams($page, ["status", "sort"]);
    const initialOverrides = {
      ...(isValidStatusFilter(urlParams.status) && { statusFilter: urlParams.status }),
      ...(isValidSortOption(urlParams.sort) && { sortOption: urlParams.sort })
    };

    // Initialize stores and data
    if ($auth.isConnected && $auth.account?.owner) {
      marketStore.setCurrentUserPrincipal($auth.account.owner);
    }

    await marketStore.init(initialOverrides);

    // Load token information
    const tokens = await fetchTokensByCanisterId([KONG_LEDGER_CANISTER_ID]);
    kongToken = tokens[0];

    // Load initial data
    await loadRecentBets();

    // Start polling
    startPolling("recentBets", () => {
      loadRecentBets();
      debouncedRefreshMarkets();
    }, 30000);

    // Restore layout preference
    if (browser) {
      const savedLayout = localStorage.getItem('preferedLayout');
      if (savedLayout) selectedLayout = parseInt(savedLayout, 10);
    }
  });


  // Debounced market refresh
  const debouncedRefreshMarkets = debounce(() => {
    marketStore.refreshMarkets();
  }, 2000);
  
  // Handlers
  async function handleMarketResolved() {
    await marketStore.refreshMarkets();
    await userData.loadUserClaims();
    await userData.loadUserUnresolvedMarkets();
  }

  // Dropdown options
  const statusOptions = $derived([
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "pending", label: "Pending" },
    { value: "closed", label: "Closed" },
    { value: "disputed", label: "Disputed" },
    { value: "voided", label: "Voided" },
    { 
      value: "myMarkets", 
      label: "My Markets",
      disabled: !$auth.isConnected,
      tooltip: "Please connect your wallet to view your markets"
    },
  ]);

  const SORT_OPTIONS = [
    { value: "newest", label: "Newest" },
    { value: "pool_desc", label: "Pool Size (High to Low)" },
    { value: "pool_asc", label: "Pool Size (Low to High)" },
    { value: "end_time_asc", label: "End Time (Soonest First)" },
    { value: "end_time_desc", label: "End Time (Latest First)" },
  ];

  // Derived values
  const currentStatusLabel = $derived(
    statusOptions.find(opt => opt.value === $marketStore.statusFilter)?.label || "All"
  );

  // Update market store and user data when auth state changes
  $effect(() => {
    if (browser) {
      if ($auth.isConnected && $auth.account?.owner) {
        marketStore.setCurrentUserPrincipal($auth.account.owner);
        userData.loadUserData();
      } else {
        marketStore.setCurrentUserPrincipal(null);
      }
    }
  });

  // Effects
  $effect(() => {
    // Save layout preference
    if (browser && selectedLayout !== undefined) {
      localStorage.setItem('preferedLayout', selectedLayout.toString());
    }
  });

  $effect(() => {
    // Update URL when filters change
    if (browser && $marketStore.statusFilter && $marketStore.sortOption && !$marketStore.loading) {
      syncURLParams($page, {
        status: { param: "status", value: $marketStore.statusFilter },
        sort: { param: "sort", value: $marketStore.sortOption }
      });
    }
  });
</script>

<svelte:head>
  <title>Prediction Markets - KongSwap</title>
  <meta name="description" content="Predict the future and earn rewards" />
</svelte:head>

<div class="min-h-screen text-kong-text-primary">
  <div class="mx-auto">
    <!-- Prediction Markets Header -->
    <PredictionMarketsHeader openBetModal={betModal.open} userClaims={userData.userClaims} />

    <!-- Filters and Controls -->
    <div class="border-b border-kong-text-primary/10 pb-4 mb-6 px-4">
      <div class="flex flex-col lg:flex-row justify-between gap-4">
        <!-- Category Filters -->
        <div class="flex flex-wrap gap-2 items-center">
          {#each $marketStore.categories as category}
            <button
              class="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:shadow-md
                     {($marketStore.selectedCategory === category || (category === "All" && $marketStore.selectedCategory === null))
                       ? 'bg-kong-primary/20 text-kong-text-primary border border-kong-primary shadow-md'
                       : 'bg-kong-bg-secondary text-kong-text-secondary hover:bg-kong-bg-tertiary hover:text-kong-text-primary border border-kong-text-primary/10'}"
              onclick={() => marketStore.setCategory(category === "All" ? null : category)}
            >
              {category}
            </button>
          {/each}
        </div>

        <!-- Filters Container -->
        <div class="flex items-center gap-2">
          <!-- Status Filter -->
          <DropdownSelect
            options={statusOptions}
            value={$marketStore.statusFilter}
            label="Status"
            onChange={(value) => {
              marketStore.setStatusFilter(value as StatusFilter);
            }}
            size="sm"
            className="min-w-[120px]"
          />

          <!-- Sort Options -->
          <DropdownSelect
            options={SORT_OPTIONS}
            value={$marketStore.sortOption}
            label="Sort by"
            onChange={(value) => marketStore.setSortOption(value as SortOption)}
            size="sm"
            className="min-w-[180px]"
          />

          <!-- Layout Toggle -->
          <DropdownSelect
            options={LAYOUT_OPTIONS}
            value={selectedLayout}
            label="Layout"
            onChange={(value) => selectedLayout = value}
            size="sm"
            className="hidden lg:flex min-w-[120px]"
          />
        </div>
      </div>
    </div>

    <!-- New grid layout for markets and recent bets -->
    <div class="lg:grid lg:grid-cols-4 lg:gap-6">
      <!-- Markets column - takes up 3/4 of the space -->
      <div class="lg:col-span-3">
        <!-- Market Sections -->
        {#if $marketStore.error}
          <div class="text-center py-12 text-kong-error">
            <AlertTriangle class="w-12 h-12 mx-auto mb-4" />
            <p class="text-lg font-medium">{$marketStore.error}</p>
          </div>
        {:else}
          <div class="relative">
            <!-- Display markets based on status filter -->
            {#if $filteredMarkets.length > 0}
              <MarketSection
                markets={$filteredMarkets}
                openBetModal={betModal.open}
                userClaims={userData.userClaims}
                onMarketResolved={handleMarketResolved}
                columns={{
                  mobile: 1,
                  tablet: selectedLayout <= 2 ? selectedLayout : 2,
                  desktop: selectedLayout
                }}
              />
            {:else}
              <!-- No Markets Message -->
              <div class="text-center py-12">
                <div class="max-w-md mx-auto text-kong-text-secondary">
                  <div class="mb-4 text-2xl">📉</div>
                  <p class="text-lg">No markets available</p>
                  <p class="text-sm mt-2">
                    {$marketStore.statusFilter !== "all"
                      ? `Try changing the status filter from "${currentStatusLabel}" to "All".`
                      : "Check back later for new prediction markets."}
                  </p>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Recent Bets column - takes up 1/4 of the space -->
      <div class="mt-6 lg:mt-0 lg:sticky lg:top-0">
        <div class="lg:max-h-[536px] flex flex-col">
          <!-- User's Unresolved Markets Card -->
          <UserUnresolvedMarketsCard markets={userData.userUnresolvedMarkets} />
          
          <RecentPredictions
            bets={recentBets}
            loading={loadingBets && isInitialLoad}
            maxHeight="calc(100vh - 10.7rem)"
            showOutcomes={false}
            className="!bg-kong-bg-secondary"
          />
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Betting Modal -->
<BetModal
  modalData={betModal.state}
  onClose={betModal.close}
  onBet={betModal.placeBet}
/>

