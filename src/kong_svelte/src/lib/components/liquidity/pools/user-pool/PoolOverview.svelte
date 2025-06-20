<script lang="ts">
  import { fade } from "svelte/transition";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatToNonZeroDecimal, calculateTokenUsdValue } from "$lib/utils/numberFormatUtils";
  import { livePools } from "$lib/stores/poolStore";
  import { calculateUserPoolPercentage } from "$lib/utils/liquidityUtils";
  import { calculateRemoveLiquidityAmounts } from '$lib/api/pools';
  import BigNumber from 'bignumber.js';
  import type { UserPoolData } from '$lib/models/UserPool';

  interface Props {
    pool: UserPoolData;
    token0: any;
    token1: any;
  }

  let { pool, token0, token1 }: Props = $props();

  // Get actual pool for APR display
  let actualPool = $derived($livePools.find((p) => {
    return p.address_0 === pool.address_0 && p.address_1 === pool.address_1;
  }));

  // Calculate user's percentage of the pool
  let poolSharePercentage = $derived(calculateUserPoolPercentage(
    actualPool?.balance_0 + actualPool?.lp_fee_0,
    actualPool?.balance_1 + actualPool?.lp_fee_1,
    pool?.amount_0,
    pool?.amount_1
  ));

  let estimatedAmounts = $state<[string, string]>(["0", "0"]);
  let loadingEarnings = $state(false);
  let earningsError = $state('');

  async function fetchEstimatedEarnings() {
    loadingEarnings = true;
    earningsError = '';
    try {
      if (!token0 || !token1 || !pool) {
        estimatedAmounts = ["0", "0"];
        loadingEarnings = false;
        return;
      }
      const result = await calculateRemoveLiquidityAmounts(
        token0.address,
        token1.address,
        pool.balance
      );
      console.log(result)
      const fee0 = new BigNumber(result.lpFee0.toString()).div(new BigNumber(10).pow(token0.decimals))
      const fee1 = new BigNumber(result.lpFee1.toString()).div(new BigNumber(10).pow(token1.decimals))
      estimatedAmounts = [fee0.toString(), fee1.toString()];
    } catch (e) {
      earningsError = e.message || 'Failed to fetch estimated earnings';
    }
    loadingEarnings = false;
  }

  // Effect to call fetchEstimatedEarnings when dependencies change
  $effect(() => {
    if (pool && token0 && token1) {
      fetchEstimatedEarnings();
    }
  });
</script>

<div in:fade={{ duration: 100 }}>
  <Panel variant="solid" type="secondary" unpadded={true} className="mb-3 overflow-hidden">
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-label">Value</span>
        <span class="stat-value highlight"
          >${formatToNonZeroDecimal(pool.usd_balance)}</span
        >
      </div>
      <div class="stat-item">
        <span class="stat-label">24h APR</span>
        <span class="stat-value accent"
          >{formatToNonZeroDecimal(actualPool?.rolling_24h_apy)}%</span
        >
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-label">Share</span>
        <span class="stat-value highlight">{poolSharePercentage}%</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">LP Tokens</span>
        <span class="stat-value highlight truncate" title={formatToNonZeroDecimal(pool.balance)}>
          {formatToNonZeroDecimal(pool.balance)}
        </span>
      </div>
    </div>
  </Panel>
  <div class="token-holdings">
    <h3 class="section-title">Your Holdings</h3>
    <Panel variant="solid" type="secondary" unpadded={true} className="overflow-hidden">
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
    </Panel>
  </div>

  <div class="earnings-container">
    <h3 class="section-title">Lifetime Fees Accrued</h3>
    {#if loadingEarnings}
      <div class="grid grid-cols-2 gap-3">
        <Panel variant="solid" type="secondary" className="!p-3 flex flex-col items-center gap-0.5 loading">
          <div class="skeleton-value"></div>
          <div class="skeleton-label"></div>
          <div class="skeleton-label short"></div>
        </Panel>
        <Panel variant="solid" type="secondary" className="!p-3 flex flex-col items-center gap-0.5 loading">
          <div class="skeleton-value"></div>
          <div class="skeleton-label"></div>
          <div class="skeleton-label short"></div>
        </Panel>
      </div>
    {:else if earningsError}
      <div class="error-message">{earningsError}</div>
    {:else if token0 && token1 && pool}
      <div class="grid grid-cols-2 gap-3">
        <Panel variant="solid" type="secondary" className="!p-3 flex flex-col items-center gap-0.5 hover:bg-white/5 transition-all duration-200">
          <span class="earnings-value truncate" title={formatToNonZeroDecimal(Number(estimatedAmounts[0]))}>
            {formatToNonZeroDecimal(Number(estimatedAmounts[0]))} {pool.symbol_0}
          </span>
          <span class="earnings-label">${(token0.metrics.price * Number(estimatedAmounts[0])).toFixed(2)}</span>
          <span class="earnings-label">{token0.symbol}</span>
        </Panel>
        <Panel variant="solid" type="secondary" className="!p-3 flex flex-col items-center gap-0.5 hover:bg-white/5 transition-all duration-200">
          <span class="earnings-value truncate" title={formatToNonZeroDecimal(Number(estimatedAmounts[1]))}>
            {formatToNonZeroDecimal(Number(estimatedAmounts[1]))} {pool.symbol_1}
          </span>
          <span class="earnings-label">${(token1.metrics.price * Number(estimatedAmounts[1])).toFixed(2)}</span>
          <span class="earnings-label">{token1.symbol}</span>
        </Panel>
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">

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
    @apply text-kong-success;
  }

  .section-title {
    @apply text-xs text-kong-text-primary/70 font-medium mb-2;
  }

  .token-holdings {
    @apply mb-3;
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

  .loading {
    @apply hover:bg-kong-bg-secondary/50;
  }

  .earnings-label {
    @apply text-xs text-kong-text-primary/60 font-medium;
  }

  .earnings-value {
    @apply text-sm font-medium text-kong-success max-w-full;
  }

  .error-message {
    @apply text-sm text-red-500 p-3 rounded-lg bg-kong-bg-secondary/50
           border border-kong-border/10 text-center;
  }

  .skeleton-value {
    @apply w-24 h-4 rounded bg-white/10 animate-pulse mb-1;
  }

  .skeleton-label {
    @apply w-16 h-3 rounded bg-white/10 animate-pulse;
  }

  .skeleton-label.short {
    @apply w-8;
  }
</style> 