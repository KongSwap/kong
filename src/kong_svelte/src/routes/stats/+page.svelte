<!-- src/kong_svelte/src/routes/stats/+page.svelte -->
<script lang="ts">
  import { switchLocale } from "$lib/stores/localeStore";
  import { t } from "$lib/locales/translations";
  import { backendService } from "$lib/services/backendService";
  import { onMount } from "svelte";
  import { isEqual } from "lodash-es";
  import Button from "$lib/components/common/Button.svelte";
  import {
    formatNumberCustom,
    getTokenDecimals,
  } from "$lib/utils/formatNumberCustom";
  import Clouds from "$lib/components/stats/Clouds.svelte";
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import StatsSignPost from "$lib/components/stats/StatsSignPost.svelte";
  import { lpTableHeaders } from "$lib/constants/statsConstants";
  import { filterPools, sortPools } from "$lib/utils/statsUtils";

  type PoolsTotals = {
    totalTvl: number | string;
    totalVolume: number | string;
    totalFees: number | string;
  };

  let tokens: any = null;
  let poolsInfo = [];
  let poolsTotals: PoolsTotals = {
    totalTvl: 0,
    totalVolume: 0,
    totalFees: 0,
  };
  let previousPoolBalances = null;
  let sortColumn = "tvl";
  let sortDirection: "asc" | "desc" = "desc";
  let userInitiatedSort = false;
  let searchQuery = "";

  function parseValue(value: any): any {
    if (typeof value === "string") {
      value = value.replace(/[$%,]/g, "");
      if (value.includes("%")) {
        return parseFloat(value);
      }
      return isNaN(parseFloat(value)) ? value : parseFloat(value);
    }
    return value;
  }

  onMount(async () => {
    try {
      tokens = await backendService.getTokens();
      await updatePoolBalances();
    } catch (error) {
      console.error("Error fetching tokens:", error);
    }
  });

  async function updatePoolBalances() {
    try {
      const response = await backendService.getPools();
      const liquidityPools = response.pools || [];

      if (!isEqual(previousPoolBalances, liquidityPools)) {
        poolsInfo = liquidityPools;
        previousPoolBalances = liquidityPools;
        const decimals = 6;

        console.log(response);

        poolsTotals = {
          totalTvl: formatBigInt(response?.total_tvl || 0, decimals),
          totalVolume: formatBigInt(response?.total_24h_volume || 0, decimals),
          totalFees: formatBigInt(response?.total_24h_lp_fee || 0, decimals),
        };

        userInitiatedSort = false;

        // Format and sort pools
        const formattedPools = formatPools(poolsInfo);
        poolsInfo = sortPools(formattedPools, sortColumn, sortDirection);
      }
    } catch (error) {
      console.error("Error fetching pool balances, retrying...", error);
      setTimeout(updatePoolBalances, 2000);
    }
  }

  function formatBigInt(value: bigint | number, decimals: number): number | string {
    if (typeof value === "bigint") {
      return Number(value) / 10 ** decimals;
    }
    return value;
  }

  function formatPools(pools: any[]): any[] {
    if (pools.length === 0 || !tokens) return pools;

    const decimals1 = getTokenDecimals(pools[0]?.symbol_1) || 6;

    return pools.map((pool) => {
      const balance = Number(pool.balance || 0);
      const apy = formatNumberCustom(Number(pool.rolling_24h_apy || 0), 2);
      const roll24hVolume = formatNumberCustom(
        Number(pool.rolling_24h_volume || 0) / 10 ** decimals1,
        0,
      );
      const tvl = formatNumberCustom(balance / 10 ** decimals1, 0);

      return {
        ...pool,
        apy,
        roll24hVolume,
        tvl,
      };
    });
  }

  // Reactive statement to update poolsInfo when tokens or poolsInfo change
  $: if (poolsInfo.length > 0 && tokens) {
    // Format pools
    const formattedPools = formatPools(poolsInfo);
    
    // Sort pools based on current sort settings
    poolsInfo = sortPools(formattedPools, sortColumn, sortDirection);
  }

  // Handle the sort event dispatched from TableHeader
  function handleSortEvent(event: CustomEvent<{ column: string; direction: "asc" | "desc" }>) {
    const { column, direction } = event.detail;
    sortColumn = column;
    sortDirection = direction;
    poolsInfo = sortPools(formatPools(poolsInfo), sortColumn, sortDirection);
    userInitiatedSort = true;
    console.log(`Sorted by ${column} in ${direction} order`, poolsInfo);
  }
</script>

<Clouds />

<main class="flex min-h-[95vh] bg-sky-100 relative pt-28">
  <div class="w-1/12 font-alumni z-[2]">
    <StatsSignPost
      totalTvl={poolsTotals.totalTvl}
      totalVolume={poolsTotals.totalVolume}
      totalFees={poolsTotals.totalFees}
    />
  </div>

  <div class="flex-grow z-10 w-10/12 flex items-center mb-20 overflow-x-scroll">
    <!-- Pool Overview Section -->
    <div
      class="bg-k-light-blue bg-opacity-70 border-[5px] border-black p-0.5 w-full max-w-5xl mx-auto"
    >
      <div class="inner-border p-4 w-full h-full">
        <div class="grid grid-cols-3 items-center mb-2 md:mb-0">
          <h2
            class="pl-1 mt-2 font-black col-span-3 md:col-span-2 text-3xl text-center md:text-left text-white mb-4 text-outline-2"
          >
            {$t("stats.overviewOfKongPools")}
          </h2>

          <!-- Search Input -->
          <div class="col-span-3 md:col-span-1 flex justify-center md:justify-end">
            <input
              type="text"
              placeholder="Search by symbol"
              bind:value={searchQuery}
              class="w-1/2 bg-sky-200/70 text-black border-none rounded-2xl min-w-[160px]"
            />
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-black font-alumni">
            <thead>
              <tr class="border-b-4 border-black text-3xl uppercase">
                {#each lpTableHeaders as header}
                  <TableHeader
                    label={$t(header.label)}
                    column={header.column}
                    textClass={header.textClass}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    on:sort={handleSortEvent}
                  />
                {/each}
              </tr>
            </thead>
            <tbody>
              {#if searchQuery.length > 0}
                <tr class="border-b-2 border-black text-xl md:text-3xl">
                  <td class="p-2 uppercase font-bold text-center" colspan="50">
                    No results found
                  </td>
                </tr>
              {:else}
                {#each filterPools(poolsInfo, searchQuery) as pool}
                  <tr class="border-b-2 border-black text-xl md:text-3xl">
                    <td class="p-2 uppercase font-bold">{pool.symbol_0}/{pool.symbol_1}</td>
                    <td class="p-2 text-right">${formatNumberCustom(pool.price, 2)}</td>
                    <td class="p-2 text-right">${pool.tvl}</td>
                    <td class="p-2 text-right">${pool.roll24hVolume}</td>
                    <td class="p-2 text-right">{pool.apy}%</td>
                    <td class="p-2">
                      <div class="flex flex-col justify-center gap-2">
                        <Button variant="green" size="small">
                          {$t("stats.swap")}
                        </Button>
                        <Button variant="green" size="small">
                          {$t("stats.addLiquidity")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                {:else}
                  <tr class="border-b-2 border-black text-xl md:text-3xl">
                    <td class="p-2 uppercase font-bold text-center" colspan="12">
                      <LoadingIndicator />
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  <div class="w-1/12"></div>
</main>

<div
  style="background-image:url('/backgrounds/grass.webp'); background-repeat: repeat-x; background-size: 100% 100%;"
  class="w-full min-h-[80px] max-h-[80px]"
></div>

<style scoped>
  main {
    background-color: #5bb2cf;
    background-size: cover;
    background-position: center;
  }

  .inner-border {
    box-shadow: inset 0 0 0 2px white;
  }

  @keyframes wobble {
    0% {
      transform: translateX(0%);
    }
    15% {
      transform: rotate(-1deg);
    }
    30% {
      transform: rotate(1deg);
    }
    45% {
      transform: rotate(-1deg);
    }
    60% {
      transform: rotate(1deg);
    }
    75% {
      transform: rotate(-1deg);
    }
    100% {
      transform: translateX(0%);
    }
  }
</style>
