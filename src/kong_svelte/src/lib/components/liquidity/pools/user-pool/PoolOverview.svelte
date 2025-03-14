<script lang="ts">
  import { fade } from "svelte/transition";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal, formatLargeNumber, calculateTokenUsdValue } from "$lib/utils/numberFormatUtils";
  import { livePools } from "$lib/services/pools/poolStore";
  import { calculateUserPoolPercentage } from "$lib/utils/liquidityUtils";

  export let pool: any;
  export let token0: any;
  export let token1: any;

  // Get token objects for images
  $: actualPool = $livePools.find((p) => {
    return p.address_0 === pool.address_0 && p.address_1 === pool.address_1;
  });

  // Calculate user's percentage of the pool
  $: poolSharePercentage = calculateUserPoolPercentage(
    actualPool?.balance_0,
    actualPool?.balance_1,
    pool?.amount_0,
    pool?.amount_1
  );

  // Calculate earnings based on APY
  function calculateEarnings(timeframe: number): string {
    // Use APY from the actual pool
    if (!actualPool?.rolling_24h_apy || !pool.usd_balance) {
      return "0";
    }

    // Convert APY to daily rate and calculate linear projection
    const apyDecimal = Number(actualPool.rolling_24h_apy) / 100; // Ensure it's a number
    const dailyRate = apyDecimal / 365;
    const earnings = parseFloat(pool.usd_balance) * dailyRate * timeframe;

    return formatToNonZeroDecimal(earnings);
  }
</script>

<div in:fade={{ duration: 100 }}>
  <div class="stats-card">
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-label">Total Value</span>
        <span class="stat-value highlight"
          >${formatToNonZeroDecimal(pool.usd_balance)}</span
        >
      </div>
      <div class="stat-item">
        <span class="stat-label">APY</span>
        <span class="stat-value accent"
          >{formatToNonZeroDecimal(actualPool?.rolling_24h_apy)}%</span
        >
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-label">Pool Share</span>
        <span class="stat-value highlight">{poolSharePercentage}%</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">LP Tokens</span>
        <span class="stat-value highlight truncate" title={formatToNonZeroDecimal(pool.balance)}>
          {formatLargeNumber(pool.balance)}
        </span>
      </div>
    </div>
  </div>

  <div class="token-holdings">
    <h3 class="section-title">Your Holdings</h3>
    <div class="token-card">
      <div class="token-row">
        <TokenImages tokens={[token0]} size={20} />
        <div class="token-details">
          <div class="token-info">
            <span class="token-name">{pool.symbol_0}</span>
            <span class="token-amount truncate" title={formatToNonZeroDecimal(pool.amount_0)}>
              {formatToNonZeroDecimal(pool.amount_0)}
            </span>
          </div>
          <span class="usd-value"
            >${calculateTokenUsdValue(pool.amount_0, token0)}</span
          >
        </div>
      </div>
      <div class="token-row">
        <TokenImages tokens={[token1]} size={20} />
        <div class="token-details">
          <div class="token-info">
            <span class="token-name">{pool.symbol_1}</span>
            <span class="token-amount truncate" title={formatToNonZeroDecimal(pool.amount_1)}>
              {formatToNonZeroDecimal(pool.amount_1)}
            </span>
          </div>
          <span class="usd-value"
            >${calculateTokenUsdValue(pool.amount_1, token1)}</span
          >
        </div>
      </div>
    </div>
  </div>

  <div class="earnings-container">
    <h3 class="section-title">Estimated Earnings</h3>
    <div class="earnings-grid">
      {#each [{ label: "Daily", days: 1 }, { label: "Weekly", days: 7 }, { label: "Monthly", days: 30 }, { label: "Yearly", days: 365 }] as period}
        <div class="earnings-card">
          <span class="earnings-value truncate" title={calculateEarnings(period.days)}>
            ${formatLargeNumber(calculateEarnings(period.days))}
          </span>
          <span class="earnings-label">{period.label}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style lang="postcss">
  .stats-card {
    @apply mb-3 rounded-lg bg-kong-bg-light/50
           border border-kong-border/10 overflow-hidden;
  }

  .stats-row {
    @apply grid grid-cols-2 divide-x divide-kong-border/10;
  }

  .stats-row:not(:last-child) {
    @apply border-b border-kong-border/10;
  }

  .stat-item {
    @apply flex flex-col gap-0.5 p-3 items-center justify-center 
           hover:bg-white/5;
    transition-property: background-color;
    transition-duration: 200ms;
  }

  .stat-label {
    @apply text-xs text-kong-text-primary/60 font-medium uppercase tracking-wide;
  }

  .stat-value {
    @apply text-lg font-medium tabular-nums max-w-full;
  }

  .stat-value.highlight {
    @apply text-kong-text-primary;
  }

  .stat-value.accent {
    @apply text-kong-text-accent-green;
  }

  .section-title {
    @apply text-xs text-kong-text-primary/70 font-medium mb-2;
  }

  .token-holdings {
    @apply mb-3;
  }

  .token-card {
    @apply rounded-lg bg-kong-bg-light/50
           border border-kong-border/10 overflow-hidden;
  }

  .token-row {
    @apply flex items-center gap-3 p-3
           hover:bg-white/5 border-b border-kong-border/10 last:border-b-0;
    transition-property: background-color;
    transition-duration: 200ms;
  }

  .token-details {
    @apply flex items-center justify-between flex-1 min-w-0;
  }

  .token-info {
    @apply flex flex-col min-w-0 max-w-[70%];
  }

  .token-name {
    @apply text-xs text-kong-text-primary/70 font-medium;
  }

  .token-amount {
    @apply text-sm font-medium text-kong-text-primary;
  }

  .truncate {
    @apply overflow-hidden text-ellipsis whitespace-nowrap;
  }

  .usd-value {
    @apply text-xs text-kong-text-primary/60 tabular-nums;
  }

  .earnings-container {
    @apply mb-3;
  }

  .earnings-grid {
    @apply grid grid-cols-2 gap-2;
  }

  .earnings-card {
    @apply p-3 rounded-lg bg-kong-bg-light/50
           border border-kong-border/10 flex flex-col items-center gap-0.5 
           hover:bg-white/5;
    transition-property: background-color;
    transition-duration: 200ms;
  }

  .earnings-label {
    @apply text-xs text-kong-text-primary/60 font-medium;
  }

  .earnings-value {
    @apply text-sm font-medium text-kong-text-accent-green max-w-full;
  }
</style> 