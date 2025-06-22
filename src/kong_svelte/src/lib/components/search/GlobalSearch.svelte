<script lang="ts">
  import { fetchUsers } from '$lib/api/users';
   import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { onMount, createEventDispatcher } from 'svelte';
  import Modal from '$lib/components/common/Modal.svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { keyboardShortcuts } from '$lib/services/keyboardShortcuts';

  // Import our new components
  import SearchInput from './SearchInput.svelte';
  import TokenResult from './TokenResult.svelte';
  import WalletResult from './WalletResult.svelte';
  import SearchEmptyState from './SearchEmptyState.svelte';
  import SearchNoResults from './SearchNoResults.svelte';
  import SearchLoading from './SearchLoading.svelte';

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
    data: UserData | Kong.Token;
  }

  const dispatch = createEventDispatcher();

  let searchQuery = $state('');
  let isSearching = $state(false);
  let searchResults = $state<SearchResult[]>([]);
  let selectedIndex = $state(-1);
  let searchTimeout: NodeJS.Timeout;
  let isMobile = $state(false);
  let touchStartY = $state(0);
  let touchMoveDistance = $state(0);
  let isScrolling = $state(false);
  let searchShortcut = $state('');

  onMount(() => {
    // Check if device is mobile
    checkMobileDevice();
    
    // Get formatted search shortcut
    if (browser) {
      const shortcut = keyboardShortcuts.getShortcutsByScope('global')
        .find(s => s.id === 'global-search');
      
      if (shortcut) {
        searchShortcut = keyboardShortcuts.formatShortcut(shortcut);
      } else {
        // Fallback if shortcut not found
        searchShortcut = keyboardShortcuts.isMacOS() ? '⌘K' : 'Ctrl+K';
      }
    }
    
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
    if (isOpen) {
      // Focus will be handled by the SearchInput component
      // Reset search state when opening
      if (!searchQuery) {
        searchResults = [];
        selectedIndex = -1;
      }
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
        fetchTokens({ search: searchQuery })
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

  function handleKeydown(e: CustomEvent<KeyboardEvent>) {
    const event = e.detail;
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
      const token = result.data as Kong.Token;
      // Navigate to token page or handle token selection
      goto(`/stats/${token.address}`);
    }
    closeSearch();
  }

  // Handle touch start event
  function handleTouchStart(e: CustomEvent) {
    const event = e.detail as TouchEvent;
    touchStartY = event.touches[0].clientY;
    touchMoveDistance = 0;
    isScrolling = false;
  }

  // Handle touch move event
  function handleTouchMove(e: CustomEvent) {
    const event = e.detail as TouchEvent;
    const currentY = event.touches[0].clientY;
    touchMoveDistance = Math.abs(currentY - touchStartY);
    
    // If moved more than 10px, consider it scrolling
    if (touchMoveDistance > 10) {
      isScrolling = true;
    }
  }

  // Handle touch end event for result selection
  function handleTouchEnd(e: CustomEvent) {
    const data = e.detail;
    // Only select if not scrolling
    if (!isScrolling) {
      if (data.event) data.event.preventDefault();
      if (data.token) {
        selectResult({ type: 'token', data: data.token });
      } else if (data.user) {
        selectResult({ type: 'user', data: data.user });
      }
    }
  }

  // For wallet badge touch handling
  function handleBadgeTouchEnd(e: CustomEvent) {
    const data = e.detail;
    if (!isScrolling && data.principalId && data.section !== undefined) {
      navigateToWalletSection(data.principalId, data.section, data.event);
    }
  }

  function navigateToWalletSection(principalId: string, section: string, event: Event) {
    if (event) event.stopPropagation();
    const path = section ? `/wallets/${principalId}/${section}` : `/wallets/${principalId}`;
    
    // Check if we're navigating to the same page structure but with different parameters
    const currentPath = window.location.pathname;
    const isSameSectionDifferentWallet = 
      section && currentPath.includes(`/wallets/`) && currentPath.endsWith(`/${section}`);
    
    // Special handling for swap page navigation which requires special attention to ensure data reloading
    const isSwapSection = section === 'swaps';
    
    // First close the search modal to prevent UI issues
    closeSearch();
    
    // Then navigate to the destination with a small delay to allow the UI to update
    setTimeout(() => {
      // Add a cache-busting parameter for same-structure different-wallet navigations
      // Always add it for swap sections to ensure proper data reloading
      if (isSameSectionDifferentWallet || isSwapSection) {
        const timestamp = Date.now();
        goto(`${path}?t=${timestamp}`);
      } else {
        goto(path);
      }
    }, isMobile ? 100 : 50); // Longer delay on mobile for better UI experience
  }

  function handleNavigate(e: CustomEvent) {
    const data = e.detail;
    if (data.principalId && data.section !== undefined) {
      navigateToWalletSection(data.principalId, data.section, data.event);
    }
  }

  function handleClearSearch() {
    searchResults = [];
    selectedIndex = -1;
  }

  // Derived values
  const tokenResults = $derived(searchResults
    .filter(r => r.type === 'token')
    .map(r => r.data as Kong.Token));
    
  const userResults = $derived(searchResults
    .filter(r => r.type === 'user')
    .map(r => r.data as UserData));
</script>

<Modal
  isOpen={isOpen}
  onClose={closeSearch}
  closeOnEscape={true}
  closeOnClickOutside={true}
  variant="solid"
  width="700px"
  className="global-search-modal"
  isPadded
>
  <div slot="title" class="w-full">
    <SearchInput 
      bind:searchQuery
      {isSearching}
      {searchShortcut}
      {isMobile}
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:clear={handleClearSearch}
    />
  </div>

  <div class="mobile-touch-container">
    <div class="search-results" style="-webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
      {#if searchResults.length > 0}
        <div class="results-container">
          <TokenResult 
            tokens={tokenResults} 
            {selectedIndex} 
            startIndex={0}
            on:touchstart={handleTouchStart}
            on:touchmove={handleTouchMove}
            on:touchend={handleTouchEnd}
            on:select={(e) => selectResult({ type: 'token', data: e.detail })}
          />

          <WalletResult 
            users={userResults} 
            {selectedIndex} 
            startIndex={tokenResults.length}
            on:touchstart={handleTouchStart}
            on:touchmove={handleTouchMove}
            on:touchend={handleTouchEnd}
            on:badgetouchend={handleBadgeTouchEnd}
            on:select={(e) => selectResult({ type: 'user', data: e.detail })}
            on:navigate={handleNavigate}
          />
        </div>
      {:else if searchQuery && !isSearching}
        <SearchNoResults {searchQuery} />
      {:else if !searchQuery}
        <SearchEmptyState {searchShortcut} {isMobile} />
      {/if}

      {#if isSearching}
        <SearchLoading />
      {/if}
    </div>
  </div>
</Modal>

<style lang="postcss">
  .search-results {
    @apply max-h-[calc(80vh-4rem)] overflow-y-auto;
    @apply max-h-[calc(70vh-4rem)] sm:max-h-[calc(80vh-4rem)];
  }

  .results-container {
    @apply flex flex-col divide-y divide-kong-border;
  }

  .mobile-touch-container {
    @apply w-full touch-manipulation overflow-hidden;
  }

  /* Add touch-friendly improvements for mobile */
  @media (max-width: 640px) {
    .search-results {
      @apply pb-4; /* Add padding at bottom for better scrolling on mobile */
    }
  }
  
</style> 