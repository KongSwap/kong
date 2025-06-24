<script lang="ts">
  import {
    formatCategory,
    calculatePercentage,
    formatBalance,
  } from "$lib/utils/numberFormatUtils";
  import { Coins, Calendar, CircleHelp, Folder } from "lucide-svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import CountdownTimer from "$lib/components/common/CountdownTimer.svelte";
  import { goto } from "$app/navigation";
  import AdminResolutionModal from "./AdminResolutionModal.svelte";
  import { auth } from "$lib/stores/auth";
  import { isAdmin } from "$lib/api/predictionMarket";
  import { voidMarketViaAdmin } from "$lib/api/predictionMarket";

  // Convert props to use $props
  let { 
    markets,
    showEndTime = true,
    openBetModal,
    onMarketResolved 
  } = $props<{
    markets: any[];
    showEndTime?: boolean;
    openBetModal: (market: any, outcomeIndex?: number) => void;
    onMarketResolved: () => Promise<void>;
  }>();

  // Convert local state to use $state
  let showResolutionModal = $state(false);
  let selectedMarket = $state<any>(null);
  let isUserAdmin = $state(false);

  // Check if user is admin using $effect (replacing onMount)
  $effect(() => {
    if ($auth.isConnected && $auth.account) {
      isAdmin($auth.account.owner).then(result => {
        isUserAdmin = result;
      });
    }
  });

  // Check if market is expired but not resolved
  function isMarketExpiredUnresolved(market: any): boolean {
    if (!market) return false;
    if (market.status && "Closed" in market.status) return false;
    return BigInt(market.end_time) <= BigInt(Date.now()) * BigInt(1_000_000);
  }

  // Check if market is resolved
  function isMarketResolved(market: any): boolean {
    return market && market.status && "Closed" in market.status;
  }

  // Check if market needs admin action (open or expired)
  function showResolveVoid(market: any): boolean {
    if (!market || !market.status) return false;
    // Show admin controls for open markets or expired markets that haven't been resolved
    return "Open" in market.status || isMarketExpiredUnresolved(market);
  }

  // Check if market is voided
  function isMarketVoided(market: any): boolean {
    return market && market.status && "Voided" in market.status;
  }

  // Helper function to check if an outcome is a winner
  function isWinningOutcome(market: any, outcomeIndex: number): boolean {
    try {
      // Case 1: Direct winning_outcomes array at the top level (MarketResult format)
      if (market.winning_outcomes) {
        return market.winning_outcomes.some(
          (winningIndex: any) => Number(winningIndex) === outcomeIndex,
        );
      }

      // Case 2: Market within MarketResult
      if (market.market) {
        // Case 2.1: If market has status with Closed variant containing winner array
        if (market.market.status && typeof market.market.status === "object") {
          const status = market.market.status;

          if ("Closed" in status && Array.isArray(status.Closed)) {
            return status.Closed.some(
              (winningIndex: any) => Number(winningIndex) === outcomeIndex,
            );
          }
        }

        // Case 2.2: If market has winning_outcomes property
        if (market.market.winning_outcomes) {
          return market.market.winning_outcomes.some(
            (winningIndex: any) => Number(winningIndex) === outcomeIndex,
          );
        }
      }

      // Case 3: Status directly on the market object
      if (market.status && typeof market.status === "object") {
        if ("Closed" in market.status && Array.isArray(market.status.Closed)) {
          return market.status.Closed.some(
            (winningIndex: any) => Number(winningIndex) === outcomeIndex,
          );
        }
      }

      // Log error for debugging if none of the expected formats are found
      if (outcomeIndex === 0) {
        console.warn(
          "Could not determine winning outcome. Market structure:",
          market,
        );
      }

      return false;
    } catch (error) {
      console.error("Error in isWinningOutcome:", error, market);
      return false;
    }
  }

  function openResolutionModal(market: any) {
    // Reset state first
    showResolutionModal = false;
    selectedMarket = null;
    
    // Then set new state after a brief delay
    setTimeout(() => {
      selectedMarket = market;
      showResolutionModal = true;
    }, 50);
  }

  async function handleResolved() {
    await onMarketResolved();
  }

  async function handleVoidMarket(market: any) {
    if (!confirm(`Are you sure you want to void the market "${market.question}"?`)) {
      return;
    }
    
    try {
      await voidMarketViaAdmin(BigInt(market.id));
      await onMarketResolved();
    } catch (error) {
      console.error("Failed to void market:", error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get status color based on market state
  function getMarketStatusColor(market: any): string {
    if (isMarketResolved(market)) return "bg-kong-accent-blue";
    if (isMarketVoided(market)) return "bg-kong-text-accent-red";
    if (isMarketExpiredUnresolved(market)) return "bg-yellow-400";
    return "bg-kong-accent-green";
  }

  // Get status text based on market state
  function getMarketStatusText(market: any): string {
    if (isMarketResolved(market)) return "Resolved";
    if (isMarketVoided(market)) return "Voided";
    if (isMarketExpiredUnresolved(market)) return "Pending";
    return "Active";
  }

  // Check if it's a Yes/No market
  function isYesNoMarket(market: any): boolean {
    return market.outcomes.length === 2 && 
           (market.outcomes[0].toLowerCase() === "yes" || market.outcomes[0].toLowerCase() === "no") && 
           (market.outcomes[1].toLowerCase() === "yes" || market.outcomes[1].toLowerCase() === "no");
  }

  // Get the index of Yes and No outcomes
  function getYesNoIndices(market: any): {yesIndex: number, noIndex: number} {
    const yesIndex = market.outcomes.findIndex((outcome: string) => outcome.toLowerCase() === "yes");
    const noIndex = market.outcomes.findIndex((outcome: string) => outcome.toLowerCase() === "no");
    return { yesIndex, noIndex };
  }
</script>

<AdminResolutionModal
  isOpen={showResolutionModal}
  market={selectedMarket}
  onClose={() => {
    showResolutionModal = false;
    selectedMarket = null;
  }}
  onResolved={handleResolved}
/>

<div class="mb-8">
  {#if markets.length === 0}
    <div class="text-center py-6 text-kong-text-secondary">
      No markets in this category
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {#each markets as market, index (`${market.id}-${index}`)}
        <Panel
          className="relative {isMarketResolved(market)
            ? 'opacity-100'
            : ''} group hover:bg-kong-bg-dark/10 transition-all duration-200 flex flex-col !min-h-[270px]"
        >
          <!-- Card content -->
          <div class="flex flex-col h-full">
            <!-- Status badge (moved to top right) -->
            <div
              class="absolute top-0 right-0 px-1.5 py-0.5 rounded-tr rounded-bl text-xs text-kong-bg-light {getMarketStatusColor(
                market,
              )}"
            >
              {getMarketStatusText(market)}
            </div>

            <!-- Header section with title and category icon -->
            <div class="flex items-start mt-1">
              <!-- Category icon (small) -->
              <div
                class="flex-shrink-0 w-10 h-10 bg-kong-accent/10 mr-2 flex items-center justify-center"
              >
                <!-- placeholder image -->
                {#if market.image_url.length != 0}
                  <img
                    src={market.image_url}
                    alt="Category Icon"
                    class="w-10 h-10 object-cover"
                  />
                {:else}
                  <div
                    class="w-10 h-10 bg-kong-accent/10 rounded-full bg-kong-bg-dark flex items-center justify-center"
                  >
                    <CircleHelp class="w-10 h-10 text-kong-bg-light/80" />
                  </div>
                {/if}
              </div>

              <!-- Title -->
              <div class="w-full">
                <button
                  class="text-sm sm:text-base flex justify-between font-medium text-kong-text-primary text-left group-hover:text-kong-primary transition-colors relative w-full"
                  title={market.question}
                  onclick={() => {
                    goto(`/predict/${market.id}`);
                  }}
                >
                  <div class="flex flex-col w-full">
                    <span class="title-text block pb-1"
                      >{market.question}</span
                    >
                  </div>
                </button>
              </div>
            </div>

            <!-- Outcomes section -->
            <div class="flex-1 flex flex-col">
              {#if isYesNoMarket(market)}
                <!-- Yes/No buttons side by side -->
                <div class="h-full items-center flex gap-2">
                  {#if getYesNoIndices(market).yesIndex !== -1}
                    {@const yesIndex = getYesNoIndices(market).yesIndex}
                    <button
                      class="flex-1 h-10 rounded transition-colors relative bg-kong-accent-green/20 hover:bg-kong-accent-green/30 text-kong-text-primary border border-kong-accent-green/30 {isMarketResolved(
                        market,
                      ) && isWinningOutcome(market, yesIndex)
                        ? 'border-2 border-kong-accent-green shadow-[0_0_5px_rgba(0,203,160,0.3)]'
                        : ''}"
                      onclick={() =>
                        !isMarketExpiredUnresolved(market) &&
                        !isMarketResolved(market) &&
                        openBetModal(market, yesIndex)}
                    >
                      <div
                        class="relative flex justify-between items-center h-full px-3"
                      >
                        <span class="font-medium text-sm">Yes</span>
                        <span
                          class="text-kong-accent font-bold text-xs whitespace-nowrap"
                        >
                          {calculatePercentage(
                            market.outcome_pools[yesIndex],
                            market.outcome_pools.reduce(
                              (acc, pool) => acc + Number(pool || 0),
                              0,
                            ),
                          ).toFixed(1)}%
                        </span>
                      </div>
                    </button>
                  {/if}

                  {#if getYesNoIndices(market).noIndex !== -1}
                    {@const noIndex = getYesNoIndices(market).noIndex}
                    <button
                      class="flex-1 h-10 rounded transition-colors relative bg-kong-accent-red/20 hover:bg-kong-accent-red/30 text-kong-text-primary border border-kong-accent-red/30 {isMarketResolved(
                        market,
                      ) && isWinningOutcome(market, noIndex)
                        ? 'border-2 border-kong-accent-red shadow-[0_0_5px_rgba(203,0,0,0.3)]'
                        : ''}"
                      onclick={() =>
                        !isMarketExpiredUnresolved(market) &&
                        !isMarketResolved(market) &&
                        openBetModal(market, noIndex)}
                    >
                      <div
                        class="relative flex justify-between items-center h-full px-3"
                      >
                        <span class="font-medium text-sm">No</span>
                        <span
                          class="text-kong-accent font-bold text-xs whitespace-nowrap"
                        >
                          {calculatePercentage(
                            market.outcome_pools[noIndex],
                            market.outcome_pools.reduce(
                              (acc, pool) => acc + Number(pool || 0),
                              0,
                            ),
                          ).toFixed(1)}%
                        </span>
                      </div>
                    </button>
                  {/if}
                </div>
              {:else}
                <div
                  class="max-h-[150px] flex flex-col gap-2 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-kong-border"
                >
                  {#each market.outcomes as outcome, i}
                    <div
                      class="relative group/outcome rounded {!isMarketExpiredUnresolved(
                        market,
                      ) && !isMarketResolved(market)
                        ? 'hover:bg-kong-surface-light/40 cursor-pointer'
                        : ''}"
                    >
                      <button
                        class="h-8 sm:h-8 hover:bg-white/10 rounded-t px-2 py-5 transition-colors relative w-full {isMarketResolved(
                          market,
                        ) && isWinningOutcome(market, i)
                          ? 'border-2 border-kong-accent-green/30 bg-kong-accent-green/5 shadow-[0_0_5px_rgba(0,203,160,0.3)]'
                          : ''}"
                        onclick={() =>
                          !isMarketExpiredUnresolved(market) &&
                          !isMarketResolved(market) &&
                          openBetModal(market, i)}
                      >
                        <div
                          class="relative flex justify-between items-center h-full gap-2"
                        >
                          <div class="flex items-center gap-2 min-w-0">
                            <span
                              class="font-medium text-kong-text-primary text-sm truncate"
                              >{outcome}</span
                            >
                            {#if isMarketResolved(market) && isWinningOutcome(market, i)}
                              <span
                                class="text-xs font-medium bg-kong-accent-green/20 text-kong-text-accent-green px-2 py-0.5 rounded-full whitespace-nowrap flex items-center"
                              >
                                <svg
                                  class="w-3 h-3 mr-1"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Winner
                              </span>
                            {/if}
                          </div>
                          <div
                            class="text-right flex items-center gap-1 sm:gap-2 flex-shrink-0"
                          >
                            <div
                              class="text-kong-accent font-bold text-xs sm:text-sm whitespace-nowrap"
                            >
                              {calculatePercentage(
                                market.outcome_pools[i],
                                market.outcome_pools.reduce(
                                  (acc, pool) => acc + Number(pool || 0),
                                  0,
                                ),
                              ).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </button>
                      <div
                        class="flex items-center justify-between rounded-b bg-kong-bg-light"
                      >
                        <div
                          class=" h-1 bg-kong-accent-green/50 rounded-b transition-all"
                          style:width={`${calculatePercentage(
                            market.outcome_pools[i],
                            market.outcome_pools.reduce(
                              (acc, pool) => acc + Number(pool || 0),
                              0,
                            ),
                          ).toFixed(1)}%`}
                        ></div>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Push footer to bottom -->
              <div class="flex-1"></div>

              <!-- Category and time information moved to bottom -->
              <div
                class="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 mt-2 px-1"
              >
                <div class="flex items-center gap-1">
                  <span
                    class="text-kong-text-secondary text-xs whitespace-nowrap flex items-center gap-1"
                  >
                    <Coins class="w-3 h-3" />
                    {formatBalance(
                      market.outcome_pools.reduce(
                        (acc, pool) => acc + Number(pool || 0),
                        0,
                      ),
                      8,
                    )} KONG
                  </span>
                  <span
                    class="py-0.5 px-1.5 flex items-center gap-1 text-kong-text-secondary bg-kong-accent/10 text-kong-accent rounded text-xs font-medium"
                  >
                    <Folder class="w-3 h-3" />
                    {formatCategory(market.category)}
                  </span>
                </div>
                {#if showEndTime}
                  <span
                    class="flex items-center gap-1 text-kong-text-secondary text-xs whitespace-nowrap"
                  >
                    <Calendar class="w-3 h-3" />
                    <CountdownTimer endTime={market.end_time} />
                  </span>
                {/if}
              </div>

              <!-- Card Footer -->
              {#if showResolveVoid(market)}
                <div class="pt-2 mt-2 border-t border-kong-border">
                  {#if isUserAdmin}
                    <div class="flex gap-2">
                      <button
                        class="flex-1 flex items-center justify-center px-3 py-2 bg-kong-accent-green/10 border border-kong-accent-green/30 text-kong-text-accent-green rounded-md font-medium transition-all duration-200 text-sm hover:bg-kong-accent-green/20 hover:border-kong-accent-green/60 hover:shadow-[0_0_8px_rgba(0,203,160,0.2)] active:translate-y-0.5"
                        onclick={() => openResolutionModal(market)}
                      >
                        <Coins class="w-3.5 h-3.5 mr-1.5" />
                        Resolve
                      </button>
                      <button
                        class="flex-1 flex items-center justify-center px-3 py-2 bg-kong-accent-red/10 border border-kong-accent-red/30 text-kong-text-accent-red rounded-md font-medium transition-all duration-200 text-sm hover:bg-kong-accent-red/20 hover:border-kong-accent-red/60 hover:shadow-[0_0_8px_rgba(255,59,59,0.2)] active:translate-y-0.5"
                        onclick={() => handleVoidMarket(market)}
                      >
                        <svg class="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M18 6 6 18"></path>
                          <path d="m6 6 12 12"></path>
                        </svg>
                        Void
                      </button>
                    </div>
                  {:else}
                    <div class="text-center text-xs text-kong-text-secondary">
                      Awaiting resolution
                    </div>
                  {/if}
                </div>
              {:else if isMarketResolved(market)}
                <div class="pt-2 mt-2 border-t border-kong-border">
                  <div class="text-center text-xs text-kong-text-secondary">
                    Resolved on {new Date(
                      Number(market.end_time) / 1_000_000,
                    ).toLocaleDateString()}
                  </div>
                </div>
              {:else if isMarketVoided(market)}
                <div class="pt-2 mt-2 border-t border-kong-border">
                  <div class="text-center text-xs text-kong-text-secondary">
                    Market voided on {new Date(
                      Number(market.end_time) / 1_000_000,
                    ).toLocaleDateString()}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </Panel>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Smooth hover transitions */
  .group\/outcome:hover :global(.bg-kong-accent-green\/40) {
    @apply bg-kong-accent-green/60;
  }

  /* Custom scrollbar styling */
  .scrollbar-thin {
    scrollbar-width: thin;
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }

  .scrollbar-track-transparent::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thumb-kong-border::-webkit-scrollbar-thumb {
    background-color: var(--kong-border, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
  }

  .scrollbar-thumb-kong-border::-webkit-scrollbar-thumb:hover {
    background-color: var(--kong-border, rgba(255, 255, 255, 0.2));
  }

  /* Title text clamp to 2 lines */
  .title-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
