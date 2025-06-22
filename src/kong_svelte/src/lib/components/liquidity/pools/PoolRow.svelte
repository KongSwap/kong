<script lang="ts">
  import { app } from "$lib/state/app.state.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { onMount } from "svelte";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { Flame, TrendingUp, PiggyBank, CheckCircle } from "lucide-svelte";
  import { livePools } from "$lib/stores/poolStore";
  import { tooltip } from "$lib/actions/tooltip";

  // Define proper types for the pool data
  type Token = Kong.Token;

  type Pool = {
    pool_id: string;
    token0: Token;
    token1: Token;
    tvl: number | bigint;
    rolling_24h_volume: number | bigint;
    rolling_24h_apy: number;
  };

  let { row, userPosition = null } = $props<{
    row: Pool;
    userPosition?: any;
  }>();

  // Normalize numeric values once
  let pool = $derived({
    ...row,
    tvl: Number.isInteger(row.tvl) ? BigInt(row.tvl) : row.tvl,
    rolling_24h_volume: Number.isInteger(row.rolling_24h_volume) ? BigInt(row.rolling_24h_volume) : row.rolling_24h_volume,
    displayTvl: Number(row.tvl) / 1e6
  });

  let tokens = $derived([pool.token0, pool.token1].filter(Boolean) as Token[]);

  let isKongPool = $derived(
    pool.token0?.address === KONG_CANISTER_ID || 
    pool.token1?.address === KONG_CANISTER_ID
  );

  // Calculate top pools metrics
  let topPoolsInfo = $derived({
    isTopVolume: Number(pool.rolling_24h_volume) > 0 && 
      [...$livePools].sort((a, b) => Number(b.rolling_24h_volume) - Number(a.rolling_24h_volume))
        .slice(0, 5)
        .some(p => p.pool_id === pool.pool_id),
    isTopTVL: Number(pool.tvl) > 0 && 
      [...$livePools].sort((a, b) => Number(b.tvl) - Number(a.tvl))
        .slice(0, 5)
        .some(p => p.pool_id === pool.pool_id),
    isTopAPY: Number(pool.rolling_24h_apy) > 0 && 
      [...$livePools].sort((a, b) => Number(b.rolling_24h_apy) - Number(a.rolling_24h_apy))
        .slice(0, 5)
        .some(p => p.pool_id === pool.pool_id)
  });

  let { isTopVolume, isTopTVL, isTopAPY } = $derived(topPoolsInfo);

  let isMobile = $derived(app.isMobile);

  // Debounce the resize handler
  function debounce<T extends (...args: any[]) => void>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }
</script>

{#if !isMobile}
  <!-- Desktop view (table row) -->
  <div class="pool-info">
    <TokenImages
      tokens={tokens}
      overlap={true}
      size={28}
    />
    <div class="pool-details">
      <div class="pool-name">
        <div class="flex items-center gap-2">
          <span>{pool.token0?.symbol}/{pool.token1?.symbol}</span>
          {#if userPosition}
            <div class="bg-kong-accent-green/10 text-kong-accent-green text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
              <CheckCircle size={10} />
              <span>Position</span>
            </div>
          {/if}
          {#if isTopVolume || isTopTVL || isTopAPY}
            <div class="flex gap-1 items-center">
              {#if isTopVolume}
                <div use:tooltip={{ text: "Top 5 by Volume", direction: "top" }}>
                  <Flame class="w-5 h-5 text-orange-400" />
                </div>
              {/if}
              {#if isTopTVL}
                <div use:tooltip={{ text: "Top 5 by TVL", direction: "top" }}>
                  <PiggyBank class="w-5 h-5 text-pink-500" />
                </div>
              {/if}
              {#if isTopAPY}
                <div use:tooltip={{ text: "Top 5 by APR", direction: "top" }}>
                  <TrendingUp class="w-5 h-5 text-green-400" />
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{:else}
  <!-- Mobile view (simplified card) -->
  <Panel 
    variant="solid" 
    type="secondary" 
    className="mb-3 {isKongPool ? 'bg-kong-primary/5 hover:bg-kong-primary/15 border-kong-primary/20' : ''}"
    interactive={true}>
    <div class="card-header">
      <div class="token-info">
        <TokenImages
          tokens={tokens}
          size={32}
          overlap={true}
        />
        <div class="token-details">
          <div class="flex items-center gap-2">
            <span class="token-pair">{pool.token0?.symbol}/{pool.token1?.symbol}</span>
            {#if isTopVolume || isTopTVL || isTopAPY}
              <div class="flex gap-1 items-center">
                {#if isTopVolume}
                  <div use:tooltip={{ text: "Top 5 by Volume", direction: "top" }}>
                    <Flame class="w-4 h-4 text-orange-400" />
                  </div>
                {/if}
                {#if isTopTVL}
                  <div use:tooltip={{ text: "Top 5 by TVL", direction: "top" }}>
                    <PiggyBank class="w-4 h-4 text-pink-400" />
                  </div>
                {/if}
                {#if isTopAPY}
                  <div use:tooltip={{ text: "Top 5 by APR", direction: "top" }}>
                    <TrendingUp class="w-4 h-4 text-green-400" />
                  </div>
                {/if}
              </div>
            {/if}
          </div>
          <span class="tvl-badge">TVL: ${pool.tvl}</span>
        </div>
      </div>
    </div>
  </Panel>
{/if}

<style scoped lang="postcss">
  .pool-info {
    @apply flex items-center gap-2;
  }

  .pool-details {
    display: flex;
    flex-direction: column;
  }

  .pool-name {
    font-weight: 500;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }


  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .token-pair {
    font-weight: 500;
  }

  .tvl-badge {
    font-size: 0.75rem;
  }

  @media (max-width: 640px) {
    .token-info {
      gap: 0.5rem;
    }

    .tvl-badge {
      font-size: 0.6875rem;
    }
  }
</style>
