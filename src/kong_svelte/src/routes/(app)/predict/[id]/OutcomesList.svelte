<script lang="ts">
    import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
    import BigNumber from "bignumber.js";
  import OutcomeProgressBar from "./OutcomeProgressBar.svelte";
  import { Dices, BarChart3 } from "lucide-svelte";

  export let market: any;
  export let token: Kong.Token;
  export let outcomes: string[];
  export let outcomePercentages: number[];
  export let betCountPercentages: number[];
  export let betCounts: number[];
  export let isMarketResolved: boolean;
  export let isPendingResolution: boolean;
  export let isMarketClosed: boolean;
  export let winningOutcomes: any[];
  export let onSelectOutcome: (outcomeIndex: number) => void;
</script>

<div class="space-y-2 sm:space-y-3">
  <div class="space-y-2 sm:space-y-3">
    {#each outcomes as outcome, i}
      <Panel className="relative !rounded {isMarketClosed && winningOutcomes.some((w) => Number(w) === i) ? 'border-2 !border-kong-accent-green' : isMarketClosed && !isPendingResolution && !winningOutcomes.some((w) => Number(w) === i) ? 'opacity-75 border border-kong-border/30' : ''}">
        <div class="relative flex flex-col">
          <div
            class="flex items-center justify-between p-2 sm:p-3 rounded transition-colors"
          >
            <div class="flex-1 min-w-0">
              <div
                class="font-medium text-sm sm:text-base truncate flex items-center gap-2"
              >
                {outcome}
                {#if isMarketClosed && winningOutcomes.some((w) => Number(w) === i)}
                  <span
                    class="text-xs px-1.5 py-0.5 bg-kong-accent-green/20 text-kong-text-accent-green rounded border border-kong-accent-green"
                  >
                    Winner
                  </span>
                {/if}
              </div>
              <div
                class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-kong-text-secondary"
              >
                <span class="flex items-center gap-1">
                  {new BigNumber(market.outcome_pools[i]).div(10 ** token.decimals).toString()} {token.symbol}
                </span>
                <div class="flex items-center gap-1">
                  <BarChart3 size={12} class="sm:w-4 sm:h-4" />
                  <span class="truncate"
                    >{betCountPercentages[i].toFixed(1)}% of predictions ({betCounts[
                      i
                    ]} total)</span
                  >
                </div>
              </div>
              <OutcomeProgressBar
                percentage={outcomePercentages[i]}
              />
            </div>
            <div class="ml-2 sm:ml-4">
              {#if !isMarketResolved && !isPendingResolution}
                <ButtonV2
                  theme="accent-green"
                  variant="solid"
                  size="md"
                  on:click={() => onSelectOutcome(i)}
                >
                  Select
                </ButtonV2>
              {:else if isMarketClosed && winningOutcomes.some((w) => Number(w) === i)}
                <div
                  class="px-3 sm:px-4 py-1.5 sm:py-2 bg-kong-accent-green/20 text-kong-text-accent-green rounded-md text-sm sm:text-base font-medium border border-kong-accent-green"
                >
                  Winner
                </div>
              {:else if isPendingResolution}
                <div class="text-sm text-yellow-500">Pending</div>
              {:else}
                <div
                  class="px-3 sm:px-4 py-1.5 sm:py-2 bg-kong-bg-dark/70 text-kong-text-secondary/70 rounded-md text-sm sm:text-base border border-kong-border/30"
                >
                  Lost
                </div>
              {/if}
            </div>
          </div>
        </div>
      </Panel>
    {/each}
  </div>
</div> 