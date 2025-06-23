<script lang="ts">
  import CreateLiquidityPanel from "$lib/components/liquidity/create_pool/CreateLiquidityPanel.svelte";
  import PoolChart from "$lib/components/liquidity/create_pool/PoolChart.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { 
    TrendingUp, 
    Droplets
  } from "lucide-svelte";
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { livePools } from "$lib/stores/poolStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  // Get the selected tokens for pool info
  let token0 = $derived($liquidityStore.token0);
  let token1 = $derived($liquidityStore.token1);
  let hasSelectedTokens = $derived(token0 && token1);
  
  // Get live pool data for selected tokens
  let livePool = $derived(
    token0 && token1 
      ? $livePools.find(p => 
          (p.address_0 === token0.address && p.address_1 === token1.address) ||
          (p.address_0 === token1.address && p.address_1 === token0.address)
        )
      : null
  );
</script>

{#snippet metricPanel(title: string, value: string, details: any, valueClass = "text-kong-primary")}
  <Panel variant="solid" className="p-5">
    <p class="text-xs text-kong-text-secondary mb-3 uppercase tracking-wider font-medium">{title}</p>
    <p class="text-3xl font-bold {valueClass} mb-3">
      {value}
    </p>
    <div class="flex justify-between items-center text-xs">
      {@html details}
    </div>
  </Panel>
{/snippet}

<svelte:head>
  <title>{hasSelectedTokens && token0 && token1 ? `Add ${token0.symbol}/${token1.symbol} Liquidity` : 'Add Liquidity'} - KongSwap</title>
</svelte:head>

<div class="flex flex-col max-w-[1300px] mx-auto px-4 pb-8">
  <!-- Header -->
  <div class="pb-8">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        {#if hasSelectedTokens}
          <TokenImages tokens={[token0, token1]} size={32} overlap={true} />
        {:else}
          <div class="p-2 rounded-full bg-kong-primary/10">
            <Droplets size={32} class="text-kong-primary" />
          </div>
        {/if}
        <h1 class="text-2xl font-bold text-kong-text-primary">
          {#if hasSelectedTokens && token0 && token1}
            Add {token0.symbol}/{token1.symbol} Liquidity
          {:else}
            Add Liquidity
          {/if}
        </h1>
      </div>
    </div>
    
    <!-- Key Metrics (only show if pool exists) -->
    {#if livePool && hasSelectedTokens}
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {@render metricPanel(
          "Pool TVL",
          `$${formatToNonZeroDecimal((livePool.tvl || 0).toString())}`,
          `<div class="flex justify-between text-xs w-full">
            <span class="text-kong-text-secondary">24h Volume: <span class="text-kong-text-primary font-medium">$${formatToNonZeroDecimal((livePool.rolling_24h_volume || 0).toString())}</span></span>
          </div>`
        )}
        
        {@render metricPanel(
          "APR (24h)",
          `${formatToNonZeroDecimal((livePool.rolling_24h_apy || 0).toString())}%`,
          `<div class="flex justify-between items-center text-xs w-full">
            <span class="text-kong-text-secondary">LP Rewards</span>
            <span class="text-kong-accent-green font-semibold">Active</span>
          </div>`,
          "text-kong-accent-green"
        )}
        
        {@render metricPanel(
          "Pool Fee",
          `${livePool.lp_fee_bps ? (livePool.lp_fee_bps / 100).toFixed(2) : '0.25'}%`,
          `<div class="flex justify-between items-center text-xs w-full">
            <span class="text-kong-text-secondary">Trade fees earned by LPs</span>
          </div>`
        )}
      </div>
    {/if}
  </div>
  
  <!-- Main Content Grid -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
    <!-- Charts Section -->
    {#if hasSelectedTokens}
      <PoolChart />
    {:else}
      <Panel variant="solid" className="min-h-[400px] p-8">
        <div class="flex flex-col items-center justify-center h-full text-center">
          <div class="p-4 bg-kong-primary/10 rounded-full mb-4">
            <TrendingUp class="w-8 h-8 text-kong-primary" />
          </div>
          <h3 class="text-lg font-medium text-kong-text-primary mb-2">Pool Analytics</h3>
          <p class="text-sm text-kong-text-primary/60 max-w-xs">
            Select both tokens to view pool information, charts, and analytics
          </p>
        </div>
      </Panel>
    {/if}
    
    <!-- Actions Panel -->
    <div class="space-y-4">
      <!-- Create Liquidity Panel -->
      <CreateLiquidityPanel />
    </div>
  </div>
</div>
