<script lang="ts">
  import { portal } from 'svelte-portal';
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import type { Pool } from "$lib/services/pools";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
    import ButtonV2 from '../common/ButtonV2.svelte';
    import { goto } from '$app/navigation';

  export let selectedPool: Pool | undefined;
  export let token: FE.Token;
  export let formattedTokens: FE.Token[];
  export let relevantPools: Pool[];
  export let onPoolSelect: (pool: Pool) => void;

  let isPoolSelectorOpen = false;
  let selectorButton: HTMLElement;
  let dropdownPosition: { top: number; left: number; width: number } | null = null;

  function updateDropdownPosition() {
    if (selectorButton) {
      const rect = selectorButton.getBoundingClientRect();
      dropdownPosition = {
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      };
    }
  }
</script>

  <div class="flex flex-col gap-3">
    <!-- Pool Selection Dropdown -->
    <div class="relative w-full flex items-center gap-2">
      <button
        bind:this={selectorButton}
        type="button"
        on:click|stopPropagation={() => {
          isPoolSelectorOpen = !isPoolSelectorOpen;
          if (isPoolSelectorOpen) {
            updateDropdownPosition();
          }
        }}
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
      
      {#if isPoolSelectorOpen && dropdownPosition}
        <div use:portal>
          <!-- Backdrop -->
          <div 
            class="fixed inset-0 z-[998] bg-black/20"
            on:click|stopPropagation={() => isPoolSelectorOpen = false}
          />
          
          <!-- Dropdown -->
          <div
            class="fixed z-[999] bg-kong-bg-dark rounded-lg shadow-xl max-h-[400px] overflow-y-auto border border-white/10"
            style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; width: {dropdownPosition.width}px;"
            on:click|stopPropagation
          >
            {#if relevantPools?.length}
              {#each relevantPools as pool}
                <button
                  type="button"
                  class="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors duration-200 {pool.pool_id === selectedPool?.pool_id ? 'bg-white/10' : ''}"
                  on:click|stopPropagation={() => {
                    onPoolSelect(pool);
                    isPoolSelectorOpen = false;
                  }}
                >
                  <div class="flex items-center gap-2">
                    <TokenImages
                      tokens={[
                        token,
                        formattedTokens?.find(t => 
                          t.canister_id === (pool.address_0 === token.canister_id 
                            ? pool.address_1 
                            : pool.address_0)
                        )
                      ].filter(Boolean)}
                      size={20}
                      overlap={true}
                    />
                    <span class="text-kong-text-primary">
                      {token.symbol} / {formattedTokens?.find(t => 
                        t.canister_id === (pool.address_0 === token.canister_id 
                          ? pool.address_1 
                          : pool.address_0)
                      )?.symbol}
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
        </div>
      {/if}
    </div>
  </div>
