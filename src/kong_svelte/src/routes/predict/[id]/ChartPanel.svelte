<script lang="ts">
  import BetLineChart from "./BetLineChart.svelte";
  import ChanceLineChart from "./ChanceLineChart.svelte";
  import { crossfade } from "svelte/transition";

  export let market: any;
  export let marketBets: any[];
  export let selectedChartTab: string;
  
  export function setSelectedChartTab(tab: string) {
    selectedChartTab = tab;
  }

  const [send, receive] = crossfade({
    duration: 300,
    fallback(node, params) {
      return {
        duration: 300,
        css: (t) => `
          opacity: ${t};
          transform: scale(${0.8 + 0.2 * t});
        `,
      };
    },
  });
</script>

<div class="flex flex-col gap-3 sm:gap-4">
  <div
    class="flex gap-2 sm:gap-4 border-b border-kong-border overflow-x-auto scrollbar-none"
  >
    <button
      on:click={() => selectedChartTab = "betHistory"}
      class="px-3 sm:px-4 py-2 sm:py-3 focus:outline-none transition-colors relative whitespace-nowrap {selectedChartTab ===
      'betHistory'
        ? 'text-kong-text-accent-green font-medium'
        : 'text-kong-text-secondary hover:text-kong-text-primary'}"
    >
      <span class="text-sm sm:text-base">Bet History</span>
      {#if selectedChartTab === "betHistory"}
        <div
          class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-accent-green rounded-t-full"
        ></div>
      {/if}
    </button>
    <button
      on:click={() => selectedChartTab = "percentageChance"}
      class="px-3 sm:px-4 py-2 sm:py-3 focus:outline-none transition-colors relative whitespace-nowrap {selectedChartTab ===
      'percentageChance'
        ? 'text-kong-text-accent-green font-medium'
        : 'text-kong-text-secondary hover:text-kong-text-primary'}"
    >
      <span class="text-sm sm:text-base">Percentage Chance</span>
      {#if selectedChartTab === "percentageChance"}
        <div
          class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-accent-green rounded-t-full"
        ></div>
      {/if}
    </button>
  </div>
  <div class="h-[300px]">
    {#if selectedChartTab === "betHistory"}
      {#if marketBets.length === 0}
        <div
          in:receive={{ key: "empty-bet-history" }}
          out:send={{ key: "empty-bet-history" }}
          class="h-full flex flex-col items-center justify-center text-center px-4"
        >
          <div
            class="w-16 h-16 mb-4 rounded-full bg-kong-bg-dark/50 flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-8 h-8 text-kong-text-secondary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 3v18h18"></path>
              <path d="m19 9-5 5-4-4-3 3"></path>
            </svg>
          </div>
          <h3 class="text-kong-text-secondary/80 font-medium mb-1">
            No bet history yet
          </h3>
          <p class="text-sm text-kong-text-secondary/60">
            Place the first bet to start tracking market activity
          </p>
        </div>
      {:else}
        <div
          in:receive={{ key: "bet-history" }}
          out:send={{ key: "bet-history" }}
        >
          <BetLineChart {market} {marketBets} />
        </div>
      {/if}
    {:else if marketBets.length === 0}
      <div
        in:receive={{ key: "empty-percentage" }}
        out:send={{ key: "empty-percentage" }}
        class="h-full flex flex-col items-center justify-center text-center px-4"
      >
        <div
          class="w-16 h-16 mb-4 rounded-full bg-kong-bg-dark/50 flex items-center justify-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-8 h-8 text-kong-text-secondary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
          </svg>
        </div>
        <h3 class="text-kong-text-secondary/80 font-medium mb-1">
          No percentage data yet
        </h3>
        <p class="text-sm text-kong-text-secondary/60">
          Bet activity will reveal market sentiment
        </p>
      </div>
    {:else}
      <div
        in:receive={{ key: "percentage-chart" }}
        out:send={{ key: "percentage-chart" }}
      >
        <ChanceLineChart {market} {marketBets} />
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
</style> 