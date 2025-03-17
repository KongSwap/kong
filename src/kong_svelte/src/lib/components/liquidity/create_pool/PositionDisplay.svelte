<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { livePools } from "$lib/services/pools/poolStore";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { onMount, onDestroy } from "svelte";
  import { auth } from "$lib/services/auth";
  import { BigNumber } from "bignumber.js";
  import { calculateUserPoolPercentage } from "$lib/utils/liquidityUtils";

  export let token0: FE.Token | null = null;
  export let token1: FE.Token | null = null;
  export let layout: "vertical" | "horizontal" = "vertical";

  // For debouncing token changes
  let tokenChangeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastToken0: string | null = null;
  let lastToken1: string | null = null;

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
  $: userPool = $currentUserPoolsStore.filteredPools.find(
    (p) => p.symbol_0 === token0Symbol && p.symbol_1 === token1Symbol,
  );
  
  // Check if position exists by checking if userPool exists and has been properly loaded
  $: hasPosition = !!userPool && userPool.id != null;
  $: hasTokens = !!token0Symbol && !!token1Symbol;
  
  // Calculate user's percentage of the pool using the imported function
  $: userPoolPercentage = calculateUserPoolPercentage(
    pool?.balance_0, 
    pool?.balance_1, 
    userPool?.amount_0, 
    userPool?.amount_1
  );
  
  // Helper function to get token decimals
  function getTokenDecimals(
    token: FE.Token | null | string, 
    userPoolToken: any,
    tokenIndex: number
  ): number {
    if (typeof token === 'object' && token?.decimals) {
      return token.decimals;
    } else if (userPoolToken?.decimals) {
      return userPoolToken.decimals;
    }
    // Default values - most ICP tokens use 8, ckUSDT uses 6
    return tokenIndex === 0 ? 8 : 6;
  }
  
  // Initialize store when connected
  onMount(async () => {
    if ($auth.isConnected && token0Symbol && token1Symbol) {
      await refreshUserPools();
    }
  });
  
  // Re-initialize when tokens change with debouncing
  $: if (token0Symbol && token1Symbol && $auth.isConnected) {
    // Only trigger refresh if tokens actually changed
    if (token0Symbol !== lastToken0 || token1Symbol !== lastToken1) {
      lastToken0 = token0Symbol;
      lastToken1 = token1Symbol;
      
      // Clear any existing timer
      if (tokenChangeTimer) {
        clearTimeout(tokenChangeTimer);
      }
      
      // Debounce the update to prevent rapid multiple calls
      tokenChangeTimer = setTimeout(() => {
        refreshUserPools();
      }, 200); // 200ms debounce
    }
  }
  
  // Cleanup on component destroy
  onDestroy(() => {
    if (tokenChangeTimer) {
      clearTimeout(tokenChangeTimer);
    }
  });
  
  // Function to refresh user pools - moved to a separate function for reuse
  async function refreshUserPools() {
    try {
      await currentUserPoolsStore.initialize();
    } catch (error) {
      console.error("Error refreshing user pools:", error);
    }
  }
  
  // Helper to safely convert value to BigNumber
  function toBigNumber(value: any): BigNumber {
    if (!value) return new BigNumber(0);
    try {
      return new BigNumber(value.toString());
    } catch (error) {
      console.error("Error converting to BigNumber:", error);
      return new BigNumber(0);
    }
  }

  // Format number for display with proper decimal places
  function formatNumber(value: BigNumber | string | number | undefined): string {
    if (!value) return "0";
    const bn = typeof value === 'object' && 'toFormat' in value ? value : toBigNumber(value);
    return bn.toFormat(8, BigNumber.ROUND_DOWN);
  }
</script>

{#if hasTokens}
  <Panel variant="transparent" className="bg-black/20">
    {#if layout === "horizontal"}
      <div class="flex flex-col gap-4">
        <!-- Pool Title Row -->
        <div class="flex items-center justify-between">
          <div class="flex items-cente r gap-3">
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
                  {formatNumber(userPool?.balance)}
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
                  {formatNumber(userPool?.amount_0)}
                </div>
              </div>

              <div>
                <div
                  class="text-kong-text-primary/40 text-xs uppercase tracking-wider mb-1"
                >
                  {token1Symbol}
                </div>
                <div class="text-kong-text-primary/90 font-medium tabular-nums">
                  {formatNumber(userPool?.amount_1)}
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
              {formatNumber(userPool?.balance)}
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
                  {formatNumber(userPool?.amount_0)}
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
                  {formatNumber(userPool?.amount_1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </Panel>
{/if}