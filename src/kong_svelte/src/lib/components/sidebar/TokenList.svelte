<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import { onMount } from 'svelte';
  import { FavoriteService } from '$lib/services/tokens/favoriteService';
  import AddCustomTokenModal from './AddCustomTokenModal.svelte';

  export let tokens: FE.Token[] = [];
  let searchQuery = '';
  let searchInput: HTMLInputElement;
  let hideZeroBalances = false;
  let sortDirection = 'desc';
  let searchDebounceTimer: NodeJS.Timeout;
  let debouncedSearchQuery = '';
  let showAddTokenModal = false;
  
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

  // Add new type for search matches
  type SearchMatch = {
    type: 'name' | 'symbol' | 'canister' | null;
    query: string;
    matchedText?: string;
  };

  // Add to script section
  let searchMatches: Record<string, SearchMatch> = {};

  let filteredTokens: FE.Token[] = [];

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
        if (hideZeroBalances && (!token.balance || BigInt(token.balance) <= 0n)) {
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
      })
      .sort((a, b) => {
        // First sort by favorites
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        
        // Use the stored usdValue directly
        const aValue = Number(a.usdValue);
        const bValue = Number(b.usdValue);
        
        return sortDirection === 'desc' 
          ? bValue - aValue
          : aValue - bValue;
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

      <div class="add-token-section">
        <button 
          class="add-token-button" 
          on:click={() => showAddTokenModal = true}
        >
          Add Custom Token
        </button>
      </div>
    </div>
  </div>
</div>

{#if showAddTokenModal}
  <AddCustomTokenModal 
    on:close={() => showAddTokenModal = false} 
  />
{/if}

<style lang="postcss">
  .token-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .tokens-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .controls-wrapper {
    display: flex;
    flex-direction: column;
  }

  .search-section {
    position: sticky;
    top: 0;
    z-index: 10;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 0.75rem 0;
    @apply text-kong-text-primary;
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .search-input::placeholder {
    @apply text-kong-text-primary/50;
  }

  .search-input:focus {
    outline: none;
    border-bottom-color: rgba(255, 255, 255, 0.5);
  }

  .action-button {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    color: rgba(255, 255, 255, 0.7);
    transition: color 0.2s;
  }

  .action-button:hover {
    @apply text-kong-text-primary;
  }

  .filter-bar {
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .filter-options {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    @apply text-kong-text-primary/70;
    cursor: pointer;
  }

  .filter-toggle:hover {
    @apply text-kong-text-primary;
  }

  .sort-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    user-select: none;
  }

  .sort-toggle:hover {
    @apply text-kong-text-primary;
  }

  .sort-arrow {
    transition: transform 0.2s;
  }

  .sort-arrow.ascending {
    transform: rotate(180deg);
  }

  .toggle-label {
    user-select: none;
  }

  .tokens-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #2a2d3d transparent;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y pinch-zoom;
  }

  .token-row-wrapper {
    touch-action: pan-y;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .tokens-container::-webkit-scrollbar {
    width: 0.375rem;
  }

  .tokens-container::-webkit-scrollbar-track {
    background: #15161c;
    border-radius: 0.25rem;
  }

  .tokens-container::-webkit-scrollbar-thumb {
    background: #2a2d3d;
    border-radius: 0.25rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-height: 160px;
    @apply text-kong-text-primary/40;
    font-size: 0.875rem;
  }

  .clear-search-button {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    @apply text-kong-text-primary/70;
    border-radius: 0.5rem;
    transition: all 0.2s;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .clear-search-button:hover {
    @apply text-kong-text-primary;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .match-indicator {
    padding: 0.25rem 1rem;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .match-type {
    color: rgba(255, 255, 255, 0.5);
    text-transform: capitalize;
  }

  .match-label {
    display: inline-block;
    padding: 0 0.5rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.6);
    border-radius: 9999px;
    font-size: 0.75rem;
    font-family: monospace;
  }

  .add-token-section {
    padding: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin-top: auto;
  }

  .add-token-button {
    width: 100%;
    padding: 0.75rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 0.5rem;
    color: rgb(59, 130, 246);
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .add-token-button:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.3);
  }
</style>
