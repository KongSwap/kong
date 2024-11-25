<!-- src/kong_svelte/src/lib/components/nav/sidebar/TokenList.svelte -->
<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import { tokenLogoStore, fetchTokenLogo } from "$lib/services/tokens/tokenLogos";
  import { formattedTokens } from "$lib/stores/formattedTokens";
  import { toggleFavoriteToken } from "$lib/services/tokens/favorites";
  import { onMount } from 'svelte';

  export let tokens: any[] = [];
  let searchQuery = '';
  let searchInput: HTMLInputElement;
  let hideZeroBalances = false;
  let sortBy = 'value';
  let sortDirection = 'desc';
  let isPasting = false;
  let searchDebounceTimer: NodeJS.Timeout;
  let debouncedSearchQuery = '';

  onMount(() => {
    // Focus search input on mount
    searchInput?.focus();
  });

  // Process and sort tokens data when it changes
  $: processedTokens = tokens
    .map((token) => {
      const formattedToken = $formattedTokens?.find((t) => t.canister_id === token.canister_id) || {};
      return {
        ...token,
        ...formattedToken,
        logo: $tokenLogoStore[token.canister_id],
        value: Number(token.balance || 0),
        searchableText: `${token.name} ${token.symbol} ${token.canister_id}`.toLowerCase()
      };
    })
    .sort((a, b) => {
      // Sort by favorites first
      if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
      
      // Then sort by value
      return sortDirection === 'desc' ? b.value - a.value : a.value - b.value;
    });

  // Debounce search input
  $: {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchQuery = searchQuery.toLowerCase();
    }, 150);
  }

  // Filter tokens based on search query and zero balance setting
  $: filteredTokens = processedTokens.filter(token => {
    const matchesSearch = !debouncedSearchQuery || token.searchableText.includes(debouncedSearchQuery);
    
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

  function handleAddLiquidity() {
    console.log('Add liquidity clicked');
  }

  async function handlePaste() {
    try {
      isPasting = true;
      const text = await navigator.clipboard.readText();
      // Clean the pasted text - remove whitespace and common separators
      const cleanedText = text.trim().replace(/[,\s\n\t]/g, '');
      searchQuery = cleanedText;
      searchInput.focus();
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    } finally {
      isPasting = false;
    }
  }

  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    // Paste shortcut
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      handlePaste();
    }
    // Clear search on Escape
    else if (event.key === 'Escape' && searchQuery) {
      event.preventDefault();
      searchQuery = '';
      searchInput.focus();
    }
    // Focus search on forward slash
    else if (event.key === '/' && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  }
</script>

<div class="token-list" on:keydown={handleKeydown}>
  <div class="tokens-header">
    <div class="controls-wrapper">
      <div class="search-section">
        <div class="search-input-wrapper">
          <input
            bind:this={searchInput}
            bind:value={searchQuery}
            type="text"
            placeholder="Search tokens"
            class="search-input"
            on:keydown={handleKeydown}
          />
          <button 
            class="action-button"
            on:click|stopPropagation={searchQuery ? () => {
              searchQuery = '';
              searchInput.focus();
            } : handlePaste}
          >
            {#if searchQuery}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            {/if}
          </button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-options">
          <label class="filter-toggle">
            <input
              type="checkbox"
              bind:checked={hideZeroBalances}
            />
            <span class="toggle-label">Hide zero balances</span>
          </label>

          <div class="sort-toggle" on:click={() => {
            sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
          }}>
            <span class="toggle-label">Sort by value</span>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="2"
              class="sort-arrow"
              class:ascending={sortDirection === 'asc'}
            >
              <path d="M12 20V4M5 13l7 7 7-7"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="tokens-content">
    <div class="tokens-container">
      {#each filteredTokens as token (token.canister_id)}
        <div class="token-row-wrapper" transition:slide={{ duration: 200 }}>
          <TokenRow
            {token}
            on:toggleFavorite={() => toggleFavoriteToken(token.canister_id)}
          />
        </div>
      {/each}
      
      {#if filteredTokens.length === 0}
        <div class="empty-state" transition:fade>
          {#if searchQuery}
            <p>No tokens found matching "{searchQuery}"</p>
            <button 
              class="clear-search-button"
              on:click={() => {
                searchQuery = '';
                searchInput.focus();
              }}
            >
              Clear Search
            </button>
          {:else}
            <p>No tokens available</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .token-list {
    @apply flex flex-col h-full;
  }

  .tokens-header {
    @apply flex-none bg-gradient-to-b from-[#1a1b23]/30 to-transparent;
  }

  .tokens-content {
    @apply flex-1 min-h-0;
  }

  .primary-button {
    @apply flex items-center justify-between
           mx-2 mt-3 mb-2 px-4 py-2.5
           text-base font-medium
           bg-[#2a2d3d]/40 text-white/90
           rounded-lg transition-all duration-200
           hover:bg-[#2a2d3d]/60 hover:text-white
           border border-white/5
           shadow-sm;
  }

  .controls-wrapper {
    @apply flex flex-col;
    @apply bg-[#15161c];
  }

  .search-section {
    @apply sticky top-0 z-10;
    @apply border-b border-[#2a2d3d];
    @apply bg-[#15161c];
  }

  .search-input-wrapper {
    @apply relative flex items-center;
    @apply bg-[#2a2d3d] p-3;
  }

  .search-input {
    @apply flex-1 bg-transparent border-none;
    @apply text-white placeholder-white/50;
    @apply focus:outline-none;
    @apply text-base pr-12;
  }

  .action-button {
    @apply absolute right-5 top-1/2 -translate-y-1/2;
    @apply flex items-center justify-center;
    @apply w-8 h-8 rounded-lg;
    @apply bg-white/10 text-white/70;
    @apply hover:bg-white/15 hover:text-white;
    @apply transition-colors;
  }

  .filter-bar {
    @apply px-4 py-3 border-b border-[#2a2d3d];
    @apply bg-[#15161c];
  }

  .filter-options {
    @apply flex items-center justify-between;
  }

  .filter-toggle {
    @apply flex items-center gap-2;
    @apply text-sm text-white/70;
    @apply cursor-pointer hover:text-white;
  }

  .sort-toggle {
    @apply flex items-center gap-2;
    @apply text-sm text-white/70;
    @apply cursor-pointer hover:text-white;
    @apply select-none;
  }

  .sort-arrow {
    @apply transition-transform duration-200;
  }

  .sort-arrow.ascending {
    @apply rotate-180;
  }

  .toggle-label {
    @apply select-none;
  }

  .filter-toggle input[type="checkbox"] {
    @apply w-4 h-4 rounded;
    @apply border border-[#2a2d3d];
    @apply bg-[#2a2d3d];
    @apply checked:bg-blue-500;
    @apply transition-colors;
    @apply focus:ring-2 focus:ring-blue-500/50;
  }

  .tokens-container {
    @apply h-full overflow-y-auto px-2 py-3;
  }

  .token-row-wrapper {
    @apply mb-1;
  }

  .empty-state {
    @apply flex flex-col items-center justify-center gap-3
           min-h-[160px] text-white/40 text-sm
           bg-[#2a2d3d]/20 rounded-lg
           border border-white/5;
  }

  .clear-search-button {
    @apply px-4 py-2 text-sm font-medium
           bg-[#2a2d3d]/30 text-white/70
           rounded-lg transition-all
           hover:bg-[#2a2d3d]/50 hover:text-white
           border border-white/10;
  }

  .icon-container {
    @apply w-20 h-20 flex items-center justify-center
           bg-gradient-to-b from-blue-500/20 to-purple-500/20
           rounded-2xl backdrop-blur-sm
           border border-white/10;
  }

  .icon-container svg {
    @apply w-10 h-10 text-blue-400;
  }

  .empty-liquidity-state h3 {
    @apply text-2xl font-semibold text-white/90;
  }

  .empty-liquidity-state p {
    @apply text-base text-white/60;
  }

  .action-buttons {
    @apply flex flex-col gap-3 w-full max-w-sm mt-2;
  }

  .primary-action {
    @apply w-full py-3 px-4
           bg-gradient-to-r from-blue-500 to-blue-600
           text-white font-medium
           rounded-xl transition-all duration-200
           hover:from-blue-600 hover:to-blue-700
           shadow-lg shadow-blue-500/20;
  }

  .secondary-action {
    @apply w-full py-3 px-4
           bg-[#2a2d3d]/40 text-white/90 font-medium
           rounded-xl transition-all duration-200
           hover:bg-[#2a2d3d]/60 hover:text-white
           border border-white/10;
  }

  .help-text {
    @apply flex items-start gap-3 mt-4
           px-4 py-3 max-w-sm
           bg-[#2a2d3d]/30 rounded-xl
           border border-white/5;
  }

  .info-icon {
    @apply flex items-center justify-center
           w-6 h-6 mt-0.5
           text-white/60;
  }

  .help-text p {
    @apply text-sm leading-relaxed text-white/70;
  }
</style>
