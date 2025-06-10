<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { onMount } from "svelte";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { Flame, TrendingUp, PiggyBank } from "lucide-svelte";
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

  let { row } = $props<{
    row: Pool;
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

  let isMobile = $state(false);
  let showDetailsButton = $state(true);

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

  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
      showDetailsButton = window.innerWidth >= 1150;
    };

    const debouncedCheckMobile = debounce(checkMobile, 250);

    checkMobile(); // Initial check
    window.addEventListener("resize", debouncedCheckMobile);

    return () => {
      window.removeEventListener("resize", debouncedCheckMobile);
    };
  });
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
  <div class="mobile-pool-card {isKongPool ? 'bg-kong-primary/5 hover:bg-kong-primary/15 border-kong-primary/20' : ''}">
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
  </div>
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

  /* Mobile Card Styles */
  .mobile-pool-card {
    background-color: #1a1b23;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
    @apply border border-kong-border;
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
    .mobile-pool-card {
      padding: 0.625rem 1rem;
    }

    .token-info {
      gap: 0.5rem;
    }

    .tvl-badge {
      font-size: 0.6875rem;
    }
  }
</style>
