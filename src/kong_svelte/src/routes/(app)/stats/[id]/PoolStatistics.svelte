<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import Panel from "$lib/components/common/Panel.svelte";
  import { Info, ExternalLink } from "lucide-svelte";
  import { tooltip } from "$lib/actions/tooltip";
  import { tokenData } from "$lib/stores/tokenData";
  import PoolSelector from "$lib/components/stats/PoolSelector.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { auth } from "$lib/stores/auth";
  import { goto } from "$app/navigation";
  
  // Props using $props() for Svelte 5 runes mode
  const { selectedPool, token, relevantPools, onPoolSelect } = $props<{
    selectedPool: BE.Pool | null | undefined;
    token?: Kong.Token | undefined;
    relevantPools?: BE.Pool[];
    onPoolSelect?: (pool: BE.Pool) => void;
  }>();

  // Helper functions to get token info
  function getToken0() {
    if (!selectedPool) return null;
    return selectedPool.token0 || $tokenData?.find(t => t.address === selectedPool.address_0);
  }
  
  function getToken1() {
    if (!selectedPool) return null;
    return selectedPool.token1 || $tokenData?.find(t => t.address === selectedPool.address_1);
  }
  
  // Derived values for display
  const token0 = $derived(getToken0());
  const token1 = $derived(getToken1());
  const token0Symbol = $derived(token0?.symbol || selectedPool?.symbol_0 || '');
  const token1Symbol = $derived(token1?.symbol || selectedPool?.symbol_1 || '');
  
  // Format numeric values with proper fallbacks
  const formattedPoolVolume24h = $derived(formatUsdValue(Number(selectedPool?.rolling_24h_volume || 0)));
  const formattedPoolFees24h = $derived(formatUsdValue(Number(selectedPool?.rolling_24h_lp_fee || 0)));
  const formattedTvl = $derived(formatUsdValue(Number(selectedPool?.tvl || 0)));
  
  // Extract APY information
  const apy = $derived(
    selectedPool?.rolling_24h_apy 
      ? Number(selectedPool.rolling_24h_apy).toFixed(2)
      : '0.00'
  );
  
  // Number of swaps
  const swaps24h = $derived(selectedPool?.rolling_24h_num_swaps || 0);
  
  // Calculate reserves with proper decimal formatting
  const token0Reserve = $derived(
    formatToNonZeroDecimal(Number(selectedPool?.balance_0 || 0))
  );
  
  const token1Reserve = $derived(
    formatToNonZeroDecimal(Number(selectedPool?.balance_1 || 0))
  );
  
  // Extract the fee percentage
  const feePercentage = $derived(
    selectedPool?.lp_fee_bps 
      ? (Number(selectedPool.lp_fee_bps) / 100).toFixed(2)
      : '0.00'
  );
  
  // Check if user has a position in this pool
  const userPosition = $derived(
    $auth.isConnected && selectedPool 
      ? $currentUserPoolsStore.filteredPools.find(
          p => p.address_0 === selectedPool.address_0 && p.address_1 === selectedPool.address_1
        )
      : null
  );
</script>

<Panel type="main" className="relative !bg-kong-bg-secondary" zIndex={1}>
  <div class="flex flex-col gap-5">
    <!-- Pool Title Section -->
    <div>
      <div class="flex justify-between items-center mb-2">
        <div class="text-sm text-kong-text-primary/50 uppercase tracking-wider">
          <span class="flex gap-x-2 items-center">
            Pool Information 
            <span use:tooltip={{
              text: "Statistics for the currently selected trading pair",
              direction: "bottom",
            }}><Info size={16} /></span>
          </span>
        </div>
        <div class="flex items-center gap-2">
          {#if userPosition}
            <button
              class="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-kong-accent-green bg-kong-accent-green/10 rounded-md hover:bg-kong-accent-green/20 transition-colors"
              onclick={() => goto(`/pools/${selectedPool.address_0}_${selectedPool.address_1}/position`)}
            >
              <ExternalLink size={12} />
              View Position
            </button>
          {/if}
          {#if selectedPool?.pool_id}
            <div class="text-xs text-kong-text-primary/50 bg-kong-bg-secondary/20 px-2 py-0.5 rounded">
              Pool #{selectedPool.pool_id}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Pool Selector Integration -->
      {#if token && onPoolSelect}
        <div class="relative pool-selector-container">
          <div class="border !border-kong-border bg-kong-bg-primary/70 hover:bg-kong-bg-secondary/30 hover:border-kong-primary/50 {$panelRoundness} transition-all duration-200">
            <PoolSelector 
              {selectedPool} 
              {token} 
              formattedTokens={$tokenData || []} 
              {relevantPools}
              {onPoolSelect}
              integrationMode={true}
            />
          </div>
        </div>
      {:else}
        <div class="mb-4">
          <div class="border !border-kong-border bg-kong-bg-primary/70 {$panelRoundness} p-3 overflow-hidden">
            <div class="flex items-center gap-3">
              <TokenImages
                tokens={[token0, token1].filter(Boolean)}
                size={20}
                overlap={true}
              />
              <div class="text-kong-text-primary font-medium">
                {token0Symbol || 'Token A'}/{token1Symbol || 'Token B'}
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Pool Stats -->
    <div class="flex flex-col gap-y-4">
      <!-- Row 1: Volume & APY -->
      <div class="grid grid-cols-2 gap-x-8">
        <!-- 24h Volume -->
        <div class="flex flex-col">
          <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-1">24h Volume</div>
          <div class="text-sm font-medium text-kong-text-primary">
            {formattedPoolVolume24h}
          </div>
        </div>

        <!-- APR -->
        <div class="flex flex-col">
          <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-1">24h APR</div>
          <div class="text-sm font-medium text-kong-text-primary flex items-center gap-1">
            {apy}% 
            {#if Number(apy) > 0}
              <span class="text-xs px-1.5 py-0.5 rounded-full bg-kong-success/10 text-kong-success">
                {Number(apy) < 4 ? 'Low' : Number(apy) < 20 ? 'Medium' : 'High'}
              </span>
            {/if}
          </div>
        </div>
      </div>

      <!-- Row 2: Fees & Swaps -->
      <div class="grid grid-cols-2 gap-x-8">
        <!-- 24h Fees -->
        <div class="flex flex-col">
          <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-1">24h Fees</div>
          <div class="text-sm font-medium text-kong-text-primary">
            {formattedPoolFees24h}
          </div>
        </div>

        <!-- 24h Swaps -->
        <div class="flex flex-col">
          <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-1">24h Swaps</div>
          <div class="text-sm font-medium text-kong-text-primary">
            {swaps24h}
          </div>
        </div>
      </div>

      <!-- Row 3: TVL & Fee % -->
      <div class="grid grid-cols-2 gap-x-8">
        <!-- TVL -->
        <div class="flex flex-col">
          <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-1">Pool TVL</div>
          <div class="text-sm font-medium text-kong-text-primary">
            {formattedTvl}
          </div>
        </div>

        <!-- Fee Percentage -->
        <div class="flex flex-col">
          <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-1">Fee Tier</div>
          <div class="text-sm font-medium text-kong-text-primary flex items-center gap-1">
            {feePercentage}% 
            <span class="text-xs px-1.5 py-0.5 rounded-full bg-kong-bg-secondary/50 text-kong-text-primary/80">
              {Number(feePercentage) <= 0.3 ? 'Low' : Number(feePercentage) <= 0.5 ? 'Medium' : 'High'}
            </span>
          </div>
        </div>
      </div>

      <!-- Row 4: Token Reserves -->
      <div class="grid grid-cols-2 gap-x-8">
        <!-- Token0 Reserve -->
        <div class="flex flex-col">
          <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-1">{token0Symbol} Reserve</div>
          <div class="text-sm font-medium text-kong-text-primary">
            {token0Reserve}
          </div>
        </div>

        <!-- Token1 Reserve -->
        <div class="flex flex-col">
          <div class="text-xs text-kong-text-primary/50 uppercase tracking-wider whitespace-nowrap mb-1">{token1Symbol} Reserve</div>
          <div class="text-sm font-medium text-kong-text-primary">
            {token1Reserve}
          </div>
        </div>
      </div>
    </div>
  </div>
</Panel>

<style scoped>
  /* Ensure the dropdown appears above other elements */
  :global(.pool-selector-container) {
    position: relative;
    z-index: 1000;
  }
</style> 