<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { walletPoolListStore } from "$lib/stores/walletPoolListStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { Droplets, SlidersHorizontal, TrendingUp, DollarSign, ArrowDownUp, Info } from "lucide-svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { tooltip } from "$lib/actions/tooltip";
  import LoadingEllipsis from "$lib/components/common/LoadingEllipsis.svelte";
  import { afterNavigate, goto } from "$app/navigation";
  import { WalletDataService, walletDataStore } from "$lib/services/wallet";
  
  let { initialDataLoading, initError } = $props<{ initialDataLoading: boolean, initError: string | null }>();
  
  let principal = $state(page.params.principalId);
  let isLoading = $state(initialDataLoading || false);
  let loadingError = $state<string | null>(initError);
  
  let selectedPoolId: string | null = $state(null);
  let tooltipPosition = $state({ x: 0, y: 0 });
  let showTooltip = $state(false);
  
  // Format currency (since formatCurrency is not available)
  function formatCurrency(value: number): string {
    return value.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  }
  
  // Sorting state
  let sortBy = $state("value"); // Default sort by value
  let sortDirection = $state("desc"); // Default sort direction is descending
  
  // Pools data
  let allPools = $state<any[]>([]);
  
  // Sorting
  let sortedPools = $derived([...allPools].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case "value":
        comparison = parseFloat(b.usd_balance || '0') - parseFloat(a.usd_balance || '0');
        break;
      case "apy":
        // Handle null/undefined APY values by treating them as 0 for sorting
        const apyA = a.rolling_24h_apy !== undefined && a.rolling_24h_apy !== null ? a.rolling_24h_apy : -1;
        const apyB = b.rolling_24h_apy !== undefined && b.rolling_24h_apy !== null ? b.rolling_24h_apy : -1;
        comparison = apyB - apyA;
        break;
      case "name":
        comparison = `${a.symbol_0}/${a.symbol_1}`.localeCompare(`${b.symbol_0}/${b.symbol_1}`);
        break;
      case "time":
        // If there's a timestamp property, use it. This is just a placeholder.
        // Replace with actual timestamp property if available
        comparison = 0;
        break;
    }
    
    return sortDirection === "asc" ? -comparison : comparison;
  }));
  
  // Calculate totals
  let totalLiquidityValue = $derived(allPools.reduce((sum, pool) => sum + parseFloat(pool.usd_balance || '0'), 0));
  
  // Calculate weighted average APY based on USD value
  let averageAPY = $derived((() => {
    if (!allPools.length || totalLiquidityValue === 0) return 0;
    
    // Calculate the sum of (APY * USD value) for all pools with valid APY
    let totalValueWithAPY = 0;
    const weightedSum = allPools.reduce((sum, pool) => {
      // Skip pools with no APY data
      if (pool.rolling_24h_apy === undefined || pool.rolling_24h_apy === null) return sum;
      
      const usdValue = parseFloat(pool.usd_balance || '0');
      totalValueWithAPY += usdValue;
      return sum + (pool.rolling_24h_apy * usdValue);
    }, 0);
    
    // If no pools have APY data, return 0
    if (totalValueWithAPY === 0) return 0;
    
    // Divide by the total USD value of pools with APY data to get weighted average
    return weightedSum / totalValueWithAPY;
  })());

  function updateSort(column: string) {
    if (sortBy === column) {
      // Toggle direction if clicking the same column
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      // New column, set as default descending for value and apy, ascending for name
      sortBy = column;
      sortDirection = column === "name" ? "asc" : "desc";
    }
  }

  // Calculate earnings based on APY (from UserPool.svelte)
  function calculateEarnings(pool: any, timeframe: number): string {
    if (pool?.rolling_24h_apy === undefined || 
        pool.rolling_24h_apy === null || 
        !pool.usd_balance) {
      return "0.00";
    }

    // Convert APY to daily rate and calculate linear projection
    // APY is already in percentage form (e.g., 5.25 for 5.25%)
    const apyDecimal = pool.rolling_24h_apy / 100;
    const dailyRate = apyDecimal / 365;
    const earnings = parseFloat(pool.usd_balance) * dailyRate * timeframe;

    return formatToNonZeroDecimal(earnings);
  }

  function showAPYDetails(pool: any, event: MouseEvent) {
    selectedPoolId = pool.id;
    // Adjust tooltip position to be more user-friendly
    tooltipPosition = { 
      x: Math.min(event.clientX, window.innerWidth - 300), 
      y: Math.min(event.clientY, window.innerHeight - 300) 
    };
    showTooltip = true;
  }

  function hideAPYDetails() {
    showTooltip = false;
  }

  // Close tooltip when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (showTooltip && !(event.target as Element).closest('.apy-tooltip')) {
      hideAPYDetails();
    }
  }

  // Synchronize with wallet data store
  $effect(() => {
    // Update local loading state based on props and wallet data store
    isLoading = initialDataLoading || $walletDataStore.isLoading;
    
    // Update local error state
    loadingError = initError || $walletDataStore.error;
    
    // Get current principal from URL
    const currentPrincipal = page.params.principalId;
    
    // Check if we need to update our local principal
    if (currentPrincipal && currentPrincipal !== principal) {
      
      allPools = [];
      isLoading = true;
      walletPoolListStore.reset();
      
      principal = currentPrincipal;
    }
    
    if (currentPrincipal && 
        $walletDataStore.currentWallet === currentPrincipal && 
        $walletDataStore.tokens.length > 0 && 
        !$walletDataStore.isLoading) {
      
      if ($walletPoolListStore.walletId !== currentPrincipal || 
          $walletPoolListStore.processedPools.length === 0) {
        loadPoolData(currentPrincipal);
      }
    }
  });
  
  // Update allPools when walletPoolListStore changes
  $effect(() => {
    // Get current principal from URL to ensure we're using the latest value
    const currentPrincipal = page.params.principalId;
    
    // Update loading state based on walletPoolListStore
    if ($walletPoolListStore.walletId === currentPrincipal) {
      isLoading = $walletPoolListStore.loading;
    }
    
    // Clear allPools if the walletPoolListStore has data for a different wallet
    if ($walletPoolListStore.walletId && 
        $walletPoolListStore.walletId !== currentPrincipal) {
      allPools = [];
      return;
    }
    
    // Update allPools from walletPoolListStore only if it matches the current principal
    if ($walletPoolListStore.processedPools.length > 0 && 
        $walletPoolListStore.walletId === currentPrincipal) {
      allPools = [...$walletPoolListStore.processedPools];
    }
  });
  
  // Load pool data for a principal
  async function loadPoolData(principalId: string) {
    if (!principalId || $walletPoolListStore.loading) return;
    
    // Always reset allPools when loading data for a different principal
    if ($walletPoolListStore.walletId !== principalId) {
      allPools = [];
      
      // Set loading state to true when fetching new data
      isLoading = true;
      
      // Reset the store to ensure we don't have stale data
      if ($walletPoolListStore.walletId !== principalId) {
        walletPoolListStore.reset();
      }
    }
    
    // Check if we already have pools for this principal
    if ($walletPoolListStore.walletId === principalId && 
        $walletPoolListStore.processedPools.length > 0) {
      return;
    }
    
    try {
      
      // Set loading state to true when fetching new data
      isLoading = true;
      
      await walletPoolListStore.fetchPoolsForWallet(principalId);
      
      // Check if pools were loaded successfully
      if ($walletPoolListStore.processedPools.length === 0) {
      } else {
      }
    } catch (error) {
      console.error("Error loading pool data:", error);
      loadingError = error instanceof Error ? error.message : "Failed to load pool data";
    }
  }
  
  // Load pools when the component mounts
  onMount(() => {
    // Only add event listeners in browser environment
    if (browser) {
      document.addEventListener('click', handleClickOutside);
    }
  });
  
  // Also check data when navigating to this page
  afterNavigate(() => {
    // Get current principal from URL to ensure we're using the latest value
    const currentPrincipal = page.params.principalId;
    
    // Update our local principal if needed
    if (currentPrincipal !== principal) {
      principal = currentPrincipal;
      
      // Reset pools data when principal changes during navigation
      allPools = [];
      
      // Reset the wallet pool list store
      walletPoolListStore.reset();
    }
    
    if (currentPrincipal && 
        !$walletPoolListStore.loading && 
        ($walletPoolListStore.walletId !== currentPrincipal || 
         $walletPoolListStore.processedPools.length === 0)) {
      
      // If wallet data is already loaded, load pools
      if ($walletDataStore.currentWallet === currentPrincipal && 
          $walletDataStore.tokens.length > 0 && 
          !$walletDataStore.isLoading) {
        loadPoolData(currentPrincipal);
      } else {
        // If wallet data is not loaded yet, set loading state
        isLoading = true;
        
        // Initialize wallet data which will then trigger pool loading
        WalletDataService.initializeWallet(currentPrincipal);
      }
    }
  });
  
  onDestroy(() => {
    // Only remove event listeners in browser environment
    if (browser) {
      document.removeEventListener('click', handleClickOutside);
    }
  });
  
  // Format percentage for display
  function formatPercentage(value: number | undefined | null): string {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(2)}%`;
  }
</script>

<svelte:head>
  <title>Liquidity Positions for {principal} - KongSwap</title>
</svelte:head>

<div class="space-y-6">
  <!-- Summary Panel -->
  <Panel>
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm uppercase font-medium text-kong-text-primary">Liquidity Overview</h3>
      <div class="p-2 rounded-lg bg-kong-primary/10">
        <Droplets class="w-3 h-3 text-kong-primary" />
      </div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 mt-4">
      <div class="flex flex-col p-3 sm:p-4 bg-kong-bg-primary/30 rounded-lg">
        <div class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1">
          <DollarSign class="w-3 h-3 sm:w-4 sm:h-4" />
          <span>Total Value</span>
        </div>
        <div class="text-lg sm:text-xl font-medium">
          {#if $walletPoolListStore.loading || isLoading}
            <LoadingEllipsis color="text-kong-text-primary" size="text-lg sm:text-xl" />
          {:else}
            {formatCurrency(totalLiquidityValue)}
          {/if}
        </div>
      </div>
      
      <div class="flex flex-col p-3 sm:p-4 bg-kong-bg-primary/30 rounded-lg">
        <div class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1">
          <TrendingUp class="w-3 h-3 sm:w-4 sm:h-4" />
          <span class="flex items-center gap-1">
            Weighted APR
            <span 
              class="text-kong-text-secondary hover:text-kong-text-primary transition-colors cursor-help"
              use:tooltip={{ 
                text: "This APR is weighted by the USD value of each position, giving more influence to larger positions.", 
                direction: "top",
                background: "bg-kong-bg-primary",
                paddingClass: "p-3",
                textSize: "sm"
              }}
            >
              <Info class="w-3 h-3" />
            </span>
          </span>
        </div>
        <div class="text-lg sm:text-xl font-medium text-kong-success">
          {#if $walletPoolListStore.loading || isLoading}
            <LoadingEllipsis color="text-kong-text-primary" size="text-lg sm:text-xl" />
          {:else if averageAPY > 0}
            {formatPercentage(averageAPY)}
          {:else}
            <span class="text-kong-text-primary">--</span>
          {/if}
        </div>
      </div>
      
      <div class="flex flex-col p-3 sm:p-4 bg-kong-bg-primary/30 rounded-lg">
        <div class="flex items-center gap-2 text-kong-text-secondary text-sm mb-1">
          <Droplets class="w-3 h-3 sm:w-4 sm:h-4" />
          <span>Active Positions</span>
        </div>
        <div class="text-lg sm:text-xl font-medium">
          {#if $walletPoolListStore.loading || isLoading}
            <LoadingEllipsis color="text-kong-text-primary" size="text-lg sm:text-xl" />
          {:else}
            {allPools.length}
          {/if}
        </div>
      </div>
    </div>
  </Panel>

  <!-- Liquidity Positions Panel -->
  <Panel variant="transparent">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm uppercase font-medium text-kong-text-primary">Liquidity Positions</h3>
      
      <div class="flex items-center gap-2">
        <button class="p-2 rounded-lg hover:bg-kong-bg-primary/60 transition-colors" title="Filter Options">
          <SlidersHorizontal class="w-3 h-3 sm:w-4 sm:h-4 text-kong-text-secondary" />
        </button>
        <div class="p-2 rounded-lg bg-kong-primary/10">
          <Droplets class="w-3 h-3 text-kong-primary" />
        </div>
      </div>
    </div>

    <div>
      {#if $walletPoolListStore.loading || isLoading}
        <div class="flex justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-kong-primary" />
        </div>
      {:else if loadingError}
        <div class="text-center py-8 text-kong-error">
          {loadingError}
        </div>
      {:else if sortedPools.length === 0}
        <div class="text-center py-8 text-kong-text-secondary">
          No liquidity positions found
        </div>
      {:else}
        <!-- Table Headers with sorting - Hidden on mobile -->
        <div class="hidden sm:grid sm:grid-cols-[2fr,1.5fr,1fr,1fr] sm:gap-4 px-4 py-2 text-sm text-kong-text-secondary font-medium border-b border-kong-bg-primary">
          <button 
            class="flex items-center gap-1 text-left hover:text-kong-text-primary transition-colors"
            onclick={() => updateSort("name")}
          >
            <span>Pool</span>
            {#if sortBy === "name"}
              <ArrowDownUp class="w-3 h-3 {sortDirection === 'asc' ? 'rotate-180' : ''}" />
            {/if}
          </button>
          <div>Token Amounts</div>
          <button 
            class="flex items-center gap-1 justify-end hover:text-kong-text-primary transition-colors"
            onclick={() => updateSort("value")}
          >
            <span>Value</span>
            {#if sortBy === "value"}
              <ArrowDownUp class="w-3 h-3 {sortDirection === 'asc' ? 'rotate-180' : ''}" />
            {/if}
          </button>
          <div class="text-right">Share</div>
          <button 
            class="flex items-center gap-1 justify-end hover:text-kong-text-primary transition-colors"
            onclick={() => updateSort("apy")}
            use:tooltip={{ 
              text: "Annual Percentage Yield - Estimated return based on recent trading activity", 
              direction: "top",
              background: "bg-kong-bg-primary",
              paddingClass: "p-2"
            }}
          >
            <span>APR</span>
            {#if sortBy === "apy"}
              <ArrowDownUp class="w-3 h-3 {sortDirection === 'asc' ? 'rotate-180' : ''}" />
            {/if}
          </button>
        </div>
        
        <!-- Mobile sorting controls -->
        <div class="sm:hidden px-4 py-2 mb-2">
          <div class="flex items-center justify-between">
            <span class="text-xs text-kong-text-secondary">Sort by:</span>
            <div class="flex gap-2">
              <button 
                class="px-2 py-1 text-xs rounded {sortBy === 'name' ? 'bg-kong-primary/20 text-kong-primary' : 'bg-kong-bg-primary/50 text-kong-text-secondary'}"
                onclick={() => updateSort("name")}
              >
                Name {#if sortBy === "name"}<span class="text-[0.6rem]">{sortDirection === 'asc' ? '↑' : '↓'}</span>{/if}
              </button>
              <button 
                class="px-2 py-1 text-xs rounded {sortBy === 'value' ? 'bg-kong-primary/20 text-kong-primary' : 'bg-kong-bg-primary/50 text-kong-text-secondary'}"
                onclick={() => updateSort("value")}
              >
                Value {#if sortBy === "value"}<span class="text-[0.6rem]">{sortDirection === 'asc' ? '↑' : '↓'}</span>{/if}
              </button>
              <button 
                class="px-2 py-1 text-xs rounded {sortBy === 'apy' ? 'bg-kong-primary/20 text-kong-primary' : 'bg-kong-bg-primary/50 text-kong-text-secondary'}"
                onclick={() => updateSort("apy")}
              >
              APR {#if sortBy === "apy"}<span class="text-[0.6rem]">{sortDirection === 'asc' ? '↑' : '↓'}</span>{/if}
              </button>
            </div>
          </div>
        </div>
        
        <!-- Table Body -->
        <div class="divide-y divide-kong-bg-primary">
          {#each sortedPools as pool}
            <!-- Desktop view - grid layout -->
            <div class="hidden sm:grid sm:grid-cols-[2fr,1.5fr,1fr,1fr] sm:gap-4 sm:items-center px-4 py-3 hover:bg-kong-bg-primary/30 hover:border-l-2 hover:border-kong-primary transition-all cursor-pointer"
                 onclick={() => goto(`/pools/${pool.address_0}_${pool.address_1}/position`)}>
              <!-- Pool -->
              <div class="flex items-center gap-2">
                <TokenImages
                  tokens={[pool.token0, pool.token1].filter(Boolean)}
                  size={28}
                  overlap={true}
                />
                <div class="text-sm">
                  <div class="font-medium">
                    {pool.symbol_0}/{pool.symbol_1}
                  </div>
                </div>
              </div>

              <!-- Token Amounts -->
              <div class="text-sm">
                <div class="font-medium flex flex-col gap-1">
                  <div class="flex items-center gap-1">
                    <TokenImages
                      tokens={[pool.token0].filter(Boolean)}
                      size={16}
                    /> 
                    <span>{formatToNonZeroDecimal(pool.amount_0)} {pool.symbol_0}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <TokenImages
                      tokens={[pool.token1].filter(Boolean)}
                      size={16}
                    /> 
                    <span>{formatToNonZeroDecimal(pool.amount_1)} {pool.symbol_1}</span>
                  </div>
                </div>
              </div>

              <!-- USD Value -->
              <div class="text-right text-sm">
                <div class="font-medium">
                  ${formatToNonZeroDecimal(pool.usd_balance)}
                </div>
              </div>

              <!-- Pool Share -->
              <div class="text-right text-sm">
                <div class="font-medium text-kong-text-primary">
                  {formatToNonZeroDecimal(pool.poolSharePercentage || 0)}%
                </div>
              </div>

              <!-- APY -->
              <div class="text-right text-sm relative">
                <span 
                  class="font-medium flex items-center gap-1 justify-end ml-auto group cursor-pointer"
                  class:text-kong-success={pool.rolling_24h_apy !== undefined && pool.rolling_24h_apy !== null && pool.rolling_24h_apy > 0}
                  class:text-kong-error={pool.rolling_24h_apy !== undefined && pool.rolling_24h_apy !== null && pool.rolling_24h_apy < 0}
                  class:text-kong-text-secondary={pool.rolling_24h_apy === undefined || pool.rolling_24h_apy === null}
                  use:tooltip={{
                    text: pool.rolling_24h_apy !== undefined && pool.rolling_24h_apy !== null 
                      ? `Based on recent trading activity. Estimated daily earnings: $${calculateEarnings(pool, 1)}`
                      : "APR data is currently unavailable for this pool",
                    direction: "top",
                    background: "bg-kong-bg-primary",
                    paddingClass: "p-2"
                  }}
                  onclick={(e) => showAPYDetails(pool, e)}
                >
                  {#if pool.rolling_24h_apy !== undefined && pool.rolling_24h_apy !== null}
                    {formatPercentage(pool.rolling_24h_apy)}
                  {:else}
                    <span>--</span>
                  {/if}
                  <Info class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </div>
            </div>
            
            <!-- Mobile view - card layout -->
            <div class="sm:hidden p-4 hover:bg-kong-bg-primary/30 hover:border-l-2 hover:border-kong-primary transition-all cursor-pointer"
                 onclick={() => goto(`/pools/${pool.address_0}_${pool.address_1}/position`)}>
              <!-- Pool and Value -->
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <TokenImages
                    tokens={[pool.token0, pool.token1].filter(Boolean)}
                    size={24}
                    overlap={true}
                  />
                  <div class="text-sm font-medium">
                    {pool.symbol_0}/{pool.symbol_1}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-medium">
                    ${formatToNonZeroDecimal(pool.usd_balance)}
                  </div>
                </div>
              </div>
              
              <!-- Token Amounts -->
              <div class="mb-2 text-xs flex flex-col gap-1">
                <div class="flex items-center gap-1">
                  <TokenImages
                    tokens={[pool.token0].filter(Boolean)}
                    size={14}
                  /> 
                  <span>{formatToNonZeroDecimal(pool.amount_0)} {pool.symbol_0}</span>
                </div>
                <div class="flex items-center gap-1">
                  <TokenImages
                    tokens={[pool.token1].filter(Boolean)}
                    size={14}
                  /> 
                  <span>{formatToNonZeroDecimal(pool.amount_1)} {pool.symbol_1}</span>
                </div>
              </div>
              
              <!-- APY -->
              <div class="flex justify-between items-center">
                <div class="text-xs text-kong-text-secondary">APR</div>
                <div 
                  class="flex items-center gap-1 text-sm"
                  class:text-kong-success={pool.rolling_24h_apy !== undefined && pool.rolling_24h_apy !== null && pool.rolling_24h_apy > 0}
                  class:text-kong-error={pool.rolling_24h_apy !== undefined && pool.rolling_24h_apy !== null && pool.rolling_24h_apy < 0}
                  class:text-kong-text-secondary={pool.rolling_24h_apy === undefined || pool.rolling_24h_apy === null}
                  onclick={(e) => showAPYDetails(pool, e)}
                >
                  {#if pool.rolling_24h_apy !== undefined && pool.rolling_24h_apy !== null}
                    {formatPercentage(pool.rolling_24h_apy)}
                  {:else}
                    <span>--</span>
                  {/if}
                  <Info class="w-3 h-3" />
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </Panel>
</div>

{#if showTooltip && selectedPoolId}
  {@const selectedPool = allPools.find(p => p.id === selectedPoolId)}
  {#if selectedPool}
    <div 
      class="apy-tooltip fixed bg-kong-bg-primary border border-kong-border rounded-lg shadow-lg p-4 z-50 w-64"
      style="left: {Math.min(tooltipPosition.x, window.innerWidth - 280)}px; top: {Math.min(tooltipPosition.y + 10, window.innerHeight - 280)}px"
    >
      <div class="flex justify-between items-center mb-3">
        <h4 class="text-sm font-medium">Estimated Earnings</h4>
        <button class="text-kong-text-secondary hover:text-kong-text-primary" onclick={hideAPYDetails}>×</button>
      </div>
      
      {#if selectedPool.rolling_24h_apy !== undefined && selectedPool.rolling_24h_apy !== null}
        <div class="grid grid-cols-2 gap-2">
          {#each [{ label: "Daily", days: 1 }, { label: "Weekly", days: 7 }, { label: "Monthly", days: 30 }, { label: "Yearly", days: 365 }] as period}
            <div class="bg-kong-bg-secondary/30 rounded-lg p-2 flex flex-col">
              <span class="text-xs text-kong-text-secondary">{period.label}</span>
              <span class="text-sm font-medium">${calculateEarnings(selectedPool, period.days)}</span>
            </div>
          {/each}
        </div>
        
        <div class="mt-3 pt-2 border-t border-kong-border/20 text-xs text-kong-text-secondary">
          Based on current APR: {formatPercentage(selectedPool.rolling_24h_apy)}
          <div class="mt-1 text-xs text-kong-text-secondary/70">
            Estimates are based on current rates and may vary over time.
          </div>
        </div>
      {:else}
        <div class="py-3 text-center">
          <p class="text-kong-text-secondary text-sm">APR data is currently unavailable for this pool.</p>
          <p class="text-xs mt-2 text-kong-text-secondary/70">Earnings estimates cannot be calculated without APR information.</p>
        </div>
      {/if}
    </div>
  {/if}
{/if}
