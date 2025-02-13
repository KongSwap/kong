<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import {
    getMarket,
    getAllBets,
    getMarketBets,
  } from "$lib/api/predictionMarket";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import BetModal from "../BetModal.svelte";
  import { TrendingUp, Clock, Users, History, BarChart3 } from "lucide-svelte";
  import Chart from "chart.js/auto";
  import {
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    TimeSeriesScale,
  } from "chart.js";

  // Register required Chart.js components
  Chart.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    TimeSeriesScale,
  );

  let market: any = null;
  let loading = true;
  let error: string | null = null;
  let marketBets: any[] = [];
  let loadingBets = false;
  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  // Modal state
  let showBetModal = false;
  let betAmount = 0;
  let selectedOutcome: number | null = null;
  let betError: string | null = null;
  let isBetting = false;
  let isApprovingAllowance = false;

  function calculatePercentage(
    amount: number | undefined,
    total: number | undefined,
  ): number {
    const amountNum = Number(amount || 0);
    const totalNum = Number(total || 0);
    if (totalNum === 0) return amountNum > 0 ? 100 : 0;
    return (amountNum / totalNum) * 100;
  }

  function formatTimeLeft(endTime: string | undefined): string {
    if (!endTime) return "Unknown";
    const end = Number(endTime) / 1_000_000; // Convert from nanoseconds to milliseconds
    const now = Date.now();
    const diff = end - now;

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  }

  function createBetHistoryChart() {
    console.log("Creating chart with:", {
      hasCanvas: !!chartCanvas,
      hasMarket: !!market,
      betCount: marketBets?.length,
      outcomes: market?.outcomes,
    });

    if (!chartCanvas || !market || !marketBets.length) {
      console.log("Skipping chart creation - missing required data");
      return;
    }

    // Destroy existing chart if it exists
    if (chart) {
      console.log("Destroying existing chart");
      chart.destroy();
    }

    // Process bet data
    const betsByOutcome = market.outcomes.map((_, index) => {
      const filteredBets = marketBets
        .filter((bet) => Number(bet.outcome_index) === index)
        .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
      console.log(`Outcome ${index} has ${filteredBets.length} bets`);
      return filteredBets;
    });

    // Calculate cumulative amounts
    const datasets = market.outcomes.map((outcome, index) => {
      const bets = betsByOutcome[index];
      let cumulative = 0;
      const data = bets.map((bet) => {
        cumulative += Number(bet.amount);
        return {
          x: Number(bet.timestamp) / 1_000_000,
          y: Number(formatBalance(cumulative, 8)),
        };
      });

      console.log(`Dataset for ${outcome}:`, data);

      // Add initial point if there are bets
      if (data.length > 0) {
        data.unshift({
          x: data[0].x - 1000, // 1 second before first bet
          y: 0,
        });
      }

      return {
        label: outcome,
        data: data,
        borderColor: index === 0 ? "#22c55e" : "#6366f1",
        backgroundColor: index === 0 ? "#22c55e20" : "#6366f120",
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      };
    });

    console.log("Final datasets:", datasets);

    const config = {
      type: "line" as const,
      data: {
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 750,
          easing: "easeInOutQuart" as const,
        },
        interaction: {
          intersect: false,
          mode: "nearest" as const,
        },
        scales: {
          x: {
            type: "time" as const,
            time: {
              unit: "hour" as const,
              displayFormats: {
                hour: "MMM d, HH:mm",
              },
            },
            grid: {
              display: false,
            },
            ticks: {
              color: "#94a3b8",
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: false,
            },
            grid: {
              color: "#1e293b40",
            },
            ticks: {
              color: "#94a3b8",
              callback: function (value) {
                return value.toLocaleString() + " KONG";
              },
            },
          },
        },
        plugins: {
          legend: {
            position: "top" as const,
            labels: {
              color: "#94a3b8",
              usePointStyle: true,
              pointStyle: "circle" as const,
            },
          },
          tooltip: {
            backgroundColor: "#1e293b",
            titleColor: "#94a3b8",
            bodyColor: "#e2e8f0",
            borderColor: "#334155",
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              title: (items) => {
                const date = new Date(items[0].parsed.x);
                return date.toLocaleString();
              },
              label: (item) => {
                return ` ${item.dataset.label}: ${item.parsed.y.toLocaleString()} KONG`;
              },
            },
          },
        },
      },
    };

    try {
      console.log("Creating new chart with config:", config);
      chart = new Chart(chartCanvas, config);
      console.log("Chart created successfully");
    } catch (error) {
      console.error("Failed to create chart:", error);
    }
  }

  async function loadMarketBets() {
    if (loadingBets) return;
    try {
      loadingBets = true;
      const allBets = await getMarketBets(Number($page.params.id));
      console.log("Loaded market bets:", allBets);
      marketBets = allBets;

      // Wait for next tick to ensure DOM is updated
      setTimeout(() => {
        createBetHistoryChart();
      }, 0);
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

      // Add window resize handler
      const handleResize = () => {
        if (chart) {
          createBetHistoryChart();
        }
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        if (chart) {
          chart.destroy();
        }
      };
    } catch (e) {
      error = "Failed to load market";
      console.error(e);
    } finally {
      loading = false;
    }
  });

  function openBetModal(outcomeIndex: number) {
    selectedOutcome = outcomeIndex;
    betAmount = 0;
    showBetModal = true;
  }

  function closeBetModal() {
    showBetModal = false;
    betAmount = 0;
    selectedOutcome = null;
    betError = null;
  }

  async function handleBet(amount: number) {
    // Implementation similar to main page
    closeBetModal();
    await loadMarketBets();
  }

  $: totalPool = Number(market?.total_pool || 0);
  $: outcomes = market?.outcomes || [];
  $: outcomePools = market?.outcome_pools?.map(Number) || [];
  $: betCounts = market?.bet_counts?.map(Number) || [];
  $: betCountPercentages = market?.bet_count_percentages || [];
  $: outcomePercentages = market?.outcome_percentages || [];
</script>

<div class="min-h-screen text-kong-text-primary px-4 py-8">
  <div class="max-w-6xl mx-auto">
    {#if error}
      <div class="text-center py-12">
        <p class="text-kong-accent-red text-lg">{error}</p>
      </div>
    {:else if loading}
      <div class="text-center py-12">
        <div
          class="animate-spin w-12 h-12 border-4 border-kong-accent-green rounded-full border-t-transparent mx-auto"
        />
      </div>
    {:else if market}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main market info -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Market header -->
          <Panel variant="transparent" type="main" className="!rounded">
            <div class="space-y-4">
              <h1 class="text-2xl font-bold">{market.question}</h1>

              <div class="flex items-center gap-6 text-kong-pm-text-secondary">
                <div class="flex items-center gap-2">
                  <Clock size={16} />
                  <span>{formatTimeLeft(market.end_time)}</span>
                </div>
                <div class="flex items-center gap-2">
                  <Users size={16} />
                  <span>{betCounts.reduce((a, b) => a + b, 0)} bets</span>
                </div>
                <div class="flex items-center gap-2">
                  <TrendingUp size={16} />
                  <span>{formatBalance(totalPool, 8)} KONG pool</span>
                </div>
              </div>
            </div>
          </Panel>

          <!-- Bet History Chart -->
          <Panel variant="transparent" type="main" className="!rounded">
            <h2 class="text-xl font-bold mb-4">Betting History</h2>
            <div class="h-[300px]">
              <canvas bind:this={chartCanvas}></canvas>
            </div>
          </Panel>

          <!-- Outcomes -->
          <Panel variant="transparent" type="main" className="!rounded">
            <h2 class="text-xl font-bold mb-4">Outcomes</h2>
            <div class="space-y-3">
              {#each outcomes as outcome, i}
                <div class="relative">
                  <div
                    class="absolute inset-0 rounded-lg"
                    style="width: {outcomePercentages[i]}%"
                  ></div>
                  <div
                    class="relative flex items-center justify-between p-4 hover:bg-kong-bg-dark/40 rounded-lg transition-colors"
                  >
                    <div class="flex-1">
                      <div class="font-medium">{outcome}</div>
                      <div
                        class="flex items-center gap-4 text-sm text-kong-pm-text-secondary"
                      >
                        <span>{outcomePercentages[i].toFixed(1)}% chance</span>
                        <div class="flex items-center gap-1">
                          <BarChart3 size={14} />
                          <span
                            >{betCountPercentages[i].toFixed(1)}% of bets ({betCounts[
                              i
                            ]} total)</span
                          >
                        </div>
                      </div>
                    </div>
                    <button
                      class="px-4 py-2 bg-kong-accent-green text-white rounded-lg font-medium hover:bg-kong-accent-green/90 transition-colors"
                      on:click={() => openBetModal(i)}
                    >
                      Bet
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </Panel>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Market stats -->
          <Panel
            variant="transparent"
            type="main"
            className="!rounded !max-h-[500px] overflow-y-scroll"
          >
            <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
              <History size={20} />
              Recent Bets
            </h2>
            <div class="space-y-3">
              {#each marketBets as bet}
                <div
                  class="flex items-center justify-between py-2 border-b border-kong-border/50 last:border-0"
                >
                  <div>
                    <div class="font-medium">
                      {outcomes[Number(bet.outcome_index)]}
                    </div>
                    <div class="text-sm text-kong-pm-text-secondary">
                      {new Date(
                        Number(bet.timestamp) / 1_000_000,
                      ).toLocaleString()}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="font-medium text-kong-accent-green">
                      {formatBalance(Number(bet.amount), 8)}
                    </div>
                    <div class="text-xs text-kong-pm-text-secondary">KONG</div>
                  </div>
                </div>
              {/each}
            </div>
          </Panel>
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
  bind:betAmount
  onClose={closeBetModal}
  onBet={handleBet}
  onOutcomeSelect={(index) => (selectedOutcome = index)}
/>

<style lang="postcss">
  /* Add any specific styles here */
</style>
