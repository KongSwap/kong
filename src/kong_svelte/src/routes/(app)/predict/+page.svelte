<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { placeBet, getLatestBets, getUserPendingClaims } from "$lib/api/predictionMarket";
  import { AlertTriangle } from "lucide-svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { toScaledAmount } from "$lib/utils/numberFormatUtils";
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
  import Badge from "$lib/components/common/Badge.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import DropdownSelect from "$lib/components/common/DropdownSelect.svelte";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { syncURLParams, getURLParams } from "$lib/utils/urlUtils";
  import type { LatestBets } from "../../../../../declarations/prediction_markets_backend/prediction_markets_backend.did";
  import RecentBets from "./RecentBets.svelte";
  import PredictionMarketsHeader from "$lib/components/predict/PredictionMarketsHeader.svelte";

  // Bet modal state
  let betModalState = $state({
    show: false,
    market: null as any,
    amount: 0,
    outcome: null as number | null,
    error: null as string | null,
    isBetting: false,
    isApprovingAllowance: false
  });

  let recentBets = $state<LatestBets[]>([]);
  let previousBets: any[] = [];
  let isInitialLoad = true;
  let loadingBets = $state(false);

  // UI state
  let selectedLayout = $state(3); // Default to 3 markets

  // Store the market and outcome to open after authentication
  let pendingMarket: any = null;
  let pendingOutcome: number | null = null;
  let tokens = [];
  let kongToken = null;
  let userClaims = $state([]);
  let loadingClaims = $state(false);
  let lastLoadedPrincipal = $state<string | null>(null);

  // Define valid filter/sort options based on marketStore types
  const validStatusFilters: StatusFilter[] = [
    "all",
    "active",
    "pending",
    "closed",
    "disputed",
    "voided",
    "myMarkets",
  ];
  const validSortOptions: SortOption[] = [
    "newest",
    "pool_asc",
    "pool_desc",
    "end_time_asc",
    "end_time_desc",
  ];

  const layoutOptions = [
    { value: 1, label: "1 Market" },
    { value: 2, label: "2 Markets" },
    { value: 3, label: "3 Markets" },
    { value: 4, label: "4 Markets" },
  ];

  function isValidStatusFilter(filter: string | null): filter is StatusFilter {
    return !!filter && validStatusFilters.includes(filter as StatusFilter);
  }

  function isValidSortOption(option: string | null): option is SortOption {
    return !!option && validSortOptions.includes(option as SortOption);
  }

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
        const bets = await getLatestBets();
        recentBets = bets;
        // Minimum loading time of 500ms to prevent flash
        const elapsed = Date.now() - startTime;
        if (elapsed < 500) {
          await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
        }

        // Only identify new bets if it's not the initial load
        if (!isInitialLoad) {
          new Set(
            recentBets
              .filter(
                (newBet) =>
                  !previousBets.some(
                    (oldBet) => getBetId(oldBet) === getBetId(newBet),
                  ),
              )
              .map(getBetId),
          );
        } else {
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
      }
    } finally {
      loadingBets = false;
    }
  }

  function getBetId(bet: any) {
    return `${bet.timestamp}-${bet.user}`;
  }

  onMount(async () => {
    const urlParams = getURLParams($page, ["status", "sort"]);
    
    let initialOverrides: {
      statusFilter?: StatusFilter;
      sortOption?: SortOption;
    } = {};
    if (isValidStatusFilter(urlParams.status)) {
      initialOverrides.statusFilter = urlParams.status as StatusFilter;
    }
    if (isValidSortOption(urlParams.sort)) {
      initialOverrides.sortOption = urlParams.sort as SortOption;
    }

    // Set the current user principal in the market store
    if ($auth.isConnected && $auth.account?.owner) {
      marketStore.setCurrentUserPrincipal($auth.account.owner);
    }

    // Initialize market store with overrides from URL
    await marketStore.init(initialOverrides);

    tokens = await fetchTokensByCanisterId([KONG_LEDGER_CANISTER_ID]);
    kongToken = tokens[0];

    // Initial bets load
    await loadRecentBets();

    // Start polling for recent bets and refresh markets using the generic polling service
    startPolling(
      "recentBets",
      () => {
        loadRecentBets();
        debouncedRefreshMarkets();
      },
      30000,
    );

    // Load layout preference from localStorage if available
    const savedLayout = browser && localStorage.getItem('preferedLayout');
    if (savedLayout !== null) {
      selectedLayout = parseInt(savedLayout, 10);
    }
  });

  // Save layout preference when changed
  $effect(() => {
    if (browser && selectedLayout !== undefined) {
      localStorage.setItem('preferedLayout', selectedLayout.toString());
    }
  });

  // Debounced market refresh to prevent too frequent updates
  const debouncedRefreshMarkets = debounce(() => {
    marketStore.refreshMarkets();
  }, 1000);

  function openBetModal(market: any, outcomeIndex?: number) {
    // Check if user is authenticated
    if (!$auth.isConnected) {
      // Store the market and outcome to open after authentication
      pendingMarket = market;
      pendingOutcome = outcomeIndex !== undefined ? outcomeIndex : 0;
      walletProviderStore.open(handleWalletLogin);
      return;
    }

    // Reset state and open modal
    betModalState = {
      show: true,
      market: market,
      amount: 0,
      outcome: outcomeIndex !== undefined ? outcomeIndex : 0,
      error: null,
      isBetting: false,
      isApprovingAllowance: false
    };
  }

  function closeBetModal() {
    betModalState.show = false;
  }

  function handleWalletLogin() {
    // If we have a pending market/outcome, open the bet modal after authentication
    if (pendingMarket) {
      openBetModal(pendingMarket, pendingOutcome);
      pendingMarket = null;
      pendingOutcome = null;
    }
  }

  async function handleBet(amount: number) {
    if (!betModalState.market || betModalState.outcome === null) return;

    try {
      betModalState.isBetting = true;
      betModalState.error = null;

      if (!kongToken) {
        throw new Error("Failed to fetch KONG token information");
      }

      // Convert bet amount to scaled token units
      const scaledAmount = toScaledAmount(amount.toString(), kongToken.decimals);

      await placeBet(
        kongToken,
        BigInt(betModalState.market.id),
        BigInt(betModalState.outcome),
        scaledAmount,
      );

      toastStore.add({
        title: "Bet Placed",
        message: `You bet ${amount} KONG on ${betModalState.market.outcomes[betModalState.outcome]}`,
        type: "success",
      });

      closeBetModal();

      // Refresh markets after successful bet
      await marketStore.refreshMarkets();
    } catch (e) {
      console.error("Bet error:", e);
      betModalState.error = e instanceof Error ? e.message : "Failed to place bet";
    } finally {
      betModalState.isBetting = false;
    }
  }

  // Filter and sort options
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

  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "pool_desc", label: "Pool Size (High to Low)" },
    { value: "pool_asc", label: "Pool Size (Low to High)" },
    { value: "end_time_asc", label: "End Time (Soonest First)" },
    { value: "end_time_desc", label: "End Time (Latest First)" },
  ];

  // Get the current status filter label
  const currentStatusLabel = $derived(
    statusOptions.find(opt => opt.value === $marketStore.statusFilter)?.label || "All"
  );

  // Update market store when auth state changes
  $effect(() => {
    if (browser) {
      if ($auth.isConnected && $auth.account?.owner) {
        const currentPrincipal = $auth.account.owner;
        marketStore.setCurrentUserPrincipal(currentPrincipal);
        
        // Only load claims if principal changed
        if (currentPrincipal !== lastLoadedPrincipal) {
          lastLoadedPrincipal = currentPrincipal;
          loadUserClaims();
        }
      } else {
        marketStore.setCurrentUserPrincipal(null);
        userClaims = [];
        lastLoadedPrincipal = null;
      }
    }
  });

  async function loadUserClaims() {
    if (!$auth.isConnected || !$auth.account?.owner || loadingClaims) return;
    
    try {
      loadingClaims = true;
      userClaims = await getUserPendingClaims($auth.account.owner);
    } catch (e) {
      console.error("Failed to load user claims:", e);
      userClaims = [];
    } finally {
      loadingClaims = false;
    }
  }

  // Update URL when filters change
  $effect(() => {
    if (
      browser &&
      $marketStore.statusFilter &&
      $marketStore.sortOption &&
      !$marketStore.loading
    ) {
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
    <PredictionMarketsHeader {openBetModal} {userClaims} />

    <!-- Filters and Controls -->
    <div class="border-b border-kong-text-primary/10 pb-4 mb-6 px-4">
      <div class="flex flex-col lg:flex-row justify-between gap-4">
        <!-- Category Filters -->
        <div class="flex flex-wrap gap-2 items-center">
          {#each $marketStore.categories as category}
            <button
              class="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200
                     {($marketStore.selectedCategory === category || (category === "All" && $marketStore.selectedCategory === null))
                       ? 'bg-kong-accent-blue/20 text-kong-accent-blue border border-kong-accent-blue/30'
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
            options={sortOptions}
            value={$marketStore.sortOption}
            label="Sort by"
            onChange={(value) => {
              marketStore.setSortOption(value as SortOption);
            }}
            size="sm"
            className="min-w-[180px]"
          />

          <!-- Layout Toggle -->
          <div class="hidden lg:flex items-center gap-1 ml-4 bg-kong-bg-secondary rounded-lg p-1 border border-kong-text-primary/10">
            {#each [1, 2, 3, 4] as columns}
              <button
                class="p-2 rounded transition-all duration-200
                       {selectedLayout === columns
                         ? 'bg-kong-bg-tertiary text-kong-text-primary'
                         : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                onclick={() => selectedLayout = columns}
                title="{columns} column{columns > 1 ? 's' : ''}"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  {#if columns === 1}
                    <rect x="2" y="2" width="16" height="16" rx="1" />
                  {:else if columns === 2}
                    <rect x="2" y="2" width="7" height="16" rx="1" />
                    <rect x="11" y="2" width="7" height="16" rx="1" />
                  {:else if columns === 3}
                    <rect x="2" y="2" width="4.5" height="16" rx="1" />
                    <rect x="7.75" y="2" width="4.5" height="16" rx="1" />
                    <rect x="13.5" y="2" width="4.5" height="16" rx="1" />
                  {:else}
                    <rect x="2" y="2" width="3.5" height="16" rx="0.5" />
                    <rect x="6.25" y="2" width="3.5" height="16" rx="0.5" />
                    <rect x="10.5" y="2" width="3.5" height="16" rx="0.5" />
                    <rect x="14.75" y="2" width="3.25" height="16" rx="0.5" />
                  {/if}
                </svg>
              </button>
            {/each}
          </div>
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
                {openBetModal}
                {userClaims}
                onMarketResolved={async () => {
                  await marketStore.refreshMarkets();
                  await loadUserClaims();
                }}
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
        <div class="lg:max-h-[calc(100vh-2rem)] flex flex-col">
          <RecentBets
            bets={recentBets}
            loading={loadingBets && isInitialLoad}
            maxHeight="calc(100vh - 10.7rem)"
            panelVariant="solid"
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
  showBetModal={betModalState.show}
  selectedMarket={betModalState.market}
  isBetting={betModalState.isBetting}
  isApprovingAllowance={betModalState.isApprovingAllowance}
  betError={betModalState.error}
  selectedOutcome={betModalState.outcome}
  bind:betAmount={betModalState.amount}
  onClose={closeBetModal}
  onBet={handleBet}
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
      var(--kong-success),
      var(--kong-primary)
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
    stroke: var(--kong-success);
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
</style>
