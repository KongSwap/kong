<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { onMount } from 'svelte';

  const { selectedPool, token, formattedTokens, relevantPools, onPoolSelect } = $props<{
    selectedPool: BE.Pool | undefined;
    token: FE.Token;
    formattedTokens: FE.Token[];
    relevantPools: BE.Pool[];
    onPoolSelect: (pool: BE.Pool) => void;
  }>();

  let isPoolSelectorOpen = $state(false);
  let dropdownRef = $state<HTMLElement | null>(null);

  // Pre-compute token lookups
  function getMatchingToken(pool: BE.Pool) {
    const tokenId = pool.address_0 === token.canister_id ? pool.address_1 : pool.address_0;
    return formattedTokens?.find(t => t.canister_id === tokenId);
  }

  // Memoize sorted pools and their matching tokens
  let poolsWithTokens = $derived(relevantPools.map(pool => ({
    pool,
    matchingToken: getMatchingToken(pool),
    tvl: Number(pool.tvl)
  })).sort((a, b) => b.tvl - a.tvl));

  function handleButtonClick(event: MouseEvent) {
    event.stopPropagation();
    isPoolSelectorOpen = !isPoolSelectorOpen;
  }

  function handleDocumentClick(event: MouseEvent) {
    const target = event.target as Node;
    if (isPoolSelectorOpen && dropdownRef && !dropdownRef.contains(target)) {
      isPoolSelectorOpen = false;
    }
  }

  onMount(() => {
    document.body.addEventListener('click', handleDocumentClick);
    return () => document.body.removeEventListener('click', handleDocumentClick);
  });
</script>

<div class="flex flex-col gap-3">
  <div class="relative w-full flex items-center gap-2" bind:this={dropdownRef}>
    <button
      type="button"
      on:click={handleButtonClick}
      class="w-full flex items-center justify-between p-3 bg-kong-bg-dark/60 hover:bg-kong-bg-dark rounded-lg transition-colors duration-200"
    >
      {#if selectedPool && formattedTokens}
        <div class="flex items-center gap-2">
          <TokenImages
            tokens={[
              token,
              formattedTokens.find(t => 
                t.canister_id === (selectedPool.address_0 === token.canister_id 
                  ? selectedPool.address_1 
                  : selectedPool.address_0)
              )
            ].filter(Boolean)}
            size={20}
            overlap={true}
          />
          <span class="text-kong-text-primary font-medium">
            {token.symbol} / {formattedTokens.find(t => 
              t.canister_id === (selectedPool.address_0 === token.canister_id 
                ? selectedPool.address_1 
                : selectedPool.address_0)
            )?.symbol}
          </span>
          <span class="text-kong-text-primary/50 text-sm">
            Pool #{selectedPool.pool_id}
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
    </button>
    
    {#if isPoolSelectorOpen}
      <div 
        class="absolute top-full left-0 right-0 mt-1 z-[999] bg-kong-bg-dark rounded-lg shadow-xl max-h-[400px] overflow-y-auto border border-white/10"
        on:click|stopPropagation
      >
        {#if poolsWithTokens.length}
          {#each poolsWithTokens as { pool, matchingToken }}
            <button
              type="button"
              class="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors duration-200 {pool.pool_id === selectedPool?.pool_id ? 'bg-white/10' : ''}"
              on:click={() => {
                onPoolSelect(pool);
                isPoolSelectorOpen = false;
              }}
            >
              <div class="flex items-center gap-2">
                <TokenImages
                  tokens={[token, matchingToken].filter(Boolean)}
                  size={20}
                  overlap={true}
                />
                <span class="text-kong-text-primary">
                  {token.symbol} / {matchingToken?.symbol}
                </span>
              </div>
              <div class="flex items-center gap-4">
                <div class="text-kong-text-primary/50 text-sm">
                  TVL: {formatUsdValue(Number(pool.tvl) / 1e6)}
                </div>
                <div class="text-kong-text-primary/50 text-sm">
                  Pool #{pool.pool_id}
                </div>
              </div>
            </button>
          {/each}
        {:else}
          <div class="p-3 text-kong-text-primary/50 text-center">
            No pools available
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>