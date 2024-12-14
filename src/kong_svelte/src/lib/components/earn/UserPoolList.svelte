<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { poolStore } from "$lib/services/pools/poolStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import UserPool from "$lib/components/liquidity/pools/UserPool.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();
  
  export let searchQuery: string = '';

  let loading = true;
  let error: string | null = null;
  let processedPools: any[] = [];
  let selectedPool = null;
  let showUserPoolModal = false;
  let sortDirection = 'desc';

  // Process pool balances when they update
  $: balances = $poolStore.userPoolBalances;
  $: {
    if (Array.isArray(balances)) {
      processedPools = balances
        .filter(poolBalance => {
          const hasBalance = Number(poolBalance.balance) > 0;
          return hasBalance;
        })
        .map(poolBalance => {
          const token0 = $tokenStore.tokens.find(t => t.symbol === poolBalance.symbol_0);
          const token1 = $tokenStore.tokens.find(t => t.symbol === poolBalance.symbol_1);
          
          const searchableText = [
            poolBalance.symbol_0,
            poolBalance.symbol_1,
            `${poolBalance.symbol_0}/${poolBalance.symbol_1}`,
            poolBalance.name || '',
            token0?.name || '',
            token1?.name || '',
            token0?.canister_id || '',
            token1?.canister_id || '',
          ].join(' ').toLowerCase();
          
          return {
            id: poolBalance.name,
            name: poolBalance.name,
            symbol: poolBalance.symbol,
            symbol_0: poolBalance.symbol_0,
            symbol_1: poolBalance.symbol_1,
            balance: poolBalance.balance.toString(),
            amount_0: poolBalance.amount_0,
            amount_1: poolBalance.amount_1,
            usd_balance: poolBalance.usd_balance,
            address_0: poolBalance.symbol_0,
            address_1: poolBalance.symbol_1,
            searchableText
          };
        });
    } else {
      processedPools = [];
    }
  }

  // Filter pools based on search
  $: filteredPools = processedPools
    .filter(poolItem => {
      if (!searchQuery) return true;
      return poolItem.searchableText.includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => sortDirection === 'desc' ? 
      Number(b.usd_balance) - Number(a.usd_balance) : 
      Number(a.usd_balance) - Number(b.usd_balance)
    );

  function handlePoolItemClick(poolItem) {
    selectedPool = poolItem;
    showUserPoolModal = true;
    dispatch('poolClick', poolItem);
  }
</script>

<div class="pool-list">
  {#if loading && processedPools.length === 0}
    <div class="loading-state" in:fade>
      <p>Loading positions...</p>
    </div>
  {:else if error}
    <div class="error-state" in:fade>
      <p>{error}</p>
    </div>
  {:else if filteredPools.length === 0}
    <div class="empty-state" in:fade>
      {#if searchQuery}
        <p>No pools found matching "{searchQuery}"</p>
      {:else}
        <p>No active positions</p>
      {/if}
    </div>
  {:else}
    {#each filteredPools as poolItem (poolItem.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div 
        class="pool-item" 
        in:slide={{ duration: 200 }}
        on:click={() => handlePoolItemClick(poolItem)}
        role="button"
        tabindex="0"
      >
        <div class="pool-content">
          <div class="pool-left">
            <TokenImages 
              tokens={[
                $tokenStore.tokens.find(token => token.symbol === poolItem.symbol_0),
                $tokenStore.tokens.find(token => token.symbol === poolItem.symbol_1)
              ]} 
              size={36}
            />
            <div class="pool-info">
              <div class="pool-pair">{poolItem.symbol_0}/{poolItem.symbol_1}</div>
              <div class="pool-balance">
                {Number(poolItem.balance).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8
                })} LP
              </div>
            </div>
          </div>
          <div class="pool-right">
            <div class="value-info">
              <div class="usd-value">
                ${formatToNonZeroDecimal(poolItem.usd_balance)}
              </div>
            </div>
            <div class="view-details">
              <span class="details-text">View Details</span>
              <span class="details-arrow">→</span>
            </div>
          </div>
        </div>
      </div>
    {/each}
  {/if}
</div>

{#if selectedPool}
  <UserPool
    pool={selectedPool}
    bind:showModal={showUserPoolModal}
    on:close={() => showUserPoolModal = false}
  />
{/if}

<style lang="postcss">
  .pool-list {
    @apply flex flex-col gap-2;
  }

  .pool-item {
    @apply bg-gray-800/50 rounded-lg p-4 cursor-pointer 
           hover:bg-gray-800/70 transition-all duration-200
           border border-transparent hover:border-blue-500/30;
  }

  .pool-content {
    @apply flex justify-between items-center w-full;
  }

  .pool-left {
    @apply flex items-center gap-4;
  }

  .pool-info {
    @apply flex flex-col gap-1;
  }

  .pool-pair {
    @apply text-lg font-medium text-white/95;
  }

  .pool-balance {
    @apply text-sm text-white/70;
  }

  .pool-right {
    @apply flex items-center gap-1;
  }

  .value-info {
    @apply flex flex-col items-end;
  }

  .usd-value {
    @apply text-base font-medium text-white/95;
  }

  .view-details {
    @apply text-sm text-blue-400 ml-4 flex items-center gap-1;
  }

  .details-text {
    @apply block;
    @apply sm:block hidden;
  }

  .details-arrow {
    @apply block;
  }

  .loading-state, .error-state, .empty-state {
    @apply flex flex-col items-center justify-center gap-3
           min-h-[160px] text-white/40 text-sm;
  }

  .error-state {
    @apply text-red-400;
  }

  .loading-state {
    @apply flex flex-col items-center justify-center gap-3
           min-h-[160px] text-white/40 text-sm animate-pulse;
  }
</style> 