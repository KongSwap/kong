<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { fetchUsers } from '$lib/api/users';
  import { fetchTokens } from '$lib/api/tokens';
  import { onMount, createEventDispatcher } from 'svelte';
  import { Search, X, User, ArrowRight, Coins, BarChart2, Droplets, ArrowRightLeft } from 'lucide-svelte';
  import Modal from '$lib/components/common/Modal.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
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
  let searchInput = $state<HTMLInputElement | null>(null);
  let searchTimeout: NodeJS.Timeout;
  let isMobile = $state(false);
  let touchStartY = $state(0);
  let touchMoveDistance = $state(0);
  let isScrolling = $state(false);

  onMount(() => {
    // Focus input when component mounts
    if (isOpen && searchInput) {
      setTimeout(() => searchInput.focus(), 100);
    }
    
    // Check if device is mobile
    checkMobileDevice();
    
    // Add event listener for resize to update mobile status
    window.addEventListener('resize', checkMobileDevice);
    
    return () => {
      window.removeEventListener('resize', checkMobileDevice);
    };
  });
  
  function checkMobileDevice() {
    isMobile = window.innerWidth < 640;
  }

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

  // Handle touch start event
  function handleTouchStart(event: TouchEvent) {
    touchStartY = event.touches[0].clientY;
    touchMoveDistance = 0;
    isScrolling = false;
  }

  // Handle touch move event
  function handleTouchMove(event: TouchEvent) {
    const currentY = event.touches[0].clientY;
    touchMoveDistance = Math.abs(currentY - touchStartY);
    
    // If moved more than 10px, consider it scrolling
    if (touchMoveDistance > 10) {
      isScrolling = true;
    }
  }

  // Handle touch end event for result selection
  function handleTouchEnd(result: SearchResult, event: Event) {
    // Only select if not scrolling
    if (!isScrolling) {
      event.preventDefault();
      selectResult(result);
    }
  }

  // For wallet badge touch handling
  function handleBadgeTouchEnd(principalId: string, section: string, event: Event) {
    if (!isScrolling) {
      navigateToWalletSection(principalId, section, event);
    }
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

  function navigateToWalletSection(principalId: string, section: string, event: Event) {
    event.stopPropagation();
    const path = section ? `/wallets/${principalId}/${section}` : `/wallets/${principalId}`;
    
    // Check if we're navigating to the same page structure but with different parameters
    const currentPath = window.location.pathname;
    const isSameSectionDifferentWallet = 
      section && currentPath.includes(`/wallets/`) && currentPath.endsWith(`/${section}`);
    
    // Special handling for swap page navigation which requires special attention to ensure data reloading
    const isSwapSection = section === 'swaps';
    
    console.log(`Navigating from GlobalSearch to: ${path}`);
    console.log(`- Same section different wallet: ${isSameSectionDifferentWallet}`);
    console.log(`- Is swap section: ${isSwapSection}`);
    
    // First close the search modal to prevent UI issues
    closeSearch();
    
    // Then navigate to the destination with a small delay to allow the UI to update
    setTimeout(() => {
      // Add a cache-busting parameter for same-structure different-wallet navigations
      // Always add it for swap sections to ensure proper data reloading
      if (isSameSectionDifferentWallet || isSwapSection) {
        const timestamp = Date.now();
        goto(`${path}?t=${timestamp}`);
        console.log(`Added timestamp ${timestamp} to URL for proper reloading`);
      } else {
        goto(path);
      }
    }, isMobile ? 100 : 50); // Longer delay on mobile for better UI experience
  }

  const tokenResults = $derived(searchResults.filter(r => r.type === 'token'));
  const userResults = $derived(searchResults.filter(r => r.type === 'user'));
</script>

{#if isOpen}
  <div 
    class="global-search-overlay"
    transition:fade={{ duration: 150 }}
    on:click|self={closeSearch}
  >
    <Panel
      variant="solid"
      type="main"
      width="100%"
      zIndex={100}
      className="global-search-panel max-w-2xl mx-4"
      transition="slide"
      transitionParams={{ duration: 200 }}
    >
      <div on:click|stopPropagation class="mobile-touch-container">
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

        <div class="search-results" style="-webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
          {#if searchResults.length > 0}
            <div class="results-container" style="padding-bottom: 20px;">
              {#if tokenResults.length > 0}
                <div class="result-section" transition:fade={{ duration: 200 }}>
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
                        on:touchstart={handleTouchStart}
                        on:touchmove={handleTouchMove}
                        on:touchend={(e) => handleTouchEnd(result, e)}
                      >
                        <div class="result-content">
                          <div class="token-icon">
                            {#if (result.data as FE.Token).logo_url}
                              <img src={(result.data as FE.Token).logo_url} alt={(result.data as FE.Token).name} loading="lazy" />
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
                <div class="result-section" transition:fade={{ duration: 200, delay: 50 }}>
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
                        on:touchstart={handleTouchStart}
                        on:touchmove={handleTouchMove}
                        on:touchend={(e) => handleTouchEnd(result, e)}
                      >
                        <div class="result-content">
                          <div class="user-icon">
                            <div class="user-avatar">
                              <User size={16} />
                            </div>
                          </div>
                          <div class="user-info">
                            <div class="user-id">{(result.data as UserData).principal_id}</div>
                            <div class="wallet-badges">
                              <div 
                                class="wallet-badge overview"
                                on:click={(e) => navigateToWalletSection((result.data as UserData).principal_id, '', e)}
                                on:touchstart={handleTouchStart}
                                on:touchmove={handleTouchMove}
                                on:touchend={(e) => handleBadgeTouchEnd((result.data as UserData).principal_id, '', e)}
                              >
                                <BarChart2 size={12} />
                                <span>Overview</span>
                              </div>
                              <div 
                                class="wallet-badge tokens"
                                on:click={(e) => navigateToWalletSection((result.data as UserData).principal_id, 'tokens', e)}
                                on:touchstart={handleTouchStart}
                                on:touchmove={handleTouchMove}
                                on:touchend={(e) => handleBadgeTouchEnd((result.data as UserData).principal_id, 'tokens', e)}
                              >
                                <Coins size={12} />
                                <span>Tokens</span>
                              </div>
                              <div 
                                class="wallet-badge liquidity"
                                on:click={(e) => navigateToWalletSection((result.data as UserData).principal_id, 'liquidity', e)}
                                on:touchstart={handleTouchStart}
                                on:touchmove={handleTouchMove}
                                on:touchend={(e) => handleBadgeTouchEnd((result.data as UserData).principal_id, 'liquidity', e)}
                              >
                                <Droplets size={12} />
                                <span>LP</span>
                              </div>
                              <div 
                                class="wallet-badge swaps"
                                on:click={(e) => navigateToWalletSection((result.data as UserData).principal_id, 'swaps', e)}
                                on:touchstart={handleTouchStart}
                                on:touchmove={handleTouchMove}
                                on:touchend={(e) => handleBadgeTouchEnd((result.data as UserData).principal_id, 'swaps', e)}
                              >
                                <ArrowRightLeft size={12} />
                                <span>Swaps</span>
                              </div>
                            </div>
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
            <div class="no-results" transition:fade={{ duration: 200 }}>
              <div class="no-results-icon">
                <X size={24} />
              </div>
              <div class="no-results-message">No results found for "{searchQuery}"</div>
              <div class="no-results-tip">Try different keywords or check for typos</div>
            </div>
          {:else if !searchQuery}
            <div class="empty-state" transition:fade={{ duration: 200 }}>
              <div class="empty-state-icon">
                <Search size={24} />
              </div>
              <div class="empty-state-title">Search Kong</div>
              <div class="empty-state-description">
                Search for tokens by name or ID, or find wallets by principal ID
              </div>
              {#if !isMobile}
                <div class="keyboard-shortcuts">
                  <div class="shortcut">
                    <span class="key">↑↓</span>
                    <span class="description">Navigate</span>
                  </div>
                  <div class="shortcut">
                    <span class="key">Enter</span>
                    <span class="description">Select</span>
                  </div>
                  <div class="shortcut">
                    <span class="key">Esc</span>
                    <span class="description">Close</span>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          {#if isSearching}
            <div class="loading-state" transition:fade={{ duration: 150 }}>
              <div class="loading-spinner"></div>
              <div class="loading-text">Searching...</div>
            </div>
          {/if}
        </div>
      </div>
    </Panel>
  </div>
{/if}

<style scoped lang="postcss">
  .global-search-overlay {
    @apply fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm;
    @apply sm:items-start sm:pt-[15vh] items-center pt-0;
  }

  .global-search-panel {
    @apply w-full max-w-2xl overflow-hidden;
    @apply mx-2 sm:mx-4;
  }

  .search-header {
    @apply flex items-center gap-2 pb-4 border-b border-kong-border;
  }

  .search-input-container {
    @apply flex-1 flex items-center gap-2 py-2 px-2 bg-kong-bg-dark/70 rounded-lg border border-kong-border/50 focus-within:border-kong-border/80 transition-colors;
    @apply py-2.5 sm:py-2;
  }

  .search-icon {
    @apply text-kong-text-secondary flex-shrink-0;
  }

  .search-input {
    @apply flex-1 bg-transparent border-none outline-none text-base text-kong-text-primary placeholder-kong-text-secondary/70;
    @apply text-base sm:text-base;
  }

  .search-loading-indicator {
    @apply flex items-center justify-center;
  }

  .spinner {
    @apply w-4 h-4 border-2 border-kong-accent-blue border-t-transparent rounded-full animate-spin;
  }

  .clear-button {
    @apply flex items-center justify-center w-6 h-6 rounded-full hover:bg-kong-text-primary/10 text-kong-text-secondary transition-colors;
    @apply w-7 h-7 sm:w-6 sm:h-6;
  }

  .close-button {
    @apply flex items-center justify-center w-8 h-8 rounded-md hover:bg-kong-text-primary/10 text-kong-text-secondary transition-colors;
    @apply w-9 h-9 sm:w-8 sm:h-8;
  }

  .search-results {
    @apply max-h-[calc(80vh-4rem)] overflow-y-auto overflow-x-hidden;
    @apply max-h-[calc(70vh-4rem)] sm:max-h-[calc(80vh-4rem)];
  }

  .results-container {
    @apply flex flex-col divide-y divide-kong-border;
    @apply overflow-x-hidden;
  }

  .result-section {
    @apply py-3 w-full;
  }

  .result-section-header {
    @apply flex items-center gap-2 px-4 py-2 text-sm font-medium text-kong-text-secondary;
  }

  .result-count {
    @apply ml-auto text-xs text-kong-text-secondary/70;
  }

  .result-list {
    @apply flex flex-col;
    @apply overflow-x-hidden;
  }

  .result-item {
    @apply flex items-center justify-between w-full px-4 py-3 text-left hover:bg-white/5 transition-colors rounded-md my-0.5;
    @apply py-3.5 sm:py-3;
  }

  .result-item.selected {
    @apply bg-white/10;
  }

  .result-content {
    @apply flex items-center gap-3 flex-1 min-w-0;
  }

  .token-icon img {
    @apply w-8 h-8 rounded-full object-cover border border-kong-border/50;
  }

  .token-placeholder {
    @apply w-8 h-8 rounded-full bg-kong-text-primary/5 border border-kong-border/50;
  }

  .token-info {
    @apply flex-1 min-w-0 max-w-full;
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

  .user-result {
    @apply relative hover:bg-kong-accent-blue/5;
  }

  .user-icon {
    @apply flex-shrink-0;
  }

  .user-avatar {
    @apply flex items-center justify-center w-8 h-8 rounded-full bg-kong-accent-blue/10 text-kong-accent-blue;
  }

  .user-info {
    @apply flex-1 min-w-0 max-w-full;
  }

  .user-id {
    @apply text-kong-text-primary font-medium truncate mb-1.5;
    @apply text-sm sm:text-base;
  }

  .wallet-badges {
    @apply flex flex-wrap gap-1.5 max-w-full;
  }

  .wallet-badge {
    @apply flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer;
    @apply mb-0.5 sm:mb-0;
  }

  .wallet-badge.overview {
    @apply bg-kong-accent-blue/10 text-kong-accent-blue hover:bg-kong-accent-blue/20;
  }

  .wallet-badge.tokens {
    @apply bg-kong-accent-green/10 text-kong-accent-green hover:bg-kong-accent-green/20;
  }

  .wallet-badge.liquidity {
    @apply bg-purple-500/10 text-purple-500 hover:bg-purple-500/20;
  }

  .wallet-badge.swaps {
    @apply bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20;
  }

  .user-level {
    @apply px-2 py-0.5 bg-kong-accent-green/20 text-kong-accent-green rounded-md text-xs font-medium;
  }

  .goto-icon {
    @apply text-kong-text-secondary/50 opacity-0 transition-opacity;
    @apply opacity-50 sm:opacity-0;
  }

  .result-item:hover .goto-icon {
    @apply opacity-100;
  }

  .no-results {
    @apply flex flex-col items-center justify-center py-16 px-4 text-center;
    @apply py-10 sm:py-16;
  }

  .no-results-icon {
    @apply flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 text-red-500 mb-4;
  }

  .no-results-message {
    @apply text-lg font-medium text-kong-text-primary mb-2;
  }

  .no-results-tip {
    @apply text-sm text-kong-text-secondary;
  }

  .empty-state {
    @apply flex flex-col items-center justify-center py-16 px-4 text-center;
    @apply py-10 sm:py-16;
  }

  .empty-state-icon {
    @apply flex items-center justify-center w-16 h-16 rounded-full bg-kong-accent-blue/20 text-kong-accent-blue mb-5;
    @apply w-14 h-14 sm:w-16 sm:h-16;
  }

  .empty-state-title {
    @apply text-2xl font-bold text-kong-text-primary mb-2;
    @apply text-xl sm:text-2xl;
  }

  .empty-state-description {
    @apply text-sm text-kong-text-secondary mb-8 max-w-md;
  }

  .keyboard-shortcuts {
    @apply flex items-center justify-center gap-8 mt-4;
    @apply hidden sm:flex;
  }

  .shortcut {
    @apply flex flex-col items-center;
  }

  .key {
    @apply px-2.5 py-1.5 bg-kong-surface-dark border border-kong-border rounded-md text-sm font-medium text-kong-text-secondary mb-1.5;
  }

  .description {
    @apply text-xs text-kong-text-secondary;
  }

  .loading-state {
    @apply flex flex-col items-center justify-center py-16;
    @apply py-10 sm:py-16;
  }

  .loading-spinner {
    @apply w-10 h-10 border-4 border-kong-accent-blue border-t-transparent rounded-full animate-spin mb-4;
  }

  .loading-text {
    @apply text-sm text-kong-text-secondary;
  }

  .mobile-touch-container {
    @apply w-full touch-manipulation overflow-hidden;
  }

  /* Add touch-friendly improvements for mobile */
  @media (max-width: 640px) {
    .result-item {
      @apply active:bg-white/10; /* Better touch feedback */
    }
    
    .wallet-badges {
      @apply gap-1; /* Tighter spacing on mobile */
    }
    
    .wallet-badge span {
      @apply text-[10px]; /* Slightly smaller text on mobile */
    }
    
    .search-results {
      @apply pb-4; /* Add padding at bottom for better scrolling on mobile */
    }
    
    .global-search-overlay {
      @apply backdrop-blur-md; /* Stronger blur on mobile */
    }
    
    .token-symbol, .user-id {
      @apply max-w-[200px]; /* Limit width on mobile */
    }
  }
</style> 