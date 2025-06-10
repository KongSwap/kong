<script lang="ts">
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
</script>

<div class="flex items-center justify-between text-sm w-[400px]">
  {#if $liquidityStore.pool}
    <div>
      <span class="text-[10px] font-medium text-white/30">TVL</span>
      <span class="ml-1 text-white/90">${formatBalance($liquidityStore.pool.tvl, 2)}</span>
    </div>

    <div>
      <span class="text-[10px] font-medium text-white/30">VOL</span>
      <span class="ml-1 text-white/90">${formatBalance($liquidityStore.pool.rolling_24h_volume, 2)}</span>
    </div>

    <div>
      <span class="text-[10px] font-medium text-white/30">FEES</span>
      <span class="ml-1 text-white/90">${formatBalance($liquidityStore.pool.rolling_24h_lp_fee, 2)}</span>
    </div>

    <div>
      <span class="text-[10px] font-medium text-white/30">APR</span>
      <span class="ml-1 text-white/90">{$liquidityStore.pool.rolling_24h_apy?.toFixed(2) ?? '0.00'}%</span>
    </div>
  {/if}
</div>
