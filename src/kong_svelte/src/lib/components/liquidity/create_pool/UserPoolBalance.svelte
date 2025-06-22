<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { auth } from "$lib/stores/auth";
  import { livePools } from "$lib/stores/poolStore";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { onMount } from "svelte";
  
  // Props
  let { token0, token1 }: { token0: Kong.Token; token1: Kong.Token } = $props();
  
  // Helper function to format numbers
  function formatNumber(value: number | string | bigint, decimals: number = 2): string {
    const num = typeof value === 'bigint' ? Number(value) : Number(value);
    return formatToNonZeroDecimal(num);
  }
  
  // Get current pool
  let currentPool = $derived(
    $livePools.find(p => 
      (p.address_0 === token0?.address && p.address_1 === token1?.address) ||
      (p.address_1 === token0?.address && p.address_0 === token1?.address)
    )
  );
  
  // Get user's position in this pool by matching token addresses
  let userPosition = $derived(
    currentPool && token0 && token1
      ? $currentUserPoolsStore.processedPools.find(p => 
          (p.address_0 === token0.address && p.address_1 === token1.address) ||
          (p.address_0 === token1.address && p.address_1 === token0.address)
        )
      : null
  );
  
  // Calculate user's share percentage based on their balance vs pool TVL
  let userSharePercentage = $derived(
    userPosition && currentPool?.tvl && userPosition.usd_balance
      ? (Number(userPosition.usd_balance) / Number(currentPool.tvl) * 100)
      : 0
  );
  
  // Use the amounts from the user position directly
  let userToken0Amount = $derived(
    userPosition ? Number(userPosition.amount_0 || 0) : 0
  );
  
  let userToken1Amount = $derived(
    userPosition ? Number(userPosition.amount_1 || 0) : 0
  );
  
  onMount(() => {
    if ($auth?.account?.owner) {
      currentUserPoolsStore.initialize();
    }
  });
</script>

<Panel variant="solid" type="secondary" className="h-full">
  <div class="flex flex-col h-full">
    <h3 class="text-sm uppercase font-medium text-kong-text-primary/90 mb-4">Your Pool Position</h3>
    
    {#if userPosition && currentPool}
      <div class="space-y-4">
        <!-- Token Balances -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <img 
                src={token0.logo_url || '/kong-logo.svg'} 
                alt={token0.symbol}
                class="w-5 h-5 rounded-full"
              />
              <span class="text-sm text-kong-text-primary/80">{token0.symbol}</span>
            </div>
            <span class="text-sm font-medium text-kong-text-primary">
              {formatNumber(userToken0Amount, 4)}
            </span>
          </div>
          
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <img 
                src={token1.logo_url || '/kong-logo.svg'} 
                alt={token1.symbol}
                class="w-5 h-5 rounded-full"
              />
              <span class="text-sm text-kong-text-primary/80">{token1.symbol}</span>
            </div>
            <span class="text-sm font-medium text-kong-text-primary">
              {formatNumber(userToken1Amount, 4)}
            </span>
          </div>
        </div>
        
        <!-- Fees Earned -->
        {#if userPosition.userFeeShare0 || userPosition.userFeeShare1}
          <div class="pt-3 mt-3 border-t border-kong-border/10">
            <div class="space-y-2">
              <span class="text-xs text-kong-text-primary/60 uppercase tracking-wider">Fees Earned</span>
              <div class="flex items-center justify-between">
                <span class="text-sm text-kong-text-primary/80">{token0.symbol}</span>
                <span class="text-sm font-medium text-kong-text-primary">
                  {formatNumber(userPosition.userFeeShare0 || 0, 4)}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-kong-text-primary/80">{token1.symbol}</span>
                <span class="text-sm font-medium text-kong-text-primary">
                  {formatNumber(userPosition.userFeeShare1 || 0, 4)}
                </span>
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Actions -->
        <!-- <div class="flex flex-col gap-2 pt-2">
          <a 
            href="/portfolio" 
            class="text-center text-xs text-kong-accent-blue hover:text-kong-accent-light transition-colors px-3 bg-kong-bg-secondary rounded hover:bg-kong-bg-secondary/80"
          >
            View in Portfolio →
          </a>
        </div> -->
      </div>
    {:else if currentPool}
      <!-- User has no position in existing pool -->
      <div class="flex-1 flex flex-col items-center justify-center text-center py-8">
        <div class="flex items-center gap-2 mb-4">
          <TokenImages 
            tokens={[token0, token1]} 
            size={32} 
            overlap={true}
          />
        </div>
        <p class="text-sm text-kong-text-primary/70 mb-2">
          You don't have a position in the
        </p>
        <p class="text-base font-medium text-kong-text-primary mb-4">
          {token0.symbol}/{token1.symbol} pool
        </p>
        <p class="text-xs text-kong-text-primary/60">
          Add liquidity to start earning fees
        </p>
      </div>
    {:else}
      <!-- No pool exists -->
      <div class="flex-1 flex flex-col items-center justify-center text-center py-8">
        <div class="flex items-center gap-2 mb-4">
          <TokenImages 
            tokens={[token0, token1]} 
            size={32} 
            overlap={true}
          />
        </div>
        <p class="text-sm text-kong-text-primary/70 mb-2">
          No pool exists for
        </p>
        <p class="text-base font-medium text-kong-text-primary mb-4">
          {token0.symbol}/{token1.symbol}
        </p>
        <p class="text-xs text-kong-text-primary/60">
          Be the first to create this pool!
        </p>
      </div>
    {/if}
  </div>
</Panel> 