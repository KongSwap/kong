<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import {
    getMarket,
    getMarketBets,
    placeBet,
  } from "$lib/api/predictionMarket";
  import { formatBalance, toScaledAmount } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import {
    TrendingUp,
    Clock,
    Users,
    BarChart3,
    AlertTriangle,
    Dices,
    CircleHelp,
    ArrowLeft,
  } from "lucide-svelte";
  import BetLineChart from "./BetLineChart.svelte";
  import ChanceLineChart from "./ChanceLineChart.svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import MarketStatCard from "./MarketStatCard.svelte";
  import OutcomeProgressBar from "./OutcomeProgressBar.svelte";
  import RecentBets from "../RecentBets.svelte";
  import { slide, fade, crossfade } from "svelte/transition";
  import BetModal from "../BetModal.svelte";
    import { toastStore } from "$lib/stores/toastStore";

  let market: any = null;
  let loading = true;
  let error: string | null = null;
  let marketBets: any[] = [];
  let loadingBets = false;
  let betError: string | null = null;
  let isBetting = false;
  let isApprovingAllowance = false;
  let timeLeftInterval: ReturnType<typeof setInterval>;
  let timeLeft: string = "";

  // Betting state
  let showBetModal = false;
  let betAmount = 0;
  let selectedOutcome: number | null = null;
  let selectedChartTab: string = "betHistory";

  const [send, receive] = crossfade({
    duration: 300,
    fallback(node, params) {
      return {
        duration: 300,
        css: t => `
          opacity: ${t};
          transform: scale(${0.8 + 0.2 * t});
        `
      };
    }
  });

  function formatTimeLeft(endTime: string | undefined): string {
    if (!endTime) return "Unknown";
    const end = Number(endTime) / 1_000_000; // Convert from nanoseconds to milliseconds
    const now = Date.now();
    const diff = end - now;

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function updateTimeLeft() {
    if (market?.end_time) {
      timeLeft = formatTimeLeft(market.end_time);
    }
  }

  async function loadMarketBets() {
    if (loadingBets) return;
    try {
      loadingBets = true;
      const allBets = await getMarketBets(Number($page.params.id));
      console.log("Loaded market bets:", allBets);
      marketBets = allBets;
    } catch (e) {
      console.error("Failed to load market bets:", e);
    } finally {
      loadingBets = false;
    }
  }

  onMount(async () => {
    try {
      const marketId = Number($page.params.id);
      const marketData = await getMarket(marketId);
      market = marketData[0];
      await loadMarketBets();

      // Start countdown timer
      updateTimeLeft();
      timeLeftInterval = setInterval(updateTimeLeft, 1000);
    } catch (e) {
      error = "Failed to load market";
      console.error(e);
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (timeLeftInterval) {
      clearInterval(timeLeftInterval);
    }
  });

  function calculatePotentialWin(
    outcomeIndex: number,
    betAmount: number,
  ): number {
    if (!market || betAmount <= 0) return 0;

    // Convert bet amount to token units (multiply by 10^8)
    const betAmountScaled = toScaledAmount(betAmount, 8);
    const currentTotalPool = Number(market.total_pool);
    const outcomePool = Number(market.outcome_pools[outcomeIndex] || 0);

    if (outcomePool === 0) return betAmount * 2; // If no bets yet, assume 2x return

    // Calculate new total pool after bet
    const newTotalPool = currentTotalPool + Number(betAmountScaled);

    // Calculate your share of the outcome pool after your bet
    const yourShareOfOutcome =
      Number(betAmountScaled) / (outcomePool + Number(betAmountScaled));

    // Your potential win is your share * total pool
    const potentialWinScaled = Math.floor(
      yourShareOfOutcome * Number(newTotalPool),
    );

    // Convert back from token units to display units
    return Number(formatBalance(potentialWinScaled, 8));
  }

  async function handleBet(outcomeIndex: number, amount: number) {
    if (!market) return;

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

      await placeBet(kongToken, Number(market.id), outcomeIndex, scaledAmount);

      // Reset betting state
      betAmount = 0;
      selectedOutcome = null;

      // Refresh market data
      const marketId = Number($page.params.id);
      const marketData = await getMarket(marketId);
      market = marketData[0];
      showBetModal = false;
      toastStore.add({
        title: "Bet Placed",
        message: `You bet ${amount} KONG on ${market.outcomes[outcomeIndex]}`,
        type: "success",
      });
      await loadMarketBets();
    } catch (e) {
      console.error("Bet error:", e);
      betError = e instanceof Error ? e.message : "Failed to place bet";
    } finally {
      isBetting = false;
    }
  }

  function calculateOdds(percentage: number): string {
    if (percentage <= 0) return "0x";
    if (percentage >= 100) return "1x";

    // Convert percentage to decimal odds
    // Decimal odds = 100/percentage
    const decimalOdds = 100 / percentage;

    // Round to 2 decimal places
    return `${decimalOdds.toFixed(2)}x`;
  }

  $: totalPool = Number(market?.total_pool || 0);
  $: outcomes = market?.outcomes || [];
  $: betCounts = market?.bet_counts?.map(Number) || [];
  $: betCountPercentages = market?.bet_count_percentages || [];
  $: outcomePercentages = market?.outcome_percentages || [];
  $: isMarketClosed = market?.status?.Closed !== undefined;
  $: winningOutcomes = isMarketClosed ? market.status.Closed : [];
  $: isMarketResolved = isMarketClosed;
  $: marketEndTime = market?.end_time ? Number(market.end_time) / 1_000_000 : null;
  $: isPendingResolution = !isMarketResolved && marketEndTime && marketEndTime < Date.now();
</script>

<div class="min-h-screen text-kong-text-primary px-2 sm:px-4">
  <div class="max-w-6xl mx-auto">
    <button
      on:click={() => goto("/predict")}
      class="mb-4 flex items-center gap-2 px-3 -mt-2 text-kong-text-secondary hover:text-kong-text-primary transition-colors rounded-md hover:bg-kong-bg-dark/40"
    >
      <ArrowLeft class="w-4 h-4" />
      <span class="text-sm">Back</span>
    </button>

    {#if error}
      <div class="text-center py-8 sm:py-12">
        <p class="text-kong-accent-red text-base sm:text-lg" role="alert">
          {error}
        </p>
        <button
          on:click={() => location.reload()}
          class="mt-3 sm:mt-4 px-4 py-2 bg-kong-accent-blue text-white rounded-md shadow-sm hover:shadow-md transition-shadow"
          aria-label="Reload market data">Reload Market</button
        >
      </div>
    {:else if loading}
      <div
        role="status"
        aria-label="Loading market data"
        class="space-y-3 sm:space-y-4 py-8 sm:py-12"
      >
        <div
          class="h-6 sm:h-8 bg-kong-bg-light/30 rounded animate-pulse mx-auto w-full sm:w-1/2"
        ></div>
        <div
          class="h-16 sm:h-20 bg-kong-bg-light/30 rounded animate-pulse mx-auto w-full sm:w-3/4"
        ></div>
        <div
          class="h-32 sm:h-40 bg-kong-bg-light/30 rounded animate-pulse mx-auto w-full"
        ></div>
      </div>
    {:else if market}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <!-- Left Column -->
        <div class="lg:col-span-2 space-y-3 sm:space-y-4">
          <!-- Chart Panel with Tabs -->
          <Panel
            variant="transparent"
            className="backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn"
          >
            <!-- Market Info Panel -->
            <div class="!rounded animate-fadeIn mb-2">
              <div class="flex items-center gap-2 sm:gap-3">
                <div
                  class="p-2 sm:p-2 bg-kong-accent-green/10 rounded flex items-center justify-center"
                >
                  <CircleHelp
                    size={20}
                    class="text-kong-text-accent-green sm:w-6 sm:h-6"
                  />
                </div>
                <div class="flex-1">
                  <h1
                    class="text-xl sm:text-2xl lg:text-2xl font-bold text-kong-text-primary leading-tight"
                  >
                    {market.question}
                  </h1>
                  {#if isMarketResolved || isPendingResolution}
                    <div class="flex items-center gap-2 mt-1">
                      {#if isMarketClosed}
                        <span class="px-2 py-0.5 bg-kong-accent-green/20 text-kong-text-accent-green text-xs rounded-full">
                          Resolved
                        </span>
                        {#if market.resolved_by}
                          <span class="text-xs text-kong-text-secondary">
                            by {market.resolved_by[0].toString().slice(0, 8)}...
                          </span>
                        {/if}
                      {:else if isPendingResolution}
                        <span class="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded-full">
                          Pending Resolution
                        </span>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-3 sm:gap-4">
              <div
                class="flex gap-2 sm:gap-4 border-b border-kong-border overflow-x-auto scrollbar-none"
              >
                <button
                  on:click={() => (selectedChartTab = "betHistory")}
                  class="px-3 sm:px-4 py-2 sm:py-3 focus:outline-none transition-colors relative whitespace-nowrap {selectedChartTab ===
                  'betHistory'
                    ? 'text-kong-text-accent-green font-medium'
                    : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                >
                  <span class="text-sm sm:text-base">Bet History</span>
                  {#if selectedChartTab === "betHistory"}
                    <div
                      class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-accent-green rounded-t-full"
                    ></div>
                  {/if}
                </button>
                <button
                  on:click={() => (selectedChartTab = "percentageChance")}
                  class="px-3 sm:px-4 py-2 sm:py-3 focus:outline-none transition-colors relative whitespace-nowrap {selectedChartTab ===
                  'percentageChance'
                    ? 'text-kong-text-accent-green font-medium'
                    : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                >
                  <span class="text-sm sm:text-base">Percentage Chance</span>
                  {#if selectedChartTab === "percentageChance"}
                    <div
                      class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-accent-green rounded-t-full"
                    ></div>
                  {/if}
                </button>
              </div>
              <div class="h-[300px]">
                {#if selectedChartTab === "betHistory"}
                  {#if marketBets.length === 0}
                    <div 
                      in:receive={{key: 'empty-bet-history'}}
                      out:send={{key: 'empty-bet-history'}}
                      class="h-full flex flex-col items-center justify-center text-center px-4"
                    >
                      <div class="w-16 h-16 mb-4 rounded-full bg-kong-bg-dark/50 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-kong-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 3v18h18"></path>
                          <path d="m19 9-5 5-4-4-3 3"></path>
                        </svg>
                      </div>
                      <h3 class="text-kong-text-secondary/80 font-medium mb-1">
                        No bet history yet
                      </h3>
                      <p class="text-sm text-kong-text-secondary/60">
                        Place the first bet to start tracking market activity
                      </p>
                    </div>
                  {:else}
                    <div 
                      in:receive={{key: 'bet-history'}}
                      out:send={{key: 'bet-history'}}
                    >
                      <BetLineChart {market} {marketBets} />
                    </div>
                  {/if}
                {:else}
                  {#if marketBets.length === 0}
                    <div 
                      in:receive={{key: 'empty-percentage'}}
                      out:send={{key: 'empty-percentage'}}
                      class="h-full flex flex-col items-center justify-center text-center px-4"
                    >
                      <div class="w-16 h-16 mb-4 rounded-full bg-kong-bg-dark/50 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-kong-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                          <line x1="9" y1="9" x2="9.01" y2="9"></line>
                          <line x1="15" y1="9" x2="15.01" y2="9"></line>
                        </svg>
                      </div>
                      <h3 class="text-kong-text-secondary/80 font-medium mb-1">
                        No percentage data yet
                      </h3>
                      <p class="text-sm text-kong-text-secondary/60">
                        Bet activity will reveal market sentiment
                      </p>
                    </div>
                  {:else}
                    <div 
                      in:receive={{key: 'percentage-chart'}}
                      out:send={{key: 'percentage-chart'}}
                    >
                      <ChanceLineChart {market} {marketBets} />
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          </Panel>

          <!-- Outcomes Panel -->
          <div class="space-y-2 sm:space-y-3">
            <div class="space-y-2 sm:space-y-3">
              {#each outcomes as outcome, i}
                <Panel className="relative !rounded">
                  <div class="relative flex flex-col">
                    <div
                      class="flex items-center justify-between p-2 sm:p-3 rounded transition-colors"
                    >
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-sm sm:text-base truncate flex items-center gap-2">
                          {outcome}
                          {#if isMarketClosed && winningOutcomes.some(w => Number(w) === i)}
                            <span class="text-xs px-1.5 py-0.5 bg-kong-accent-green/20 text-kong-text-accent-green rounded">
                              Winner
                            </span>
                          {/if}
                        </div>
                        <div
                          class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-kong-pm-text-secondary"
                        >
                          <span class="flex items-center gap-1">
                            <Dices size={12} class="sm:w-4 sm:h-4" />
                            <span
                              class={outcomePercentages[i] >= 75
                                ? "text-emerald-500"
                                : outcomePercentages[i] >= 50
                                  ? "text-kong-text-accent-green"
                                  : outcomePercentages[i] >= 25
                                    ? "text-yellow-500"
                                    : "text-red-500"}
                            >
                              {calculateOdds(outcomePercentages[i])} payout
                            </span>
                          </span>
                          <div class="flex items-center gap-1">
                            <BarChart3 size={12} class="sm:w-4 sm:h-4" />
                            <span class="truncate"
                              >{betCountPercentages[i].toFixed(1)}% of bets ({betCounts[
                                i
                              ]} total)</span
                            >
                          </div>
                        </div>
                        <OutcomeProgressBar
                          percentage={outcomePercentages[i]}
                        />
                      </div>
                      <div class="ml-2 sm:ml-4">
                        {#if !isMarketResolved && !isPendingResolution}
                          <button
                            aria-label={`Place bet for ${outcome}`}
                            class="px-3 sm:px-4 py-1.5 sm:py-2 bg-kong-accent-green hover:bg-kong-accent-green-hover text-white rounded-md font-bold shadow-sm hover:shadow-md transition-shadow text-sm sm:text-base"
                            on:click={() => {
                              selectedOutcome = i;
                              showBetModal = true;
                            }}
                          >
                            Bet
                          </button>
                        {:else if isMarketClosed && winningOutcomes.some(w => Number(w) === i)}
                          <div class="px-3 sm:px-4 py-1.5 sm:py-2 bg-kong-accent-green/20 text-kong-text-accent-green rounded-md text-sm sm:text-base font-medium">
                            Winner
                          </div>
                        {:else if isPendingResolution}
                          <div class="text-sm text-yellow-500">
                            Pending
                          </div>
                        {:else}
                          <div class="px-3 sm:px-4 py-1.5 sm:py-2 bg-kong-bg-dark/50 text-kong-text-secondary rounded-md text-sm sm:text-base">
                            Lost
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>
                </Panel>
              {/each}
            </div>
          </div>
        </div>

        <!-- Right Column -->
        <div class="space-y-3 sm:space-y-4">
          <!-- Market Stats Panel -->
          <Panel
            variant="transparent"
            className="bg-kong-bg-dark/80 backdrop-blur-sm !rounded shadow-lg border border-kong-border/10 animate-fadeIn"
          >
            <h2 class="text-sm sm:text-sm uppercase font-medium mb-2">
              Market Statistics
            </h2>
            <div
              class="grid grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4 lg:gap-6"
            >
              <MarketStatCard
                icon={Clock}
                label="Time Left"
                value={isMarketResolved ? 'Market Closed' : (timeLeft || formatTimeLeft(market.end_time))}
              />

              <MarketStatCard
                icon={Users}
                label="Total Bets"
                value={`${betCounts.reduce((a, b) => a + b, 0).toLocaleString()} bets`}
              />

              <div class="col-span-2 lg:col-span-1">
                <MarketStatCard
                  icon={TrendingUp}
                  label="Total Pool"
                  value={`${formatBalance(totalPool, 8)} KONG`}
                />
              </div>
            </div>
          </Panel>

          <!-- Recent Bets Panel -->
          <RecentBets
            bets={marketBets}
            outcomes={market?.outcomes}
            showOutcomes={true}
            maxHeight="500px"
            panelVariant="transparent"
            title="Recent Bets"
            loading={loadingBets}
          />
        </div>
      </div>
    {/if}
  </div>
</div>

<BetModal
  {showBetModal}
  selectedMarket={market}
  {isBetting}
  {isApprovingAllowance}
  {betError}
  {selectedOutcome}
  {betAmount}
  onClose={() => {
    showBetModal = false;
    selectedOutcome = null;
    betAmount = 0;
    betError = null;
  }}
  onBet={(amount) => handleBet(selectedOutcome!, amount)}
  onOutcomeSelect={(index) => selectedOutcome = index}
/>

<style lang="postcss" scoped>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }

  .scrollbar-none {
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
</style>
