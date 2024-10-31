<!-- src/kong_svelte/src/routes/stats/+page.svelte -->
<script lang="ts">
  import { t } from "$lib/locales/translations";
  import { onMount, onDestroy } from "svelte";
  import Button from "$lib/components/common/Button.svelte";
  import Tooltip from "$lib/components/common/Tooltip.svelte";
  import { formatNumberCustom } from "$lib/utils/formatNumberCustom";
  import Clouds from "$lib/components/stats/Clouds.svelte";
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import StatsSignPost from "$lib/components/stats/StatsSignPost.svelte";
  import { lpTableHeaders } from "$lib/constants/statsConstants";
  import { filterPools, sortPools } from "$lib/utils/statsUtils";
  import {
    poolStore,
    poolsList,
    poolTotals,
    poolsLoading,
    poolsError,
  } from "$lib/stores/poolStore";
  import { writable, derived } from "svelte/store";
  import { debounce } from "lodash-es";
  import { goto } from "$app/navigation";
  import { ArrowLeftRight, Droplets } from "lucide-svelte";
  import { tokenStore } from "$lib/stores/tokenStore";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";

  // Search functionality
  const searchQuery = writable("");
  const debouncedSearch = debounce((value: string) => {
    searchQuery.set(value);
  }, 300);

  // Sorting state
  const sortColumnStore = writable("tvl");
  const sortDirectionStore = writable<"asc" | "desc">("desc");

  // Derived store for filtered and sorted pools
  const filteredSortedPools = derived(
    [poolsList, searchQuery, sortColumnStore, sortDirectionStore],
    ([$pools, $searchQuery, $sortColumn, $sortDirection]) => {
      const filtered = filterPools($pools, $searchQuery);
      return sortPools(filtered, $sortColumn, $sortDirection);
    },
  );

  function handleSortEvent(
    event: CustomEvent<{ column: string; direction: "asc" | "desc" }>,
  ) {
    const { column, direction } = event.detail;
    sortColumnStore.set(column);
    sortDirectionStore.set(direction);
  }

  // Load initial data
  onMount(async () => {
    try {
      await Promise.all([tokenStore.loadTokens(), poolStore.loadPools()]);
    } catch (error) {
      console.error("Error loading initial data:", error);
    }
  });
</script>

<Clouds />

<main class="flex min-h-[94vh] bg-sky-100 relative">
  <div class="w-1/12 font-alumni z-[2]">
    <StatsSignPost
      totalTvl={$poolTotals.tvl}
      totalVolume={$poolTotals.rolling_24h_volume}
      totalFees={$poolTotals.fees_24h}
    />
  </div>

  <div class="z-10 w-10/12 flex pt-32">
    <div class="w-full">
      <div
        class="bg-k-light-blue bg-opacity-70 border-[5px] border-black p-0.5 max-w-5xl mx-auto"
      >
        <div class="inner-border p-4 w-full">
          <!-- Header and Search -->
          <div class="grid grid-cols-3 items-center mb-2 md:mb-0">
            <h2
              class="pl-1 mt-2 font-black col-span-3 md:col-span-2 text-3xl text-center md:text-left text-white mb-4 text-outline-2"
            >
              {$t("stats.overviewOfKongPools")}
            </h2>

            <div
              class="col-span-3 md:col-span-1 flex justify-center md:justify-end"
            >
              <input
                type="text"
                placeholder="Search by symbol"
                on:input={(e) => debouncedSearch(e.currentTarget.value)}
                class="w-1/2 bg-sky-200/70 text-black border-none rounded-2xl min-w-[160px]"
              />
            </div>
          </div>

          <!-- Pool Table -->
          <div class="overflow-x-scroll">
            {#if $poolsLoading}
              <LoadingIndicator />
            {:else if $poolsError}
              <div class="text-center text-red-500 p-4">{$poolsError}</div>
            {:else}
              <table class="w-full text-black font-alumni">
                <!-- Table Headers -->
                <thead>
                  <tr class="border-b-4 border-black text-3xl uppercase">
                    {#each lpTableHeaders as header}
                      <TableHeader
                        label={$t(header.label)}
                        column={header.column}
                        textClass={header.textClass}
                        sortColumn={$sortColumnStore}
                        sortDirection={$sortDirectionStore}
                        on:sort={handleSortEvent}
                      />
                    {/each}
                  </tr>
                </thead>

                <!-- Table Body -->
                <tbody>
                  {#if !$poolsLoading && $filteredSortedPools.length === 0}
                    <tr class="border-b-2 border-black text-xl md:text-3xl">
                      <td
                        class="p-2 uppercase font-bold text-center"
                        colspan="50"
                      >
                        No results found
                      </td>
                    </tr>
                  {:else}
                    {#each $filteredSortedPools as pool (pool.id)}
                      <tr class="border-b-2 border-black text-xl md:text-3xl">
                        <!-- Pool row content -->
                        <td
                          class="uppercase font-bold cursor-pointer"
                          on:click={() => goto(`/stats/pools?id=${pool.id}`)}
                        >
                          <div class="flex items-center">
                            <div
                              class="isolate flex -space-x-3 overflow-hidden p-2 w-[5rem]"
                            >
                              <img
                                class="relative z-30 inline-block h-9 w-9 rounded-full ring-2 ring-sky-500 bg-white"
                                src={$tokenStore.tokens.find(
                                  (token) =>
                                    token.canister_id === pool.address_0,
                                )?.logo || "/tokens/not_verified.webp"}
                                alt={pool.symbol_0}
                              />
                              <img
                                class="relative z-20 inline-block h-9 w-9 rounded-full ring-2 ring-sky-500 bg-white"
                                src={$tokenStore.tokens.find(
                                  (token) =>
                                    token.canister_id === pool.address_1,
                                )?.logo || "/tokens/not_verified.webp"}
                                alt={pool.symbol_1}
                              />
                            </div>
                            <span>{pool.symbol_0}/{pool.symbol_1}</span>
                          </div>
                        </td>
                        <td class="p-2 text-right"
                          >${formatNumberCustom(pool.price.toString(), 2)}</td
                        >
                        <td class="p-2 text-right"
                          >${formatNumberCustom(pool.tvl.toString(), 2)}</td
                        >
                        <td class="p-2 text-right"
                          >${formatNumberCustom(
                            pool.rolling_24h_volume.toString(),
                            2,
                          )}</td
                        >
                        <td class="p-2 text-right"
                          >{formatNumberCustom(
                            pool.rolling_24h_apy.toString(),
                            2,
                          )}%</td
                        >
                        <td class="p-2 flex justify-center">
                          <div
                            class="flex flex-col content-center items-center justify-center gap-3.5"
                          >
                            <Tooltip
                              text={$t("stats.swap") +
                                " " +
                                pool.symbol_0 +
                                "/" +
                                pool.symbol_1}
                            >
                              <Button variant="green" size="small">
                                <ArrowLeftRight size={20} />
                              </Button>
                            </Tooltip>
                            <Tooltip
                              text={$t("stats.addLiquidity") +
                                " " +
                                pool.symbol_0 +
                                "/" +
                                pool.symbol_1}
                            >
                              <Button variant="green" size="small">
                                <Droplets size={20} />
                              </Button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    {/each}
                  {/if}
                </tbody>
              </table>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="w-1/12"></div>
</main>

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
