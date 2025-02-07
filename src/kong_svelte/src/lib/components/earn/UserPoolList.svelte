<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { liveUserPools } from "$lib/services/pools/poolStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { ChevronDown, Plus, Minus } from "lucide-svelte";
  import UserPool from "$lib/components/liquidity/pools/UserPool.svelte";
  import { livePools } from "$lib/services/pools/poolStore";
  import { onMount, tick } from "svelte";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";

  export let searchQuery = "";

  let loading = true;
  let processedPools: any[] = [];
  let error: string | null = null;
  let expandedPoolId: string | null = null;
  let selectedPool: any = null;
  let showUserPoolModal = false;
  let tokens: Record<string, FE.Token> = {};
  let poolsLoading = true;  // Track pools loading state
  let tokensLoading = false;  // Track tokens loading state

  // Helper computed value to determine overall loading state
  $: loading = poolsLoading || tokensLoading;

  function createSearchableText(
    poolBalance: any,
    token0?: FE.Token,
    token1?: FE.Token,
  ): string {
    return [
      poolBalance.symbol_0,
      poolBalance.symbol_1,
      `${poolBalance.symbol_0}/${poolBalance.symbol_1}`,
      poolBalance.name || "",
      token0?.name || "",
      token1?.name || "",
      token0?.canister_id || "",
      token1?.canister_id || "",
    ]
      .join(" ")
      .toLowerCase();
  }

  // Process pool balances when they update
  $: {
    if (Array.isArray($liveUserPools)) {
      processedPools = $liveUserPools
        .filter((poolBalance) => Number(poolBalance.balance) > 0)
        .map((poolBalance) => {
          const token0 = tokens[poolBalance.address_0];
          const token1 = tokens[poolBalance.address_1];
          const matchingPool = $livePools.find(
            (p) => p.address_0 === poolBalance.address_0 && p.address_1 === poolBalance.address_1
          );

          return {
            id: poolBalance.name,
            name: poolBalance.name,
            symbol: poolBalance.symbol,
            symbol_0: poolBalance.symbol_0,
            symbol_1: poolBalance.symbol_1,
            balance: poolBalance.balance,
            amount_0: poolBalance.amount_0,
            amount_1: poolBalance.amount_1,
            usd_balance: poolBalance.usd_balance,
            address_0: poolBalance.address_0,
            address_1: poolBalance.address_1,
            token0,
            token1,
            searchableText: createSearchableText(poolBalance, token0, token1)
          };
        });
      poolsLoading = false;  // Mark pools as loaded once we process them
    }
  }

  // Add an onMount block to fetch tokens after component hydration
  onMount(async () => {
    await tick();
    if ($liveUserPools && Array.isArray($liveUserPools) && $liveUserPools.length > 0) {
      fetchTokensForPools($liveUserPools);
    }
  });

  async function fetchTokensForPools(pools: any[]) {
    if (pools.length === 0) return;  // Don't fetch if no pools
    
    try {
      tokensLoading = true;
      const tokenIds = [...new Set(pools.flatMap(pool => [pool.address_0, pool.address_1]))];
      const fetchedTokens = await fetchTokensByCanisterId(tokenIds);
      tokens = fetchedTokens.reduce((acc, token) => {
        acc[token.canister_id] = token;
        return acc;
      }, {} as Record<string, FE.Token>);
    } catch (e) {
      error = "Failed to load token information";
      console.error("Error fetching tokens:", e);
    } finally {
      tokensLoading = false;
    }
  }

  // Filter pools based on search
  $: filteredPools = processedPools
    .filter(
      (pool) =>
        !searchQuery || pool.searchableText.includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => Number(b.usd_balance) - Number(a.usd_balance));

  function handlePoolItemClick(pool: any) {
    if (expandedPoolId === pool.id) {
      expandedPoolId = null;
    } else {
      selectedPool = pool;
      showUserPoolModal = true;
    }
  }

  function handleLiquidityRemoved() {
    showUserPoolModal = false;
    selectedPool = null;
  }
</script>

<div class="mt-2">
  {#if loading}
    <div class="loading-state" in:fade>
      <p class="text-center text-lg font-medium">Loading positions...</p>
    </div>
  {:else if error}
    <div class="error-state" in:fade>
      <p class="text-center text-lg font-medium">{error}</p>
    </div>
  {:else if filteredPools.length === 0 && !loading}
    <div class="empty-state" in:fade>
      {#if searchQuery}
        <p class="text-center text-lg font-medium">
          No pools found matching "{searchQuery}"
        </p>
      {:else}
        <p class="text-center text-lg font-medium">No active positions</p>
      {/if}
    </div>
  {:else}
    <div class="pools-grid">
      {#each processedPools as pool (pool.id)}
        <div in:slide={{ duration: 200 }}>
          <div
            class="group rounded-lg border border-kong-border bg-kong-bg-dark/30 backdrop-blur-lg p-3.5 shadow-sm hover:shadow-md transition-all"
            class:expanded={expandedPoolId === pool.id}
            on:click={() => handlePoolItemClick(pool)}
            on:keydown={(e) => e.key === "Enter" && handlePoolItemClick(pool)}
            role="button"
            tabindex="0"
          >
            <!-- Card Header -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="relative">
                    <TokenImages
                      tokens={[pool.token0, pool.token1]}
                      size={36}
                    />
                  </div>
                  <div>
                    <h3
                      class="text-base font-semibold text-kong-text-primary/95"
                    >
                      {pool.symbol_0}/{pool.symbol_1}
                    </h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400">
                      {Number(pool.balance).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8,
                      })} LP
                    </p>
                  </div>
                </div>
                <p class="text-sm font-semibold text-kong-text-primary/95">
                  ${formatToNonZeroDecimal(pool.usd_balance)}
                </p>
              </div>
            </div>

            <!-- Expanded Content -->
            {#if expandedPoolId === pool.id}
              <div
                class="mt-3 pt-3 border-t border-kong-border dark:border-kong-border"
                transition:slide={{ duration: 200 }}
              >
                <div class="space-y-3">
                  <!-- Pool ID -->
                  <div class="flex items-center justify-between">
                    <span
                      class="text-xs font-medium text-slate-500 dark:text-slate-400"
                      >Pool ID</span
                    >
                    <code
                      class="px-1.5 py-0.5 text-xs font-medium bg-slate-100 dark:bg-kong-bg-light rounded"
                    >
                      {pool.id.slice(0, 8)}...{pool.id.slice(-6)}
                    </code>
                  </div>

                  <!-- Token Details -->
                  <div class="space-y-2">
                    {#each [
                      { symbol: pool.symbol_0, amount: pool.amount_0, token: pool.token0 },
                      { symbol: pool.symbol_1, amount: pool.amount_1, token: pool.token1 }
                    ] as tokenInfo}
                      <div
                        class="flex items-center justify-between p-2.5 rounded-md border border-kong-border dark:border-slate-700/50 bg-slate-50/50 dark:bg-kong-bg-light"
                      >
                        <div class="flex items-center gap-2.5">
                          <TokenImages
                            tokens={[tokenInfo.token]}
                            size={24}
                          />
                          <div>
                            <p
                              class="text-sm font-medium text-kong-text-primary/20 text-kong-text-primary"
                            >
                              {tokenInfo.symbol}
                            </p>
                            <p
                              class="text-xs text-slate-500 dark:text-slate-400"
                            >
                              {Number(tokenInfo.amount).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <p
                          class="text-sm font-medium text-blue-600 dark:text-blue-400"
                        >
                          ${formatToNonZeroDecimal(Number(tokenInfo.amount) * 1.5)}
                        </p>
                      </div>
                    {/each}
                  </div>

                  <!-- Actions -->
                  <div class="flex justify-end gap-2 pt-1">
                    <!-- Add LP Button -->
                    <button
                      class="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-kong-text-primary/20 hover:bg-kong-border dark:bg-kong-bg-light text-kong-text-primary dark:hover:bg-slate-700 transition-colors"
                      on:click|stopPropagation={() => {
                        // Add LP logic here
                      }}
                    >
                      <Plus size={14} />
                      <span>Add LP</span>
                    </button>

                    <!-- Remove LP Button -->
                    <button
                      class="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-kong-text-primary/20 hover:bg-kong-border dark:bg-kong-bg-light text-kong-text-primary dark:hover:bg-slate-700 transition-colors"
                      on:click|stopPropagation={() => {
                        // Remove LP logic here
                      }}
                    >
                      <Minus size={14} />
                      <span>Remove LP</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if selectedPool}
  <UserPool
    pool={selectedPool}
    bind:showModal={showUserPoolModal}
    on:liquidityRemoved={handleLiquidityRemoved}
  />
{/if}

<style lang="postcss">
  .pools-grid {
    @apply grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4;
  }

  :global(.expanded) {
    @apply ring-1 ring-kong-border dark:ring-kong-border shadow-md;
  }

  .loading-state,
  .error-state,
  .empty-state {
    @apply flex items-center justify-center
           h-40
           rounded-lg
           text-kong-text-primary/80 dark:text-slate-50
           border border-kong-border dark:border-kong-border
           shadow-sm;
  }

  .error-state {
    @apply text-red-600
           border-red-200 dark:border-red-900/50
           bg-red-50/90 dark:bg-red-950/20;
  }
</style>
