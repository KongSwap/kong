<script lang="ts" runes>
  import { createEventDispatcher } from "svelte";
  import BetLineChart from "./BetLineChart.svelte";
  import ChanceLineChart from "./ChanceLineChart.svelte";

  const props = $props<{
    market: any;
    marketBets: any[];
    selectedChartTab: string;
  }>();

  // Function to notify parent of events
  const dispatch = createEventDispatcher<{
    tabChange: string;
  }>();

  // Function to handle tab selection
  function selectTab(tab: string) {
    if (tab !== props.selectedChartTab) {
      dispatch("tabChange", tab);
    }
  }

  // Track error states for charts
  let betChartError = $state(false);
  let chanceChartError = $state(false);
  let marketBetsSnapshot = $state<any[]>([]);

  // When marketBets changes, update the snapshot and reset chart errors
  $effect(() => {
    if (props.marketBets) {
      // Create a new array to break any reactivity issues
      marketBetsSnapshot = [...props.marketBets];
      // Reset error states when data changes
      betChartError = false;
      chanceChartError = false;
    }
  });

  // Error handler functions
  function handleBetChartError() {
    betChartError = true;
  }

  function handleChanceChartError() {
    chanceChartError = true;
  }
</script>

<div class="flex flex-col gap-3 sm:gap-4">
  <div
    class="flex gap-2 sm:gap-4 border-b border-kong-border overflow-x-auto scrollbar-none"
  >
    <button
      on:click={() => selectTab("percentageChance")}
      class="px-3 sm:px-4 py-2 sm:py-3 focus:outline-none transition-colors relative whitespace-nowrap {props.selectedChartTab ===
      'percentageChance'
        ? 'text-kong-primary font-medium'
        : 'text-kong-text-secondary hover:text-kong-text-primary'}"
    >
      <span class="text-sm sm:text-base">Percentage Chance</span>
      {#if props.selectedChartTab === "percentageChance"}
        <div
          class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-primary rounded-t-full"
        ></div>
      {/if}
    </button>
    <button
      on:click={() => selectTab("betHistory")}
      class="px-3 sm:px-4 py-2 sm:py-3 focus:outline-none transition-colors relative whitespace-nowrap {props.selectedChartTab ===
      'betHistory'
        ? 'text-kong-primary font-medium'
        : 'text-kong-text-secondary hover:text-kong-text-primary'}"
    >
      <span class="text-sm sm:text-base">Bet History</span>
      {#if props.selectedChartTab === "betHistory"}
        <div
          class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-primary rounded-t-full"
        ></div>
      {/if}
    </button>
  </div>

  <div class="chart-container relative">
    {#if props.market && marketBetsSnapshot.length > 0}
      {#if props.selectedChartTab === "betHistory"}
        {#if betChartError}
          <div
            class="h-[300px] flex items-center justify-center bg-kong-bg-dark/20 rounded"
          >
            <p class="text-kong-text-secondary">
              Unable to display bet history chart
            </p>
          </div>
        {:else}
          <div class="chart-wrapper">
            <BetLineChart
              market={props.market}
              marketBets={marketBetsSnapshot}
              on:error={handleBetChartError}
            />
          </div>
        {/if}
      {:else if props.selectedChartTab === "percentageChance"}
        {#if chanceChartError}
          <div
            class="h-[300px] flex items-center justify-center bg-kong-bg-dark/20 rounded"
          >
            <p class="text-kong-text-secondary">
              Unable to display percentage chance chart
            </p>
          </div>
        {:else}
          <div class="chart-wrapper">
            <ChanceLineChart
              market={props.market}
              marketBets={marketBetsSnapshot}
              on:error={handleChanceChartError}
            />
          </div>
        {/if}
      {/if}
    {:else}
      <div
        class="h-[300px] flex items-center justify-center bg-kong-bg-dark/20 rounded"
      >
        <p class="text-kong-text-secondary">No chart data available</p>
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .scrollbar-none {
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  .chart-container {
    height: 300px;
    width: 100%;
  }

  .chart-wrapper {
    height: 100%;
    width: 100%;
  }
</style>
