<script lang="ts">
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
  } from "lucide-svelte";
  import BetLineChart from "./BetLineChart.svelte";
  import ChanceLineChart from "./ChanceLineChart.svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import MarketStatCard from './MarketStatCard.svelte';
  import BetInput from './BetInput.svelte';
  import BetSummary from './BetSummary.svelte';
  import OutcomeProgressBar from './OutcomeProgressBar.svelte';

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
  let betAmounts: number[] = [];
  let selectedOutcome: number | null = null;
  let selectedChartTab: string = "betHistory";

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
      betAmounts[outcomeIndex] = 0;
      betAmounts = [...betAmounts];
      selectedOutcome = null;

      // Refresh market data
      const marketId = Number($page.params.id);
      const marketData = await getMarket(marketId);
      market = marketData[0];
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
</script>

<div class="min-h-screen text-kong-text-primary px-2 sm:px-4 py-4 sm:py-8">
  <div class="max-w-6xl mx-auto">
    {#if error}
      <div class="text-center py-8 sm:py-12">
        <p class="text-kong-accent-red text-base sm:text-lg" role="alert">{error}</p>
        <button
          on:click={() => location.reload()}
          class="mt-3 sm:mt-4 px-4 py-2 bg-kong-accent-green text-white rounded-md shadow-sm hover:shadow-md transition-shadow"
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
                <div class="p-2 sm:p-2 bg-kong-accent-green/10 rounded flex items-center justify-center">
                  <CircleHelp size={20} class="text-kong-accent-green sm:w-6 sm:h-6" />
                </div>
                <h1 class="text-xl sm:text-2xl lg:text-2xl font-bold text-kong-text-primary leading-tight">
                  {market.question}
                </h1>
            </div>
          </div>
            <div class="flex flex-col gap-3 sm:gap-4">
              <div class="flex gap-2 sm:gap-4 border-b border-kong-border overflow-x-auto scrollbar-none">
                <button
                  on:click={() => (selectedChartTab = "betHistory")}
                  class="px-3 sm:px-4 py-2 sm:py-3 focus:outline-none transition-colors relative whitespace-nowrap {selectedChartTab ===
                  'betHistory'
                    ? 'text-kong-accent-green font-medium'
                    : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                >
                  <span class="text-sm sm:text-base">Bet History</span>
                  {#if selectedChartTab === "betHistory"}
                    <div class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-accent-green rounded-t-full"></div>
                  {/if}
                </button>
                <button
                  on:click={() => (selectedChartTab = "percentageChance")}
                  class="px-3 sm:px-4 py-2 sm:py-3 focus:outline-none transition-colors relative whitespace-nowrap {selectedChartTab ===
                  'percentageChance'
                    ? 'text-kong-accent-green font-medium'
                    : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                >
                  <span class="text-sm sm:text-base">Percentage Chance</span>
                  {#if selectedChartTab === "percentageChance"}
                    <div class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-accent-green rounded-t-full"></div>
                  {/if}
                </button>
              </div>
              <div class="h-[300px]">
                {#if selectedChartTab === "betHistory"}
                  <BetLineChart {market} {marketBets} />
                {:else}
                  <ChanceLineChart {market} {marketBets} />
                {/if}
              </div>
            </div>
          </Panel>

          <!-- Outcomes Panel -->
          <div class="space-y-2 sm:space-y-3">
            <h2 class="text-lg sm:text-xl font-bold px-1">Outcomes</h2>
            <div class="space-y-2 sm:space-y-3">
              {#each outcomes as outcome, i}
                <Panel className="relative !rounded">
                  <div class="relative flex flex-col">
                    <div
                      class="flex items-center justify-between p-2 sm:p-3 hover:bg-kong-bg-dark/40 rounded transition-colors shadow-sm hover:shadow-md"
                    >
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-sm sm:text-base truncate">{outcome}</div>
                        <div
                          class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-kong-pm-text-secondary"
                        >
                          <span class="flex items-center gap-1">
                            <Dices size={12} class="sm:w-4 sm:h-4" />
                            <span
                              class={outcomePercentages[i] >= 75
                                ? "text-emerald-500"
                                : outcomePercentages[i] >= 50
                                  ? "text-kong-accent-green"
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
                        <OutcomeProgressBar percentage={outcomePercentages[i]} />
                      </div>
                      <div class="ml-2 sm:ml-4">
                        {#if selectedOutcome === i}
                          <button
                            aria-label={`Cancel bet for ${outcome}`}
                            class="px-3 sm:px-4 py-1.5 sm:py-2 bg-kong-bg-light text-kong-text-primary rounded-md font-medium shadow-sm hover:shadow-md transition-shadow hover:bg-kong-bg-dark text-sm sm:text-base"
                            on:click={() => (selectedOutcome = null)}
                          >
                            Cancel
                          </button>
                        {:else}
                          <button
                            aria-label={`Place bet for ${outcome}`}
                            class="px-3 sm:px-4 py-1.5 sm:py-2 bg-kong-accent-green text-white rounded-md font-bold shadow-sm hover:shadow-md transition-shadow text-sm sm:text-base"
                            on:click={() => (selectedOutcome = i)}
                          >
                            Bet
                          </button>
                        {/if}
                      </div>
                    </div>

                    {#if selectedOutcome === i}
                      <div class="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-kong-border/10 p-3 sm:p-4 rounded">
                        <div class="space-y-4">
                          <div>
                            <div class="flex items-center justify-between mb-3">
                              <label class="text-sm font-medium text-kong-text-primary">
                                Place your bet on <span class="text-kong-accent-green">{outcome}</span>
                              </label>
                              <button
                                on:click={() => (selectedOutcome = null)}
                                class="text-kong-text-secondary hover:text-kong-text-primary transition-colors p-1"
                                aria-label="Cancel bet"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                              </button>
                            </div>
                            <BetInput bind:betAmount={betAmounts[i]} />
                          </div>
                          {#if betAmounts[i] > 0}
                            <BetSummary
                              betAmount={betAmounts[i]}
                              potentialWin={calculatePotentialWin(i, betAmounts[i])}
                              odds={calculateOdds(outcomePercentages[i])}
                            />
                          {/if}
                          <div class="flex justify-end">
                            <button
                              class="px-4 py-2 bg-kong-accent-green text-white rounded font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[100px] justify-center group hover:bg-kong-accent-green-hover text-sm"
                              on:click={() => handleBet(i, betAmounts[i])}
                              disabled={isBetting || !betAmounts[i]}
                            >
                              {#if isBetting}
                                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>{isApprovingAllowance ? 'Approving...' : 'Placing...'}</span>
                              {:else}
                                <span>Place Bet</span>
                              {/if}
                            </button>
                          </div>
                          {#if betError}
                            <div
                              class="p-2.5 bg-kong-accent-red/10 border border-kong-accent-red/30 rounded text-kong-accent-red flex items-center gap-2 animate-fadeIn"
                            >
                              <AlertTriangle class="w-4 h-4 flex-shrink-0" />
                              <span class="text-xs">{betError}</span>
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/if}
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
            <h2 class="text-base sm:text-lg font-bold mb-4 sm:mb-6">Market Statistics</h2>
            <div class="grid grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4 lg:gap-6">
              <MarketStatCard
                icon={Clock}
                label="Time Left"
                value={timeLeft || formatTimeLeft(market.end_time)}
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
          <Panel
            variant="transparent"
            className="p-3 sm:p-4 bg-kong-bg-dark !rounded shadow-md animate-fadeIn"
          >
            <div class="sticky top-4">
              <h3 class="text-base sm:text-lg font-bold mb-3 sm:mb-4">Recent Bets</h3>
              <div class="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[500px] overflow-y-auto scrollbar-thin pr-2">
                {#each marketBets as bet}
                  <div
                    class="flex items-center justify-between py-2 sm:py-3 px-2 border-b border-kong-border/50 last:border-0 hover:bg-kong-bg-dark/30 transition-colors rounded"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="font-medium text-sm sm:text-base truncate">
                        {outcomes[Number(bet.outcome_index)]}
                      </div>
                      <div class="text-xs sm:text-sm text-kong-pm-text-secondary">
                        {new Date(Number(bet.timestamp) / 1_000_000).toLocaleString()}
                      </div>
                    </div>
                    <div class="text-right ml-2">
                      <div class="font-medium text-kong-accent-green text-sm sm:text-base">
                        {formatBalance(Number(bet.amount), 8)}
                      </div>
                      <div class="text-xs text-kong-pm-text-secondary">
                        KONG
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    {/if}
  </div>
</div>

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

  /* Add scrollbar styling */
  .scrollbar-thin {
    scrollbar-width: thin;
    &::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background-color: rgb(var(--kong-border) / 0.5);
      border-radius: 3px;
    }
  }

  .scrollbar-none {
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
</style>
