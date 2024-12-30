<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import { onMount } from 'svelte';
  import { FavoriteService } from '$lib/services/tokens/favoriteService';
    import BigNumber from 'bignumber.js';

  type SearchMatch = {
    type: 'name' | 'symbol' | 'canister' | null;
    query: string;
    matchedText?: string;
  };

  export let tokens: FE.Token[] = [];
  let searchQuery = '';
  let searchInput: HTMLInputElement;
  let hideZeroBalances = false;
  let sortDirection = 'desc';
  let searchDebounceTimer: NodeJS.Timeout;
  let debouncedSearchQuery = '';
  let searchMatches: Record<string, SearchMatch> = {};
  let filteredTokens: FE.Token[] = [];
  
  onMount(async () => {
    await FavoriteService.loadFavorites();
  });
  
  // At the start of the component, add validation logging
  $: {
    if (tokens) {
      const invalidTokens = tokens.filter(t => !t || !t.canister_id);
      if (invalidTokens.length > 0) {
        console.warn('TokenList: Found invalid tokens:', invalidTokens);
      }
    }
  }

  // Debounce search input
  $: {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchQuery = searchQuery.toLowerCase();
    }, 150);
  }

  async function updateFilteredTokens() {
    const tokensWithFavorites = await Promise.all(
      $formattedTokens.map(async (token) => {
        const isFavorite = await FavoriteService.isFavorite(token.canister_id);
        const usdValue = $tokenStore.balances[token.canister_id]?.in_usd || 0n;
        return { token, isFavorite, usdValue };
      })
    );

    filteredTokens = tokensWithFavorites
      .filter(({ token }) => {
        // Check zero balance condition
        if (hideZeroBalances) {
          try {
            const balance = BigInt($tokenStore.balances[token.canister_id]?.in_tokens || 0n)
            if (balance <= 0n) return false;
          } catch (e) {
            console.warn(`Error checking balance for token ${token.canister_id}:`, e);
            return true; // Show tokens with invalid balance format
          }
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
      })
      .sort((a, b) => {
        // First sort by favorites
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        
        // Use the stored usdValue directly
        const aValue = new BigNumber($tokenStore.balances[a.token.canister_id]?.in_usd?.toString());
        const bValue = new BigNumber($tokenStore.balances[b.token.canister_id]?.in_usd?.toString());
        
        return sortDirection === 'desc' 
          ? bValue.minus(aValue).toNumber()
          : aValue.minus(bValue).toNumber();
      })
      .map(({ token }) => token);
  }

  $: if ($formattedTokens || debouncedSearchQuery || hideZeroBalances || sortDirection) {
    updateFilteredTokens();
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

  let touchStartY = 0;
  let isSwiping = false;

  function handleTouchStart(event: TouchEvent) {
    touchStartY = event.touches[0].clientY;
    isSwiping = false;
  }

  function handleTouchMove(event: TouchEvent) {
    const touchY = event.touches[0].clientY;
    const deltaY = Math.abs(touchY - touchStartY);
    
    if (deltaY > 10) {
      isSwiping = true;
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    if (isSwiping) {
      event.preventDefault();
      event.stopPropagation();
    }
    isSwiping = false;
  }
</script>

<div class="token-list" on:keydown={handleKeydown}>
  <div>
    <div class="flex items-center gap-2">
      <div class="search-input-wrapper flex-1">
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder="Search tokens..."
          class="search-input"
          on:keydown={handleKeydown}
        />
        {#if searchQuery}
          <button 
            class="clear-button"
            on:click|stopPropagation={() => {
              searchQuery = '';
              searchInput.focus();
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <label class="filter-toggle flex items-center gap-2 text-gray-400 hover:text-white">
          <span class="toggle-label text-xs">Hide zero</span>
          <input
            type="checkbox"
            bind:checked={hideZeroBalances}
            class="sr-only"
          />
          <div class="toggle-switch" />
        </label>

        <div class="sort-toggle" on:click={() => {
          sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
        }}>
          <span class="toggle-label text-xs">Value</span>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="14" 
            height="14" 
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

  <div class="tokens-content">
    <div 
      class="tokens-container"
      on:touchstart={handleTouchStart}
      on:touchmove={handleTouchMove}
      on:touchend={handleTouchEnd}
    >
      {#each filteredTokens as token (token.canister_id)}
        <div 
          class="token-row-wrapper" 
          transition:slide={{ duration: 200 }}
        >
          <TokenRow
            {token}
            on:toggleFavorite={async ({ detail }) => {
              await FavoriteService.toggleFavorite(detail.canisterId);
              filteredTokens = [...filteredTokens];
            }}
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


<style lang="postcss">
  .token-list {
    @apply flex flex-col h-full overflow-hidden;
  }

  .search-input-wrapper {
    @apply relative flex items-center bg-kong-bg-dark/40 rounded-md border border-gray-700/50;
  }

  .search-input {
    @apply w-full bg-transparent border-none py-1.5 px-3 text-sm text-white
           placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50;
  }

  .clear-button {
    @apply absolute right-2 text-gray-500 hover:text-white transition-colors p-1;
  }

  .sort-toggle {
    @apply flex items-center gap-1.5 text-gray-400 cursor-pointer 
           hover:text-white transition-colors whitespace-nowrap bg-kong-bg-dark/40
           px-2 py-1.5 rounded-md border border-gray-700/50 h-[34px];
  }

  .sort-arrow {
    @apply transition-transform duration-200;
  }

  .sort-arrow.ascending {
    @apply rotate-180;
  }

  .filter-toggle {
    @apply relative flex items-center cursor-pointer h-[34px] px-2;
  }

  .toggle-switch {
    @apply w-7 h-4 bg-gray-700 rounded-full transition-colors duration-200
           before:content-[''] before:absolute before:w-3 before:h-3 
           before:bg-gray-400 before:rounded-full before:transition-transform
           before:duration-200 before:translate-x-0.5 before:translate-y-0.5;
  }

  .filter-toggle input:checked + .toggle-switch {
    @apply bg-blue-900;
  }

  .filter-toggle input:checked + .toggle-switch::before {
    @apply translate-x-3.5 bg-blue-400;
  }

  .tokens-content {
    @apply flex-1 min-h-0 overflow-y-auto px-1.5;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  .tokens-container {
    @apply py-1.5;
  }

  .token-row-wrapper {
    @apply mb-0.5 last:mb-0;
  }

  .match-indicator {
    @apply px-2 py-0.5 text-xs flex items-center gap-2 text-gray-400;
  }

  .match-type {
    @apply capitalize;
  }

  .match-label {
    @apply font-mono;
  }

  .empty-state {
    @apply flex flex-col items-center justify-center gap-2
           min-h-[120px] text-white/40 text-xs;
  }

  .clear-search-button {
    @apply px-3 py-1.5 bg-kong-bg-dark/70 text-white/70 text-xs font-medium rounded-md
           transition-all duration-200 hover:bg-gray-700/90 hover:text-white;
  }
</style>
