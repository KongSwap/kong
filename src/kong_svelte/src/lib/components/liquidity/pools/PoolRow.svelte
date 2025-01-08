<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { onMount } from "svelte";
  import { formatUsdValue, fromRawAmount } from "$lib/utils/tokenFormatters";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import { derived, get } from "svelte/store";
  import { Flame, TrendingUp, Wallet, PiggyBank } from "lucide-svelte";
  import { livePools } from "$lib/services/pools/poolStore";
  import { tooltip } from "$lib/actions/tooltip";

  export let row: any;

  const tokenMap = derived(formattedTokens, ($tokens) => {
    const map = new Map();
    if ($tokens) {
      $tokens.forEach((token) => {
        map.set(token.canister_id, token);
      });
    }
    return map;
  });

  $: pool = {
    ...row,
    tvl: BigInt(row.tvl),
    rolling_24h_volume: BigInt(row.rolling_24h_volume),
    displayTvl: Number(row.tvl) / 1e6
  };

  $: isKongPool = pool.address_0 === KONG_CANISTER_ID || pool.address_1 === KONG_CANISTER_ID;

  $: isTopVolume = Number(pool.rolling_24h_volume) > 0 && [...$livePools]
    .sort((a, b) => Number(b.rolling_24h_volume) - Number(a.rolling_24h_volume))
    .slice(0, 5)
    .map(p => p.pool_id)
    .includes(pool.pool_id);

  $: isTopTVL = Number(pool.tvl) > 0 && [...$livePools]
    .sort((a, b) => Number(b.tvl) - Number(a.tvl))
    .slice(0, 5)
    .map(p => p.pool_id)
    .includes(pool.pool_id);

  $: isTopAPY = Number(pool.rolling_24h_apy) > 0 && [...$livePools]
    .sort((a, b) => Number(b.rolling_24h_apy) - Number(a.rolling_24h_apy))
    .slice(0, 5)
    .map(p => p.pool_id)
    .includes(pool.pool_id);

  let isMobile = false;
  let showDetailsButton = true;

  type Cleanup = () => void;

  onMount((): Cleanup => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
      showDetailsButton = window.innerWidth >= 1150;
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  });
</script>

{#if !isMobile}
  <!-- Desktop view (table row) -->
  <div class="pool-info">
    <TokenImages
      tokens={[
        get(tokenMap).get(pool.address_0),
        get(tokenMap).get(pool.address_1)
      ]}
      overlap={true}
      size={28}
    />
    <div class="pool-details">
      <div class="pool-name">
        <div class="flex items-center gap-2">
          <span>{pool.symbol_0}/{pool.symbol_1}</span>
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
                <div use:tooltip={{ text: "Top 5 by APY", direction: "top" }}>
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
  <div class="mobile-pool-card">
    <div class="card-header">
      <div class="token-info">
        <TokenImages
          tokens={[
            get(tokenMap).get(pool.address_0),
            get(tokenMap).get(pool.address_1)
          ]}
          size={32}
          overlap={true}
        />
        <div class="token-details">
          <div class="flex items-center gap-2">
            <span class="token-pair">{pool.symbol_0}/{pool.symbol_1}</span>
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
                  <div use:tooltip={{ text: "Top 5 by APY", direction: "top" }}>
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
