<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import { tokenLogoStore, fetchTokenLogo } from "$lib/services/tokens/tokenLogos";
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import { toggleFavoriteToken } from "$lib/services/tokens/favorites";
  import { onMount } from 'svelte';

  // Update the token type to include isFavorite
  interface ProcessedToken extends FE.Token {
    logo?: string;
    value: number;
    usdValue: number;
    searchableText: string;
    canister_id: string;
    isFavorite?: boolean;
  }

  export let tokens: FE.Token[] = [];
  let searchQuery = '';
  let searchInput: HTMLInputElement;
  let hideZeroBalances = false;
  let sortBy = 'value';
  let sortDirection = 'desc';
  let isPasting = false;
  let searchDebounceTimer: NodeJS.Timeout;
  let debouncedSearchQuery = '';

  onMount(() => {
    searchInput?.focus();
  });

  // Subscribe to the stores
  $: formattedTokensList = $formattedTokens;
  $: tokenState = $tokenStore;

  $: processedTokens = tokens
    .map((token): ProcessedToken => {
      const formattedToken = formattedTokensList?.find((t) => t.canister_id === token.canister_id);
      const balance = tokenState.balances[token.canister_id] || 0;
      const price = tokenState.prices[token.canister_id] || 0;
      const decimals = token.decimals || 0;
      
      // Convert balance from token decimals
      const normalizedBalance = Number(balance) / (10 ** decimals);
      const usdValue = normalizedBalance * price;
      
      return {
        ...token,
        ...(formattedToken || {}),
        logo: $tokenLogoStore[token.canister_id],
        value: normalizedBalance,
        usdValue,
        balance: balance.toString(),
        searchableText: `${token.name || ''} ${token.symbol || ''} ${token.canister_id || ''}`.toLowerCase(),
        canister_id: token.canister_id?.toLowerCase() || '',
        isFavorite: Boolean(formattedToken?.isFavorite)
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

  // Add new type for search matches
  type SearchMatch = {
    type: 'name' | 'symbol' | 'canister' | null;
    query: string;
    matchedText?: string;
  };

  // Add to script section
  let searchMatches: Record<string, SearchMatch> = {};

  // Update the filter tokens logic
  $: filteredTokens = processedTokens.filter(token => {
    // First check zero balances if enabled
    if (hideZeroBalances && token.value <= 0) {
      return false;
    }
    
    if (!debouncedSearchQuery) {
      searchMatches[token.canister_id] = { type: null, query: '' };
      return true;
    }
    
    const query = debouncedSearchQuery.trim().toLowerCase();
    
    // Check canister ID first
    const canisterId = token.canister_id;
    if (canisterId.toLowerCase().includes(query)) {
      searchMatches[token.canister_id] = {
        type: 'canister',
        query,
        matchedText: canisterId
      };
      return true;
    }
    
    // Check name
    if (token.name?.toLowerCase().includes(query)) {
      searchMatches[token.canister_id] = {
        type: 'name',
        query,
        matchedText: token.name
      };
      return true;
    }
    
    // Check symbol
    if (token.symbol?.toLowerCase().includes(query)) {
      searchMatches[token.canister_id] = {
        type: 'symbol',
        query,
        matchedText: token.symbol
      };
      return true;
    }
    
    return false;
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

  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    // Clear search on Escape
    if (event.key === 'Escape' && searchQuery) {
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

  // Calculate total portfolio value using token balances and USD values
  $: totalPortfolioValue = processedTokens.reduce((total, token) => {
    const tokenValue = (token.value || 0) * (token.price || 0);
    return total + tokenValue;
  }, 0);

  // Format USD value
  function formatUSD(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  }

  // Update the helper function for match display
  function getMatchDisplay(match: SearchMatch): string {
    if (!match.matchedText) return '';
    
    const query = match.query.toLowerCase();
    const text = match.matchedText;
    const index = text.toLowerCase().indexOf(query);
    
    if (index === -1) return text;
    
    const before = text.slice(0, index);
    const highlighted = text.slice(index, index + query.length);
    const after = text.slice(index + query.length);
    
    return `${before}<span class="match-highlight">${highlighted}</span>${after}`;
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
            placeholder="Search by name, symbol, or canister ID"
            class="search-input"
            on:keydown={handleKeydown}
          />
          {#if searchQuery}
            <button 
              class="action-button"
              on:click|stopPropagation={() => {
                searchQuery = '';
                searchInput.focus();
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          {/if}
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
          {#if searchQuery && searchMatches[token.canister_id]?.type === 'canister'}
            <div class="match-indicator" transition:fade>
              <span class="match-type">canister:</span>
              <code class="match-label">{token.canister_id}</code>
            </div>
          {:else if searchQuery && searchMatches[token.canister_id]?.type}
            <div class="match-indicator" transition:fade>
              <span class="match-type">{searchMatches[token.canister_id].type}:</span>
              <span class="match-label">
                {@html getMatchDisplay(searchMatches[token.canister_id])}
              </span>
            </div>
          {/if}
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
    @apply flex flex-col h-full overflow-hidden;
  }

  .tokens-content {
    @apply flex-1 min-h-0 overflow-hidden;
  }

  .controls-wrapper {
    @apply flex flex-col;
    @apply bg-[#15161c];
  }

  .search-section {
    @apply sticky top-0 z-10;
    @apply border-b border-[#2a2d3d];
    @apply bg-[#15161c];
    @apply rounded-t-[6px];
  }

  .search-input-wrapper {
    @apply relative flex items-center;
    @apply bg-[#2a2d3d] p-3;
    @apply rounded-t-[6px];
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
    @apply h-full overflow-y-auto;
  }

  .empty-state {
    @apply flex flex-col items-center justify-center gap-3
           min-h-[160px] text-white/40 text-sm;
  }

  .clear-search-button {
    @apply px-4 py-2 text-sm font-medium
           bg-[#2a2d3d]/30 text-white/70
           rounded-lg transition-all
           hover:bg-[#2a2d3d]/50 hover:text-white
           border border-white/10;
  }

  .portfolio-value {
    @apply px-4 py-3 border-b border-[#2a2d3d];
  }

  .value-row {
    @apply flex items-center justify-between;
  }

  .value-label {
    @apply text-sm text-white/70;
  }

  .value-amount {
    @apply text-base font-medium text-white;
  }

  .match-indicator {
    @apply px-4 py-1 text-xs flex items-center gap-2;
  }

  .match-type {
    @apply text-white/50 capitalize;
  }

  .match-label {
    @apply inline-block px-2 py-0.5 
           bg-white/5 text-white/60
           rounded-full text-xs
           font-mono;
  }
</style>
