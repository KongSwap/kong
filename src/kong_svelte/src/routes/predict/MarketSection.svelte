<script lang="ts">
  import {
    formatCategory,
    calculatePercentage,
  } from "$lib/utils/numberFormatUtils";
  import { Coins, Plus, Calendar, ArrowUpRight } from "lucide-svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import CountdownTimer from "$lib/components/common/CountdownTimer.svelte";
  import { goto } from "$app/navigation";
  import AdminResolutionModal from "./AdminResolutionModal.svelte";
  import { auth } from "$lib/services/auth";
  import { get } from "svelte/store";
  import { isAdmin } from "$lib/api/predictionMarket";
  import { onMount } from "svelte";

  export let title: string;
  export let statusColor: string;
  export let markets: any[];
  export let isResolved: boolean = false;
  export let showEndTime: boolean = true;
  export let openBetModal: (market: any, outcomeIndex?: number) => void;
  export let onMarketResolved: () => Promise<void>;

  let showResolutionModal = false;
  let selectedMarket: any = null;
  let isUserAdmin = false;

  // Check if user is admin
  onMount(async () => {
    const authStore = get(auth);
    if (authStore.isConnected && authStore.account) {
      isUserAdmin = await isAdmin(authStore.account.owner);
    }
  });

  // Check if market is active (not expired and not resolved)
  function isMarketActive(market: any): boolean {
    if (!market) return false;
    if (market.status && "Closed" in market.status) return false;
    return BigInt(market.end_time) > BigInt(Date.now()) * BigInt(1_000_000);
  }

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
    selectedMarket = market;
    showResolutionModal = true;
  }

  async function handleResolved() {
    await onMarketResolved();
  }

  // Get status color based on market state
  function getMarketStatusColor(market: any): string {
    if (isMarketResolved(market)) return "bg-kong-accent-blue text-kong-text-on-primary";
    if (isMarketExpiredUnresolved(market)) return "bg-yellow-400 text-kong-text-on-primary";
    return "bg-kong-accent-green text-kong-text-on-primary";
  }

  // Get status text based on market state
  function getMarketStatusText(market: any): string {
    if (isMarketResolved(market)) return "Resolved";
    if (isMarketExpiredUnresolved(market)) return "Pending";
    return "Active";
  }

  // Get gradient class based on status color
  function getGradientClass(colorClass: string): string {
    switch (colorClass) {
      case "bg-kong-accent-green":
        return "from-kong-accent-green/80";
      case "bg-yellow-400":
        return "from-orange-400/80";
      case "bg-kong-accent-blue":
        return "from-kong-accent-blue/80";
      default:
        return "from-kong-accent-green/80";
    }
  }
</script>

<AdminResolutionModal
  isOpen={showResolutionModal}
  market={selectedMarket}
  on:close={() => (showResolutionModal = false)}
  on:resolved={handleResolved}
/>

<div class="mb-8">
  {#if markets.length === 0}
    <div class="text-center py-6 text-kong-text-secondary">
      No markets in this category
    </div>
  {:else}
    <div class="relative pb-3">
      <h2
        class="text-sm text-kong-text-primary items-center font-medium flex gap-2"
      >
        <div
          class="bg-gradient-to-l h-3 rounded-r-lg to-transparent px-3 py-0.5 w-[20px] {getGradientClass(
            statusColor,
          )}"
        ></div>
        {title}
      </h2>
    </div>

    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4"
    >
      {#each markets as market (market.id)}
        <Panel
          variant="solid"
          className="relative {isMarketResolved(market)
            ? 'opacity-100'
            : ''} group hover:bg-kong-bg-dark/10 transition-all duration-200 flex flex-col min-h-[200px] sm:min-h-[220px]"
        >
          <!-- Card content -->
          <div class="flex flex-col h-full">
            <!-- Status badge (moved to top right) -->
            <div class="absolute top-0 right-0 px-1.5 py-0.5 rounded-tr rounded-bl text-xs text-kong-bg-dark {getMarketStatusColor(market)}">
              {getMarketStatusText(market)}
            </div>
            
            <!-- Header section with title and category icon -->
            <div class="flex items-start mt-1">
              <!-- Category icon (small) -->
              <div class="flex-shrink-0 w-10 h-10 bg-kong-accent/10 mr-2 flex items-center justify-center">
                <!-- placeholder image -->
                 <img src="https://placehold.co/60x60" alt="Category Icon" class="w-10 h-10 object-cover">
              </div>
              
              <!-- Title -->
              <div class="w-full">
                <button
                  class="text-sm sm:text-base flex justify-between font-medium text-kong-text-primary text-left group-hover:text-kong-primary transition-colors relative w-full"
                  title={market.question}
                  on:click={() => {
                    goto(`/predict/${market.id}`);
                  }}
                >
                  <div class="flex flex-col w-full">
                    <span class="title-text block pb-1 max-h-[2.8em]">{market.question}</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Outcomes section -->
            <div class="flex-1 flex flex-col">
              <div class="mt-2 max-h-[80px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-kong-border">
                {#each market.outcomes as outcome, i}
                  <div
                    class="relative group/outcome rounded {!isMarketExpiredUnresolved(market) && !isMarketResolved(market)
                      ? 'hover:bg-kong-surface-light/40 cursor-pointer'
                      : ''}"
                  >
                    <button
                      class="h-8 sm:h-8 hover:bg-white/10 rounded px-2 py-4 transition-colors relative w-full {isMarketResolved(market) &&
                        isWinningOutcome(market, i)
                          ? 'border-2 border-kong-accent-green/30 bg-kong-accent-green/5 shadow-[0_0_5px_rgba(0,203,160,0.3)]'
                          : ''}"
                      on:click={() =>
                        !isMarketExpiredUnresolved(market) &&
                        !isMarketResolved(market) &&
                        openBetModal(market, i)}
                    >
                      <div
                        class="absolute bottom-0 left-0 h-1 bg-kong-accent-green/40 rounded transition-all"
                        style:width={`${calculatePercentage(
                          market.outcome_pools[i],
                          market.outcome_pools.reduce(
                            (acc, pool) => acc + Number(pool || 0),
                            0,
                          ),
                        ).toFixed(1)}%`}
                      ></div>
                      <div
                        class="relative flex justify-between items-center h-full gap-2"
                      >
                        <div class="flex items-center gap-2 min-w-0">
                          <span
                            class="font-medium text-kong-text-primary text-xs sm:text-sm truncate"
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
                  </div>
                {/each}
              </div>

              <!-- Push footer to bottom -->
              <div class="flex-1"></div>

              <!-- Category and time information moved to bottom -->
              <div class="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 mt-2 px-1">
                <span
                  class="py-0.5 px-1.5 text-kong-text-secondary bg-kong-accent/10 text-kong-accent rounded text-xs font-medium"
                >
                  {formatCategory(market.category)}
                </span>
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
              {#if isMarketExpiredUnresolved(market)}
                <div class="pt-2 border-t border-kong-border">
                  {#if isUserAdmin}
                    <button
                      class="w-full flex items-center justify-center py-1.5 sm:py-2 border shadow-sm border-kong-accent-green/50 hover:bg-kong-accent-green/10 text-kong-text-accent-green rounded font-medium transition-all text-xs sm:text-sm"
                      on:click={() => openResolutionModal(market)}
                    >
                      <Coins class="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5" />
                      Resolve Market
                    </button>
                  {:else}
                    <div class="text-center text-xs text-kong-text-secondary">
                      Awaiting resolution
                    </div>
                  {/if}
                </div>
              {:else if isMarketResolved(market)}
                <div class="pt-2 border-t border-kong-border">
                  <div class="text-center text-xs text-kong-text-secondary">
                    Resolved on {new Date(
                      Number(market.end_time) / 1_000_000,
                    ).toLocaleDateString()}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </Panel>
      {/each}

      <!-- Placeholder cards to fill out the row -->
      {#if markets.filter(m => isMarketActive(m)).length % 5 !== 0 && markets.filter(m => isMarketActive(m)).length > 0}
        {#each Array(5 - (markets.filter(m => isMarketActive(m)).length % 5)) as _}
          <div class="hidden 2xl:block">
            <Panel
              variant="solid"
              className="relative opacity-60 hover:opacity-100 border border-dashed border-kong-border/30 flex flex-col transition-all duration-200 hover:border-kong-accent-green/30"
            >
              <div class="flex-1 flex items-center justify-center py-8">
                <div class="text-center">
                  <div class="text-kong-text-secondary mb-2">
                    <Plus class="w-6 h-6 mx-auto mb-2 opacity-50" />
                    Want to create your own market?
                  </div>
                  <p class="text-xs text-kong-text-secondary/70">
                    Coming soon: Create and manage<br />your own prediction
                    markets
                  </p>
                </div>
              </div>

              <div class="mt-3 pt-2 border-t border-kong-border">
                <div
                  class="w-full py-2 text-center text-kong-text-secondary/50 text-xs"
                >
                  Stay tuned
                </div>
              </div>
            </Panel>
          </div>
        {/each}
      {/if}
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
