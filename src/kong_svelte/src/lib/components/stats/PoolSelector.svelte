<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { onMount } from 'svelte';
  import { livePools, isLoadingPools, loadPools } from "$lib/stores/poolStore";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import Dropdown from "$lib/components/common/Dropdown.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";

  const { selectedPool, token, formattedTokens, onPoolSelect, isLoading, relevantPools: propRelevantPools, integrationMode = false } = $props<{
    selectedPool: BE.Pool | undefined;
    token: Kong.Token;
    formattedTokens: Kong.Token[];
    onPoolSelect: (pool: BE.Pool) => void;
    relevantPools?: BE.Pool[];
    isLoading?: boolean;
    integrationMode?: boolean;
  }>();

  // Replace manual dropdown state with bindable state
  let isPoolSelectorOpen = $state(false);

  // Pre-compute token lookups
  function getMatchingToken(pool: BE.Pool) {
    // First try to find by canister ID
    const tokenId = pool.address_0 === token.address ? pool.address_1 : pool.address_0;
    const foundToken = formattedTokens?.find(t => t.address === tokenId);
    
    // If not found, try to use the token object from the pool directly
    if (!foundToken) {
      // Create a minimal token object using available data
      const isToken0 = pool.address_0 === tokenId;
      const symbol = isToken0 ? pool.symbol_0 : pool.symbol_1;
      
      // Handle token0/token1 safely with type checking
      // @ts-ignore - token0/token1 may exist on extended Pool objects from API
      const poolToken = isToken0 && pool.token0 ? pool.token0 : 
                       !isToken0 && pool.token1 ? pool.token1 : null;
      
      // Cast to unknown first to avoid type errors as recommended by TypeScript
      return {
        symbol: symbol || 'Unknown',
        address: tokenId,
        name: symbol || 'Unknown',
        // Add a known placeholder image URL to ensure TokenImages can render something
        logo_url: poolToken?.logo_url || `/tokens/${tokenId}.webp`,
        // Add a "placeholder" flag to help with debugging
        _placeholder: true
      } as unknown as Kong.Token;
    }
    
    return foundToken;
  }

  // Get relevant pools for the current token - fallback to livePools if relevantPools prop is not provided
  let relevantPools = $derived(
    propRelevantPools || 
    $livePools.filter(pool => 
      pool.address_0 === token.address || pool.address_1 === token.address
    )
  );

  // Memoize sorted pools and their matching tokens
  let poolsWithTokens = $derived(relevantPools.map(pool => {
    const matchingToken = getMatchingToken(pool);
    const tvl = Number(pool.tvl);

    return { pool, matchingToken, tvl };
  }).sort((a, b) => b.tvl - a.tvl));

  // Remove handleButtonClick and handleDocumentClick as Dropdown handles this

  onMount(() => {
    // Load pools if not already loaded
    if ($livePools.length === 0) {
      loadPools().catch(err => console.error("Failed to load pools:", err));
    }
  });

  // Helper function to safely get token symbol
  function getPoolPairText(pool: BE.Pool) {
    if (!pool) return '';
    
    const token1Symbol = pool.address_0 === token.address 
      ? (pool.symbol_1 || formattedTokens?.find(t => t.address === pool.address_1)?.symbol || 'Unknown')
      : (pool.symbol_0 || formattedTokens?.find(t => t.address === pool.address_0)?.symbol || 'Unknown');
    
    return `${token.symbol} / ${token1Symbol}`;
  }
</script>

<div class="flex flex-col gap-3 relative w-full">
  <Dropdown 
    bind:open={isPoolSelectorOpen} 
    position="bottom-left"
    width="w-full"
    triggerClass="w-full p-0"
    contentClass="max-h-[400px] overflow-y-auto {integrationMode ? 'w-[calc(100%+2px)] -ml-[1px]' : ''}"
  >
    <!-- Trigger Slot -->
    <svelte:fragment slot="trigger">
      <ButtonV2
        variant="outline"
        size="sm"
        className="{integrationMode ? '!border-0 bg-transparent' : '!border-kong-border bg-kong-bg-primary/70'} hover:bg-kong-bg-secondary/30 hover:border-kong-primary/50 w-full {$panelRoundness} transition-all duration-200 !py-3"
      >
        <div class="flex items-center justify-between w-full">
          {#if $isLoadingPools}
            <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded-full border-2 border-kong-text-primary/20 border-t-kong-text-primary animate-spin"></div>
              <span class="text-kong-text-primary/70">Loading pools...</span>
            </div>
          {:else if selectedPool && formattedTokens}
            <div class="flex items-center gap-2">
              <TokenImages
                tokens={[
                  token,
                  selectedPool.address_0 === token.address
                    ? (formattedTokens.find(t => t.address === selectedPool.address_1) || {
                        address: selectedPool.address_1,
                        symbol: selectedPool.symbol_1,
                        name: selectedPool.symbol_1 || 'Unknown',
                        logo_url: (selectedPool as any).token1?.logo_url || `/tokens/${selectedPool.address_1}.webp`
                      } as unknown as Kong.Token)
                    : (formattedTokens.find(t => t.address === selectedPool.address_0) || {
                        address: selectedPool.address_0,
                        symbol: selectedPool.symbol_0,
                        name: selectedPool.symbol_0 || 'Unknown',
                        logo_url: (selectedPool as any).token0?.logo_url || `/tokens/${selectedPool.address_0}.webp`
                      } as unknown as Kong.Token)
                ].filter(Boolean)}
                size={22}
                tooltip={{ text: "", direction: "top" }}
              />
              <span class="text-kong-text-primary font-medium">
                {getPoolPairText(selectedPool)}
              </span>
            </div>
          {:else}
            <div class="text-kong-text-primary/50">No pool selected</div>
          {/if}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-kong-text-primary/50 transform transition-transform duration-200 {isPoolSelectorOpen ? 'rotate-180' : ''}"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
      </ButtonV2>
    </svelte:fragment>

    <!-- Dropdown Content -->
    <svelte:fragment let:getItemClass>
      <!-- Restore original content -->
      {#if $isLoadingPools}
        <div class="p-6 flex flex-col items-center justify-center gap-3">
          <div class="w-6 h-6 rounded-full border-2 border-kong-text-primary/20 border-t-kong-text-primary animate-spin"></div>
          <div class="text-kong-text-primary/70">Loading pools...</div>
        </div>
      {:else if poolsWithTokens.length}
        {#each poolsWithTokens as { pool, matchingToken }}
          <button
            type="button"
            class="{getItemClass()} !p-3 {pool.pool_id === selectedPool?.pool_id ? 'bg-kong-bg-secondary' : ''} w-full"
            onclick={() => {
              onPoolSelect(pool);
              isPoolSelectorOpen = false;
            }}
            role="menuitem"
          >
            <div class="flex items-center gap-2">
              <TokenImages
                tokens={[token, matchingToken].filter(Boolean)}
                size={20}
                overlap={true}
                containerClass=""
                imageWrapperClass=""
                tooltip={{ text: "", direction: "top" }}
              />
              <span class="{pool.pool_id === selectedPool?.pool_id ? 'text-kong-primary' : 'text-kong-text-primary'} group-hover:text-kong-primary text-nowrap">
                {token.symbol} / {matchingToken?.symbol || 
                  (pool.address_0 === token.address ? pool.symbol_1 : pool.symbol_0) || 
                  (((pool as any).token1?.symbol || (pool as any).token0?.symbol) || 
                  'Unknown')}
              </span>
            </div>
            <div class="flex items-center gap-4">
              <div class="{pool.pool_id === selectedPool?.pool_id ? 'text-kong-primary/80' : 'text-kong-text-primary/50'} group-hover:text-kong-primary/80 text-sm">
                TVL: {formatUsdValue(Number(pool.tvl))}
              </div>
            </div>
          </button>
        {/each}
      {:else}
        <div class="p-3 text-kong-text-primary/50 text-center">
          No pools available
        </div>
      {/if}
    </svelte:fragment>
  </Dropdown>
</div>