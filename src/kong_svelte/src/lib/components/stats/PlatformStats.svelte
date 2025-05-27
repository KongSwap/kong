<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

  // Props
  export let poolTotals: {
    total_volume_24h: number;
    total_tvl: number;
    total_fees_24h: number;
  };
  export let isLoading: boolean = false;
</script>

<div class="w-full">
  <Panel
    type="main"
    className="flex flex-col !bg-transparent !shadow-none !border-none !p-0"
    height="100%"
  >
    <div class="flex flex-col gap-2">
      <div class="flex flex-col gap-2">
        {#if isLoading}
          <div class="flex flex-col gap-2">
            <!-- Top row loading state -->
            <div class="grid grid-cols-2 gap-2">
              {#each Array(2) as _}
                <div
                  class="h-16 bg-kong-bg-secondary rounded-lg animate-pulse"
                ></div>
              {/each}
            </div>
            <!-- Bottom row loading state -->
            <div class="w-full">
              <div
                class="h-16 bg-kong-bg-secondary rounded-lg animate-pulse"
              ></div>
            </div>
          </div>
        {:else}
          <div class="flex flex-col gap-2">
            <!-- Top row: Volume and Fees -->
            <div class="grid grid-cols-2 gap-2">
              <!-- Total Volume 24h -->
              <div class="bg-kong-bg-secondary rounded-lg p-3">
                <div class="flex flex-col">
                  <span class="text-lg font-bold text-kong-text-primary">
                    {formatUsdValue(poolTotals.total_volume_24h)}
                  </span>
                  <span class="text-xs text-kong-text-secondary font-medium"
                    >24h Volume</span
                  >
                </div>
              </div>

              <!-- Total Fees 24h -->
              <div class="bg-kong-bg-secondary rounded-lg p-3">
                <div class="flex flex-col">
                  <span class="text-lg font-bold text-kong-text-primary">
                    {formatUsdValue(poolTotals.total_fees_24h)}
                  </span>
                  <span class="text-xs text-kong-text-secondary font-medium"
                    >24h Fees</span
                  >
                </div>
              </div>
            </div>

            <!-- Bottom row: TVL on its own -->
            <div class="w-full">
              <!-- Total TVL -->
              <div class="bg-kong-bg-secondary rounded-lg p-3">
                <div class="flex flex-col">
                  <span class="text-lg font-bold text-kong-text-primary">
                    ${poolTotals.total_tvl.toLocaleString(undefined, {
                      maximumFractionDigits: 2
                    })}
                  </span>
                  <span class="text-xs text-kong-text-secondary font-medium"
                    >Total TVL</span
                  >
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </Panel>
</div> 