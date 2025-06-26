<script lang="ts" runes>
  import BetBarChart from "./BetBarChart.svelte";
  import ChanceLineChart from "./ChanceLineChart.svelte";
  import Card from "$lib/components/common/Card.svelte";

  const props = $props<{
    market: any;
    marketBets: any[];
    selectedTab: string;
  }>();

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

<Card className="">
  <div class="chart-container relative p-3">
    {#if props.selectedTab === "betHistory"}
      {#if props.market && marketBetsSnapshot.length > 0}
        {#if betChartError}
          <div
            class="h-[200px] flex items-center justify-center bg-kong-bg-primary/20 rounded"
          >
            <p class="text-kong-text-secondary text-xs">
              Unable to display history
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
          class="h-[200px] flex items-center justify-center bg-kong-bg-primary/20 rounded"
        >
          <p class="text-kong-text-secondary text-xs">No history data available</p>
        </div>
      {/if}
    {:else if props.selectedTab === "percentageChance"}
      {#if props.market && marketBetsSnapshot.length > 0}
        {#if chanceChartError}
          <div
            class="h-[200px] flex items-center justify-center bg-kong-bg-primary/20 rounded"
          >
            <p class="text-kong-text-secondary text-xs">
              Unable to display chart
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
          class="h-[200px] flex items-center justify-center bg-kong-bg-primary/20 rounded"
        >
          <p class="text-kong-text-secondary text-xs">No data available</p>
        </div>
      {/if}
    {:else if props.selectedTab === "rules"}
      <div class="h-[200px] overflow-y-auto !text-kong-text-primary">
        {#if props.market && props.market.rules}
          <div class="prose prose-invert max-w-none">
            <p class="text-sm text-kong-text-secondary whitespace-pre-wrap">{props.market.rules}</p>
          </div>
        {:else}
          <p class="text-kong-text-secondary text-center">
            No specific rules are available for this market.
          </p>
        {/if}
      </div>
    {/if}
  </div>
</Card>

<style lang="postcss">
  .chart-container {
    height: 200px;
    width: 100%;
  }

  .chart-wrapper {
    height: 100%;
    width: 100%;
  }
</style>
