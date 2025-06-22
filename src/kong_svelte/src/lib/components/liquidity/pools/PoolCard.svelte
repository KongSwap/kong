<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { getPoolPriceUsd } from "$lib/utils/statsUtils";

  interface PoolCardProps {
    pool: BE.Pool;
    tokenMap: Map<string, any>;
    userPoolData?: any;
    isHighlighted?: boolean;
    isMobile?: boolean;
    isConnected?: boolean;
    onClick: () => void;
  }

  let { 
    pool, 
    tokenMap, 
    userPoolData = null, 
    isHighlighted = false, 
    isMobile = false,
    isConnected = false,
    onClick 
  }: PoolCardProps = $props();

  const stats = $derived([
    { 
      label: "APR", 
      value: pool.apr ? `${pool.apr}%` : `${Number(pool.rolling_24h_apy || 0).toFixed(2)}%`,
      color: 'text-kong-primary'
    },
    { 
      label: "Price", 
      value: pool.price ? pool.price : pool.tvl !== undefined ? `${(pool.symbol_1 || pool.token1?.symbol) === "ckUSDT" ? "$" : ""}${formatToNonZeroDecimal(getPoolPriceUsd(pool))}${(pool.symbol_1 || pool.token1?.symbol) === "ckUSDT" ? "" : " " + (pool.symbol_1 || pool.token1?.symbol)}` : "--"
    },
    { 
      label: "TVL", 
      value: formatUsdValue(Number(pool.tvl || 0)) 
    },
    { 
      label: "Vol 24h", 
      value: formatUsdValue(Number(pool.rolling_24h_volume || 0)) 
    },
    ...(isConnected ? [{
      label: "Your Position",
      value: userPoolData ? `$${userPoolData.usdValue || 0}` : "$0",
      color: userPoolData ? 'text-kong-success' : 'text-kong-text-secondary'
    }] : [])
  ]);

  const mobileStats = $derived(stats.slice(0, 4));
</script>

<Panel
  interactive={true}
  onclick={onClick}
  className={`cursor-pointer transition-all ${isMobile
    ? "active:scale-[0.99]"
    : "hover:scale-[1.02] active:scale-[0.98]"} ${isHighlighted
    ? 'bg-gradient-to-br from-[rgba(0,149,235,0.05)] to-[rgba(0,149,235,0.02)] shadow-[inset_0_1px_1px_rgba(0,149,235,0.1)]'
    : ''}`}
  unpadded={true}
>
  <div class="p-4 h-full flex flex-col">
    <!-- Pool Info Row -->
    <div class="flex items-center gap-{isMobile ? '2.5' : '3'} mb-4">
      <TokenImages
        tokens={[
          tokenMap.get(pool.address_0) || pool.token0,
          tokenMap.get(pool.address_1) || pool.token1,
        ]}
        size={isMobile ? 28 : 36}
        overlap={!isMobile}
      />
      <div class="flex-1 min-w-0">
        <div
          class="text-base font-{isMobile ? 'medium' : 'semibold'} text-kong-text-primary truncate"
        >
          {pool.symbol_0 || pool.token0?.symbol}/{pool.symbol_1 || pool.token1?.symbol}
        </div>
        {#if !isMobile}
          <div class="text-xs text-kong-text-secondary truncate">
            {pool.name || `${pool.symbol_0 || pool.token0?.symbol}/${pool.symbol_1 || pool.token1?.symbol} Pool`}
          </div>
        {/if}
        {#if userPoolData}
          <div class="flex items-center gap-2">
            <div class="text-xs text-kong-accent-blue">
              {userPoolData.sharePercentage}% of pool
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="{!userPoolData ? 'flex-1 flex flex-col justify-end' : ''}">
      {#if isMobile}
        <div class="grid grid-cols-2 gap-3">
          {#each mobileStats as stat}
            <div class="bg-black/10 rounded-lg p-2.5">
              <div class="text-xs text-kong-text-secondary mb-1">
                {stat.label}
              </div>
              <div class="text-sm font-medium {stat.color || 'text-kong-text-primary'}">
                {stat.value}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="space-y-3">
          {#each stats as stat}
            <div class="flex justify-between items-center">
              <span class="text-sm text-kong-text-secondary">{stat.label}</span>
              <span class="text-sm font-medium {stat.color || 'text-kong-text-primary'}">{stat.value}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</Panel>