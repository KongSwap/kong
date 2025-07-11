<script lang="ts">
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { calculatePercentage } from "$lib/utils/numberFormatUtils";
  import { Check, CheckCircle } from "lucide-svelte";

  let {
    outcome,
    index,
    market,
    openBetModal,
    isYesNo = false,
  } = $props<{
    outcome: string;
    index: number;
    market: any;
    openBetModal: (market: any, outcomeIndex?: number) => void;
    isYesNo?: boolean;
  }>();

  // Helper functions to check market status
  function isMarketResolved(market: any): boolean {
    return market && market.status && "Closed" in market.status;
  }

  function isMarketExpiredUnresolved(market: any): boolean {
    if (!market) return false;
    if (market.status && "Closed" in market.status) return false;
    return BigInt(market.end_time) <= BigInt(Date.now()) * BigInt(1_000_000);
  }

  function isWinningOutcome(market: any, outcomeIndex: number): boolean {
    try {
      if (market.winning_outcomes) {
        return market.winning_outcomes.some(
          (winningIndex: any) => Number(winningIndex) === outcomeIndex,
        );
      }

      if (market.status && typeof market.status === "object") {
        if ("Closed" in market.status && Array.isArray(market.status.Closed)) {
          return market.status.Closed.some(
            (winningIndex: any) => Number(winningIndex) === outcomeIndex,
          );
        }
      }

      return false;
    } catch (error) {
      console.error("Error in isWinningOutcome:", error, market);
      return false;
    }
  }

  // Calculate the percentage for this outcome
  const percentage = $derived(
    calculatePercentage(
      market.outcome_pools[index],
      market.outcome_pools.reduce((acc, pool) => acc + Number(pool || 0), 0),
    ).toFixed(1),
  );


  // Determine if the outcome is a winner
  const isWinner = $derived(isWinningOutcome(market, index));

  // Determine background color based on outcome
  const bgColor = $derived(
    isYesNo
      ? outcome.toLowerCase() === "yes"
        ? "bg-kong-success/5 border-kong-success/20 hover:bg-kong-success/10 text-kong-text-primary"
        : "bg-kong-error/5 border-kong-error/20 hover:bg-kong-error/10 text-kong-text-primary"
      : "",
  );

  // Determine width based on percentage
  const width = $derived(`${percentage}%`);

  // Handler to open the bet modal for this outcome
  function handleOutcomeClick() {
    if (
      !isMarketExpiredUnresolved(market) &&
      !isMarketResolved(market) &&
      !("Pending" in market.status) &&
      !("Voided" in market.status)
    ) {
      openBetModal(market, index);
    }
  }
</script>

{#if isYesNo}
  <!-- Yes/No outcome button -->
  <button
    class="w-full cursor-pointer py-1 px-5 text-center {$panelRoundness} font-medium group/outcome relative
      border transition-all duration-200
      {isWinner
      ? 'bg-kong-success/10 text-kong-success font-bold border-kong-success/30'
      : bgColor} 
      {isMarketExpiredUnresolved(market)
      ? 'opacity-80 cursor-pointer'
      : isMarketResolved(market) && !isWinner
      ? 'opacity-40 cursor-pointer grayscale'
      : isMarketResolved(market) && isWinner
      ? 'opacity-100 cursor-pointer'
      : 'hover:opacity-100 hover:shadow-sm transform hover:translate-y-[0.5px]'}"
    onclick={handleOutcomeClick}
  >
    <div
      class="relative z-10 flex items-center justify-center gap-1 truncate-text"
    >
      <div class="flex items-center justify-center gap-1">
        <span class="truncate {isMarketResolved(market) && !isWinner ? 'text-kong-text-disabled' : ''}">{outcome}</span>

        {#if isWinner}
          <CheckCircle
            class="w-4 h-4 text-kong-success flex-shrink-0"
          />
        {/if}
      </div>
      <div class="text-xs {isMarketResolved(market) && !isWinner ? 'text-kong-text-disabled' : 'text-kong-text-secondary'} font-normal">
        {percentage}%
      </div>
    </div>
  </button>
{:else}
  <!-- Non Yes/No outcome button -->
  <button
    class="w-full py-2 px-3 text-left overflow-hidden flex items-center {$panelRoundness} 
      relative border transition-all duration-200 text-sm
      {isWinner
      ? 'bg-kong-success/10 text-kong-success font-bold border-kong-success/30'
      : 'border-kong-border/20 hover:border-kong-border/40 bg-kong-bg-tertiary hover:bg-kong-primary/40'} 
      {isMarketExpiredUnresolved(market)
      ? 'opacity-80 cursor-pointer'
      : isMarketResolved(market) && !isWinner
      ? 'opacity-40 cursor-pointer grayscale'
      : isMarketResolved(market) && isWinner
      ? 'opacity-100 cursor-pointer'
      : 'hover:opacity-100 hover:shadow-sm'}"
    onclick={handleOutcomeClick}
  >
    <!-- Background progress bar -->
    <div
      class="absolute left-0 top-0 h-full {isWinner
        ? 'bg-kong-success/20'
        : isMarketResolved(market) && !isWinner
        ? 'bg-gray-500/10'
        : 'bg-kong-primary/10'} opacity-90 transition-width duration-300 {$panelRoundness}"
      style="width: {width};"
    />

    <!-- Outcome text content -->
    <div class="flex w-full justify-between items-center">
      <span class="relative z-10 flex items-center gap-2 min-w-0">
        <span class="truncate block {isMarketResolved(market) && !isWinner ? 'text-kong-text-disabled' : ''}">{outcome}</span>
        {#if isWinner}
          <CheckCircle
            class="w-4 h-4 text-kong-success flex-shrink-0"
          />
        {/if}
      </span>
      <span
        class="text-xs {isMarketResolved(market) && !isWinner ? 'text-kong-text-disabled' : 'text-kong-text-secondary'} relative z-10 font-medium flex-shrink-0"
      >
        {percentage}%
      </span>
    </div>
  </button>
{/if}

<style>
  .transition-width {
    transition: width 0.3s ease-in-out;
  }
  .truncate-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
    max-width: 100%;
  }
</style>
