<!-- src/kong_svelte/src/lib/components/nav/sidebar/TokenList.svelte -->
<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import { tokenLogoStore, fetchTokenLogo } from "$lib/services/tokens/tokenLogos";
  import { formattedTokens } from "$lib/stores/formattedTokens";
  import { toggleFavoriteToken } from "$lib/services/tokens/favorites";

  export let tokens: any[] = [];
  let searchQuery = '';
  let searchInput: HTMLInputElement;
  let hideZeroBalances = false;
  let sortBy = 'value'; // 'value' or 'name'
  let sortDirection = 'desc'; // 'asc' or 'desc'

  // Process and sort tokens data when it changes
  $: processedTokens = tokens
    .map((token) => {
      const formattedToken = $formattedTokens?.find((t) => t.canister_id === token.canister_id) || {};
      return {
        ...token,
        ...formattedToken,
        logo: $tokenLogoStore[token.canister_id],
        value: Number(token.balance || 0)
      };
    })
    .sort((a, b) => {
      // Sort by favorites first
      if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
      
      // Then sort by selected criteria
      if (sortBy === 'value') {
        return sortDirection === 'desc' ? b.value - a.value : a.value - b.value;
      } else {
        return sortDirection === 'desc' 
          ? b.name?.localeCompare(a.name || '') 
          : a.name?.localeCompare(b.name || '');
      }
    });

  // Filter tokens based on search query and zero balance setting
  $: filteredTokens = processedTokens.filter(token => {
    const matchesSearch = token.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         token.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         token.canister_id?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (hideZeroBalances) {
      return matchesSearch && token.value > 0;
    }
    return matchesSearch;
  });

  // Fetch logos for tokens that don't have them
  $: {
    processedTokens.forEach(token => {
      if (!$tokenLogoStore[token.canister_id]) {
        fetchTokenLogo(token.canister_id);
      }
    });
  }

  function toggleSort(criteria: string) {
    if (sortBy === criteria) {
      sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      sortBy = criteria;
      sortDirection = 'desc';
    }
  }
</script>

<div class="token-list">
  <div class="search-section">
    <input
      bind:this={searchInput}
      type="text"
      placeholder="Search tokens..."
      bind:value={searchQuery}
      class="search-input"
    />
    <div class="controls">
      <button 
        class="sort-button"
        class:active={sortBy === 'value'}
        on:click={() => toggleSort('value')}
      >
        Value {sortBy === 'value' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}
      </button>
      <button 
        class="filter-button"
        class:active={hideZeroBalances}
        on:click={() => hideZeroBalances = !hideZeroBalances}
      >
        Hide 0 Balances
      </button>
    </div>
  </div>

  <div class="tokens-list">
    {#each filteredTokens as token (token.canister_id)}
      <div transition:slide|local={{ duration: 150 }}>
        <TokenRow
          {token}
          on:toggleFavorite={() => toggleFavoriteToken(token.canister_id)}
        />
      </div>
    {/each}
    
    {#if filteredTokens.length === 0}
      <div class="empty-state">
        <p>{searchQuery ? 'No tokens found' : 'No tokens available'}</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .token-list {
    @apply flex flex-col h-full;
    background: linear-gradient(to bottom, rgba(26, 27, 35, 0.3), transparent);
  }

  .search-section {
    @apply flex flex-col gap-2 p-3;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .search-input {
    @apply w-full text-sm bg-[#2a2d3d]/30 text-white
           px-4 py-2.5 rounded-lg outline-none
           transition-all duration-200;
  }

  .search-input:hover {
    @apply bg-[#2a2d3d]/50;
  }

  .search-input:focus {
    @apply bg-[#2a2d3d]/50;
    box-shadow: 0 0 0 2px rgba(58, 62, 82, 0.8);
  }

  .search-input::placeholder {
    @apply text-white/40;
  }

  .controls {
    @apply flex items-center gap-2;
  }

  .sort-button,
  .filter-button {
    @apply px-3 py-2 text-sm font-medium
           text-white/60 bg-[#2a2d3d]/30
           rounded-lg transition-all duration-200
           hover:text-white hover:bg-[#2a2d3d]/50;
  }

  .sort-button.active,
  .filter-button.active {
    @apply bg-[#2a2d3d] text-white;
    box-shadow: 0 0 0 1px rgba(58, 62, 82, 0.8);
  }

  .tokens-list {
    @apply flex-1 overflow-y-auto px-3;
  }

  .tokens-list > div {
    @apply mb-1;
  }

  .tokens-list::-webkit-scrollbar {
    @apply w-1;
  }

  .tokens-list::-webkit-scrollbar-track {
    @apply bg-transparent;
  }

  .tokens-list::-webkit-scrollbar-thumb {
    @apply bg-white/10 rounded-sm;
  }

  .empty-state {
    @apply flex flex-col items-center justify-center
           min-h-[200px] mt-4 text-white/40 text-sm
           bg-[#2a2d3d]/20 rounded-lg
           border border-white/5;
  }
</style>
