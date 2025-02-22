<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    placeBet,
    getAllBets,
    getAllCategories,
    getAllMarkets,
    isAdmin,
  } from "$lib/api/predictionMarket";
  import { AlertTriangle, Plus, ClipboardList } from "lucide-svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { toScaledAmount } from "$lib/utils/numberFormatUtils";
  import MarketSection from "./MarketSection.svelte";
  import BetModal from "./BetModal.svelte";
  import RecentBets from "$lib/components/predict/RecentBets.svelte";
  import TrollBox from "$lib/components/predict/TrollBox.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/services/auth";

  let marketsByStatus: any = { active: [], resolved: [] };
  let loading = true;
  let loadingBets = false;
  let error: string | null = null;
  let isUserAdmin = false;

  // Modal state
  let showBetModal = false;
  let selectedMarket: any = null;
  let betAmount = 0;
  let selectedOutcome: number | null = null;
  let betError: string | null = null;
  let isBetting = false;
  let isApprovingAllowance = false;

  // Update category state
  let categories: string[] = ["All"];
  let selectedCategory: string | null = null;

  let recentBets: any[] = [];
  let previousBets: any[] = [];
  let newBetIds = new Set<string>();
  let isInitialLoad = true;

  let pollInterval: ReturnType<typeof setInterval>;

  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });

  // Format category from variant to display text
  function formatCategory(category: any): string {
    if (!category) return "Other";

    // If category is already a string, just format it
    if (typeof category === "string") {
      return category.replace(/_/g, " ");
    }

    // Handle variant form (e.g., { Crypto: null })
    const key = Object.keys(category)[0];
    return key.replace(/_/g, " ");
  }

  async function loadRecentBets() {
    // Prevent concurrent calls
    if (loadingBets) return;
    try {
      loadingBets = true;
      // Store previous bets before updating
      previousBets = [...recentBets];
      recentBets = await getAllBets(0, 5);

      // Only identify new bets if it's not the initial load
      if (!isInitialLoad) {
        newBetIds = new Set(
          recentBets
            .filter(
              (newBet) =>
                !previousBets.some(
                  (oldBet) =>
                    oldBet.timestamp === newBet.timestamp &&
                    oldBet.outcome_index === newBet.outcome_index,
                ),
            )
            .map((bet) => `${bet.timestamp}-${bet.outcome_index}`),
        );

        // Clear animation after a delay
        if (newBetIds.size > 0) {
          setTimeout(() => {
            newBetIds.clear();
          }, 1500);
        }
      } else {
        isInitialLoad = false;
      }
    } catch (e) {
      console.error("Failed to load recent bets:", e);
    } finally {
      loadingBets = false;
    }
  }

  onMount(async () => {
    try {
      // Initial data load
      const [allMarketsResult, categoriesResult] = await Promise.all([
        getAllMarkets(),
        getAllCategories(),
      ]);

      // Check if user is admin
      if ($auth.isConnected) {
        isUserAdmin = await isAdmin($auth.account.owner);
        console.log("isUserAdmin", isUserAdmin);
      }

      // Convert nanoseconds to milliseconds for comparison
      const nowNs = BigInt(Date.now()) * BigInt(1_000_000);

      // Process markets once
      marketsByStatus = {
        active: allMarketsResult.filter(
          (market) =>
            "Open" in market.status && BigInt(market.end_time) > nowNs,
        ),
        expired_unresolved: allMarketsResult.filter(
          (market) =>
            "Open" in market.status && BigInt(market.end_time) <= nowNs,
        ),
        resolved: allMarketsResult.filter(
          (market) => "Closed" in market.status,
        ),
      };

      categories = ["All", ...categoriesResult];

      // Initial bets load
      await loadRecentBets();

      // Set up polling for recent bets
      pollInterval = setInterval(loadRecentBets, 1000 * 10); // 10 seconds
    } catch (e) {
      error = "Failed to load prediction markets";
      console.error(e);
    } finally {
      loading = false;
    }
  });

  function openBetModal(market: any, outcomeIndex?: number) {
    selectedMarket = market;
    betAmount = 0;
    selectedOutcome = outcomeIndex ?? null;
    showBetModal = true;
  }

  function closeBetModal() {
    showBetModal = false;
    selectedMarket = null;
    betAmount = 0;
    selectedOutcome = null;
    betError = null;
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

      // Refresh markets first, then bets sequentially to avoid race conditions
      const newMarkets = await getAllMarkets();

      // Convert nanoseconds to milliseconds for comparison
      const nowNs = BigInt(Date.now()) * BigInt(1_000_000);

      // Update markets state
      marketsByStatus = {
        active: newMarkets.filter(
          (market) =>
            "Open" in market.status && BigInt(market.end_time) > nowNs,
        ),
        expired_unresolved: newMarkets.filter(
          (market) =>
            "Open" in market.status && BigInt(market.end_time) <= nowNs,
        ),
        resolved: newMarkets.filter((market) => "Closed" in market.status),
      };
    } catch (e) {
      console.error("Bet error:", e);
      betError = e instanceof Error ? e.message : "Failed to place bet";
    } finally {
      isBetting = false;
    }
  }

  async function refreshMarkets() {
    try {
      const allMarketsResult = await getAllMarkets();
      
      // Convert nanoseconds to milliseconds for comparison
      const nowNs = BigInt(Date.now()) * BigInt(1_000_000);

      // Update markets state
      marketsByStatus = {
        active: allMarketsResult.filter(
          (market) =>
            "Open" in market.status && BigInt(market.end_time) > nowNs,
        ),
        expired_unresolved: allMarketsResult.filter(
          (market) =>
            "Open" in market.status && BigInt(market.end_time) <= nowNs,
        ),
        resolved: allMarketsResult.filter(
          (market) => "Closed" in market.status,
        ),
      };
    } catch (error) {
      console.error("Failed to refresh markets:", error);
      toastStore.error("Failed to refresh markets");
    }
  }
</script>

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

      <!-- Category Filters -->
      <div class="flex flex-col items-center justify-center md:justify-end gap-4">
        <div class="w-full flex flex-wrap gap-2 justify-center max-w-full overflow-x-auto pb-2 md:pb-0">
          {#each categories as category}
            <button
              class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                            {selectedCategory === category ||
              (category === 'All' && !selectedCategory)
                ? 'bg-kong-pm-accent text-white'
                : 'bg-kong-pm-dark text-kong-pm-text-secondary hover:bg-kong-pm-accent/20'}"
              on:click={() =>
                (selectedCategory = category === "All" ? null : category)}
            >
              {category}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- New grid layout for markets and recent bets -->
    <div class="lg:grid lg:grid-cols-4 lg:gap-6">
      <!-- Markets column - takes up 3/4 of the space -->
      <div class="lg:col-span-3">
        <!-- Market Sections -->
        {#if error}
          <div class="text-center py-12 text-kong-accent-red">
            <AlertTriangle class="w-12 h-12 mx-auto mb-4" />
            <p class="text-lg font-medium">{error}</p>
          </div>
        {:else if loading}
          <div class="text-center py-12">
            <div
              class="animate-spin w-12 h-12 border-4 border-kong-accent-green rounded-full border-t-transparent mx-auto"
            ></div>
            <p class="mt-4 text-kong-pm-text-secondary">Loading markets...</p>
          </div>
        {:else}
          <!-- Active Markets -->
          {#if marketsByStatus.active?.length > 0}
            <MarketSection
              title="Active Markets"
              statusColor="bg-kong-accent-green"
              markets={marketsByStatus.active.filter(
                (market) =>
                  !selectedCategory ||
                  selectedCategory === "All" ||
                  formatCategory(market.category) ===
                    formatCategory(selectedCategory),
              )}
              {openBetModal}
              onMarketResolved={refreshMarkets}
            />
          {/if}

          <!-- Expired Unresolved Markets -->
          {#if marketsByStatus.expired_unresolved?.length > 0}
            <MarketSection
              title="Pending Resolution"
              statusColor="bg-yellow-400"
              markets={marketsByStatus.expired_unresolved.filter(
                (market) =>
                  !selectedCategory ||
                  selectedCategory === "All" ||
                  formatCategory(market.category) ===
                    formatCategory(selectedCategory),
              )}
              showEndTime={false}
              {openBetModal}
              onMarketResolved={refreshMarkets}
            />
          {/if}

          <!-- Resolved Markets -->
          {#if marketsByStatus.resolved?.length > 0}
            <MarketSection
              title="Resolved Markets"
              statusColor="bg-kong-accent-green"
              markets={marketsByStatus.resolved.filter(
                (market) =>
                  !selectedCategory ||
                  selectedCategory === "All" ||
                  formatCategory(market.category) ===
                    formatCategory(selectedCategory),
              )}
              isResolved={true}
              {openBetModal}
              onMarketResolved={refreshMarkets}
            />
          {/if}

          <!-- No Markets Message -->
          {#if (!marketsByStatus.active || marketsByStatus.active.length === 0) && (!marketsByStatus.expired_unresolved || marketsByStatus.expired_unresolved.length === 0) && (!marketsByStatus.resolved || marketsByStatus.resolved.length === 0)}
            <div class="text-center py-12">
              <div class="max-w-md mx-auto text-kong-pm-text-secondary">
                <div class="mb-4 text-2xl">📉</div>
                <p class="text-lg">No markets available</p>
                <p class="text-sm mt-2">
                  Check back later for new prediction markets
                </p>
              </div>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Recent bets column - takes up 1/4 of the space -->
      <div class="lg:col-span-1">
        <div class="mb-2 flex flex-col gap-2">
          {#if isUserAdmin}
            <button
              on:click={() => goto('/predict/create')}
              class="w-full p-3 bg-kong-accent-green hover:bg-kong-accent-green-hover text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Plus class="w-3.5 h-3.5" />
              Create Market
            </button>
          {/if}
          {#if $auth.isConnected}
          <button
            on:click={() => goto('/predict/history')}
            class="w-full p-3 bg-kong-surface-dark hover:bg-kong-surface-light text-kong-text-primary rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <ClipboardList class="w-3.5 h-3.5" />
              View History
            </button>
          {/if}
        </div>
        <div class="sticky top-4 space-y-4">
          <RecentBets
            bets={recentBets}
            {newBetIds}
            showOutcomes={false}
            maxHeight="500px"
            loading={loadingBets}
          />
        </div>
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
