<!-- src/kong_svelte/src/routes/stats/+page.svelte -->
<script lang="ts">
  import { writable, derived } from "svelte/store";
  import { t } from "$lib/services/translations";
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import { tokensTableHeaders } from "$lib/constants/statsConstants";
  import { filterTokens, sortTableData } from "$lib/utils/statsUtils";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import { flip } from "svelte/animate";
  import debounce from "lodash-es/debounce";
  import { formatTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { poolStore } from "$lib/services/pools/poolStore";
  import { walletStore } from "$lib/services/wallet/walletStore";
  import Clouds from "$lib/components/stats/Clouds.svelte";
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";

  const searchQuery = writable("");
  const copyStates = writable<Record<string, string>>({});

  const debouncedSearch = debounce((value: string) => {
    searchQuery.set(value);
  }, 300);

  const sortColumnStore = writable("formattedUsdValue");
  const sortDirectionStore = writable<"asc" | "desc">("desc");

  // Loading state
  const tokensLoading = derived(
    [tokenStore, poolStore, formattedTokens],
    ([$tokenStore, $poolStore, $formattedTokens]) => 
      $tokenStore.isLoading || 
      $poolStore.isLoading || 
      !$formattedTokens?.length
  );

  // Error state with null check
  const tokensError = derived(
    [tokenStore, poolStore],
    ([$tokenStore, $poolStore]) => $tokenStore.error || $poolStore.error
  );

  // Modified filtered tokens store to handle undefined or null values
  const filteredSortedTokens = derived(
    [formattedTokens, searchQuery, sortColumnStore, sortDirectionStore],
    ([$formattedTokens, $searchQuery, $sortColumn, $sortDirection]) => {
      if (!$formattedTokens) return [];

      const filtered = filterTokens($formattedTokens, $searchQuery);
      return sortTableData(filtered, $sortColumn, $sortDirection);
    }
  );

  // Function to copy text to clipboard
  function copyToClipboard(tokenId: string) {
    navigator.clipboard.writeText(tokenId).then(
      () => {
        updateCopyState(tokenId, "Copied!");
      },
      (err) => {
        updateCopyState(tokenId, "Copy Failed!");
      }
    );
  }

  // Update the copy state for a specific token
  function updateCopyState(tokenId: string, text: string) {
    copyStates.update(states => {
      return { ...states, [tokenId]: text };
    });
    setTimeout(() => {
      copyStates.update(states => {
        return { ...states, [tokenId]: "Copy" };
      });
    }, 1000);
  }
</script>

<Clouds />
<section class="flex min-h-[94vh] relative w-full justify-center">
  <!-- Main Content -->
  <div class="z-10 flex pt-10 justify-center w-full md:w-100 px-2 md:px-0 max-w-5xl">
    <div class="flex flex-col w-full">
      <div
        class="inner-border bg-k-light-blue bg-opacity-40 backdrop-blur-md border-[5px] border-black p-0.5 w-full mx-auto"
      >
        <div class="p-4 w-full max-h-[68vh] overflow-y-auto pb-8">
          <!-- Header and Search Bar -->
          <div class="grid grid-cols-3 items-center mb-2 md:mb-0 pb-2">
            <h2
              class="pl-1 mt-2 font-black col-span-3 md:col-span-2 text-3xl text-center md:text-left text-white mb-4 text-outline-2"
            >
              {$t("stats.statsTableTitle")}
            </h2>

            <div
              class="col-span-3 md:col-span-1 flex justify-center md:justify-end"
            >
              <input
                type="text"
                placeholder="Search by symbol or name"
                on:input={(e) => debouncedSearch(e.currentTarget.value)}
                class="w-1/2 bg-sky-200/30 placeholder:text-gray-600 font-alumni text-xl text-black border-none rounded-xl min-w-[160px] focus:ring-green-700 focus:ring-2 p-2.5"
                aria-label="Search Tokens by Symbol or Name"
              />
            </div>
          </div>

          <!-- Table Container -->
          <div class="overflow-x-scroll">
            {#if $tokensError}
              <div class="text-center text-red-500 p-4">{$tokensError}</div>
            {:else}
              <table class="w-full text-black font-alumni">
                <thead>
                  <tr class="border-b-4 border-black text-3xl uppercase">
                    {#each tokensTableHeaders as header}
                      <TableHeader
                        label={header.label}
                        column={header.column}
                        textClass={header.textClass}
                        requiresAuth={header.requiresAuth}
                        sortColumn={$sortColumnStore}
                        sortDirection={$sortDirectionStore}
                        onsort={({ column, direction }) => {
                          sortColumnStore.set(column);
                          sortDirectionStore.set(direction);
                        }}
                      />
                    {/each}
                  </tr>
                </thead>

                <tbody>
                  {#if $filteredSortedTokens && $filteredSortedTokens.length > 0}
                    {#each $filteredSortedTokens as token, index (token.canister_id + '-' + token.symbol + '-' + index)}
                      <tr
                        class="border-b-2 border-black text-xl md:text-3xl cursor-pointer !h-[4.75rem]"
                        animate:flip={{ duration: 300 }}
                        tabindex="0"
                        aria-label={`View details for token ${token.symbol || 'Unknown'}`}
                      >
                        <td class="uppercase font-bold pl-2 focused:ring-0 ring-0 focused:border-none active:border-none">
                          <div class="flex items-center">
                            {#if token}
                              <TokenImages
                                tokens={[token]}
                                containerClass="mr-2.5"
                              />
                              <div class="flex flex-col">
                                <span>{token.symbol || 'Unknown'}</span>
                                <div class="flex items-center font-mono text-xs">
                                  <span class="text-sm font-normal">{token.canister_id || 'N/A'}</span>
                                  <button
                                    class="ml-2 text-xs bg-blue-200/60 hover:bg-yellow-400/90 font-mono rounded px-1"
                                    on:click={(e) => {
                                      e.stopPropagation();
                                      if (token.canister_id) copyToClipboard(token.canister_id);
                                    }}
                                    aria-label="Copy Canister ID"
                                  >
                                    {$copyStates[token.canister_id] || "Copy"}
                                  </button>
                                </div>
                              </div>
                            {/if}
                          </div>
                        </td>
                        <td class="p-2 text-right">${formatToNonZeroDecimal($tokenStore.prices[token.canister_id] || 0)}</td>
                        <td class="p-2 text-right">
                          ${formatToNonZeroDecimal(formatTokenAmount(token.total_24h_volume || 0n, 6))}
                        </td>
                        {#if $walletStore.isConnected}
                          <td class="p-2 text-right">
                            <div class="flex flex-col items-end justify-center">
                              <span class="text-2xl">
                                {formatToNonZeroDecimal(token?.formattedBalance || '0')} {token?.symbol || ''}
                              </span>
                              <span class="text-sm">(${token?.formattedUsdValue || '0'})</span>
                            </div>
                          </td>
                        {/if}
                      </tr>
                    {/each}
  
                  {/if}

                  {#if $tokensLoading && !$filteredSortedTokens.length}
                    <!-- Display skeleton loaders or placeholders -->
                    {#each Array(10) as _, index}
                      <tr class="border-b-2 border-black text-xl md:text-3xl animate-pulse">
                        <td class="p-2">
                          <div class="h-4 bg-gray-300 rounded w-3/4"></div>
                        </td>
                        <td class="p-2">
                          <div class="h-4 bg-gray-300 rounded"></div>
                        </td>
                        <td class="p-2">
                          <div class="h-4 bg-gray-300 rounded"></div>
                        </td>
                        <!-- Add more cells as needed -->
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

<div class="absolute bottom-0 left-0 w-full h-[10vh] bg-gradient-to-t from-transparent to-white">
  <img src="/backgrounds/grass.webp" class="w-full h-full object-cover" />
</div>

<style scoped>
  .inner-border {
    box-shadow: inset 0 0 0 2px white;
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
