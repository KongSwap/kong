<script lang="ts" context="module">
  export {};
</script>

<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import type { Pool } from "$lib/services/pools";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import { goto } from "$app/navigation";

  // Update the props type definition to use BE and FE namespaces directly
  const props = $props<{
    token: FE.Token;
    pools: BE.Pool[];
    userBalances: {
      balance: string;
      symbol_0: string;
      symbol_1: string;
    }[];
  }>();

  // Function to get paginated pools
  function getPaginatedPools(pools: BE.Pool[]): { pools: Pool[] } {
    if (!props.token) return { pools: [] };

    const filteredPools = pools
      .filter(
        (p) =>
          p.address_0 === props.token.canister_id ||
          p.address_1 === props.token.canister_id,
      )
      .sort((a, b) => Number(b.tvl) - Number(a.tvl))
      .map((p) => ({
        ...p,
        pool_id: String(p.pool_id),
        tvl: String(p.tvl),
        volume_24h: String(p.volume_24h),
        lp_token_supply: String(p.lp_token_supply),
      })) as unknown as Pool[];

    return {
      pools: filteredPools,
    };
  }

  // Add helper function to calculate pool share
  function calculatePoolShare(
    pool: Pool,
    userBalance:
      | {
          balance: string;
          symbol_0: string;
          symbol_1: string;
        }
      | undefined,
  ): string {
    if (!userBalance || !pool.lp_token_supply) return "0%";

    const userLPBalance = BigInt(userBalance.balance);
    const totalLPSupply = BigInt(pool.lp_token_supply);

    if (totalLPSupply === 0n) return "0%";

    const sharePercentage =
      Number((userLPBalance * 10000n) / totalLPSupply) / 100;
    return `${sharePercentage.toFixed(2)}%`;
  }
</script>

<Panel variant="blue" type="main" className="flex-1 md:w-1/2 !p-0">
  <div class="flex flex-col h-[600px] w-full">
    <div class="p-4 border-b border-slate-700/70">
      <h2 class="text-2xl font-semibold text-white/80">Token Pools</h2>
    </div>
    <div class="flex-1 overflow-y-auto">
      {#if !props.pools}
        <div class="flex flex-col items-center justify-center h-full text-center py-8">
          <div class="w-8 h-8 mb-4">
            <div class="loader"></div>
          </div>
          <div class="text-lg text-white/80 font-medium">Loading pools...</div>
          <div class="text-sm text-white/50 mt-1">Please wait while we fetch the pool data</div>
        </div>
      {:else}
        {@const paginatedData = getPaginatedPools(props.pools)}
        <div class="flex-1 overflow-y-auto">
          {#each paginatedData.pools as pool}
            <div
              class="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors duration-200 p-4"
            >
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  {#if $formattedTokens}
                    <TokenImages
                      imageWrapperClass="bg-gray-900 rounded-full"
                      tokens={[
                        props.token,
                        $formattedTokens.find(
                          (t) =>
                            t.canister_id ===
                            (pool.address_0 === props.token.canister_id
                              ? pool.address_1
                              : pool.address_0),
                        ),
                      ].filter((t): t is FE.Token => Boolean(t))}
                      size={32}
                      overlap={true}
                    />
                  {/if}
                  <div>
                    <div class="text-white font-medium">
                      {props.token.symbol} /
                      {$formattedTokens?.find(
                        (t) =>
                          t.canister_id ===
                          (pool.address_0 === props.token.canister_id
                            ? pool.address_1
                            : pool.address_0),
                      )?.symbol || "Unknown"}
                    </div>
                    <div class="text-xs text-slate-400">
                      Pool #{pool.pool_id}
                    </div>
                  </div>
                </div>
                <div class="hidden sm:flex gap-2">
                  <button
                    onclick={() =>
                      goto(
                        `/pool/add?token0=${pool.address_0}&token1=${pool.address_1}`,
                      )}
                    class="inline-block px-3 py-1.5 text-sm bg-purple-500/20 text-purple-400 rounded-full hover:bg-purple-500/30 transition-colors duration-200"
                  >
                    Add LP
                  </button>
                  <button
                    onclick={() =>
                      goto(`/swap?from=${pool.address_0}&to=${pool.address_1}`)}
                    class="inline-block px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/30 transition-colors duration-200"
                  >
                    Trade
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div class="text-slate-400 text-xs mb-1">TVL</div>
                  <div class="text-white font-medium">
                    {formatUsdValue(Number(Number(pool.tvl) / 1e6))}
                  </div>
                </div>
                <div>
                  <div class="text-slate-400 text-xs mb-1">24h Volume</div>
                  <div class="text-white font-medium">
                    {formatUsdValue(Number(pool.volume_24h / 1e6))}
                  </div>
                </div>
                <div>
                  <div class="text-slate-400 text-xs mb-1">APY</div>
                  <div class="text-white font-medium">{pool.apy}%</div>
                </div>
                <div>
                  <div class="text-slate-400 text-xs mb-1">My Share</div>
                  <div class="text-white font-medium">
                    {calculatePoolShare(
                      pool,
                      props.userBalances.find(
                        (b) =>
                          b.symbol_0 === pool.symbol_0 &&
                          b.symbol_1 === pool.symbol_1,
                      ),
                    )}
                  </div>
                </div>
              </div>
              <div class="mt-3 sm:hidden flex gap-2">
                <button
                  onclick={() =>
                    goto(`/swap?from=${pool.address_0}&to=${pool.address_1}`)}
                  class="flex-1 text-center px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/30 transition-colors duration-200"
                >
                  Trade
                </button>
                <button
                  onclick={() =>
                    goto(
                      `/pool/add?token0=${pool.address_0}&token1=${pool.address_1}`,
                    )}
                  class="flex-1 text-center px-3 py-1.5 text-sm bg-purple-500/20 text-purple-400 rounded-full hover:bg-purple-500/30 transition-colors duration-200"
                >
                  Add LP
                </button>
              </div>
            </div>
          {/each}

          {#if paginatedData.pools.length === 0}
            <div
              class="flex flex-col items-center justify-center h-full text-center py-8"
            >
              <div class="w-12 h-12 mb-4 text-white/50">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4M12 20V4" />
                </svg>
              </div>
              <div class="text-lg text-white/80 font-medium">No pools found</div>
              <div class="text-sm text-white/50 mt-1">
                There are currently no liquidity pools for this token
              </div>
              <button
                onclick={() => goto("/pool/add")}
                class="mt-6 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors duration-200"
              >
                Create Pool
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</Panel>

<style>
  .loader {
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid rgba(255, 255, 255, 0.4);
    border-radius: 50%;
    width: 100%;
    height: 100%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
