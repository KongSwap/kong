<script lang="ts">
  import { getUserHistory } from "$lib/api/predictionMarket";
  import { auth } from "$lib/stores/auth";
  import { goto } from "$app/navigation";
  import {
    TrendingUp,
    Wallet,
    Award,
    Activity,
    ArrowUpRight,
  } from "lucide-svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import Card from "$lib/components/common/Card.svelte";
  import PerformanceChart from "./PerformanceChart.svelte";
  import { fade } from "svelte/transition";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Alert from "$lib/components/common/Alert.svelte";

  let history = $state<any>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let tokenDetails = $state<Map<string, Kong.Token>>(new Map());

  // Pagination state
  let currentPage = $state(1);
  const itemsPerPage = 10; // Show 10 items per page

  // Load history when component mounts or auth changes
  $effect(() => {
    if ($auth.isConnected) {
      getHistory();
    }
  });

  async function getHistory() {
    try {
      loading = true;
      history = await getUserHistory($auth.account.owner);
      await loadTokenDetails();
    } catch (e) {
      console.error("Failed to load history:", e);
      error =
        e instanceof Error ? e.message : "Failed to load prediction history";
    } finally {
      loading = false;
    }
  }

  async function loadTokenDetails() {
    if (!history) return;

    // Get unique token IDs from all bets
    const tokenIds = new Set<string>();
    [...(history.active_bets || []), ...(history.resolved_bets || [])].forEach(
      (bet) => {
        if (bet.market?.token_id) {
          tokenIds.add(bet.market.token_id);
        }
      },
    );

    // Load token details for each unique token ID
    for (const tokenId of tokenIds) {
      try {
        const token = await userTokens.getTokenDetails(tokenId);
        if (token) {
          tokenDetails.set(tokenId, token);
        }
      } catch (e) {
        console.error(`Failed to load token details for ${tokenId}:`, e);
      }
    }

    // Trigger reactivity
    tokenDetails = tokenDetails;
  }

  // Combine and paginate bets
  const combinedBets = $derived(
    history
      ? [...(history.active_bets || []), ...(history.resolved_bets || [])]
      : []
  );
  const totalPages = $derived(Math.ceil(combinedBets.length / itemsPerPage));
  const paginatedBets = $derived(
    combinedBets.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    )
  );

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
    const outcomePool = Number(
      bet.market.outcome_pools[Number(bet.outcome_index)],
    );
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
    <!-- Alert at the top -->
    <div class="mb-6">
      <Alert
        type="warning"
        title="Warning"
        message="Data on this page may be inaccurate in some places. This is currently being worked on."
      />
    </div>

    <div class="mb-8">
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 class="text-2xl md:text-3xl font-bold mb-2">
            Prediction History
          </h1>
          <p class="text-kong-text-secondary">
            View your past predictions and outcomes
          </p>
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
      <Card>
        <div class="text-center py-8 text-kong-error">
          <p class="text-lg">{error}</p>
        </div>
      </Card>
    {:else if loading}
      <Card>
        <div class="text-center py-8">
          <div
            class="animate-spin w-8 h-8 border-4 border-kong-success rounded-full border-t-transparent mx-auto"
          ></div>
          <p class="mt-4 text-kong-text-secondary">
            Loading your prediction history...
          </p>
        </div>
      </Card>
    {:else if !history || (!history.active_bets.length && !history.resolved_bets.length)}
      <Card>
        <div class="text-center py-12">
          <div class="max-w-md mx-auto">
            <p class="text-lg mb-2">No predictions yet</p>
            <p class="text-sm text-kong-text-secondary">
              Start making predictions to see your prediction history here
            </p>
          </div>
        </div>
      </Card>
    {:else}
      <!-- Summary Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <Wallet class="w-5 h-5 text-kong-success" />
              <h3 class="text-sm text-kong-text-secondary">Current Balance</h3>
            </div>
            <p class="text-xl font-medium">
              {formatBalance(history.current_balance, 8, 2)} KONG
            </p>
          </div>
        </Card>
        <Card>
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <TrendingUp class="w-5 h-5 text-kong-accent-blue" />
              <h3 class="text-sm text-kong-text-secondary">Total Wagered</h3>
            </div>
            <p class="text-xl font-medium">
              {formatBalance(history.total_wagered, 8, 2)} KONG
            </p>
          </div>
        </Card>
        <Card>
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <Award class="w-5 h-5 text-kong-primary" />
              <h3 class="text-sm text-kong-text-secondary">Total Won</h3>
            </div>
            <p class="text-xl font-medium">
              {formatBalance(history.total_won, 8, 2)} KONG
            </p>
          </div>
        </Card>
        <Card>
          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <Activity class="w-5 h-5 text-yellow-400" />
              <h3 class="text-sm text-kong-text-secondary">
                Active Predictions
              </h3>
            </div>
            <p class="text-xl font-medium">{history.active_bets.length}</p>
          </div>
        </Card>
      </div>

      <!-- Performance Chart -->
      <div in:fade class="mb-8">
        <Card>
          <PerformanceChart {history} />
        </Card>
      </div>

      <!-- Combined Bets Table -->
      {#if history && (history.active_bets.length > 0 || (history.resolved_bets && history.resolved_bets.length > 0))}
        <div class="mb-8">
          <h2 class="text-xl font-bold mb-4">Prediction History</h2>
          <Card>
            <table class="w-full min-w-full">
              <thead>
                <tr class="border-b border-kong-bg-primary text-left">
                  <th class="p-4 text-kong-text-secondary font-medium"
                    >Market</th
                  >
                  <th class="p-4 text-kong-text-secondary font-medium"
                    >Outcome</th
                  >
                  <th class="p-4 text-kong-text-secondary font-medium"
                    >Status</th
                  >
                  <th
                    class="p-4 text-kong-text-secondary font-medium text-right"
                    >Wager</th
                  >
                  <th
                    class="p-4 text-kong-text-secondary font-medium text-right"
                    >Result</th
                  >
                </tr>
              </thead>
              <tbody>
                {#if paginatedBets.length > 0}
                  {#each paginatedBets as bet}
                    {@const statusInfo = getOutcomeStatus(bet)}
                    {@const token = tokenDetails.get(bet.market?.token_id)}
                    <tr
                      class="border-b border-kong-bg-primary hover:bg-kong-bg-primary/10 transition-colors"
                    >
                      <td class="px-4 py-2.5">
                        <button
                          class="text-sm sm:text-base line-clamp-2 font-medium text-kong-text-primary text-left hover:text-kong-primary transition-colors flex items-center gap-1 max-w-md"
                          title={bet.market.question}
                          onclick={() => goto(`/predict/${bet.market.id}`)}
                        >
                          <img
                            src={bet?.market?.image_url}
                            alt={token?.symbol}
                            class="w-8 h-8 rounded-kong-roundness mr-2 object-cover"
                          />
                          <span class="block">{bet.market.question}</span>
                          <ArrowUpRight
                            class="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0"
                          />
                        </button>
                      </td>
                      <td class="px-4 py-2.5">
                        <span
                          class="text-sm px-3 py-1 rounded-full bg-kong-bg-primary inline-block"
                        >
                          {bet.outcome_text}
                        </span>
                      </td>
                      <td class="px-4 py-2.5">
                        <span class="text-sm font-medium {statusInfo.color}">
                          {statusInfo.text}
                        </span>
                      </td>
                      <td class="text-right font-medium">
                        <div class="flex gap-2 items-center justify-end px-4">
                          <TokenImages tokens={[token]} size={18} />
                          <span class="text-sm font-medium">
                            {formatBalance(
                              bet.bet_amount,
                              token?.decimals || 8,
                              2,
                            )}
                          </span>
                        </div>
                      </td>
                      <td class="px-4 py-2.5 text-right font-medium">
                        {#if statusInfo.text === "Pending"}
                          <span class="text-sm text-kong-text-secondary block"
                            >Potential Win</span
                          >
                          <span class="text-kong-success"
                            >{formatBalance(
                              calculatePotentialWin(bet),
                              token?.decimals || 8,
                              2,
                            )}
                            {token?.symbol || "KONG"}</span
                          >
                        {:else if statusInfo.text === "Won"}
                          <span class="text-sm text-kong-text-secondary block"
                            >Winnings</span
                          >
                          {#if bet.winnings && bet.winnings.length > 0}
                            <span class="text-kong-success">
                              +{formatBalance(
                                bet.winnings[0],
                                token?.decimals || 8,
                                2,
                              )}
                              {token?.symbol || "KONG"}
                            </span>
                          {:else}
                            <span class="text-kong-text-secondary">-</span>
                          {/if}
                        {:else}
                          <span class="text-sm text-kong-text-secondary block"
                            >Result</span
                          >
                          <span class="text-kong-error"
                            >-{formatBalance(
                              bet.bet_amount,
                              token?.decimals || 8,
                              2,
                            )}
                            {token?.symbol || "KONG"}</span
                          >
                        {/if}
                      </td>
                    </tr>
                  {/each}
                {:else}
                  <tr>
                    <td
                      colspan="6"
                      class="p-4 text-center text-kong-text-secondary"
                      >No predictions found for this page.</td
                    >
                  </tr>
                {/if}
              </tbody>
            </table>
            <!-- Pagination Controls -->
            {#if totalPages > 1}
              <div
                class="flex justify-between items-center p-4 border-t border-kong-bg-primary"
              >
                <button
                  onclick={prevPage}
                  disabled={currentPage === 1}
                  class="px-4 py-2 text-sm font-medium rounded-md transition-colors {currentPage ===
                  1
                    ? 'bg-kong-bg-secondary text-kong-text-disabled cursor-not-allowed'
                    : 'bg-kong-secondary hover:bg-kong-secondary-hover text-kong-text-primary'}"
                >
                  Previous
                </button>
                <span class="text-sm text-kong-text-secondary">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onclick={nextPage}
                  disabled={currentPage === totalPages}
                  class="px-4 py-2 text-sm font-medium rounded-md transition-colors {currentPage ===
                  totalPages
                    ? 'bg-kong-bg-secondary text-kong-text-disabled cursor-not-allowed'
                    : 'bg-kong-secondary hover:bg-kong-secondary-hover text-kong-text-primary'}"
                >
                  Next
                </button>
              </div>
            {/if}
          </Card>
        </div>
      {/if}
    {/if}
  </div>
</div>
