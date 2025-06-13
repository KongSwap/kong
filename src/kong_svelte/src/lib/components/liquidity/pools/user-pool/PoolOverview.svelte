<script lang="ts">
  import { fade } from "svelte/transition";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatToNonZeroDecimal, formatLargeNumber, calculateTokenUsdValue } from "$lib/utils/numberFormatUtils";
  import { livePools } from "$lib/stores/poolStore";
  import type { UserPoolData } from "$lib/models/UserPool";

  export let pool: UserPoolData;
  export let token0: any;
  export let token1: any;

  // Get actual pool for APR display
  $: actualPool = $livePools.find((p) => {
    return p.address_0 === pool.address_0 && p.address_1 === pool.address_1;
  });

  // Use pre-calculated values from the serializer
  $: poolSharePercentage = formatToNonZeroDecimal(pool.poolSharePercentage);
  $: userFeeShare0 = pool.userFeeShare0;
  $: userFeeShare1 = pool.userFeeShare1;
  $: totalFeesEarnedUSD = formatToNonZeroDecimal(pool.totalFeesEarnedUSD);
</script>

<div in:fade={{ duration: 100 }}>
  <div class="token-holdings">
    <h3 class="section-title">Your Holdings</h3>
    <div class="token-card">
      <div class="token-row">
        <TokenImages tokens={[token0]} size={20} />
        <div class="token-details">
          <div class="token-info">
            <span class="token-name">{pool.symbol_0}</span>
            <span class="token-amount truncate" title={formatToNonZeroDecimal(pool.amount_0.toString())}>
              {formatToNonZeroDecimal(pool.amount_0.toString())}
            </span>
          </div>
          <span class="usd-value"
            >${calculateTokenUsdValue(pool.amount_0.toString(), token0)}</span
          >
        </div>
      </div>
      <div class="token-row">
        <TokenImages tokens={[token1]} size={20} />
        <div class="token-details">
          <div class="token-info">
            <span class="token-name">{pool.symbol_1}</span>
            <span class="token-amount truncate" title={formatToNonZeroDecimal(pool.amount_1.toString())}>
              {formatToNonZeroDecimal(pool.amount_1.toString())}
            </span>
          </div>
          <span class="usd-value"
            >${calculateTokenUsdValue(pool.amount_1.toString(), token1)}</span
          >
        </div>
      </div>
      <div class="holdings-total-row">
        <span class="holdings-total-label">Value</span>
        <span class="holdings-total-value">${formatToNonZeroDecimal(pool.usd_balance)} <span class="holdings-info">({poolSharePercentage}% share)</span></span>
      </div>
    </div>
  </div>

  <div class="earnings-container">
    <h3 class="section-title">Lifetime Fees Earned</h3>
    <div class="fee-details">
      <div class="fee-breakdown">
        <div class="fee-token">
          <TokenImages tokens={[token0]} size={16} />
          <span class="fee-token-name">{pool.symbol_0}</span>
          <span class="fee-token-amount" title={formatToNonZeroDecimal(userFeeShare0)}>
            {formatLargeNumber(userFeeShare0)}
          </span>
        </div>
        <div class="fee-token">
          <TokenImages tokens={[token1]} size={16} />
          <span class="fee-token-name">{pool.symbol_1}</span>
          <span class="fee-token-amount" title={formatToNonZeroDecimal(userFeeShare1)}>
            {formatLargeNumber(userFeeShare1)}
          </span>
        </div>
        <div class="fee-total-row">
          <span class="fee-total-label">Value</span>
          <span class="fee-total-value">${totalFeesEarnedUSD} <span class="apy-text">({formatToNonZeroDecimal(actualPool?.rolling_24h_apy)}% APR)</span></span>
        </div>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
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

  .holdings-total-row {
    @apply flex items-center justify-between p-3;
  }

  .holdings-total-label {
    @apply text-xs text-kong-text-primary/60 font-medium;
  }

  .holdings-total-value {
    @apply text-sm font-medium text-kong-text-primary tabular-nums;
  }

  .holdings-info {
    @apply text-kong-text-primary/60 text-xs;
  }

  .earnings-container {
    @apply mb-3;
  }

  .fee-details {
    @apply rounded-lg bg-kong-bg-light/50
           border border-kong-border/10 overflow-hidden;
  }


  .fee-breakdown {
    @apply divide-y divide-kong-border/10;
  }

  .fee-token {
    @apply flex items-center gap-2 p-3 hover:bg-white/5;
    transition-property: background-color;
    transition-duration: 200ms;
  }

  .fee-token-name {
    @apply text-xs text-kong-text-primary/70 font-medium flex-1;
  }

  .fee-token-amount {
    @apply text-sm font-medium text-kong-text-primary tabular-nums;
  }

  .fee-total-row {
    @apply flex items-center justify-between p-3;
  }

  .fee-total-label {
    @apply text-xs text-kong-text-primary/60 font-medium;
  }

  .fee-total-value {
    @apply text-sm font-medium text-kong-text-accent-green tabular-nums;
  }

  .apy-text {
    @apply text-kong-text-primary/60 text-xs;
  }
</style> 