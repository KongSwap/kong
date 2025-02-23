<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    placeBet,
    getAllBets,
    isAdmin,
  } from "$lib/api/predictionMarket";
  import { AlertTriangle, Plus, ClipboardList } from "lucide-svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { toScaledAmount } from "$lib/utils/numberFormatUtils";
  import MarketSection from "./MarketSection.svelte";
  import LazyMarketSection from "./LazyMarketSection.svelte";
  import BetModal from "./BetModal.svelte";
  import RecentBets from "./RecentBets.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/services/auth";
  import { marketStore, filteredMarkets } from "$lib/stores/marketStore";
  import { debounce } from "lodash-es";
  import { startPolling, stopPolling } from "$lib/utils/pollingService";

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

  onDestroy(() => {
    // Stop the polling task
    stopPolling("recentBets");
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
      const startTime = Date.now();
      
      // Store previous bets before updating
      previousBets = [...recentBets];
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
    } catch (e) {
      console.error("Failed to load recent bets:", e);
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
      
      // Refresh markets after successful bet
      await marketStore.refreshMarkets();
      
    } catch (e) {
      console.error("Bet error:", e);
      betError = e instanceof Error ? e.message : "Failed to place bet";
    } finally {
      isBetting = false;
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
        {:else if $marketStore.loading}
          <div class="text-center py-12">
            <div
              class="animate-spin w-12 h-12 border-4 border-kong-accent-green rounded-full border-t-transparent mx-auto"
            ></div>
            <p class="mt-4 text-kong-pm-text-secondary">Loading markets...</p>
          </div>
        {:else}
          <!-- Active Markets -->
          {#if $filteredMarkets.active?.length > 0}
            <MarketSection
              title="Active Markets"
              statusColor="bg-kong-accent-green"
              markets={$filteredMarkets.active}
              {openBetModal}
              onMarketResolved={async () => await marketStore.refreshMarkets()}
            />
          {/if}

          <!-- Expired Unresolved Markets -->
          {#if $filteredMarkets.expired_unresolved?.length > 0}
            <MarketSection
              title="Pending Resolution"
              statusColor="bg-yellow-400"
              markets={$filteredMarkets.expired_unresolved}
              showEndTime={false}
              {openBetModal}
              onMarketResolved={async () => await marketStore.refreshMarkets()}
            />
          {/if}

          <!-- Resolved Markets -->
          {#if $filteredMarkets.resolved?.length > 0}
            <LazyMarketSection
              title="Resolved Markets"
              statusColor="bg-kong-accent-green"
              markets={$filteredMarkets.resolved}
              isResolved={true}
              {openBetModal}
              onMarketResolved={async () => await marketStore.refreshMarkets()}
            />
          {/if}

          <!-- No Markets Message -->
          {#if (!$filteredMarkets.active || $filteredMarkets.active.length === 0) && (!$filteredMarkets.expired_unresolved || $filteredMarkets.expired_unresolved.length === 0) && (!$filteredMarkets.resolved || $filteredMarkets.resolved.length === 0)}
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
