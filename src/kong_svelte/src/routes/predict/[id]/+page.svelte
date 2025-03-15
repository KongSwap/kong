<!-- TODO: Add the rules -->
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
    ArrowLeft,
  } from "lucide-svelte";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import RecentBets from "../RecentBets.svelte";
  import { slide, fade, crossfade } from "svelte/transition";
  import BetModal from "../BetModal.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  
  // Import our new components
  import MarketHeader from "./MarketHeader.svelte";
  import ChartPanel from "./ChartPanel.svelte";
  import OutcomesList from "./OutcomesList.svelte";
  import MarketStats from "./MarketStats.svelte";

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
  
  // Add an error state for charts
  let chartError: boolean = false;

  // Reference to the ChartPanel component
  let chartPanel: typeof ChartPanel;

  // Betting state
  let showBetModal = false;
  let betAmount = 0;
  let selectedOutcome: number | null = null;
  let selectedChartTab: string = "percentageChance";

  // Handle chart tab changes
  function handleChartTabChange(event: CustomEvent<string>) {
    selectedChartTab = event.detail;
  }

  const [send, receive] = crossfade({
    duration: 300,
    fallback(node, params) {
      return {
        duration: 300,
        css: (t) => `
          opacity: ${t};
          transform: scale(${0.8 + 0.2 * t});
        `,
      };
    },
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
      
      // Create a completely new array with deep copies to avoid any reference issues
      // Make sure to process BigInt values to prevent reactivity issues
      marketBets = allBets.map(bet => {
        const newBet = {...bet};
        
        // Process every property that might be a BigInt
        for (const key in newBet) {
          if (typeof newBet[key] === 'bigint') {
            newBet[key] = Number(newBet[key].toString());
          }
        }
        
        return newBet;
      });
      
    } catch (e) {
      console.error("Failed to load market bets:", e);
      // Set an empty array on error to avoid undefined issues
      marketBets = [];
    } finally {
      loadingBets = false;
    }
  }

  onMount(async () => {
    try {
      const marketId = Number($page.params.id);
      const marketData = await getMarket(marketId);
      console.log(marketData);
      market = marketData[0];
      
      try {
        await loadMarketBets();
      } catch (betError) {
        console.error("Error loading bets:", betError);
        // Continue with the rest of the page even if bets fail to load
        marketBets = [];
      }

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
      
      // Reload bets with a small delay to allow backend to update
      setTimeout(async () => {
        await loadMarketBets();
      }, 500);
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

  function handleOutcomeSelect(outcomeIndex: number) {
    selectedOutcome = outcomeIndex;
    showBetModal = true;
  }

  $: totalPool = Number(market?.total_pool || 0);
  $: outcomes = market?.outcomes || [];
  $: betCounts = market?.bet_counts?.map(Number) || [];
  $: betCountPercentages = market?.bet_count_percentages || [];
  $: outcomePercentages = market?.outcome_percentages || [];
  $: isMarketClosed = market?.status?.Closed !== undefined;
  $: winningOutcomes = isMarketClosed ? market.status.Closed : [];
  $: isMarketResolved = isMarketClosed;
  $: marketEndTime = market?.end_time
    ? Number(market.end_time) / 1_000_000
    : null;
  $: isPendingResolution =
    !isMarketResolved && marketEndTime && marketEndTime < Date.now();
</script>

<svelte:head> 
  <title>{market?.question} - KongSwap</title>
  <meta name="description" content="{market?.question}" />
</svelte:head>

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
            <MarketHeader 
              {market} 
              isMarketResolved={isMarketResolved} 
              isPendingResolution={isPendingResolution} 
            />
            
            <!-- Re-enable the simplified ChartPanel -->
            <ChartPanel 
              market={market}
              marketBets={marketBets}
              selectedChartTab={selectedChartTab}
              on:tabChange={handleChartTabChange}
            />
          </Panel>

          <!-- Outcomes Panel -->
          <OutcomesList
            {market}
            outcomes={outcomes}
            outcomePercentages={outcomePercentages}
            betCountPercentages={betCountPercentages}
            betCounts={betCounts}
            isMarketResolved={isMarketResolved}
            isPendingResolution={isPendingResolution}
            isMarketClosed={isMarketClosed}
            winningOutcomes={winningOutcomes}
            onSelectOutcome={handleOutcomeSelect}
          />
        </div>

        <!-- Right Column -->
        <div class="space-y-3 sm:space-y-4">
          <!-- Market Stats Panel -->
          <MarketStats
            totalPool={totalPool}
            betCounts={betCounts}
            timeLeft={timeLeft}
            isMarketResolved={isMarketResolved}
            marketEndTime={market.end_time}
          />

          <!-- Restore the simplified RecentBets -->
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
  onOutcomeSelect={(index) => (selectedOutcome = index)}
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
</style>
