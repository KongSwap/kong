<script lang="ts">
  import { fade } from "svelte/transition";
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import { currentUserBalancesStore } from "$lib/stores/balancesStore";
  import { loadBalances } from "$lib/stores/tokenStore";
  import { onMount } from "svelte";
  import { FavoriteService } from "$lib/services/tokens/favoriteService";
  import { Search, Plus } from "lucide-svelte";
  import { searchToken, getMatchDisplay } from "$lib/utils/searchUtils";
  import { sortTokens, filterByBalance } from "$lib/utils/sortUtils";
  import { handleSearchKeyboard } from "$lib/utils/keyboardUtils";
  import { browser } from "$app/environment";
  import { writable, derived, get } from "svelte/store";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { debounce } from "$lib/utils/debounce";
  import { auth } from "$lib/services/auth";
  import { userTokens } from "$lib/stores/userTokens";
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import AddNewTokenModal from "$lib/components/sidebar/AddNewTokenModal.svelte";

  // Use $props() instead of export let
  const props = $props<{ tokens: FE.Token[] }>();

  type SearchMatch = {
    type: "name" | "symbol" | "canister" | null;
    query: string;
    matchedText?: string;
  };

  // Extended token type for API results
  type TokenWithSearchQuery = FE.Token & {
    _searchQuery?: string;
  };

  // Create persistent hideZero store
  const hideZeroStore = writable(
    browser
      ? localStorage.getItem("kong_hide_zero_balances") === "true"
      : false,
  );

  // Store for user's tokens
  const userTokenList = writable<FE.Token[]>([]);

  // State for custom token modal
  let isAddNewTokenModalOpen = $state(false);
  
  // Initialize userTokenList with tokens prop
  $effect(() => {
    userTokenList.set(props.tokens);
  });

  // Subscribe to changes in the userTokens store
  $effect(() => {
    if ($userTokens) {
      // Update our local token list when the userTokens store changes
      const newTokens = $userTokens.tokens;
      const currentTokens = get(userTokenList);
      
      // Only update if the tokens have actually changed
      if (JSON.stringify(newTokens.map(t => t.canister_id).sort()) !== 
          JSON.stringify(currentTokens.map(t => t.canister_id).sort())) {
        userTokenList.set(newTokens);
        
        // Force a refresh of the filtered tokens view only if needed
        const currentSearch = get(searchQuery);
        if (currentSearch) {
          // Briefly clear and restore search to force UI update
          searchQuery.set("");
          setTimeout(() => searchQuery.set(currentSearch), 10);
        }
      }
    }
  });

  // Persist hideZero changes
  $effect(() => {
    if (browser) {
      localStorage.setItem("kong_hide_zero_balances", $hideZeroStore.toString());
    }
  });

  let searchInput: HTMLInputElement;
  const searchQuery = writable("");
  const debouncedSearch = derived(searchQuery, ($query, set) => {
    const timer = setTimeout(() => {
      set($query.toLowerCase());
    }, 400);

    return () => clearTimeout(timer);
  });

  // Create a writable store for sort direction
  const sortDirectionStore = writable<"asc" | "desc">("desc");

  // Add state for API search results
  const apiSearchResults = writable<TokenWithSearchQuery[]>([]);
  let isSearching = $state<boolean>(false);
  let enablingTokenId = $state<string | null>(null);

  // Create debounced API search function
  const debouncedApiSearch = debounce(async (query: string) => {
    if (!browser || !query || query.length < 2) {
      apiSearchResults.set([]);
      return;
    }

    // Don't search if we're already showing results for this query
    const currentResults = get(apiSearchResults);
    if (currentResults.length > 0 && currentResults[0]._searchQuery === query) {
      return;
    }

    isSearching = true;
    try {
      const { tokens } = await fetchTokens({ 
        search: query,
        limit: 20 // Limit API results to prevent overwhelming the UI
      });
      
      // Get the current user tokens with the most up-to-date data
      const currentTokens = get(userTokenList);
      const enabledCanisterIds = new Set(currentTokens.map(t => t.canister_id));
      
      // Also check the userTokens store in case it has tokens not yet in userTokenList
      const userTokensState = get(userTokens);
      Object.keys(userTokensState.enabledTokens || {}).forEach(id => {
        enabledCanisterIds.add(id);
      });
      
      // Filter out tokens that are already enabled
      const filteredApiResults = tokens
        .filter(token => !enabledCanisterIds.has(token.canister_id))
        .map(token => ({
          ...token,
          _searchQuery: query // Add the query that produced this result
        }));
      
      apiSearchResults.set(filteredApiResults);
    } catch (error) {
      console.error('Error searching tokens:', error);
      apiSearchResults.set([]);
    } finally {
      isSearching = false;
    }
  }, 300);

  // Update search effect to trigger API search
  $effect(() => {
    if (browser && $searchQuery && $searchQuery.length >= 2) {
      void debouncedApiSearch($searchQuery);
    } else {
      apiSearchResults.set([]);
    }
  });

  // Add this store to track recently enabled tokens with their search matches
  const recentlyEnabledTokens = writable<Record<string, SearchMatch>>({});
  
  // Create derived store for filtered and sorted tokens
  const filteredTokens = derived(
    [
      userTokenList,
      debouncedSearch,
      hideZeroStore,
      currentUserBalancesStore,
      sortDirectionStore,
      apiSearchResults,
      searchQuery,
      recentlyEnabledTokens,
    ],
    ([$tokens, $search, $hideZero, $balances, $sortDirection, $apiResults, $rawSearch, $recentlyEnabled], set) => {
      const matches: Record<string, SearchMatch> = {};

      // Guard against undefined or null tokens
      if (!Array.isArray($tokens)) {
        set({ tokens: [], apiTokens: [], matches: {} });
        return;
      }

      // Use the raw search query for immediate reaction if debouncedSearch hasn't updated yet
      const searchTerm = ($search as string) || ($rawSearch ? $rawSearch.toLowerCase() : "");
      
      // Copy matches from recently enabled tokens
      Object.assign(matches, $recentlyEnabled);

      // Create a Set of token IDs for faster lookups
      const tokenIdSet = new Set($tokens.map(t => t.canister_id));

      // First gather normal enabled tokens that match the search
      const filtered = $tokens.filter((token) => {
        // Check zero balance
        if (!filterByBalance(token, $balances, $hideZero)) {
          return false;
        }

        // If token was recently enabled and matched the current search, always include it
        if (searchTerm && $recentlyEnabled[token.canister_id]) {
          return true;
        }

        if (!searchTerm) {
          matches[token.canister_id] = { type: null, query: "" };
          return true;
        }

        const match = searchToken(token, searchTerm);
        if (match) {
          matches[token.canister_id] = match;
          return true;
        }

        return false;
      });

      // Process API results - filter out any that are in the user token list
      const apiTokens = $apiResults.filter(token => {
        // Don't show tokens that were recently enabled
        if (token.canister_id in $recentlyEnabled) {
          return false;
        }
        
        // Don't show tokens that are already in the user's list - use Set for faster lookup
        if (tokenIdSet.has(token.canister_id)) {
          return false;
        }
        
        if (!searchTerm) return false;
        
        const match = searchToken(token, searchTerm);
        if (match) {
          matches[token.canister_id] = match;
          return true;
        }
        
        return false;
      });

      // Sort tokens with recently enabled first, then by the normal sort criteria
      sortTokens(filtered, $balances, FavoriteService, $sortDirection).then(
        (sorted) => {
          // Move recently enabled tokens to the top
          const recentIds = Object.keys($recentlyEnabled);
          if (recentIds.length > 0 && searchTerm) {
            const recentTokens = sorted.filter(t => recentIds.includes(t.canister_id));
            const otherTokens = sorted.filter(t => !recentIds.includes(t.canister_id));
            set({ tokens: [...recentTokens, ...otherTokens], apiTokens, matches });
          } else {
            set({ tokens: sorted, apiTokens, matches });
          }
        },
      );
    },
    { tokens: [], apiTokens: [], matches: {} },
  );

  let isInitialLoad = $state(true);

  onMount(async () => {
    await FavoriteService.loadFavorites();
    
    // Load balances for all tokens when component mounts
    const authStore = get(auth);
    if (authStore?.isConnected && authStore?.account?.owner) {
      const owner = authStore.account.owner.toString();
      const tokens = get(userTokenList);
      if (tokens.length > 0) {
        try {
          const balances = await loadBalances(tokens, owner, false);
          
          // Update the balances store with the fetched balances
          const currentBalances = get(currentUserBalancesStore);
          const updatedBalances = { ...currentBalances };
          
          // Add new balances to the store
          Object.entries(balances).forEach(([canisterId, balance]) => {
            updatedBalances[canisterId] = balance;
          });
          
          // Update the store
          currentUserBalancesStore.set(updatedBalances);
        } catch (e) {
          console.error("Failed to load balances on mount:", e);
        }
      }
    }
    
    isInitialLoad = false;
  });

  // Effect to reload balances when auth or token list changes
  $effect(() => {
    const authStore = get(auth);
    const tokens = get(userTokenList);
    
    if (authStore?.isConnected && authStore?.account?.owner && tokens.length > 0) {
      const owner = authStore.account.owner.toString();
      loadBalances(tokens, owner, false)
        .then(balances => {
          // Update the balances store with the fetched balances
          const currentBalances = get(currentUserBalancesStore);
          const updatedBalances = { ...currentBalances };
          
          // Add new balances to the store
          Object.entries(balances).forEach(([canisterId, balance]) => {
            updatedBalances[canisterId] = balance;
          });
          
          // Update the store
          currentUserBalancesStore.set(updatedBalances);
        })
        .catch(e => console.error("Failed to load balances on update:", e));
    }
  });

  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    handleSearchKeyboard(event, {
      searchQuery: $searchQuery,
      searchInput,
      onClear: () => searchQuery.set(""),
    });
  }

  // Fix searchQuery clear button
  function clearSearch() {
    searchQuery.set("");
    searchInput.focus();
  }

  // Handle enabling a token
  async function handleEnableToken(e: MouseEvent, token: FE.Token) {
    e.preventDefault();
    e.stopPropagation();
    
    // Set loading state
    enablingTokenId = token.canister_id;
    
    try {
      // Store the current search query and match before any changes
      const currentQuery = get(searchQuery);
      
      // If we have a search query, create a match for this token
      let match = null;
      if (currentQuery) {
        match = searchToken(token, currentQuery.toLowerCase());
        if (match) {
          // Add this token to recently enabled with its search match
          recentlyEnabledTokens.update(tokens => ({
            ...tokens,
            [token.canister_id]: match
          }));
        }
      }

      // First, remove from API results to prevent duplication
      apiSearchResults.update(results => 
        results.filter(t => t.canister_id !== token.canister_id)
      );
      
      // Check if token is already in the list to avoid duplicates
      const currentTokens = get(userTokenList);
      const alreadyExists = currentTokens.some(t => t.canister_id === token.canister_id);
      
      if (!alreadyExists) {
        // Enable the token in userTokens store - this also adds it to the tokens array
        userTokens.enableToken(token);
        
        // Explicitly add to local userTokenList for immediate display
        userTokenList.update(tokens => [token, ...tokens]);
        
        // Load balance for the newly enabled token if user is connected
        const authStore = get(auth);
        if (authStore?.isConnected && authStore?.account?.owner) {
          const owner = authStore.account.owner.toString();
          loadBalances([token], owner, true)
            .then(balances => {
              // Update the balances store with the fetched balances
              const currentBalances = get(currentUserBalancesStore);
              const updatedBalances = { ...currentBalances };
              
              // Add new balances to the store
              Object.entries(balances).forEach(([canisterId, balance]) => {
                updatedBalances[canisterId] = balance;
              });
              
              // Update the store
              currentUserBalancesStore.set(updatedBalances);
            })
            .catch(e => console.error("Failed to load balances:", e));
        }
      }

      // Force refresh token list to ensure immediate UI update
      if (currentQuery) {
        // Reset query briefly to force a full refresh of the search results
        searchQuery.set("");
        setTimeout(() => searchQuery.set(currentQuery), 10);
      }
      
      // Schedule cleanup of recently enabled after a few seconds
      if (match) {
        setTimeout(() => {
          recentlyEnabledTokens.update(tokens => {
            const newTokens = {...tokens};
            delete newTokens[token.canister_id];
            return newTokens;
          });
        }, 5000);
      }
    } finally {
      // Clear loading state
      enablingTokenId = null;
    }
  }

  // Handle token removal
  function handleTokenRemoval(canisterId: string) {
    // Update local list immediately for better UI responsiveness
    userTokenList.update(tokens => tokens.filter(token => token.canister_id !== canisterId));
    
    // Then update the store (which will trigger the effect above)
    userTokens.disableToken(canisterId);
  }

  // Handle token added from modal
  function handleTokenAdded(event: CustomEvent<FE.Token>) {
    const newToken = event.detail;
    
    // Check if token is already in the list
    const currentTokens = get(userTokenList);
    const alreadyExists = currentTokens.some(t => t.canister_id === newToken.canister_id);
    
    if (!alreadyExists) {
      // Add to local userTokenList for immediate display
      userTokenList.update(tokens => [newToken, ...tokens]);
    }
  }
</script>

<div
  class="token-list-container h-full min-h-full flex flex-col"
  on:keydown={handleKeydown}
  role="listbox"
  aria-label="Token List"
  tabindex="0"
>
  <div class="search-section bg-kong-bg-dark/50">
    <div class="flex items-center gap-2 px-2 py-2">
      <div class="search-input-wrapper flex-1">
        <div class="search-icon-wrapper">
          <Search size={16} class="search-icon" />
        </div>
        <input
          bind:this={searchInput}
          bind:value={$searchQuery}
          type="text"
          placeholder="Search tokens..."
          class="search-input"
          on:keydown={handleKeydown}
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
        {#if $searchQuery}
          <button
            class="clear-button"
            aria-label="Clear search"
            on:click|stopPropagation={clearSearch}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <label
          class="filter-toggle flex items-center gap-2 text-kong-text-secondary hover:text-kong-text-primary"
        >
          <span class="toggle-label text-xs">Hide zero</span>
          <input
            type="checkbox"
            checked={$hideZeroStore}
            on:change={(e) => hideZeroStore.set(e.currentTarget.checked)}
            class="sr-only"
          />
          <div class="toggle-switch"></div>
        </label>
      </div>
    </div>
  </div>

  <div class="token-list-content rounded-b-lg">
    <div class="token-rows">
      {#each $filteredTokens.tokens as token (token.canister_id)}
        <div class="token-row-wrapper">
          <TokenRow
            {token}
            onRemove={handleTokenRemoval}
            on:toggleFavorite={async ({ detail }) => {
              await FavoriteService.toggleFavorite(detail.canisterId);
            }}
          />
          {#if $searchQuery && $filteredTokens.matches[token.canister_id]?.type === "canister"}
            <div class="match-indicator" transition:fade={{ duration: 150 }}>
              <span class="match-type">canister:</span>
              <code class="match-label">{token.canister_id}</code>
            </div>
          {:else if $searchQuery && $filteredTokens.matches[token.canister_id]?.type}
            <div class="match-indicator" transition:fade={{ duration: 150 }}>
              <span class="match-type"
                >{$filteredTokens.matches[token.canister_id].type}:</span
              >
              <span class="match-label">
                {@html getMatchDisplay(
                  $filteredTokens.matches[token.canister_id],
                )}
              </span>
            </div>
          {/if}
        </div>
      {/each}

      {#if $filteredTokens.apiTokens.length > 0}
        <div class="api-tokens-section">
          <div class="api-tokens-header">
            <span class="text-sm uppercase font-medium">Available Tokens</span>
          </div>
          
          {#each $filteredTokens.apiTokens as token (token.canister_id)}
            <div class="token-row-wrapper api-token-row">
              <div class="token-row">
                <div class="token-info">
                  <div class="token-icon">
                    <img 
                      src={token.logo_url} 
                      alt={token.symbol} 
                      class="token-logo"
                      on:error={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        img.src = 'https://raw.githubusercontent.com/Psychedelic/assets/main/icons/tokens/default.png';
                      }}
                    />
                  </div>
                  <div class="token-details">
                    <div class="token-name-row">
                      <span class="token-symbol">{token.symbol}</span>
                      <span class="token-name">{token.name}</span>
                    </div>
                  </div>
                </div>
                <div class="token-actions">
                  <button 
                    class="enable-token-button" 
                    on:click={(e) => handleEnableToken(e, token)}
                    disabled={enablingTokenId === token.canister_id}
                  >
                    {#if enablingTokenId === token.canister_id}
                      <div class="button-spinner"></div>
                    {:else}
                      <Plus size={14} />
                      <span>Enable</span>
                    {/if}
                  </button>
                </div>
              </div>
              {#if $searchQuery && $filteredTokens.matches[token.canister_id]?.type === "canister"}
                <div class="match-indicator" transition:fade={{ duration: 150 }}>
                  <span class="match-type">canister:</span>
                  <code class="match-label">{token.canister_id}</code>
                </div>
              {:else if $searchQuery && $filteredTokens.matches[token.canister_id]?.type}
                <div class="match-indicator" transition:fade={{ duration: 150 }}>
                  <span class="match-type"
                    >{$filteredTokens.matches[token.canister_id].type}:</span
                  >
                  <span class="match-label">
                    {@html getMatchDisplay(
                      $filteredTokens.matches[token.canister_id],
                    )}
                  </span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if isSearching}
        <div class="loading-indicator">
          <LoadingIndicator text="Searching tokens..." />
        </div>
      {/if}

      {#if $filteredTokens.tokens.length === 0 && $filteredTokens.apiTokens.length === 0 && !isSearching}
        <div class="empty-state" in:fade>
          {#if isInitialLoad || $userTokenList.length === 0}
            <LoadingIndicator text="Loading tokens..." />
          {:else if $searchQuery}
            <p>No tokens found matching "{$searchQuery}"</p>
            <button class="clear-search-button" on:click={clearSearch}>
              Clear Search
            </button>
          {:else}
            <p>No tokens available</p>
          {/if}
        </div>
      {/if}
      
      <!-- Add New Token button -->
      <div class="add-custom-token-container">
        <button 
          class="add-custom-token-button" 
          on:click={() => isAddNewTokenModalOpen = true}
        >
          <Plus size={16} />
          <span>Add New Token</span>
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Custom Token Modal -->
<AddNewTokenModal 
  isOpen={isAddNewTokenModalOpen}
  onClose={() => isAddNewTokenModalOpen = false}
  on:tokenAdded={handleTokenAdded}
/>

<style scoped lang="postcss">
  .token-list-container {
    @apply h-[calc(100vh-180px)] md:h-[calc(100vh-140px)] relative;
  }

  .search-section {
    @apply sticky top-0 z-20;
    @apply border-b border-kong-border;
  }

  .token-list-content {
    @apply flex-1 overflow-hidden bg-kong-bg-light;
  }

  .token-rows {
    @apply h-full overflow-y-auto py-1.5 px-2;
  }

  .search-input-wrapper {
    @apply relative flex items-center flex-1 bg-kong-bg-dark/30 rounded-lg border border-kong-border/40;
  }

  .search-icon-wrapper {
    @apply absolute left-3 z-10 flex items-center pointer-events-none;
  }

  .search-input {
    @apply w-full bg-transparent border-none py-2 pl-9 pr-3.5 text-sm
           text-kong-text-primary placeholder-kong-text-secondary/70 
           focus:outline-none focus:ring-1 focus:ring-kong-accent-blue/40;
    font-size: 16px; /* Prevent zoom on iOS */
    -webkit-text-size-adjust: 100%; /* Prevent text size adjust on iOS */
  }

  .clear-button {
    @apply absolute right-2 text-kong-text-secondary hover:text-kong-text-primary transition-colors p-1;
  }

  .filter-toggle {
    @apply relative flex items-center cursor-pointer h-[34px] px-2;
  }

  .toggle-switch {
    @apply w-7 h-4 bg-kong-bg-dark rounded-full transition-colors duration-200
           before:content-[''] before:absolute before:w-3 before:h-3 
           before:bg-kong-text-secondary before:rounded-full before:transition-transform
           before:duration-200 before:translate-x-0.5 before:translate-y-0.5;
  }

  .filter-toggle input:checked + .toggle-switch {
    @apply bg-blue-900;
  }

  .filter-toggle input:checked + .toggle-switch::before {
    @apply translate-x-3.5 bg-kong-text-primary;
  }

  .token-row-wrapper {
    @apply mb-0.5 last:mb-0;
  }

  .match-indicator {
    @apply px-2 py-0.5 text-xs flex items-center gap-2 text-kong-text-secondary;
  }

  .match-type {
    @apply capitalize;
  }

  .match-label {
    @apply font-mono;
  }

  .empty-state {
    @apply flex flex-col items-center justify-center gap-2
           h-[calc(100vh-250px)] md:h-[calc(100vh-290px)] text-kong-text-secondary text-xs;
  }

  .clear-search-button {
    @apply px-3 py-1.5 bg-kong-bg-dark/70 text-kong-text-primary/70 text-xs font-medium rounded-md
           transition-all duration-200 hover:bg-gray-700/90 hover:text-kong-text-primary;
  }

  /* API Tokens Section Styles */
  .api-tokens-section {
    @apply mt-4 border-t border-kong-border/30 pt-2;
  }

  .api-tokens-header {
    @apply px-2 py-1.5 text-xs font-medium text-kong-text-secondary mb-2;
  }

  .api-token-row {
    @apply opacity-90 hover:opacity-100 transition-opacity;
  }

  .token-row {
    @apply flex items-center justify-between p-2 rounded-lg
           bg-kong-bg-dark/50 hover:bg-kong-bg-dark/80 transition-colors;
  }

  .token-info {
    @apply flex items-center gap-2;
  }

  .token-icon {
    @apply w-8 h-8 rounded-full overflow-hidden flex items-center justify-center
           bg-kong-bg-dark border border-kong-border/40;
  }

  .token-logo {
    @apply w-full h-full object-cover;
  }

  .token-details {
    @apply flex flex-col;
  }

  .token-name-row {
    @apply flex items-center gap-2;
  }

  .token-symbol {
    @apply text-sm font-medium text-kong-text-primary;
  }

  .token-name {
    @apply text-xs text-kong-text-secondary;
  }

  .token-actions {
    @apply flex items-center;
  }

  .enable-token-button {
    @apply flex items-center gap-1 px-2 py-1 text-xs font-medium rounded
           bg-kong-primary text-white hover:bg-kong-primary-hover
           transition-colors disabled:opacity-70 disabled:cursor-wait;
  }

  .button-spinner {
    @apply w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin;
  }

  .loading-indicator {
    @apply flex flex-col items-center justify-center gap-2 py-6
           text-kong-text-secondary text-xs;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Add New Token button styles */
  .add-custom-token-container {
    @apply mt-4 px-2 py-2 border-t border-kong-border/30;
  }

  .add-custom-token-button {
    @apply w-full flex items-center justify-center gap-2 px-3 py-2.5 
           bg-kong-bg-dark/70 text-kong-text-primary rounded-lg
           hover:bg-kong-bg-dark transition-colors;
  }
</style>
