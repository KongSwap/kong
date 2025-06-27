<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { placeBet, getAllBets, isAdmin } from "$lib/api/predictionMarket";
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
    filteredMarkets,
    type SortOption,
    type StatusFilter,
  } from "$lib/stores/marketStore";
  import { debounce } from "lodash-es";
  import { startPolling, stopPolling } from "$lib/utils/pollingService";
  import { clickOutside } from "$lib/actions/clickOutside";
  import Badge from "$lib/components/common/Badge.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { goto } from "$app/navigation";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";

  // Modal state
  let showBetModal = $state(false);
  let selectedMarket = $state<any>(null);
  let betAmount = $state(0);
  let selectedOutcome = $state<number | null>(null);
  let betError = $state<string | null>(null);
  let isBetting = $state(false);
  let isApprovingAllowance = $state(false);

  let recentBets = $state<any[]>([]);
  let previousBets = $state<any[]>([]);
  let isInitialLoad = $state(true);
  let loadingBets = $state(false);
  let isUserAdmin = $state(false);

  // UI state for dropdowns
  let statusDropdownOpen = $state(false);
  let sortDropdownOpen = $state(false);

  // Store the market and outcome to open after authentication
  let pendingMarket = $state<any>(null);
  let pendingOutcome = $state<number | null>(null);
  let tokens = $state([]);
  let kongToken = $state(null);

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

  $effect(() => {
    if ($auth.isConnected) {
      isAdmin($auth.account.owner).then((isAdmin) => {
        isUserAdmin = isAdmin;
      });
    }
  });

  onMount(async () => {
    // Initialize market store
    await marketStore.init();

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
  });

  // Debounced market refresh to prevent too frequent updates
  const debouncedRefreshMarkets = debounce(() => {
    marketStore.refreshMarkets();
  }, 10000);

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
      const scaledAmount = toScaledAmount(amount.toString(), kongToken.decimals);

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
    { value: "open", label: "Open" },
    { value: "expired", label: "Pending" },
    { value: "resolved", label: "Resolved" },
    { value: "voided", label: "Voided" },
  ];

  // Sort options mapping
  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "pool_desc", label: "Pool Size (High to Low)" },
    { value: "pool_asc", label: "Pool Size (Low to High)" },
  ];

  // Get current option label - make reactive with $derived
  const currentStatusLabel = $derived(
    statusOptions.find((option) => option.value === $marketStore.statusFilter)?.label || "All"
  );

  const currentSortLabel = $derived(
    sortOptions.find((option) => option.value === $marketStore.sortOption)?.label || "Pool Size (High to Low)"
  );
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
        {#if isUserAdmin}
          <ButtonV2
            theme="accent-green"
            variant="solid"
            size="md"
            onclick={() => goto("/predict/create")}
          >
            Create Market
          </ButtonV2>
        {/if}
        {#if $auth.isConnected}
          <ButtonV2
            theme="secondary"
            variant="solid"
            size="md"
            onclick={() => goto("/predict/history")}
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
            onclick={() =>
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
      <div class="flex items-center justify-between md:justify-end gap-2 mt-2 md:mt-0">
        <!-- Status Filter Dropdown -->
        <div
          class="relative status-dropdown flex-1 md:flex-none max-w-[48%] md:max-w-none"
          use:clickOutside={() => (statusDropdownOpen = false)}
        >
          <button
            class="flex items-center justify-between w-full px-3 py-1.5 rounded text-xs font-medium bg-kong-surface-dark text-kong-text-primary hover:bg-kong-bg-light/30 transition-colors border border-kong-border/50"
            onclick={(e) => {
              e.stopPropagation();
              statusDropdownOpen = !statusDropdownOpen;
              sortDropdownOpen = false;
            }}
          >
            <span class="whitespace-nowrap overflow-hidden text-ellipsis">
              Status: {currentStatusLabel}
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
                  onclick={() => {
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
            onclick={(e) => {
              e.stopPropagation();
              sortDropdownOpen = !sortDropdownOpen;
              statusDropdownOpen = false;
            }}
          >
            <span class="whitespace-nowrap overflow-hidden text-ellipsis">
              Sort: {currentSortLabel}
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
                  onclick={() => {
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
      <!-- Markets column - takes up 4/5 of the space -->
      <div class="lg:col-span-4">
        <!-- Market Sections -->
        {#if $marketStore.error}
          <div class="text-center py-12 text-kong-accent-red">
            <AlertTriangle class="w-12 h-12 mx-auto mb-4" />
            <p class="text-lg font-medium">{$marketStore.error}</p>
          </div>
        {:else}
          <div class="relative">
            <!-- Display markets based on status filter -->
            {#if ($filteredMarkets.active && $filteredMarkets.active.length > 0) || ($marketStore.statusFilter !== "open" && (($filteredMarkets.expired_unresolved && $filteredMarkets.expired_unresolved.length > 0) || ($filteredMarkets.resolved && $filteredMarkets.resolved.length > 0)))}
              <MarketSection
                markets={$marketStore.statusFilter === "resolved"
                  ? $filteredMarkets.resolved.filter(
                      (market) => "Closed" in market.status,
                    )
                  : $marketStore.statusFilter === "voided"
                    ? $filteredMarkets.resolved.filter(
                        (market) => "Voided" in market.status,
                      )
                    : $marketStore.statusFilter === "expired"
                      ? $filteredMarkets.expired_unresolved
                      : $marketStore.statusFilter === "all"
                        ? [
                            ...($filteredMarkets.active || []),
                            ...($filteredMarkets.expired_unresolved || []),
                            ...($filteredMarkets.resolved || []),
                          ]
                        : $filteredMarkets.active}
                {openBetModal}
                onMarketResolved={async () =>
                  await marketStore.refreshMarkets()}
              />
            {:else}
              <!-- No Markets Message -->
              <div class="text-center py-12">
                <div class="max-w-md mx-auto text-kong-pm-text-secondary">
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
