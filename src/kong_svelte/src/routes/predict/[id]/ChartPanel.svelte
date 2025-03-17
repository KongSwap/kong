<script lang="ts" runes>
  import BetBarChart from "./BetBarChart.svelte";
  import ChanceLineChart from "./ChanceLineChart.svelte";

  const props = $props<{
    market: any;
    marketBets: any[];
    selectedChartTab: string;
    onTabChange?: (tab: string) => void;
  }>();

  // Function to handle tab selection
  function selectTab(tab: string) {
    if (tab !== props.selectedChartTab && props.onTabChange) {
      props.onTabChange(tab);
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
    <button
      on:click={() => selectTab("rules")}
      class="px-3 sm:px-4 py-2 sm:py-3 focus:outline-none transition-colors relative whitespace-nowrap {props.selectedChartTab ===
      'rules'
        ? 'text-kong-primary font-medium'
        : 'text-kong-text-secondary hover:text-kong-text-primary'}"
    >
      <span class="text-sm sm:text-base">Rules</span>
      {#if props.selectedChartTab === "rules"}
        <div
          class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-primary rounded-t-full"
        ></div>
      {/if}
    </button>
  </div>

  <div class="chart-container relative">
    {#if props.selectedChartTab === "betHistory"}
      {#if props.market && marketBetsSnapshot.length > 0}
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
            <BetBarChart
              market={props.market}
              marketBets={marketBetsSnapshot}
              on:error={handleBetChartError}
            />
          </div>
        {/if}
      {:else}
        <div
          class="h-[300px] flex items-center justify-center bg-kong-bg-dark/20 rounded"
        >
          <p class="text-kong-text-secondary">No bet history data available</p>
        </div>
      {/if}
    {:else if props.selectedChartTab === "percentageChance"}
      {#if props.market && marketBetsSnapshot.length > 0}
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
      {:else}
        <div
          class="h-[300px] flex items-center justify-center bg-kong-bg-dark/20 rounded"
        >
          <p class="text-kong-text-secondary">No percentage chance data available</p>
        </div>
      {/if}
    {:else if props.selectedChartTab === "rules"}
      <div class="px-4 h-[300px] overflow-y-auto bg-kong-bg-dark/10 rounded !text-kong-text-primary">
        {#if props.market && props.market.rules}
          <div class="prose prose-invert max-w-none">
            {#if typeof props.market.rules === 'string'}
              <p class="text-sm text-kong-text-secondary whitespace-pre-wrap">{props.market.rules}</p>
            {:else if Array.isArray(props.market.rules)}
              <ul>
                {#each props.market.rules as rule}
                  <li class="text-kong-text-primary">{rule}</li>
                {/each}
              </ul>
            {:else}
              <p class="text-kong-text-secondary">Rules format not recognized</p>
            {/if}
          </div>
        {:else}
          <div class="flex flex-col gap-3 h-full justify-center items-center">
            <p class="text-kong-text-secondary text-center">
              No specific rules are available for this market.
            </p>
            <p class="text-kong-text-secondary text-center text-sm">
              Standard platform rules apply. The market will be resolved based on the actual outcome
              when it is determined.
            </p>
          </div>
        {/if}
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
