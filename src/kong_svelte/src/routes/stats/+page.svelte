<!-- src/kong_svelte/src/routes/stats/+page.svelte -->
<script lang="ts">
  import { t } from "$lib/locales/translations";
  import { backendService } from "$lib/services/backendService";
  import { onMount, onDestroy } from "svelte";
  import Button from "$lib/components/common/Button.svelte";
  import { formatNumberCustom } from "$lib/utils/formatNumberCustom";
  import Clouds from "$lib/components/stats/Clouds.svelte";
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import StatsSignPost from "$lib/components/stats/StatsSignPost.svelte";
  import { lpTableHeaders } from "$lib/constants/statsConstants";
  import { filterPools, sortPools } from "$lib/utils/statsUtils";
  import { fetchPools, poolsInfo, poolsTotals } from "$lib/stores/poolStore";
  import { writable } from 'svelte/store';
  import { debounce } from 'lodash-es'; // Import debounce from lodash
    import { goto } from "$app/navigation";

  type PoolsTotalsType = {
    totalTvl: number | string;
    totalVolume: number | string;
    totalFees: number | string;
  };

  let tokens: Record<string, any> = {}; // Define tokens as a Record for better type safety
  let poolsData: any[] = [];
  let currentPoolsTotals: PoolsTotalsType = {
    totalTvl: 0,
    totalVolume: 0,
    totalFees: 0,
  };
  let sortColumn = "tvl";
  let sortDirection: "asc" | "desc" = "desc";
  let searchQuery = "";
  let debouncedSearchQuery = "";

  // Create a writable store for the search input with debouncing
  const searchStore = writable("");

  // Subscribe to poolsInfo and poolsTotals from the store
  const unsubscribePoolsInfo = poolsInfo.subscribe(value => {
    poolsData = value;
    console.log('poolsInfo updated:', poolsData);
  });

  const unsubscribePoolsTotals = poolsTotals.subscribe(value => {
    currentPoolsTotals = value;
    console.log('poolsTotals updated:', currentPoolsTotals);
  });

  onDestroy(() => {
    unsubscribePoolsInfo();
    unsubscribePoolsTotals();
  });

  /**
   * Handles the sort event dispatched from the TableHeader component.
   * Updates the sort column and direction.
   * @param event - The custom sort event containing column and direction.
   */
  function handleSortEvent(event: CustomEvent<{ column: string; direction: "asc" | "desc" }>) {
    const { column, direction } = event.detail;
    sortColumn = column;
    sortDirection = direction;
  }

  onMount(async () => {
    try {
      tokens = await backendService.getTokens();
      await fetchPools();
    } catch (error) {
      console.error("Error during onMount:", error);
    }

    // Initialize debounced search
    const debounced = debounce((query: string) => {
      debouncedSearchQuery = query;
    }, 300); // 300ms debounce delay

    // Subscribe to searchStore changes with debouncing
    const unsubscribeSearch = searchStore.subscribe(value => {
      debounced(value);
    });

    // Clean up the search subscription on destroy
    onDestroy(() => {
      unsubscribeSearch();
    });
  });

  /**
   * Reactive statement to compute sorted and filtered pools based on search query and sort settings.
   */
  let sortedFilteredPools: any[] = [];

  $: sortedFilteredPools = sortPools(filterPools(poolsData, debouncedSearchQuery), sortColumn, sortDirection);
</script>

<Clouds />

<main class="flex min-h-[95vh] bg-sky-100 relative pt-28">
  <div class="w-1/12 font-alumni z-[2]">
    <StatsSignPost
      totalTvl={currentPoolsTotals.totalTvl}
      totalVolume={currentPoolsTotals.totalVolume}
      totalFees={currentPoolsTotals.totalFees}
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
              bind:value={$searchStore}
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
              {#if sortedFilteredPools.length === 0}
                <tr class="border-b-2 border-black text-xl md:text-3xl">
                  <td class="p-2 uppercase font-bold text-center" colspan="50">
                    No results found
                  </td>
                </tr>
              {:else}
                {#each sortedFilteredPools as pool (pool.lp_token_symbol)}
                  <tr class="border-b-2 border-black text-xl md:text-3xl">
                    <td class="uppercase font-bold" on:click={() => goto(`/stats/${pool.lp_token_symbol}`)}>
                      <div class="flex items-center">
                        <!-- Dynamic Token Logos -->
                        <div class="isolate flex -space-x-1 overflow-hidden p-2">
                          <img class="relative z-30 inline-block h-8 w-8 rounded-full ring-[3px] ring-sky-500 bg-white" src="/tokens/icp.png" alt={pool.symbol_0}>
                          <img class="relative z-20 inline-block h-8 w-8 rounded-full ring-[3px] ring-sky-500 bg-white" src="/tokens/icp.png" alt={pool.symbol_1}>
                        </div>
                        <span>{pool.symbol_0}/{pool.symbol_1}</span>
                      </div>
                    </td>
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
                  <tr>
                    <LoadingIndicator />
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
