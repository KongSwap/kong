<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { liveUserPools } from "$lib/services/pools/poolStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { liveTokens } from "$lib/services/tokens/tokenStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { ChevronDown, Plus, Minus } from "lucide-svelte";

  export let searchQuery = "";

  let loading = true;
  let processedPools: any[] = [];
  let error: string | null = null;
  let expandedPoolId: string | null = null;

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
          const token0 = $liveTokens.find(
            (t) => t.symbol === poolBalance.symbol_0,
          );
          const token1 = $liveTokens.find(
            (t) => t.symbol === poolBalance.symbol_1,
          );

          return {
            id: poolBalance.name,
            name: poolBalance.name,
            symbol: poolBalance.symbol,
            symbol_0: poolBalance.symbol_0,
            symbol_1: poolBalance.symbol_1,
            balance: poolBalance.balance.toString(),
            amount_0: poolBalance.amount_0,
            amount_1: poolBalance.amount_1,
            usd_balance: poolBalance.usd_balance,
            address_0: poolBalance.symbol_0,
            address_1: poolBalance.symbol_1,
            searchableText: createSearchableText(poolBalance, token0, token1),
          };
        });
    } else {
      processedPools = [];
    }
    loading = false;
  }

  // Filter pools based on search
  $: filteredPools = processedPools
    .filter(
      (pool) =>
        !searchQuery || pool.searchableText.includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => Number(b.usd_balance) - Number(a.usd_balance));

  function handlePoolItemClick(pool: any) {
    expandedPoolId = expandedPoolId === pool.id ? null : pool.id;
  }
</script>

<div class="mt-2">
  {#if loading && processedPools.length === 0}
    <div class="loading-state" in:fade>
      <p class="text-center text-lg font-medium">Loading positions...</p>
    </div>
  {:else if error}
    <div class="error-state" in:fade>
      <p class="text-center text-lg font-medium">{error}</p>
    </div>
  {:else if filteredPools.length === 0}
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
      {#each filteredPools as pool (pool.id)}
        <div class="pool-container" in:slide={{ duration: 200 }}>
          <div
            class="group rounded-lg border border-kong-border dark:border-kong-border bg-white/90 dark:bg-kong-bg-dark/40 backdrop-blur-lg p-3.5 shadow-sm hover:shadow-md transition-all"
            class:expanded={expandedPoolId === pool.id}
            on:click={() => handlePoolItemClick(pool)}
            on:keydown={(e) => e.key === "Enter" && handlePoolItemClick(pool)}
            role="button"
            tabindex="0"
          >
            <!-- Card Header -->
            <div class="space-y-3">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="relative">
                    <TokenImages
                      tokens={[
                        $liveTokens.find((t) => t.symbol === pool.symbol_0),
                        $liveTokens.find((t) => t.symbol === pool.symbol_1),
                      ]}
                      size={36}
                    />
                  </div>
                  <div>
                    <h3
                      class="text-base font-semibold text-slate-900 dark:text-slate-100"
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
                <ChevronDown
                  size={16}
                  class={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
                    expandedPoolId === pool.id ? "rotate-180" : ""
                  }`}
                />
              </div>

              <!-- Stats Row -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <p
                    class="text-xs font-medium text-slate-500 dark:text-slate-400"
                  >
                    Share
                  </p>
                  <p
                    class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                  >
                    {(Number(pool.balance) / 100).toFixed(2)}%
                  </p>
                </div>
                <div class="text-right">
                  <p
                    class="text-xs font-medium text-slate-500 dark:text-slate-400"
                  >
                    Value
                  </p>
                  <p
                    class="text-sm font-semibold text-slate-900 dark:text-slate-100"
                  >
                    ${formatToNonZeroDecimal(pool.usd_balance)}
                  </p>
                </div>
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
                    {#each [{ symbol: pool.symbol_0, amount: pool.amount_0 }, { symbol: pool.symbol_1, amount: pool.amount_1 }] as token}
                      <div
                        class="flex items-center justify-between p-2.5 rounded-md border border-kong-border dark:border-slate-700/50 bg-slate-50/50 dark:bg-kong-bg-light"
                      >
                        <div class="flex items-center gap-2.5">
                          <TokenImages
                            tokens={[
                              $liveTokens.find(
                                (t) => t.symbol === token.symbol,
                              ),
                            ]}
                            size={24}
                          />
                          <div>
                            <p
                              class="text-sm font-medium text-slate-900 dark:text-slate-100"
                            >
                              {token.symbol}
                            </p>
                            <p
                              class="text-xs text-slate-500 dark:text-slate-400"
                            >
                              {Number(token.amount).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <p
                          class="text-sm font-medium text-blue-600 dark:text-blue-400"
                        >
                          ${formatToNonZeroDecimal(Number(token.amount) * 1.5)}
                        </p>
                      </div>
                    {/each}
                  </div>

                  <!-- Share Info -->
                  <div
                    class="flex items-center justify-between p-2.5 rounded-md bg-slate-50/50 dark:bg-kong-bg-light"
                  >
                    <span
                      class="text-xs font-medium text-slate-500 dark:text-slate-400"
                      >Pool Share</span
                    >
                    <span
                      class="text-sm font-medium text-slate-900 dark:text-slate-100"
                    >
                      {(Number(pool.balance) / 100).toFixed(4)}%
                    </span>
                  </div>

                  <!-- Actions -->
                  <div class="flex justify-end gap-2 pt-1">
                    <!-- Add LP Button -->
                    <button
                      class="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-kong-border dark:bg-kong-bg-light dark:text-slate-100 dark:hover:bg-slate-700 transition-colors"
                      on:click|stopPropagation={() => {
                        // Add LP logic here
                      }}
                    >
                      <Plus size={14} />
                      <span>Add LP</span>
                    </button>

                    <!-- Remove LP Button -->
                    <button
                      class="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-kong-border dark:bg-kong-bg-light dark:text-slate-100 dark:hover:bg-slate-700 transition-colors"
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
           bg-white/90 dark:bg-kong-bg-dark/40 backdrop-blur-lg
           text-slate-900 dark:text-slate-50
           border border-kong-border dark:border-kong-border
           shadow-sm;
  }

  .error-state {
    @apply text-red-600
           border-red-200 dark:border-red-900/50
           bg-red-50/90 dark:bg-red-950/20;
  }
</style>
