<!-- src/kong_svelte/src/routes/pools/+page.svelte -->
<script lang="ts">
  import { t } from "$lib/locales/translations";
  import { writable } from "svelte/store";
  import { formatUSD } from "$lib/utils/numberFormatUtils";
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import { lpTableHeaders } from "$lib/constants/statsConstants";
  import { filterPools, sortTableData } from "$lib/utils/statsUtils";
  import {
    poolsList,
    poolTotals,
    poolsLoading,
    poolsError,
  } from "$lib/stores/poolStore";
  import { derived } from "svelte/store";
  import { goto } from "$app/navigation";
  import { Droplets } from "lucide-svelte";
  import { tokenStore } from "$lib/stores/tokenStore";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import { flip } from "svelte/animate";
  import debounce from "lodash-es/debounce"; // Import debounce from lodash-es
  import { onMount } from "svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";

  onMount(async () => {
    await tokenStore.loadTokens();
  });

  /**
   * Derived store to create a token map for quick lookup.
   * Automatically updates when tokenStore changes.
   */
  tokenStore.loadTokens();
  const tokenMap = derived(tokenStore, ($tokenStore) => {
    const map = new Map<string, any>();
    $tokenStore.tokens.forEach((token) => {
      map.set(token.canister_id, token);
    });
    return map;
  });

  const searchQuery = writable("");

  // Use lodash-es debounce instead of custom debounce
  const debouncedSearch = debounce((value: string) => {
    searchQuery.set(value);
  }, 300);

  const sortColumnStore = writable("rolling_24h_volume");
  const sortDirectionStore = writable<"asc" | "desc">("desc");

  /**
   * Derived store that filters and sorts pools based on search query and sort criteria.
   */
  const filteredSortedPools = derived(
    [poolsList, searchQuery, sortColumnStore, sortDirectionStore],
    ([$pools, $searchQuery, $sortColumn, $sortDirection]) => {
      const filtered = filterPools($pools, $searchQuery);
      return sortTableData(filtered, $sortColumn, $sortDirection);
    },
  );

  /**
   * Handles sorting events triggered by TableHeader components.
   * @param {CustomEvent<{ column: string; direction: "asc" | "desc" }>} event
   */
  function handleSortEvent(
    event: CustomEvent<{ column: string; direction: "asc" | "desc" }>,
  ) {
    const { column, direction } = event.detail;
    sortColumnStore.set(column);
    sortDirectionStore.set(direction);
  }
</script>

<section class="flex min-h-[94vh] relative w-full justify-center">
  <!-- Main Content -->
  <div class="z-10 flex pt-40 justify-center w-11/12 md:w-100 px-2 md:px-0">
    <div class="flex flex-col w-full">
      <div
        class="inner-border bg-emerald-500 bg-opacity-40 backdrop-blur-md border-[5px] border-black p-0.5 w-full mx-auto"
      >
        <div class="p-4 w-full max-h-[68vh] overflow-y-auto pb-8">
          <!-- Header and Search Bar -->
          <div class="flex flex-col md:flex-row items-center mb-2 md:mb-0 pb-2">
            <!-- Invisible spacer for left side -->
            <div class="hidden md:block w-[200px]"></div>
            
            <!-- Centered title -->
            <div class="flex-1 flex justify-center">
              <h2 class="mt-2 font-bold text-3xl text-center text-white mb-4 text-outline-2">
                {$t("stats.poolsTableTitle")}
              </h2>
            </div>
            
            <!-- Search on right -->
            <div class="w-[200px] flex justify-end">
              <input
                type="text"
                placeholder="Search by symbol"
                on:input={(e) => debouncedSearch(e.currentTarget.value)}
                class="w-full bg-sky-200/30 placeholder:text-gray-600 font-alumni text-xl text-black border-none rounded-xl min-w-[160px] focus:ring-green-700 focus:ring-2 p-2.5"
                aria-label="Search Pools by Symbol"
              />
            </div>
          </div>

          <!-- Table Container -->
          <div class="overflow-x-scroll">
            {#if $poolsLoading}
              <LoadingIndicator />
            {:else if $poolsError}
              <div class="text-center text-red-500 p-4">{$poolsError}</div>
            {:else}
              <table class="w-full text-black font-alumni">
                <thead>
                  <tr class="border-b-4 border-black text-3xl uppercase">
                    {#each lpTableHeaders as header}
                      <TableHeader
                        label={$t(header.label)}
                        column={header.column}
                        textClass={header.textClass}
                        requiresAuth={header.requiresAuth}
                        sortColumn={$sortColumnStore}
                        sortDirection={$sortDirectionStore}
                        on:sort={handleSortEvent}
                      />
                    {/each}
                  </tr>
                </thead>

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
                      <tr
                        class="border-b-2 border-black text-xl md:text-3xl cursor-pointer !h-[4.75rem]"
                        animate:flip={{ duration: 300 }}
                        tabindex="0"
                        aria-label={`View details for pool ${pool.symbol_0}/${pool.symbol_1}`}
                      >
                        <td
                          class="uppercase font-bold pl-2 focused:ring-0 ring-0 focused:border-none active:border-none"
                        >
                          <div class="flex items-center">
                            <TokenImages
                              tokens={[$tokenMap.get(pool.address_0), $tokenMap.get(pool.address_1)]}
                              containerClass="mr-2.5"
                            />
                            <span>{pool.symbol_0}/{pool.symbol_1}</span>
                            {#if pool.is_hot}
                              <span class="flex items-center text-xs">
                                <span class="text-xs mr-0.5">🔥</span> HOT
                              </span>
                            {/if}
                          </div>
                        </td>
                        <td class="p-2 text-right">
                          ${formatUSD(pool.price)}
                        </td>
                        <td class="p-2 text-right">
                          ${formatUSD(pool.tvl)}
                        </td>
                        <td class="p-2 text-right">
                          ${formatUSD(pool.rolling_24h_volume)}
                        </td>
                        <td class="p-2 text-right">
                          {formatUSD(pool.rolling_24h_apy)}%
                        </td>
                        <td class="p-2">
                          <div
                            class="flex content-center items-center justify-center gap-x-1"
                          >
                            <button
                              class="rounded-full text-nowrap bg-[#6ebd40] border-2 border-black px-2 py-1 flex items-center justify-center text-xl hover:bg-[#498625] hover:text-white"
                              on:click={() =>
                                goto(
                                  `/pools/add?token0=${pool.address_0}&token1=${pool.address_1}`,
                                )}
                            >
                              <Droplets size={18} class="mr-1" /> Add LP
                            </button>
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
</section>

<style scoped>
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

  tr {
    transition:
      background-color 0.3s ease,
      transform 0.3s ease;
  }

  tbody tr:hover {
    background-image: linear-gradient(
      to right,
      rgba(27, 224, 99, 0.5),
      rgba(255, 225, 0, 0.509)
    );
  }

  /* Accessibility Enhancements */
  tr:focus {
    outline: 2px solid #3b82f6; /* Tailwind blue-500 */
    outline-offset: -2px;
  }
</style>
