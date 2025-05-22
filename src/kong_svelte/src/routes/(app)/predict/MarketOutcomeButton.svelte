<script lang="ts">
    import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { calculatePercentage } from "$lib/utils/numberFormatUtils";
  import { Check, CheckCircle, ThumbsDown, ThumbsUp, X } from "lucide-svelte";

  let {
    outcome,
    index,
    market,
    isWinningOutcome,
    isMarketResolved,
    isMarketExpiredUnresolved,
    openBetModal,
    isYesNo = false,
  } = $props<{
    outcome: string;
    index: number;
    market: any;
    isWinningOutcome: (market: any, index: number) => boolean;
    isMarketResolved: (market: any) => boolean;
    isMarketExpiredUnresolved: (market: any) => boolean;
    openBetModal: (market: any, outcomeIndex?: number) => void;
    isYesNo?: boolean;
  }>();

  // Calculate the percentage for this outcome
  const percentage = $derived(calculatePercentage(
    market.outcome_pools[index],
    market.outcome_pools.reduce((acc, pool) => acc + Number(pool || 0), 0),
  ).toFixed(1));

  // Determine button classes based on type and state
  const buttonClasses = $derived(isYesNo
    ? `flex-1 h-10 rounded transition-colors relative ${
        index === 0
          ? "bg-kong-accent-green/20 hover:bg-kong-accent-green/30 text-kong-text-primary border border-kong-accent-green/30"
          : "bg-kong-accent-red/20 hover:bg-kong-accent-red/30 text-kong-text-primary border border-kong-accent-red/30"
      } ${
        isMarketResolved(market) && isWinningOutcome(market, index)
          ? index === 0
            ? "border-2 border-kong-accent-green shadow-[0_0_5px_rgba(0,203,160,0.3)]"
            : "border-2 border-kong-accent-red shadow-[0_0_5px_rgba(203,0,0,0.3)]"
          : ""
      }`
    : `h-8 sm:h-8 hover:bg-white/10 ${panelRoundness} px-2 py-5 transition-colors relative w-full ${
        isMarketResolved(market) && isWinningOutcome(market, index)
          ? "border-2 border-kong-accent-green/30 bg-kong-accent-green/5 shadow-[0_0_5px_rgba(0,203,160,0.3)]"
          : ""
      }`);

  // Determine progress bar color based on type
  const progressBarColor = $derived(isYesNo
    ? index === 0
      ? "bg-kong-accent-green/50"
      : "bg-kong-accent-red/50"
    : "bg-kong-accent-green/50");

  // Determine if the outcome is a winner
  const isWinner = $derived(isWinningOutcome(market, index));

  // Determine background color based on outcome
  const bgColor = $derived(
    isYesNo
      ? outcome.toLowerCase() === "yes"
        ? "bg-kong-accent-green/10 border-kong-accent-green/30 hover:bg-kong-accent-green/20 text-kong-text-accent-green"
        : "bg-kong-accent-red/10 border-kong-accent-red/30 hover:bg-kong-accent-red/20 text-kong-text-accent-red"
      : ""
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
    class="w-full py-2 px-5 text-center {$panelRoundness} font-medium text-lg group/outcome relative
      border transition-all duration-200 
      {isWinner
        ? 'bg-kong-accent-green/20 text-kong-text-accent-green font-bold border-kong-accent-green/40'
        : `${bgColor} border-${outcome.toLowerCase() === 'yes' ? 'kong-accent-green' : 'kong-accent-red'}/20`} 
      {isMarketExpiredUnresolved(market) || isMarketResolved(market)
        ? 'opacity-80 cursor-default'
        : 'hover:opacity-100 hover:shadow-sm transform hover:translate-y-[0.5px]'}"
    on:click={handleOutcomeClick}
  >
    <span class="relative z-10 flex items-center justify-center gap-1">
      {#if outcome === "Yes"}
        <ThumbsUp class="w-4 h-4 text-kong-accent-green" />
      {:else}
        <ThumbsDown class="w-4 h-4 text-kong-accent-red" />
      {/if}
      {outcome}

      {#if isWinner}
        <CheckCircle class="w-4 h-4 text-kong-accent-green animate-pulse" />
      {/if}
    </span>
    <div class="text-xs text-kong-text-secondary font-normal">
      {percentage}%
    </div>
  </button>
{:else}
  <!-- Non Yes/No outcome button -->
  <button
    class="w-full py-2 px-3 text-left overflow-hidden flex items-center {$panelRoundness} 
      relative border transition-all duration-200
      {isWinner
        ? 'bg-kong-accent-green/10 text-kong-text-accent-green font-bold border-kong-accent-green/30'
        : 'border-kong-border/20 hover:border-kong-border/40 hover:bg-kong-surface-light/20'} 
      {isMarketExpiredUnresolved(market) || isMarketResolved(market)
        ? 'opacity-80 cursor-default'
        : 'hover:opacity-100 hover:shadow-sm'}"
    on:click={handleOutcomeClick}
  >
    <!-- Background progress bar -->
    <div
      class="absolute left-0 top-0 h-full {isWinner 
        ? 'bg-kong-accent-green/20' 
        : 'bg-kong-primary/10'} opacity-90 transition-width duration-300  {$panelRoundness}"
      style="width: {width};"
    />

    <!-- Outcome text content -->
    <div class="flex w-full justify-between items-center">
      <span class="relative z-10 flex items-center gap-2">
        {outcome}
        {#if isWinner}
          <CheckCircle class="w-4 h-4 text-kong-accent-green animate-pulse" />
        {/if}
      </span>
      <span class="text-xs text-kong-text-secondary relative z-10 font-medium">
        {percentage}%
      </span>
    </div>
  </button>
{/if}

<style>
  .transition-width {
    transition: width 0.3s ease-in-out;
  }
</style> 