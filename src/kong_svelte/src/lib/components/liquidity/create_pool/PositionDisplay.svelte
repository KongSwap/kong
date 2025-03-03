<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { livePools } from "$lib/services/pools/poolStore";
  import { userPoolListStore } from "$lib/stores/userPoolListStore";
  import { onMount } from "svelte";
  import { auth } from "$lib/services/auth";

  export let token0: FE.Token | null = null;
  export let token1: FE.Token | null = null;
  export let decimals: number = 8;
  export let layout: "vertical" | "horizontal" = "vertical";

  // Get objects or null values for TokenImages component
  $: tokenObj0 = typeof token0 === 'object' ? token0 : null;
  $: tokenObj1 = typeof token1 === 'object' ? token1 : null;

  // Get token symbols regardless of whether we have objects or strings
  $: token0Symbol = typeof token0 === 'object' ? token0?.symbol : token0;
  $: token1Symbol = typeof token1 === 'object' ? token1?.symbol : token1;

  // Calculate percentage of total pool using symbols for lookup
  $: pool = $livePools.find(
    (p) => p.symbol_0 === token0Symbol && p.symbol_1 === token1Symbol,
  );
  $: userPool = $userPoolListStore.filteredPools.find(
    (p) => p.symbol_0 === token0Symbol && p.symbol_1 === token1Symbol,
  );
  
  // Check if position exists by checking if userPool exists and has been properly loaded
  $: hasPosition = !!userPool && userPool.id != null;
  $: hasTokens = !!token0Symbol && !!token1Symbol;
  
  // Calculate user's percentage of the pool
  $: userPoolPercentage = calculateUserPoolPercentage(pool, userPool, token0, token1);
  
  // Initialize store when connected
  onMount(async () => {
    if ($auth.isConnected && token0Symbol && token1Symbol) {
      await userPoolListStore.initialize();
    }
  });
  
  // Re-initialize when tokens change
  $: if (token0Symbol && token1Symbol && $auth.isConnected) {
    userPoolListStore.initialize();
  }
  
  function calculateUserPoolPercentage(
    pool: BE.Pool | undefined, 
    userPool: any, 
    token0: FE.Token | null | string, 
    token1: FE.Token | null | string
  ): string {
    if (!pool || !userPool) {
      return "0";
    }
    
    try {
      // Safely get values and handle potential undefined/null
      const userAmount0 = Number(userPool.amount_0 || 0);
      const userAmount1 = Number(userPool.amount_1 || 0);
      
      // Get token decimals directly from the token objects if they are objects
      // Otherwise fall back to userPool tokens or defaults
      let token0Decimals = 8; // Default for most IC tokens
      let token1Decimals = 8; // Default for ckUSDT
      
      if (typeof token0 === 'object' && token0?.decimals) {
        token0Decimals = token0.decimals;
      } else if (userPool.token0?.decimals) {
        token0Decimals = userPool.token0.decimals;
      }
      
      if (typeof token1 === 'object' && token1?.decimals) {
        token1Decimals = token1.decimals;
      } else if (userPool.token1?.decimals) {
        token1Decimals = userPool.token1.decimals;
      }
      
      // Convert BigInt pool balances to numbers with appropriate decimal scaling
      const poolBalance0 = Number(pool.balance_0) / Math.pow(10, token0Decimals);
      const poolBalance1 = Number(pool.balance_1) / Math.pow(10, token1Decimals);
      
      if (poolBalance0 === 0 || poolBalance1 === 0) return "0";
      
      // Calculate percentages based on both tokens
      const percentage0 = (userAmount0 / poolBalance0) * 100;
      const percentage1 = (userAmount1 / poolBalance1) * 100;
      
      // Use the average of both percentages (they should be very close)
      const averagePercentage = (percentage0 + percentage1) / 2;
      
      // Format to 2 decimal places
      return averagePercentage.toFixed(2);
    } catch (error) {
      console.error("Error calculating pool percentage:", error);
      return "0";
    }
  }
</script>

{#if hasTokens}
  <Panel variant="transparent" className="bg-black/20">
    {#if layout === "horizontal"}
      <div class="flex flex-col gap-4">
        <!-- Pool Title Row -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <TokenImages tokens={[tokenObj0, tokenObj1]} size={24} overlap />
            <span
              class="font-medium text-kong-text-primary/90 whitespace-nowrap text-base"
            >
              {token0Symbol}/{token1Symbol} Pool
            </span>
          </div>

          <!-- Status -->
          <div class="flex items-center">
            {#if hasPosition}{:else}
              <span
                class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-500 whitespace-nowrap"
              >
                New Position
              </span>
            {/if}
          </div>
        </div>

        <!-- Position Info Row -->
        {#if hasPosition}
          <Panel variant="transparent" className="">
            <div class="grid grid-cols-3 w-full gap-6">
              <div>
                <div
                  class="text-kong-text-primary/40 text-xs uppercase tracking-wider mb-1"
                >
                  LP Tokens
                </div>
                <div class="text-kong-text-primary/90 font-medium tabular-nums">
                  {Number(userPool?.balance)}
                </div>
                <div class="text-kong-text-primary/40 text-xs mt-1">
                  {userPoolPercentage}% of pool
                </div>
              </div>

              <div>
                <div
                  class="text-kong-text-primary/40 text-xs uppercase tracking-wider mb-1"
                >
                  {token0Symbol}
                </div>
                <div class="text-kong-text-primary/90 font-medium tabular-nums">
                  {Number(userPool?.amount_0)}
                </div>
              </div>

              <div>
                <div
                  class="text-kong-text-primary/40 text-xs uppercase tracking-wider mb-1"
                >
                  {token1Symbol}
                </div>
                <div class="text-kong-text-primary/90 font-medium tabular-nums">
                  {Number(userPool?.amount_1)}
                </div>
              </div>
            </div>
          </Panel>
        {/if}
      </div>
    {:else}
      <!-- Vertical Layout -->
      <div class="flex items-center justify-between mb-5">
        <div class="flex flex-col">
          {#if hasPosition}
            <div
              class="text-kong-text-primary/60 text-sm font-medium uppercase tracking-wider"
            >
              Current Position
            </div>
            <div class="text-kong-text-primary/40 text-xs mt-1">
              {userPoolPercentage}% of pool
            </div>
          {:else}
            <div class="flex flex-col gap-1">
              <div class="inline-flex items-center gap-2">
                <span
                  class="text-sm font-medium uppercase tracking-wider text-kong-text-primary/90"
                >
                  New Position
                </span>
                <span
                  class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300"
                >
                  First LP
                </span>
              </div>
            </div>
          {/if}
        </div>
        <div class="flex items-center gap-2 bg-white/5 py-1.5 px-3 rounded-lg">
          <TokenImages tokens={[tokenObj0, tokenObj1]} size={20} overlap />
          <span class="text-kong-text-primary/60 text-sm font-medium">
            {token0Symbol}/{token1Symbol}
          </span>
        </div>
      </div>

      {#if hasPosition}
        <div class="flex flex-col gap-3">
          <div class="bg-black/20 rounded-lg p-4">
            <div
              class="text-kong-text-primary/40 text-xs uppercase tracking-wider mb-1.5"
            >
              LP Tokens
            </div>
            <div
              class="text-kong-text-primary/90 text-lg font-medium tabular-nums"
            >
              {Number(userPool?.balance)}
            </div>
          </div>

          <div class="bg-black/20 rounded-lg p-4">
            <div
              class="text-kong-text-primary/40 text-xs uppercase tracking-wider mb-3"
            >
              Pooled Assets
            </div>
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages tokens={[tokenObj0]} size={24} />
                  <span class="text-kong-text-primary/90 font-medium"
                    >{token0Symbol}</span
                  >
                </div>
                <span
                  class="text-kong-text-primary/90 font-medium tabular-nums"
                >
                  {Number(userPool?.amount_0)}
                </span>
              </div>
              <div class="h-px bg-white/5" />
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages tokens={[tokenObj1]} size={24} />
                  <span class="text-kong-text-primary/90 font-medium"
                    >{token1Symbol}</span
                  >
                </div>
                <span
                  class="text-kong-text-primary/90 font-medium tabular-nums"
                >
                  {Number(userPool?.amount_1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </Panel>
{/if}
