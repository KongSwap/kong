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
  import AdminResolutionModal from "$lib/components/predict/AdminResolutionModal.svelte";
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

  function openResolutionModal(market: any) {
    selectedMarket = market;
    showResolutionModal = true;
  }

  async function handleResolved() {
    await onMarketResolved();
  }

  // Get gradient class based on status color
  function getGradientClass(colorClass: string): string {
    switch (colorClass) {
      case "bg-kong-accent-green":
        return "from-kong-accent-green/80";
      case "bg-yellow-400":
        return "from-orange-400/80";
      default:
        return "from-kong-accent-green/80";
    }
  }

  function getBgClass(colorClass: string): string {
    switch (colorClass) {
      case "bg-yellow-400":
        return "opacity-50 hover:opacity-100";
      default:
        return "";
    }
  }
</script>

<AdminResolutionModal
  isOpen={showResolutionModal}
  market={selectedMarket}
  on:close={() => showResolutionModal = false}
  on:resolved={handleResolved}
/>

<div class="mb-8">
  {#if markets.length === 0}
    <div class="text-center py-6 text-kong-pm-text-secondary">
      No markets in this category
    </div>
  {:else}
    <div class="relative pb-3">
      <h2
        class="text-sm uppercase text-kong-text-primary items-center font-medium flex gap-2"
      >
        <div
          class="bg-gradient-to-l h-3 rounded-r-lg to-transparent px-3 py-0.5 w-[20px] {getGradientClass(
            statusColor,
          )}"
        ></div>
        {title}
      </h2>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
      {#each markets as market (market.id)}
        <Panel
          variant="transparent"
          className="relative {getBgClass(statusColor)} {isResolved
            ? 'opacity-70 hover:opacity-100'
            : ''} group hover:bg-kong-bg-dark/10 transition-all duration-200 flex flex-col min-h-[200px] sm:min-h-[220px]"
        >
          {#if isResolved}
            <div class="absolute top-2 right-2">
              <span
                class="px-2 py-0.5 bg-kong-accent-green/20 text-kong-text-accent-green text-xs rounded-full"
              >
                Resolved
              </span>
            </div>
          {/if}

          <!-- Header section -->
          <div class="flex-initial">
            <div class="flex justify-between items-start mb-2 sm:mb-3">
              <div class="flex-1">
                <button
                  class="text-sm sm:text-base line-clamp-2 font-medium mb-1 sm:mb-1.5 text-kong-text-primary text-left group-hover:text-kong-text-accent-green transition-colors relative min-h-[2.5rem] sm:min-h-[3rem] w-full"
                  title={market.question}
                  on:click={() => {
                    goto(`/predict/${market.id}`);
                  }}
                >
                  <span class="block pr-3">{market.question}</span>
                  <ArrowUpRight
                    class="w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0"
                  />
                </button>
                <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 text-sm">
                  <span
                    class="px-1.5 py-0.5 bg-kong-pm-accent/10 text-kong-pm-accent rounded text-xs font-medium"
                  >
                    {formatCategory(market.category)}
                  </span>
                  {#if showEndTime}
                    <span
                      class="flex items-center gap-1 text-kong-pm-text-secondary text-xs whitespace-nowrap"
                    >
                      <Calendar class="w-3 h-3" />
                      <CountdownTimer endTime={market.end_time} />
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          </div>

          <!-- Outcomes section -->
          <div class="flex-1 flex flex-col">
            <div class="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
              {#each market.outcomes as outcome, i}
                <div class="relative group/outcome rounded {title !==
                      'Pending Resolution' && !isResolved
                      ? 'hover:bg-kong-surface-light/40 cursor-pointer'
                      : ''}">
                  <button
                    class="h-8 sm:h-10 hover:bg-white/10 rounded p-1.5 transition-colors relative w-full"
                    on:click={() =>
                      title !== "Pending Resolution" &&
                      !isResolved &&
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
                        <span class="font-medium text-kong-text-primary text-xs sm:text-sm truncate"
                          >{outcome}</span
                        >
                      </div>
                      <div class="text-right flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <div class="text-kong-pm-accent font-bold text-xs sm:text-sm whitespace-nowrap">
                          {calculatePercentage(
                            market.outcome_pools[i],
                            market.outcome_pools.reduce(
                              (acc, pool) => acc + Number(pool || 0),
                              0,
                            ),
                          ).toFixed(1)}%
                        </div>
                        <div class="text-xs text-kong-pm-text-secondary hidden sm:block">
                          {formatBalance(market.outcome_pools[i], 8)}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              {/each}
            </div>

            <!-- Push footer to bottom -->
            <div class="flex-1"></div>

            <!-- Card Footer -->
            {#if !isResolved && title !== "Pending Resolution"}
              <div class="pt-1.5 sm:pt-2 border-t border-kong-pm-border">
                <div class="flex items-center justify-center">
                  <button
                    class="w-full flex items-center justify-center py-1.5 sm:py-2 border shadow-sm border-kong-accent-green/50 hover:bg-kong-accent-green/10 text-kong-text-accent-green rounded font-medium transition-all text-xs sm:text-sm"
                    on:click={() => openBetModal(market)}
                  >
                    <Coins class="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5" />
                    Place Bet
                  </button>
                </div>
              </div>
            {:else if title === "Pending Resolution"}
              <div class="pt-2 border-t border-kong-pm-border">
                {#if isUserAdmin}
                  <button
                    class="w-full flex items-center justify-center py-1.5 sm:py-2 border shadow-sm border-kong-accent-green/50 hover:bg-kong-accent-green/10 text-kong-text-accent-green rounded font-medium transition-all text-xs sm:text-sm"
                    on:click={() => openResolutionModal(market)}
                  >
                    <Coins class="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5" />
                    Resolve Market
                  </button>
                {:else}
                  <div class="text-center text-xs text-kong-pm-text-secondary">
                    Awaiting resolution
                  </div>
                {/if}
              </div>
            {:else}
              <div class="pt-2 border-t border-kong-pm-border">
                <div class="text-center text-xs text-kong-pm-text-secondary">
                  Resolved on {new Date(
                    Number(market.end_time) / 1_000_000,
                  ).toLocaleDateString()}
                </div>
              </div>
            {/if}
          </div>
        </Panel>
      {/each}

      <!-- Placeholder cards to fill out the row -->
      {#if markets.length % 3 !== 0 && title === "Active Markets"}
        {#each Array(3 - (markets.length % 3)) as _}
          <div class="hidden lg:block">
            <Panel
              variant="transparent"
              className="relative opacity-60 hover:opacity-100 border border-dashed border-kong-border/30 flex flex-col transition-all duration-200 hover:border-kong-accent-green/30"
            >
              <div class="flex-1 flex items-center justify-center py-8">
                <div class="text-center">
                  <div class="text-kong-pm-text-secondary mb-2">
                    <Plus class="w-6 h-6 mx-auto mb-2 opacity-50" />
                    Want to create your own market?
                  </div>
                  <p class="text-xs text-kong-pm-text-secondary/70">
                    Coming soon: Create and manage<br />your own prediction
                    markets
                  </p>
                </div>
              </div>

              <div class="mt-3 pt-2 border-t border-kong-pm-border">
                <div
                  class="w-full py-2 text-center text-kong-pm-text-secondary/50 text-xs"
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
</style>
