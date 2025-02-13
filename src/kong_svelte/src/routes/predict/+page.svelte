<script lang="ts">
  import { onMount } from "svelte";
  import {
    getMarketsByStatus,
    placeBet,
    getAllBets,
    getAllCategories,
    getAllMarkets,
  } from "$lib/api/predictionMarket";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { Coins, AlertTriangle, Flame, TrendingUpDown } from "lucide-svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { auth } from "$lib/services/auth";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { formatBalance, toScaledAmount } from "$lib/utils/numberFormatUtils";
  import MarketSection from "./MarketSection.svelte";
  import BetModal from './BetModal.svelte';
  import BigNumber from "bignumber.js";
  import Panel from "$lib/components/common/Panel.svelte";

  let marketsByStatus: any = { active: [], resolved: [] };
  let loading = true;
  let loadingBets = false;
  let error: string | null = null;

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

  // Calculate the correct percentage for each outcome
  function calculatePercentage(
    amount: number | undefined,
    total: number | undefined,
  ): number {
    // Convert inputs to numbers and handle undefined
    const amountNum = Number(amount || 0);
    const totalNum = Number(total || 0);

    // Debug logging
    console.log("Calculating percentage:", {
      amount: amountNum,
      total: totalNum,
    });

    // Safety check for invalid numbers
    if (isNaN(amountNum) || isNaN(totalNum)) {
      console.log("Invalid numbers detected:", { amountNum, totalNum });
      return 0;
    }

    // If total is 0, check if this outcome has any amount
    if (totalNum === 0) {
      return amountNum > 0 ? 100 : 0;
    }

    // Calculate percentage
    const percentage = (amountNum / totalNum) * 100;
    console.log("Calculated percentage:", percentage);

    return percentage;
  }

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
            .filter(newBet => !previousBets.some(oldBet => 
              oldBet.bet.timestamp === newBet.bet.timestamp && 
              oldBet.bet.outcome_index === newBet.bet.outcome_index
            ))
            .map(bet => `${bet.bet.timestamp}-${bet.bet.outcome_index}`)
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
        getAllCategories()
      ]);
      
      // Convert nanoseconds to milliseconds for comparison
      const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
      
      // Process markets once
      marketsByStatus = {
        active: allMarketsResult.filter(market => 
          'Open' in market.status && 
          BigInt(market.end_time) > nowNs
        ),
        expired_unresolved: allMarketsResult.filter(market => 
          'Open' in market.status && 
          BigInt(market.end_time) <= nowNs
        ),
        resolved: allMarketsResult.filter(market => 
          'Closed' in market.status
        )
      };
      
      categories = ['All', ...categoriesResult];
      
      // Initial bets load
      await loadRecentBets();

      // Set up polling for recent bets
      const pollInterval = setInterval(loadRecentBets, 1000 * 10); // 10 seconds
      
      return () => {
        clearInterval(pollInterval);
      };
    } catch (e) {
      error = 'Failed to load prediction markets';
      console.error(e);
    } finally {
      loading = false;
    }
  });

  function openBetModal(market: any) {
    selectedMarket = market;
    betAmount = 0;
    selectedOutcome = null;
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
        throw new Error('Failed to fetch KONG token information');
      }

      // Convert bet amount to scaled token units
      const scaledAmount = toScaledAmount(amount, kongToken.decimals);

      await placeBet(
        kongToken,
        Number(selectedMarket.id),
        selectedOutcome,
        scaledAmount
      );

      closeBetModal();
      
      // Refresh markets first, then bets sequentially to avoid race conditions
      const newMarkets = await getAllMarkets();
      
      // Convert nanoseconds to milliseconds for comparison
      const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
      
      // Update markets state
      marketsByStatus = {
        active: newMarkets.filter(market => 
          'Open' in market.status && 
          BigInt(market.end_time) > nowNs
        ),
        expired_unresolved: newMarkets.filter(market => 
          'Open' in market.status && 
          BigInt(market.end_time) <= nowNs
        ),
        resolved: newMarkets.filter(market => 
          'Closed' in market.status
        )
      };
    } catch (e) {
      console.error('Bet error:', e);
      betError = e instanceof Error ? e.message : 'Failed to place bet';
    } finally {
      isBetting = false;
    }
  }

  function marketIsTrending(market: any): boolean {
    if (
      !market.outcomes ||
      !market.outcome_pools ||
      market.total_pool === undefined
    )
      return false;
    return market.outcomes.some((_: any, i: number) => {
      return (
        calculatePercentage(market.outcome_pools[i], market.total_pool) > 60
      );
    });
  }
</script>

<div class="min-h-screen text-kong-text-primary px-4">
  <div class="max-w-7xl mx-auto">
    <div class="text-center mb-8 flex justify-between items-center">
      <div class="flex flex-col gap-2">
        <h1
          class="text-xl flex items-center gap-3 justify-center drop-shadow-lg md:text-3xl font-bold text-kong-text-primary max-w-2xl mx-auto text-kong-text-primary/80 bg-300"
        >
          <TrendingUpDown size={28} class="gradient-stroke" strokeWidth={2.5} />
          Prediction Markets
        </h1>

        <p
          class="text-kong-pm-text-secondary pl-8 flex items-center gap-2 justify-center"
        >
          Predict the future and earn rewards.
        </p>
      </div>

      <!-- Category Filters -->
      <div class="flex items-center">
        <div class="flex flex-wrap gap-2 justify-center">
          {#each categories as category}
            <button
              class="px-3 py-1 rounded-full text-sm font-medium transition-colors
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
        {#if recentBets.length > 0}
          <div class="sticky top-4">
            <h2 class="text-2xl font-bold mb-2 flex items-center gap-2">
              <span
                class="w-2 h-2 bg-kong-accent-green rounded-full animate-pulse"
              ></span>
              Recent Bets
            </h2>
            <Panel variant="transparent" type="main" className="!rounded !p-0">
              <div>
                {#each recentBets as { bet, market }}
                  <div
                    class="flex flex-col py-3 px-4 border-b border-kong-border/50 last:border-0 {newBetIds.has(`${bet.timestamp}-${bet.outcome_index}`) ? 'flash-new-bet' : ''}"
                  >
                    <!-- Market Question -->
                    <div
                      class="text-kong-text-primary font-medium line-clamp-2"
                    >
                      {market.question}
                    </div>

                    <!-- Bet Details -->
                    <div class="flex items-center justify-between mt-1">
                      <div class="flex flex-col">
                        <span class="text-kong-accent-green">
                          {market.outcomes[Number(bet.outcome_index)]}
                        </span>
                        <span class="text-xs text-kong-pm-text-secondary">
                          {new Date(
                            Number(bet.timestamp) / 1_000_000,
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span
                          class="font-medium text-kong-accent-green"
                        >
                          {formatBalance(bet.amount, 8)}
                        </span>
                        <span class="text-xs text-kong-pm-text-secondary"
                          >KONG</span
                        >
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </Panel>
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
    onOutcomeSelect={(index) => selectedOutcome = index}
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
