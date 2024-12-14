<script lang="ts">
  import { writable, derived } from "svelte/store";
  import { poolsList } from "$lib/services/pools/poolStore";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import PoolRow from "$lib/components/liquidity/pools/PoolRow.svelte";
  import { goto } from "$app/navigation";
  import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-svelte";
  import PoolDetails from "$lib/components/liquidity/pools/PoolDetails.svelte";
  import { auth } from "$lib/services/auth";
  import { userPoolBalances } from "$lib/services/pools/poolStore";
  import UserPool from "$lib/components/liquidity/pools/UserPool.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import PoolList from "$lib/components/sidebar/PoolList.svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

  // Navigation state
  const activePoolView = writable("all"); // "all" or "user"

  // Modal state
  let showPoolDetails = false;
  let selectedPool = null;
  let selectedUserPool = null;

  // Sort state
  const sortColumn = writable("rolling_24h_volume");
  const sortDirection = writable<"asc" | "desc">("desc");

  let searchTerm = "";
  let searchDebounceTimer: NodeJS.Timeout;
  let debouncedSearchTerm = "";

  // Memoize token map
  const tokenMap = derived(formattedTokens, ($tokens) => {
    const map = new Map();
    if ($tokens) {
      $tokens.forEach((token) => {
        map.set(token.canister_id, token);
      });
    }
    return map;
  });

  // Get count of pools with non-zero balance
  const activePoolCount = derived(userPoolBalances, ($balances) => {
    if (!Array.isArray($balances)) return 0;
    return $balances.filter((balance) => balance.balance > 0n).length;
  });

  function handleAddLiquidity(token0: string, token1: string) {
    goto(`/earn/add?token0=${token0}&token1=${token1}`);
  }

  function handleShowDetails(pool: BE.Pool) {
    selectedPool = pool;
    showPoolDetails = true;
  }

  function handleSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchTerm = searchTerm.trim().toLowerCase();
    }, 300);
  }

  // Search and filter functionality
  $: filteredPools = $poolsList.filter((pool) => {
    if (!debouncedSearchTerm) return true;

    const token0 = $tokenMap.get(pool.address_0);
    const token1 = $tokenMap.get(pool.address_1);

    const searchMatches = [
      pool.symbol_0.toLowerCase(),
      pool.symbol_1.toLowerCase(),
      `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase(),
      `${pool.symbol_1}/${pool.symbol_0}`.toLowerCase(),
      pool.address_0?.toLowerCase() || "",
      pool.address_1?.toLowerCase() || "",
      token0?.name?.toLowerCase() || "",
      token1?.name?.toLowerCase() || "",
    ];

    return searchMatches.some((match) => match.includes(debouncedSearchTerm));
  });

  function toggleSort(column: string) {
    if ($sortColumn === column) {
      sortDirection.update((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      sortColumn.set(column);
      sortDirection.set("asc");
    }
  }

  function getSortIcon(column: string) {
    if ($sortColumn !== column) return ArrowUpDown;
    return $sortDirection === "asc" ? ArrowUp : ArrowDown;
  }

  $: sortedPools = [...filteredPools].sort((a, b) => {
    const direction = $sortDirection === "asc" ? 1 : -1;
    const column = $sortColumn;

    if (column === "rolling_24h_volume") {
      return (
        direction *
        (Number(a.rolling_24h_volume) - Number(b.rolling_24h_volume))
      );
    }
    if (column === "tvl") {
      return direction * (Number(a.tvl || 0) - Number(b.tvl || 0));
    }
    if (column === "rolling_24h_apy") {
      return (
        direction * (Number(a.rolling_24h_apy) - Number(b.rolling_24h_apy))
      );
    }
    if (column === "price") {
      return direction * (Number(a.price) - Number(b.price));
    }
    return 0;
  });

  function handlePoolClick(event) {
    const pool = event.detail;
    const fullPool = $poolsList.find(
      (p) =>
        p.symbol_0 === pool.symbol_0 &&
        p.symbol_1 === pool.symbol_1 &&
        p.pool_id,
    );
    if (fullPool && typeof fullPool.pool_id === "number") {
      selectedUserPool = fullPool;
    }
  }

  function getPriceChangeClass(change: number): string {
    if (change > 0) return "text-green-400";
    if (change < 0) return "text-red-400";
    return "text-gray-400";
  }
</script>

<Panel className="flex-1 my-4">
  <div class="h-full overflow-hidden flex flex-col">
    <!-- Common header for both views -->
    <div class="flex flex-col gap-3 sm:gap-0 mb-4 sticky top-0 z-10">
      <!-- Mobile-only buttons -->
      <div class="flex flex-col gap-3 sm:hidden">
        <div class="w-full">
          <div class="bg-[#1a1b23] border border-[#2a2d3d] rounded-lg w-full">
            <div class="flex items-center w-full">
              <div class="flex w-full border-r border-[#2a2d3d]">
                <button
                  class="px-4 py-2 w-1/2 transition-colors duration-200 {$activePoolView ===
                  'all'
                    ? 'text-white'
                    : 'text-[#8890a4] hover:text-white'}"
                  on:click={() => ($activePoolView = "all")}
                >
                  All Pools
                </button>
                <button
                  class="px-4 py-2 w-1/2 transition-colors duration-200 {$activePoolView ===
                  'user'
                    ? 'text-white'
                    : 'text-[#8890a4] hover:text-white'}"
                  on:click={() => ($activePoolView = "user")}
                >
                  Your Pools ({$activePoolCount})
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          class="w-full bg-[#1a1b23] border border-[#2a2d3d] rounded-lg px-4 py-2"
        >
          <input
            type="text"
            placeholder="Search pools..."
            class="w-full bg-transparent text-white placeholder-[#8890a4] focus:outline-none"
            bind:value={searchTerm}
            on:input={handleSearch}
          />
        </div>

        <button
          class="flex items-center gap-2 primary-button"
          on:click={() => goto("/earn/add")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Add Position</span>
        </button>
      </div>

      <div class="hidden sm:flex items-center gap-3">
        <div class="flex-1 bg-[#1a1b23] border border-[#2a2d3d] rounded-lg">
          <div class="flex items-center">
            <div class="flex border-r border-[#2a2d3d]">
              <button
                class="px-4 py-2 transition-colors duration-200 {$activePoolView ===
                'all'
                  ? 'text-white'
                  : 'text-[#8890a4] hover:text-white'}"
                on:click={() => ($activePoolView = "all")}
              >
                All Pools
              </button>
              <button
                class="px-4 py-2 transition-colors duration-200 {$activePoolView ===
                'user'
                  ? 'text-white'
                  : 'text-[#8890a4] hover:text-white'}"
                on:click={() => ($activePoolView = "user")}
              >
                Your Pools ({$activePoolCount})
              </button>
            </div>

            <div class="flex-1 px-4 py-2">
              <input
                type="text"
                placeholder="Search pools..."
                class="w-full bg-transparent text-white placeholder-[#8890a4] focus:outline-none"
                bind:value={searchTerm}
                on:input={handleSearch}
              />
            </div>
          </div>
        </div>

        <button
          class="flex items-center gap-2 primary-button whitespace-nowrap"
          on:click={() => goto("/earn/add")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Add Position</span>
        </button>
      </div>
    </div>

    <div class="overflow-auto flex-1">
      {#if $activePoolView === "all"}
        <!-- All Pools View -->
        <div class="overflow-auto flex-1">
          <!-- Desktop Table View -->
          <table class="w-full hidden lg:table">
            <thead>
              <tr>
                <th class="text-left w-1/4">Pool</th>
                <th
                  class="text-right cursor-pointer w-1/6"
                  on:click={() => toggleSort("price")}
                >
                  Price
                  <svelte:component
                    this={getSortIcon("price")}
                    class="inline w-4 h-4 ml-1"
                  />
                </th>
                <th
                  class="text-right cursor-pointer w-1/6"
                  on:click={() => toggleSort("tvl")}
                >
                  TVL
                  <svelte:component
                    this={getSortIcon("tvl")}
                    class="inline w-4 h-4 ml-1"
                  />
                </th>
                <th
                  class="text-right cursor-pointer w-1/6"
                  on:click={() => toggleSort("rolling_24h_volume")}
                >
                  Volume 24H
                  <svelte:component
                    this={getSortIcon("rolling_24h_volume")}
                    class="inline w-4 h-4 ml-1"
                  />
                </th>
                <th
                  class="text-right cursor-pointer w-1/6"
                  on:click={() => toggleSort("rolling_24h_apy")}
                >
                  APY
                  <svelte:component
                    this={getSortIcon("rolling_24h_apy")}
                    class="inline w-4 h-4 ml-1"
                  />
                </th>
                <th class="text-right w-1/12">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each sortedPools as pool, i (pool.address_0 + pool.address_1)}
                <PoolRow
                  pool={{...pool, tvl: Number(pool.tvl)}}
                  tokenMap={$tokenMap}
                  isEven={i % 2 === 0}
                  onAddLiquidity={handleAddLiquidity}
                  onShowDetails={() => handleShowDetails(pool)}
                />
              {/each}
            </tbody>
          </table>

          <!-- Mobile/Tablet Card View -->
          <div class="lg:hidden space-y-3">
            <!-- Sort Controls for Mobile -->
            <div
              class="flex flex-col gap-2 bg-[#1a1b23] rounded-lg border border-[#2a2d3d] p-3"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <select
                    bind:value={$sortColumn}
                    class="bg-[#2a2d3d] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="rolling_24h_volume">Volume 24H</option>
                    <option value="tvl">TVL</option>
                    <option value="rolling_24h_apy">APY</option>
                    <option value="price">Price</option>
                  </select>
                  <button
                    on:click={() =>
                      sortDirection.update((d) =>
                        d === "asc" ? "desc" : "asc",
                      )}
                    class="bg-[#2a2d3d] p-2 rounded-lg"
                  >
                    <svelte:component
                      this={$sortDirection === "asc" ? ArrowUp : ArrowDown}
                      class="w-4 h-4 text-white"
                    />
                  </button>
                </div>
              </div>
            </div>

            {#each sortedPools as pool}
              <div
                class="bg-[#1a1b23] p-3 rounded-lg border border-[#2a2d3d] hover:border-blue-500/30 transition-all duration-200"
              >
                <div class="flex items-center justify-between mb-3 gap-4">
                  <div class="flex items-center gap-2">
                    <TokenImages
                      tokens={[
                        $tokenMap.get(pool.address_0),
                        $tokenMap.get(pool.address_1),
                      ]}
                      size={28}
                      overlap={true}
                    />
                    <div class="font-medium text-white">
                      {pool.symbol_0}/{pool.symbol_1}
                    </div>
                  </div>
                  <button
                    on:click={() => handleShowDetails(pool)}
                    class="primary-button !py-1.5 !px-2 w-1/2"
                  >
                    Details
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div class="bg-[#2a2d3d]/50 p-2 rounded-lg">
                    <div class="text-xs text-[#8890a4]">Price</div>
                    <div class="text-sm font-medium text-white">
                      ${Number(pool.price) < 0.01
                        ? Number(pool.price).toFixed(6)
                        : Number(pool.price).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                    </div>
                  </div>
                  <div class="bg-[#2a2d3d]/50 p-2 rounded-lg">
                    <div class="text-xs text-[#8890a4]">TVL</div>
                    <div class="text-sm font-medium text-white">
                      {formatUsdValue(Number(pool.tvl)) || "0.00"}
                    </div>
                  </div>
                  <div class="bg-[#2a2d3d]/50 p-2 rounded-lg">
                    <div class="text-xs text-[#8890a4]">Volume 24H</div>
                    <div class="text-sm font-medium text-white">
                      {formatUsdValue(Number(pool.rolling_24h_volume) / 1e6) ||
                        "0.00"}
                    </div>
                  </div>
                  <div class="bg-[#2a2d3d]/50 p-2 rounded-lg">
                    <div class="text-xs text-[#8890a4]">APY</div>
                    <div class="text-sm font-medium text-white">
                      {Number(pool.rolling_24h_apy).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <!-- User Pools View -->
        {#if $auth.isConnected}
          <div class="h-full">
            <PoolList
              on:poolClick={handlePoolClick}
              initialSearch={debouncedSearchTerm}
            />
          </div>
        {:else}
          <div
            class="flex flex-col items-center justify-center h-64 text-center"
          >
            <p class="text-gray-400 mb-4">
              Connect your wallet to view your liquidity positions
            </p>
            <button
              class="px-6 py-2 bg-[#60A5FA] text-white rounded-lg hover:bg-[#60A5FA]/90 transition-colors duration-200"
              on:click={() => {
                // TODO: Show connect wallet modal
                console.log("Show connect wallet modal");
              }}
            >
              Connect Wallet
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</Panel>

{#if showPoolDetails && selectedPool}
  <PoolDetails
    pool={selectedPool}
    tokenMap={$tokenMap}
    showModal={showPoolDetails}
    positions={[]}
    onClose={() => {
      showPoolDetails = false;
      selectedPool = null;
    }}
  />
{/if}

{#if selectedUserPool}
  <Modal
    isOpen={!!selectedUserPool}
    title={`${selectedUserPool.symbol_0}/${selectedUserPool.symbol_1} Pool Details`}
    onClose={() => (selectedUserPool = null)}
    width="max-w-2xl"
  >
    <UserPool
      pool={selectedUserPool}
      showModal={!!selectedUserPool}
      on:close={() => (selectedUserPool = null)}
    />
  </Modal>
{/if}

<style>
  /* Add these new styles */
  table th {
    padding: 1rem 0.5rem;
    color: #8890a4;
    font-weight: 500;
    font-size: 0.875rem;
  }

  table th:first-child {
    padding-left: 1rem;
  }

  table th:last-child {
    padding-right: 1rem;
  }

  .price-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }

  .price-value {
    color: white;
    font-weight: 500;
    font-size: 1rem;
  }
</style>
