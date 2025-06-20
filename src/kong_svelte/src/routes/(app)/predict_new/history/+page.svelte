<script lang="ts">
  import { onMount } from "svelte";
  import { getUserHistory } from "$lib/api/predictionMarket";
  import { auth } from "$lib/stores/auth";
  import { goto } from "$app/navigation";
  import { ArrowLeft, TrendingUp, Wallet, Award, Activity, ArrowUpRight } from "lucide-svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import PerformanceChart from "./PerformanceChart.svelte";
  import { fade } from "svelte/transition";
  import { notificationsStore } from "$lib/stores/notificationsStore";
    import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  let history: any = null;
  let loading = true;
  let error: string | null = null;

  // Pagination state
  let currentPage = 1;
  const itemsPerPage = 10; // Show 10 items per page

  onMount(async () => {
    try {
      if ($auth.isConnected) {
        history = await getUserHistory($auth.account.owner);
      }
    } catch (e) {
      console.error("Failed to load data:", e);
      error = e instanceof Error ? e.message : "Failed to load prediction history";
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
      history = await getUserHistory($auth.account.owner);
    } catch (e) {
      console.error("Failed to load history:", e);
      error = e instanceof Error ? e.message : "Failed to load prediction history";
    } finally {
      loading = false;
    }
  }





  // Combine and paginate bets
  $: combinedBets = history ? [...(history.active_bets || []), ...(history.resolved_bets || [])] : [];
  $: totalPages = Math.ceil(combinedBets.length / itemsPerPage);
  $: paginatedBets = combinedBets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function nextPage() {
    if (currentPage < totalPages) {
      currentPage++;
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
    }
  }

  function getOutcomeStatus(bet: any): { text: string; color: string } {
    if (!bet.market.status || !("Closed" in bet.market.status)) {
      return { text: "Pending", color: "text-yellow-400" };
    }

    const winningOutcomes = bet.market.status.Closed;
    const isWinner = winningOutcomes.includes(bet.outcome_index);

    return isWinner
      ? { text: "Won", color: "text-kong-success" }
      : { text: "Lost", color: "text-kong-error" };
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

<svelte:head>
  <title>Prediction History - KongSwap</title>
  <meta name="description" content="View your past predictions and outcomes" />
</svelte:head>

<div class="min-h-screen text-kong-text-primary px-4">
  <div class="max-w-6xl mx-auto">
    <button
      onclick={() => goto("/predict")}
      class="mb-4 flex items-center gap-2 px-3 py-2 text-kong-text-secondary hover:text-kong-text-primary transition-colors rounded-md hover:bg-kong-bg-primary/40"
    >
      <ArrowLeft class="w-4 h-4" />
      <span class="text-sm">Back to Markets</span>
    </button>

    <div class="mb-8">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold mb-2">Prediction History</h1>
          <p class="text-kong-text-secondary">View your past predictions and outcomes</p>
        </div>
        <ButtonV2
          onclick={() => goto("/predict/claims")}
          theme="primary"
          size="lg"
          className="text-white font-medium rounded-lg transition-colors flex items-center gap-2 sm:self-start"
        >
          <div class="flex items-center gap-2">
            <Award class="w-4 h-4" />
            <span>Claim Rewards</span>
          </div>
        </ButtonV2>
      </div>
    </div>

    {#if error}
      <Panel className="!rounded">
        <div class="text-center py-8 text-kong-error">
          <p class="text-lg">{error}</p>
        </div>
      </Panel>
    {:else if loading}
      <Panel className="!rounded">
        <div class="text-center py-8">
          <div class="animate-spin w-8 h-8 border-4 border-kong-success rounded-full border-t-transparent mx-auto" />
          <p class="mt-4 text-kong-text-secondary">Loading your prediction history...</p>
        </div>
      </Panel>
    {:else if !history || (!history.active_bets.length && !history.resolved_bets.length)}
      <Panel className="!rounded">
        <div class="text-center py-12">
          <div class="max-w-md mx-auto">
            <p class="text-lg mb-2">No predictions yet</p>
            <p class="text-sm text-kong-text-secondary">
              Start making predictions to see your prediction history here
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
              <Wallet class="w-5 h-5 text-kong-success" />
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
              <Award class="w-5 h-5 text-kong-primary" />
              <h3 class="text-sm text-kong-text-secondary">Total Won</h3>
            </div>
            <p class="text-xl font-medium">{formatBalance(history.total_won, 8, 2)} KONG</p>
          </div>
        </Panel>
        <Panel className="!rounded">
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <Activity class="w-5 h-5 text-yellow-400" />
              <h3 class="text-sm text-kong-text-secondary">Active Predictions</h3>
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



      <!-- Combined Bets Table -->
      {#if (history && (history.active_bets.length > 0 || (history.resolved_bets && history.resolved_bets.length > 0)))}
        <div class="mb-8">
          <h2 class="text-xl font-bold mb-4">Prediction History</h2>
          <Panel className="!rounded overflow-x-auto">
            <table class="w-full min-w-full">
              <thead>
                <tr class="border-b border-kong-bg-primary text-left">
                  <th class="p-4 text-kong-text-secondary font-medium">Market</th>
                  <th class="p-4 text-kong-text-secondary font-medium">Outcome</th>
                  <th class="p-4 text-kong-text-secondary font-medium">Status</th>
                  <th class="p-4 text-kong-text-secondary font-medium text-right">Amount</th>
                  <th class="p-4 text-kong-text-secondary font-medium text-right">Result</th>
                </tr>
              </thead>
              <tbody>
                {#if paginatedBets.length > 0}
                  {#each paginatedBets as bet}
                    {@const statusInfo = getOutcomeStatus(bet)}
                    <tr class="border-b border-kong-bg-primary hover:bg-kong-bg-primary/10 transition-colors">
                      <td class="p-4">
                        <button
                          class="text-sm sm:text-base line-clamp-2 font-medium text-kong-text-primary text-left hover:text-kong-success transition-colors flex items-center gap-1 max-w-md"
                          title={bet.market.question}
                          onclick={() => goto(`/predict/${bet.market.id}`)}
                        >
                          <span class="block">{bet.market.question}</span>
                          <ArrowUpRight class="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                        </button>
                      </td>
                      <td class="p-4">
                        <span class="text-sm px-3 py-1 rounded-full bg-kong-bg-primary inline-block">
                          {bet.outcome_text}
                        </span>
                      </td>
                      <td class="p-4">
                        <span class="text-sm font-medium {statusInfo.color}">
                          {statusInfo.text}
                        </span>
                      </td>
                      <td class="p-4 text-right font-medium">
                        {formatBalance(bet.bet_amount, 8, 2)} KONG
                      </td>
                      <td class="p-4 text-right font-medium">
                        {#if statusInfo.text === 'Pending'}
                            <span class="text-sm text-kong-text-secondary block">Potential Win</span>
                            <span class="text-kong-success">{formatBalance(calculatePotentialWin(bet), 8, 2)} KONG</span>
                        {:else if statusInfo.text === 'Won'}
                            <span class="text-sm text-kong-text-secondary block">Winnings</span>
                            {#if bet.winnings && bet.winnings.length > 0}
                                <span class="text-kong-success">
                                    +{formatBalance(bet.winnings[0], 8, 2)} KONG
                                </span>
                            {:else}
                                <span class="text-kong-text-secondary">-</span>
                            {/if}
                        {:else}
                            <span class="text-sm text-kong-text-secondary block">Result</span>
                            <span class="text-kong-error">-{formatBalance(bet.bet_amount, 8, 2)} KONG</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                {:else}
                  <tr>
                    <td colspan="5" class="p-4 text-center text-kong-text-secondary">No predictions found for this page.</td>
                  </tr>
                {/if}
              </tbody>
            </table>
            <!-- Pagination Controls -->
            {#if totalPages > 1}
            <div class="flex justify-between items-center p-4 border-t border-kong-bg-primary">
              <button
                onclick={prevPage}
                disabled={currentPage === 1}
                class="px-4 py-2 text-sm font-medium rounded-md transition-colors {currentPage === 1 ? 'bg-kong-bg-secondary text-kong-text-disabled cursor-not-allowed' : 'bg-kong-secondary hover:bg-kong-secondary-hover text-kong-text-primary'}"
              >
                Previous
              </button>
              <span class="text-sm text-kong-text-secondary">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onclick={nextPage}
                disabled={currentPage === totalPages}
                class="px-4 py-2 text-sm font-medium rounded-md transition-colors {currentPage === totalPages ? 'bg-kong-bg-secondary text-kong-text-disabled cursor-not-allowed' : 'bg-kong-secondary hover:bg-kong-secondary-hover text-kong-text-primary'}"
              >
                Next
              </button>
            </div>
            {/if}
          </Panel>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* Add any custom styles here if needed */
</style>
