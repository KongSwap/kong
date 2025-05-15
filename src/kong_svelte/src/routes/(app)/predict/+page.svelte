<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { placeBet, getLatestBets, isAdmin } from "$lib/api/predictionMarket";
  import { AlertTriangle, ChevronDown } from "lucide-svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { toScaledAmount } from "$lib/utils/numberFormatUtils";
  import MarketSection from "./MarketSection.svelte";
  import BetModal from "./BetModal.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { auth } from "$lib/stores/auth";
  import {
    marketStore,
    type SortOption,
    type StatusFilter,
  } from "$lib/stores/marketStore";
  import { debounce } from "lodash-es";
  import { startPolling, stopPolling } from "$lib/utils/pollingService";
  import { clickOutside } from "$lib/actions/clickOutside";
  import Badge from "$lib/components/common/Badge.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { userTokens } from "$lib/stores/userTokens";
  import type { LatestBets } from "../../../../../declarations/prediction_markets_backend/prediction_markets_backend.did";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { truncateAddress } from "$lib/utils/principalUtils";

  // Modal state
  let showBetModal = false;
  let selectedMarket: any = null;
  let betAmount = 0;
  let selectedOutcome: number | null = null;
  let betError: string | null = null;
  let isBetting = false;
  let isApprovingAllowance = false;

  let recentBets: LatestBets[] = [];
  let previousBets: any[] = [];
  let isInitialLoad = true;
  let loadingBets = false;
  let isUserAdmin = false;

  // UI state for dropdowns
  let statusDropdownOpen = false;
  let sortDropdownOpen = false;
  let layoutDropdownOpen = false;
  let selectedLayout = 2;

  // Store the market and outcome to open after authentication
  let pendingMarket: any = null;
  let pendingOutcome: number | null = null;
  let tokens = [];
  let kongToken = null;

  // Define valid filter/sort options based on marketStore types
  const validStatusFilters: StatusFilter[] = [
    "all",
    "active",
    "pending",
    "closed",
    "disputed",
    "voided",
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
        recentBets = await getLatestBets();
        console.log(recentBets);

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

  $: if ($auth.isConnected) {
    isAdmin($auth.account.owner).then((isAdmin) => {
      isUserAdmin = isAdmin;
    });
  }

  onMount(async () => {
    const urlParams = $page.url.searchParams;
    const statusFromUrl = urlParams.get("status");
    const sortFromUrl = urlParams.get("sort");

    let initialOverrides: {
      statusFilter?: StatusFilter;
      sortOption?: SortOption;
    } = {};
    if (isValidStatusFilter(statusFromUrl)) {
      initialOverrides.statusFilter = statusFromUrl;
    }
    if (isValidSortOption(sortFromUrl)) {
      initialOverrides.sortOption = sortFromUrl;
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
  $: if (browser && selectedLayout !== undefined) {
    localStorage.setItem('preferedLayout', selectedLayout.toString());
  }

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

    // User is authenticated, proceed with opening bet modal
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

  function handleWalletLogin() {
    // If we have a pending market/outcome, open the bet modal after authentication
    if (pendingMarket) {
      openBetModal(pendingMarket, pendingOutcome);
      pendingMarket = null;
      pendingOutcome = null;
    }
  }

  async function handleBet(amount: number) {
    if (!selectedMarket || selectedOutcome === null) return;

    try {
      isBetting = true;
      betError = null;

      if (!kongToken) {
        throw new Error("Failed to fetch KONG token information");
      }

      // Convert bet amount to scaled token units
      const scaledAmount = toScaledAmount(amount, kongToken.decimals);

      await placeBet(
        kongToken,
        BigInt(selectedMarket.id),
        BigInt(selectedOutcome),
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
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "pending", label: "Pending" },
    { value: "closed", label: "Closed" },
    { value: "disputed", label: "Disputed" },
    { value: "voided", label: "Voided" },
  ];

  // Sort options mapping
  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "pool_desc", label: "Pool Size (High to Low)" },
    { value: "pool_asc", label: "Pool Size (Low to High)" },
    { value: "end_time_asc", label: "End Time (Soonest First)" },
    { value: "end_time_desc", label: "End Time (Latest First)" },
  ];

  // Get current option label
  function getCurrentStatusLabel() {
    return (
      statusOptions.find((option) => option.value === $marketStore.statusFilter)
        ?.label || "All"
    );
  }

  function getCurrentSortLabel() {
    return (
      sortOptions.find((option) => option.value === $marketStore.sortOption)
        ?.label || "Pool Size (High to Low)"
    );
  }

  // Reactive statement to update URL when filters change
  $: if (
    browser &&
    $marketStore.statusFilter &&
    $marketStore.sortOption &&
    !$marketStore.loading
  ) {
    const newUrlParams = new URLSearchParams($page.url.searchParams.toString());
    let changed = false;

    if (newUrlParams.get("status") !== $marketStore.statusFilter) {
      newUrlParams.set("status", $marketStore.statusFilter);
      changed = true;
    }
    if (newUrlParams.get("sort") !== $marketStore.sortOption) {
      newUrlParams.set("sort", $marketStore.sortOption);
      changed = true;
    }

    if (changed) {
      const currentPath = $page.url.pathname;
      goto(`${currentPath}?${newUrlParams.toString()}`, {
        replaceState: true,
        noScroll: true,
        keepFocus: true,
      });
    }
  }
</script>

<svelte:head>
  <title>Prediction Markets - KongSwap</title>
  <meta name="description" content="Predict the future and earn rewards" />
</svelte:head>

<div class="min-h-screen text-kong-text-primary px-4">
  <div class="max-w-7xl mx-auto">
    <div
      class="text-center mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-6"
    >
      <div class="flex flex-col gap-2 w-full">
        <h1
          class="text-2xl flex items-center gap-3 justify-center md:justify-start drop-shadow-lg md:text-3xl font-bold text-kong-text-primary/80"
        >
          Prediction Markets
        </h1>
      </div>

      <div class="flex gap-3 w-full justify-center md:justify-end">
        {#if $auth.isConnected}
          <ButtonV2
            theme="primary"
            variant="solid"
            size="md"
            on:click={() => goto("/predict/create")}
          >
            Create Market
          </ButtonV2>
          <ButtonV2
            theme="secondary"
            variant="solid"
            size="md"
            on:click={() => goto("/predict/history")}
          >
            Prediction History
          </ButtonV2>
        {/if}
      </div>
    </div>

    <!-- Admin Actions & User History -->
    <div class="flex flex-col md:flex-row justify-between gap-3 mb-4">
      <!-- Category Filters -->
      <div class="flex flex-wrap gap-2 max-w-full overflow-x-auto items-center">
        {#each $marketStore.categories as category}
          <span
            class="cursor-pointer"
            on:click={() =>
              marketStore.setCategory(category === "All" ? null : category)}
          >
            {#if $marketStore.selectedCategory === category || (category === "All" && $marketStore.selectedCategory === null)}
              <Badge
                variant="green"
                size="sm"
                pill={true}
                icon="●"
                class="border border-kong-accent-green font-medium"
              >
                {category}
              </Badge>
            {:else}
              <Badge variant="gray" size="sm" pill={true}>
                {category}
              </Badge>
            {/if}
          </span>
        {/each}
      </div>

      <!-- Filters Container -->
      <div
        class="flex items-center justify-between md:justify-end gap-2 mt-2 md:mt-0"
      >
        <!-- Layout Toggle Dropdown -->
        <div
          class="relative layout-dropdown flex-1 md:flex-none max-w-[48%] md:max-w-none"
          use:clickOutside={() => (layoutDropdownOpen = false)}
        >
          <button
            class="flex items-center justify-between w-full px-3 py-1.5 rounded text-xs font-medium bg-kong-surface-dark text-kong-text-primary hover:bg-kong-bg-light/30 transition-colors border border-kong-border/50"
            on:click={(e) => {
              e.stopPropagation();
              layoutDropdownOpen = !layoutDropdownOpen;
              statusDropdownOpen = false;
              sortDropdownOpen = false;
            }}
          >
            <span class="whitespace-nowrap overflow-hidden text-ellipsis">
              Columns: {layoutOptions[selectedLayout].label}
            </span>
            <ChevronDown class="w-3 h-3 ml-1 flex-shrink-0" />
          </button>

          {#if layoutDropdownOpen}
            <div
              class="absolute top-full left-0 mt-1 z-50 bg-kong-surface-dark border border-kong-border rounded-md shadow-lg py-1 w-full min-w-[120px] backdrop-blur-sm"
            >
              {#each layoutOptions as option, index}
                <button
                  class="w-full text-left px-3 py-2 text-xs hover:bg-kong-bg-light/30 {selectedLayout === index
                    ? 'bg-kong-accent-green/20 text-kong-accent-green font-medium'
                    : 'text-kong-text-primary'}"
                  on:click={() => {
                    selectedLayout = index;
                    layoutDropdownOpen = false;
                  }}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Status Filter Dropdown -->
        <div
          class="relative status-dropdown flex-1 md:flex-none max-w-[48%] md:max-w-none"
          use:clickOutside={() => (statusDropdownOpen = false)}
        >
          <button
            class="flex items-center justify-between w-full px-3 py-1.5 rounded text-xs font-medium bg-kong-surface-dark text-kong-text-primary hover:bg-kong-bg-light/30 transition-colors border border-kong-border/50"
            on:click={(e) => {
              e.stopPropagation();
              statusDropdownOpen = !statusDropdownOpen;
              sortDropdownOpen = false;
            }}
          >
            <span class="whitespace-nowrap overflow-hidden text-ellipsis">
              Status: {getCurrentStatusLabel()}
            </span>
            <ChevronDown class="w-3 h-3 ml-1 flex-shrink-0" />
          </button>

          {#if statusDropdownOpen}
            <div
              class="absolute top-full left-0 mt-1 z-50 bg-kong-surface-dark border border-kong-border rounded-md shadow-lg py-1 w-full min-w-[120px] backdrop-blur-sm"
            >
              {#each statusOptions as option}
                <button
                  class="w-full text-left px-3 py-2 text-xs hover:bg-kong-bg-light/30 {$marketStore.statusFilter ===
                  option.value
                    ? 'bg-kong-accent-green/20 text-kong-accent-green font-medium'
                    : 'text-kong-text-primary'}"
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

        <!-- Sorting Dropdown -->
        <div
          class="relative sort-dropdown flex-1 md:flex-none max-w-[48%] md:max-w-none"
          use:clickOutside={() => (sortDropdownOpen = false)}
        >
          <button
            class="flex items-center justify-between w-full px-3 py-1.5 rounded text-xs font-medium bg-kong-surface-dark text-kong-text-primary hover:bg-kong-bg-light/30 transition-colors border border-kong-border/50"
            on:click={(e) => {
              e.stopPropagation();
              sortDropdownOpen = !sortDropdownOpen;
              statusDropdownOpen = false;
            }}
          >
            <span class="whitespace-nowrap overflow-hidden text-ellipsis">
              Sort: {getCurrentSortLabel()}
            </span>
            <ChevronDown class="w-3 h-3 ml-1 flex-shrink-0" />
          </button>

          {#if sortDropdownOpen}
            <div
              class="absolute top-full right-0 mt-1 z-30 bg-kong-surface-dark border border-kong-border rounded-md shadow-lg py-1 w-full min-w-[180px] backdrop-blur-sm"
            >
              {#each sortOptions as option}
                <button
                  class="w-full text-left px-3 py-2 text-xs hover:bg-kong-bg-light/30 {$marketStore.sortOption ===
                  option.value
                    ? 'bg-kong-accent-green/20 text-kong-accent-green font-medium'
                    : 'text-kong-text-primary'}"
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

    <!-- New grid layout for markets and recent bets -->
    <div class="lg:grid lg:grid-cols-4 lg:gap-6">
      <!-- Markets column - takes up 3/4 of the space -->
      <div class="lg:col-span-3">
        <!-- Market Sections -->
        {#if $marketStore.error}
          <div class="text-center py-12 text-kong-accent-red">
            <AlertTriangle class="w-12 h-12 mx-auto mb-4" />
            <p class="text-lg font-medium">{$marketStore.error}</p>
          </div>
        {:else}
          <div class="relative">
            <!-- Display markets based on status filter -->
            {#if $marketStore.markets.length > 0}
              <MarketSection
                markets={$marketStore.markets}
                {openBetModal}
                onMarketResolved={async () =>
                  await marketStore.refreshMarkets()}
                columns={{
                  mobile: 1,
                  tablet: layoutOptions[selectedLayout].value <= 2 ? layoutOptions[selectedLayout].value : 2,
                  desktop: layoutOptions[selectedLayout].value
                }}
              />
            {:else}
              <!-- No Markets Message -->
              <div class="text-center py-12">
                <div class="max-w-md mx-auto text-kong-pm-text-secondary">
                  <div class="mb-4 text-2xl">📉</div>
                  <p class="text-lg">No markets available</p>
                  <p class="text-sm mt-2">
                    {$marketStore.statusFilter !== "all"
                      ? `Try changing the status filter from "${getCurrentStatusLabel()}" to "All".`
                      : "Check back later for new prediction markets."}
                  </p>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Recent Bets column - takes up 1/4 of the space -->
      <div class="mt-6 lg:mt-0">
        <Panel variant="solid" type="main" className="overflow-hidden px-0">
          <div
            class="border-b border-kong-border/30 flex justify-between items-center px-4"
          >
            <h2 class="font-semibold">Recent Predictions</h2>
            <span
              class="text-kong-accent-green flex items-center gap-1 text-sm px-2 py-1 rounded-full font-medium"
              >
              <div class="bg-kong-accent-green w-2 h-2 animate-pulse rounded-full"></div>
              Live</span
            >
          </div>

          {#if loadingBets && isInitialLoad}
            <div class="p-4 text-center">
              <div
                class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-kong-accent-green border-r-transparent"
              ></div>
              <p class="mt-2 text-kong-text-secondary">
                Loading recent predictions...
              </p>
            </div>
          {:else if recentBets.length === 0}
            <div class="p-4 text-center text-kong-text-secondary">
              <p>No recent predictions yet</p>
            </div>
          {:else}
            <div
              class="divide-y divide-kong-border/30 flex flex-col gap-2 pt-1"
            >
              {#each recentBets as bet}
                <div
                  class="items-center cursor-pointer py-1.5 px-4 transition-colors group"
                >
                  <div
                    class="mb-1 font-medium text-kong-text-primary group-hover:text-kong-primary transition-colors"
                    on:click={() => goto(`/predict/${bet.market.id}`)}

                    >
                    {bet.market.question}
                  </div>
                  <!-- User predicted outcome on market question -->
                  <div class="text-kong-text-secondary break-all">
                    <span
                      class="font-medium text-kong-accent-green inline-flex gap-1"
                    >
                      <TokenImages
                        tokens={[
                          $userTokens.tokens.find(
                            (token) => token.address === bet.bet.token_id,
                          ),
                        ]}
                        size={14}
                      />
                      {formatToNonZeroDecimal(Number(bet.bet.amount) / 10 ** 8)}
                      {$userTokens.tokens.find(
                        (token) => token.address === bet.bet.token_id,
                      )?.symbol}
                    </span>
                    on

                    <span
                      class="font-medium bg-kong-primary inline-flex items-center text-kong-text-on-primary px-1.5 rounded"
                    >
                      {bet.market.outcomes[Number(bet.bet.outcome_index)]}
                    </span>

                    by
                    <span class="hover:text-kong-primary transition-colors" on:click={() => goto(
                      `/wallets/${bet.bet.user.toString()}`
                    )}>
                      {truncateAddress(bet.bet.user.toString())}
                    </span>

                    at {new Date(
                      Number(bet.bet.timestamp) / 1_000_000,
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </Panel>
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
</style>
