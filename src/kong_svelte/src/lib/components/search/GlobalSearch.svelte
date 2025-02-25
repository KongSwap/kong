<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { fetchUsers } from '$lib/api/users';
  import { fetchTokens } from '$lib/api/tokens';
  import { onMount, createEventDispatcher } from 'svelte';
  import { Search, X, User, ArrowRight, Coins } from 'lucide-svelte';
  import Modal from '$lib/components/common/Modal.svelte';
  import { goto } from '$app/navigation';

  const { isOpen = false } = $props();

  interface UserData {
    user_id: number;
    principal_id: string;
    my_referral_code: string;
    referred_by: string | null;
    fee_level: number;
  }

  interface SearchResult {
    type: 'user' | 'token';
    data: UserData | FE.Token;
  }

  const dispatch = createEventDispatcher();

  let searchQuery = $state('');
  let isSearching = $state(false);
  let searchResults = $state<SearchResult[]>([]);
  let selectedIndex = $state(-1);
  let searchInput: HTMLInputElement;

  let searchTimeout: NodeJS.Timeout;

  onMount(() => {
    // Focus input when component mounts
    if (isOpen && searchInput) {
      setTimeout(() => searchInput.focus(), 100);
    }
  });

  // Watch for changes to isOpen
  $effect(() => {
    if (isOpen && searchInput) {
      setTimeout(() => searchInput.focus(), 100);
    }
  });

  async function handleSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    isSearching = true;
    try {
      const [usersResponse, tokensResponse] = await Promise.all([
        fetchUsers(searchQuery),
        fetchTokens({ canister_id: searchQuery })
      ]);

      const userResults: SearchResult[] = usersResponse.items.map(item => ({
        type: 'user',
        data: {
          user_id: item.user_id,
          principal_id: item.principal_id,
          my_referral_code: item.my_referral_code,
          referred_by: item.referred_by,
          fee_level: item.fee_level
        }
      }));

      const tokenResults: SearchResult[] = tokensResponse.tokens.map(token => ({
        type: 'token',
        data: token
      }));

      searchResults = [...tokenResults, ...userResults];
    } catch (error) {
      console.error('Error fetching results:', error);
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  function handleInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(handleSearch, 300);
  }

  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0) {
          selectResult(searchResults[selectedIndex]);
        } else if (searchResults.length > 0) {
          // Select the first result if none is selected
          selectResult(searchResults[0]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeSearch();
        break;
    }
  }

  function closeSearch() {
    searchQuery = '';
    searchResults = [];
    selectedIndex = -1;
    dispatch('close');
  }

  function selectResult(result: SearchResult) {
    if (result.type === 'user') {
      const user = result.data as UserData;
      // Navigate to user page or handle user selection
      goto(`/wallets/${user.principal_id}`);
    } else {
      const token = result.data as FE.Token;
      // Navigate to token page or handle token selection
      goto(`/stats/${token.canister_id}`);
    }
    closeSearch();
  }

  function formatPrice(price: number | string | undefined): string {
    if (!price) return '$0.00';
    const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(numericPrice);
  }

  function formatPriceChange(change: number | string | undefined): string {
    if (!change) return '0.00%';
    const numericChange = typeof change === 'string' ? parseFloat(change) : change;
    return `${numericChange >= 0 ? '+' : ''}${numericChange.toFixed(2)}%`;
  }

  function getPriceChangeClass(change: number | string | undefined): string {
    if (!change) return '';
    const numericChange = typeof change === 'string' ? parseFloat(change) : change;
    return numericChange >= 0 ? 'text-kong-accent-green' : 'text-kong-accent-red';
  }

  const tokenResults = $derived(searchResults.filter(r => r.type === 'token'));
  const userResults = $derived(searchResults.filter(r => r.type === 'user'));
</script>

{#if isOpen}
  <div 
    class="global-search-overlay"
    transition:fade={{ duration: 100 }}
    on:click|self={closeSearch}
  >
    <div 
      class="global-search-container"
      transition:slide={{ duration: 150, axis: 'y' }}
      on:click|stopPropagation
    >
      <div class="search-header">
        <div class="search-input-container">
          <Search size={18} class="search-icon" />
          <input
            type="text"
            bind:value={searchQuery}
            bind:this={searchInput}
            placeholder="Search for tokens, wallets..."
            class="search-input"
            on:input={handleInput}
            on:keydown={handleKeydown}
            autocomplete="off"
          />
          {#if isSearching}
            <div class="search-loading-indicator">
              <div class="spinner" />
            </div>
          {:else if searchQuery}
            <button class="clear-button" on:click={() => { searchQuery = ''; searchResults = []; }}>
              <X size={16} />
            </button>
          {/if}
        </div>
        <button class="close-button" on:click={closeSearch}>
          <X size={18} />
        </button>
      </div>

      <div class="search-results">
        {#if searchResults.length > 0}
          <div class="results-container">
            {#if tokenResults.length > 0}
              <div class="result-section">
                <div class="result-section-header">
                  <Coins size={16} />
                  <span>Tokens</span>
                  <span class="result-count">{tokenResults.length} results</span>
                </div>
                
                <div class="result-list">
                  {#each tokenResults as result, index}
                    <button
                      class="result-item token-result {selectedIndex === index ? 'selected' : ''}"
                      on:click={() => selectResult(result)}
                    >
                      <div class="result-content">
                        <div class="token-icon">
                          {#if (result.data as FE.Token).logo_url}
                            <img src={(result.data as FE.Token).logo_url} alt={(result.data as FE.Token).name} />
                          {:else}
                            <div class="token-placeholder"></div>
                          {/if}
                        </div>
                        <div class="token-info">
                          <div class="token-name">{(result.data as FE.Token).name}</div>
                          <div class="token-symbol">{(result.data as FE.Token).symbol} • {formatPrice((result.data as FE.Token).metrics?.price)}</div>
                        </div>
                        {#if (result.data as FE.Token).metrics?.price_change_24h}
                          <div class="token-price-change {getPriceChangeClass((result.data as FE.Token).metrics.price_change_24h)}">
                            {formatPriceChange((result.data as FE.Token).metrics.price_change_24h)}
                          </div>
                        {/if}
                      </div>
                      <ArrowRight size={16} class="goto-icon" />
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            {#if userResults.length > 0}
              <div class="result-section">
                <div class="result-section-header">
                  <User size={16} />
                  <span>Wallets</span>
                  <span class="result-count">{userResults.length} results</span>
                </div>
                
                <div class="result-list">
                  {#each userResults as result, index}
                    <button
                      class="result-item user-result {selectedIndex === tokenResults.length + index ? 'selected' : ''}"
                      on:click={() => selectResult(result)}
                    >
                      <div class="result-content">
                        <div class="user-info">
                          <div class="user-id">{(result.data as UserData).principal_id}</div>
                          <div class="user-referral">Referral: {(result.data as UserData).my_referral_code}</div>
                        </div>
                        {#if (result.data as UserData).fee_level > 0}
                          <div class="user-level">Level {(result.data as UserData).fee_level}</div>
                        {/if}
                      </div>
                      <ArrowRight size={16} class="goto-icon" />
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {:else if searchQuery && !isSearching}
          <div class="no-results">
            <div class="no-results-message">No results found for "{searchQuery}"</div>
            <div class="no-results-tip">Try different keywords or check for typos</div>
          </div>
        {:else if !searchQuery}
          <div class="empty-state">
            <div class="empty-state-icon">
              <Search size={24} />
            </div>
            <div class="empty-state-title">Search Kong</div>
            <div class="empty-state-description">
              Search for tokens by name or ID, or find wallets by principal ID
            </div>
            <div class="keyboard-shortcuts">
              <div class="shortcut">
                <span class="key">↑↓</span>
                <span class="description">Navigate results</span>
              </div>
              <div class="shortcut">
                <span class="key">Enter</span>
                <span class="description">Open selected</span>
              </div>
              <div class="shortcut">
                <span class="key">Esc</span>
                <span class="description">Close search</span>
              </div>
            </div>
          </div>
        {/if}

        {#if isSearching}
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <div class="loading-text">Searching...</div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .global-search-overlay {
    @apply fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/40 backdrop-blur-sm;
  }

  .global-search-container {
    @apply w-full max-w-2xl bg-kong-surface-dark rounded-lg border border-kong-border shadow-xl overflow-hidden;
  }

  .search-header {
    @apply flex items-center gap-2 p-3 border-b border-kong-border;
  }

  .search-input-container {
    @apply flex-1 flex items-center gap-2 py-1.5 px-3 bg-kong-bg-dark/50 rounded-md;
  }

  .search-icon {
    @apply text-kong-text-secondary flex-shrink-0;
  }

  .search-input {
    @apply flex-1 bg-transparent border-none outline-none text-kong-text-primary placeholder-kong-text-secondary/70;
  }

  .search-loading-indicator {
    @apply flex items-center justify-center;
  }

  .spinner {
    @apply w-4 h-4 border-2 border-kong-accent-blue border-t-transparent rounded-full animate-spin;
  }

  .clear-button {
    @apply flex items-center justify-center w-5 h-5 rounded hover:bg-kong-text-primary/10 text-kong-text-secondary transition-colors;
  }

  .close-button {
    @apply flex items-center justify-center w-8 h-8 rounded-md hover:bg-kong-text-primary/10 text-kong-text-secondary transition-colors;
  }

  .search-results {
    @apply max-h-[80vh] overflow-y-auto;
  }

  .results-container {
    @apply flex flex-col divide-y divide-kong-border;
  }

  .result-section {
    @apply py-2;
  }

  .result-section-header {
    @apply flex items-center gap-2 px-4 py-2 text-sm font-medium text-kong-text-secondary;
  }

  .result-count {
    @apply ml-auto text-xs text-kong-text-secondary/70;
  }

  .result-list {
    @apply flex flex-col;
  }

  .result-item {
    @apply flex items-center justify-between w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors;
  }

  .result-item.selected {
    @apply bg-white/10;
  }

  .result-content {
    @apply flex items-center gap-3 flex-1 min-w-0;
  }

  .token-icon img {
    @apply w-6 h-6 rounded-full object-cover;
  }

  .token-placeholder {
    @apply w-6 h-6 rounded-full bg-kong-text-primary/10;
  }

  .token-info {
    @apply flex-1 min-w-0;
  }

  .token-name {
    @apply text-kong-text-primary font-medium truncate;
  }

  .token-symbol {
    @apply text-sm text-kong-text-secondary truncate;
  }

  .token-price-change {
    @apply text-sm font-medium;
  }

  .user-info {
    @apply flex-1 min-w-0;
  }

  .user-id {
    @apply text-kong-text-primary font-medium truncate;
  }

  .user-referral {
    @apply text-sm text-kong-text-secondary truncate;
  }

  .user-level {
    @apply px-2 py-0.5 bg-kong-accent-green/20 text-kong-accent-green rounded text-sm font-medium;
  }

  .goto-icon {
    @apply text-kong-text-secondary/50 opacity-0 transition-opacity;
  }

  .result-item:hover .goto-icon {
    @apply opacity-100;
  }

  .no-results {
    @apply flex flex-col items-center justify-center py-12 px-4 text-center;
  }

  .no-results-message {
    @apply text-lg font-medium text-kong-text-primary mb-2;
  }

  .no-results-tip {
    @apply text-sm text-kong-text-secondary;
  }

  .empty-state {
    @apply flex flex-col items-center justify-center py-16 px-4 text-center;
  }

  .empty-state-icon {
    @apply flex items-center justify-center w-12 h-12 rounded-full bg-kong-accent-blue/20 text-kong-accent-blue mb-4;
  }

  .empty-state-title {
    @apply text-xl font-medium text-kong-text-primary mb-2;
  }

  .empty-state-description {
    @apply text-sm text-kong-text-secondary mb-8 max-w-md;
  }

  .keyboard-shortcuts {
    @apply flex items-center justify-center gap-6 mt-4;
  }

  .shortcut {
    @apply flex flex-col items-center;
  }

  .key {
    @apply px-2 py-1 bg-kong-surface-dark border border-kong-border rounded text-sm font-medium text-kong-text-secondary mb-1;
  }

  .description {
    @apply text-xs text-kong-text-secondary;
  }

  .loading-state {
    @apply flex flex-col items-center justify-center py-12;
  }

  .loading-spinner {
    @apply w-8 h-8 border-2 border-kong-accent-blue border-t-transparent rounded-full animate-spin mb-4;
  }

  .loading-text {
    @apply text-sm text-kong-text-secondary;
  }
</style> 