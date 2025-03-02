<script lang="ts">
  import { onMount } from "svelte";
  import { getUserHistory } from "$lib/api/predictionMarket";
  import { auth } from "$lib/services/auth";
  import { goto } from "$app/navigation";
  import { ArrowLeft, TrendingUp, Wallet, Award, Activity, ArrowUpRight } from "lucide-svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import PerformanceChart from "./PerformanceChart.svelte";
  import { fade } from "svelte/transition";
  let history: any = null;
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      if ($auth.isConnected) {
        console.log("User is connected", $auth);
        history = await getUserHistory($auth.account.owner.toString());
        console.log("History", history);
      }
    } catch (e) {
      console.error("Failed to load history:", e);
      error = e instanceof Error ? e.message : "Failed to load betting history";
    } finally {
      loading = false;
    }
  });

  $: if ($auth.isConnected) {
    getHistory();
  }

  async function getHistory() {
    try {
      loading = true;
      history = await getUserHistory($auth.account.owner.toString());
      console.log("History", history);
    } catch (e) {
      console.error("Failed to load history:", e);
      error = e instanceof Error ? e.message : "Failed to load betting history";
    } finally {
      loading = false;
    }
  }

  function getOutcomeStatus(bet: any): { text: string; color: string } {
    if (!bet.market.status || !("Closed" in bet.market.status)) {
      return { text: "Pending", color: "text-yellow-400" };
    }

    const winningOutcomes = bet.market.status.Closed;
    const isWinner = winningOutcomes.includes(bet.outcome_index);

    return isWinner
      ? { text: "Won", color: "text-kong-accent-green" }
      : { text: "Lost", color: "text-kong-accent-red" };
  }

  function calculatePotentialWin(bet: any): number {
    const totalPool = Number(bet.market.total_pool);
    const outcomePool = Number(bet.market.outcome_pools[Number(bet.outcome_index)]);
    const betAmount = Number(bet.bet_amount);

    if (totalPool > 0 && outcomePool > 0) {
      // Calculate potential win based on current pool ratio
      const ratio = totalPool / outcomePool;
      return betAmount * ratio;
    }
    return 0;
  }
</script>

<div class="min-h-screen text-kong-text-primary px-4">
  <div class="max-w-6xl mx-auto">
    <button
      on:click={() => goto("/predict")}
      class="mb-4 flex items-center gap-2 px-3 py-2 text-kong-text-secondary hover:text-kong-text-primary transition-colors rounded-md hover:bg-kong-bg-dark/40"
    >
      <ArrowLeft class="w-4 h-4" />
      <span class="text-sm">Back to Markets</span>
    </button>

    <div class="mb-8">
      <h1 class="text-2xl md:text-3xl font-bold mb-2">Betting History</h1>
      <p class="text-kong-text-secondary">View your past predictions and outcomes</p>
    </div>

    {#if error}
      <Panel className="!rounded">
        <div class="text-center py-8 text-kong-accent-red">
          <p class="text-lg">{error}</p>
        </div>
      </Panel>
    {:else if loading}
      <Panel className="!rounded">
        <div class="text-center py-8">
          <div class="animate-spin w-8 h-8 border-4 border-kong-accent-green rounded-full border-t-transparent mx-auto" />
          <p class="mt-4 text-kong-text-secondary">Loading your betting history...</p>
        </div>
      </Panel>
    {:else if !history || (!history.active_bets.length && !history.resolved_bets.length)}
      <Panel className="!rounded">
        <div class="text-center py-12">
          <div class="max-w-md mx-auto">
            <p class="text-lg mb-2">No bets yet</p>
            <p class="text-sm text-kong-text-secondary">
              Start making predictions to see your betting history here
            </p>
          </div>
        </div>
      </Panel>
    {:else}
      <!-- Summary Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Panel className="!rounded">
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <Wallet class="w-5 h-5 text-kong-accent-green" />
              <h3 class="text-sm text-kong-text-secondary">Current Balance</h3>
            </div>
            <p class="text-xl font-medium">{formatBalance(history.current_balance, 8, 2)} KONG</p>
          </div>
        </Panel>
        <Panel className="!rounded">
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <TrendingUp class="w-5 h-5 text-kong-accent-blue" />
              <h3 class="text-sm text-kong-text-secondary">Total Wagered</h3>
            </div>
            <p class="text-xl font-medium">{formatBalance(history.total_wagered, 8, 2)} KONG</p>
          </div>
        </Panel>
        <Panel className="!rounded">
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <Award class="w-5 h-5 text-kong-accent-purple" />
              <h3 class="text-sm text-kong-text-secondary">Total Won</h3>
            </div>
            <p class="text-xl font-medium">{formatBalance(history.total_won, 8, 2)} KONG</p>
          </div>
        </Panel>
        <Panel className="!rounded">
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <Activity class="w-5 h-5 text-yellow-400" />
              <h3 class="text-sm text-kong-text-secondary">Active Bets</h3>
            </div>
            <p class="text-xl font-medium">{history.active_bets.length} ({formatBalance(history.active_bets.reduce((sum, bet) => sum + Number(bet.bet_amount), 0), 8, 2)} KONG)</p>
          </div>
        </Panel>
      </div>

      <!-- Performance Chart -->
      <div in:fade class="mb-8">
        <Panel variant="solid" className="!rounded">
            <PerformanceChart {history} />
        </Panel>
      </div>

      <!-- Active Bets -->
      {#if history.active_bets.length > 0}
        <div class="mb-8">
          <h2 class="text-xl font-bold mb-4">Active Bets</h2>
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#each history.active_bets as bet}
              <Panel className="!rounded group hover:bg-kong-bg-dark/10 transition-all duration-200 flex flex-col">
                <div class="">
                  <div class="flex flex-col gap-4">
                    <div>
                      <button
                        class="text-sm sm:text-base line-clamp-2 font-medium mb-2 text-kong-text-primary text-left group-hover:text-kong-text-accent-green transition-colors relative min-h-[2.5rem] sm:min-h-[3rem] w-full"
                        title={bet.market.question}
                        on:click={() => goto(`/predict/${bet.market.id}`)}
                      >
                        <span class="block pr-3">{bet.market.question}</span>
                        <ArrowUpRight
                          class="w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0"
                        />
                      </button>
                      <div class="flex flex-wrap gap-2 items-center">
                        <span class="text-sm px-3 py-1 rounded-full bg-kong-bg-dark">
                          {bet.outcome_text}
                        </span>
                        <span class="text-sm font-medium text-yellow-400">
                          Pending
                        </span>
                      </div>
                    </div>
                    <div class="flex justify-between items-end pt-2 border-t border-kong-bg-dark">
                      <div class="text-sm text-kong-text-secondary">
                        Bet Amount
                        <div class="text-base font-medium text-kong-text-primary">
                          {formatBalance(bet.bet_amount, 8, 2)} KONG
                        </div>
                      </div>
                      <div class="text-sm text-kong-text-secondary text-right">
                        Potential Win
                        <div class="text-base font-medium text-kong-accent-green">
                          {formatBalance(calculatePotentialWin(bet), 8, 2)} KONG
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Resolved Bets -->
      {#if history.resolved_bets && history.resolved_bets.length > 0}
        <div>
          <h2 class="text-xl font-bold mb-4">Resolved Bets</h2>
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#each history.resolved_bets as bet}
              <Panel className="!rounded group hover:bg-kong-bg-dark/10 transition-all duration-200 flex flex-col">
                <div class="p-4">
                  <div class="flex flex-col gap-4">
                    <div>
                      <button
                        class="text-sm sm:text-base line-clamp-2 font-medium mb-2 text-kong-text-primary text-left group-hover:text-kong-text-accent-green transition-colors relative min-h-[2.5rem] sm:min-h-[3rem] w-full"
                        title={bet.market.question}
                        on:click={() => goto(`/predict/${bet.market.id}`)}
                      >
                        <span class="block pr-3">{bet.market.question}</span>
                        <ArrowUpRight
                          class="w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0"
                        />
                      </button>
                      <div class="flex flex-wrap gap-2 items-center">
                        <span class="text-sm px-3 py-1 rounded-full bg-kong-bg-dark">
                          {bet.outcome_text}
                        </span>
                        <span class="text-sm font-medium {getOutcomeStatus(bet).color}">
                          {getOutcomeStatus(bet).text}
                        </span>
                      </div>
                    </div>
                    <div class="flex justify-between items-end pt-2 border-t border-kong-bg-dark">
                      <div class="text-sm text-kong-text-secondary">
                        Bet Amount
                        <div class="text-base font-medium text-kong-text-primary">
                          {formatBalance(bet.bet_amount, 8, 2)} KONG
                        </div>
                      </div>
                      {#if bet.winnings && bet.winnings.length > 0}
                        <div class="text-sm text-kong-text-secondary text-right">
                          Won
                          <div class="text-base font-medium text-kong-accent-green">
                            {formatBalance(bet.winnings[0], 8, 2)} KONG
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              </Panel>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* Add any custom styles here if needed */
</style>
