<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import type { Pool } from "$lib/services/pools";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  
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
      })) as unknown as Pool[];

    return {
      pools: filteredPools,
    };
  }

  // Add helper function to calculate pool share
  function calculatePoolShare(
    pool: Pool,
    userBalance: {
      balance: string;
      symbol_0: string;
      symbol_1: string;
    } | undefined,
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
    <div class="p-4">
      <h2 class="text-2xl font-semibold text-white/80">Token Pools</h2>
    </div>
    <div class="flex-1 overflow-y-auto p-4">
      {#if !props.pools}
        <div class="text-white">Loading pools...</div>
      {:else}
        {@const paginatedData = getPaginatedPools(props.pools)}
        <div class="flex-1 overflow-y-auto">
          {#each paginatedData.pools as pool}
            <div
              class="border-b border-slate-700/70 hover:bg-slate-800/30 transition-colors duration-200 p-4"
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
                <div class="hidden sm:block">
                  <a
                    href="/swap?from={pool.address_0}&to={pool.address_1}"
                    class="inline-block px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/30 transition-colors duration-200"
                  >
                    Trade
                  </a>
                </div>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div class="text-slate-400 text-xs mb-1">TVL</div>
                  <div class="text-white font-medium">
                    {formatUsdValue(Number(pool.tvl))}
                  </div>
                </div>
                <div>
                  <div class="text-slate-400 text-xs mb-1">24h Volume</div>
                  <div class="text-white font-medium">
                    {formatUsdValue(Number(pool.daily_volume || 0))}
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
              <div class="mt-3 sm:hidden">
                <a
                  href="/swap?from={pool.address_0}&to={pool.address_1}"
                  class="block w-full text-center px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/30 transition-colors duration-200"
                >
                  Trade
                </a>
              </div>
            </div>
          {/each}

          {#if paginatedData.pools.length === 0}
            <div
              class="flex flex-col items-center justify-center h-full text-center py-8"
            >
              <div class="text-slate-400 mb-2">No pools found</div>
              <div class="text-sm text-slate-500">
                There are currently no liquidity pools for this token
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</Panel> 