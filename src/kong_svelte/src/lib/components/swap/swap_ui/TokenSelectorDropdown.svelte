<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { onDestroy } from "svelte";
  import {
    currentUserBalancesStore,
  } from "$lib/stores/tokenStore";
  import { loadBalances, refreshBalances, refreshSingleBalance } from "$lib/stores/balancesStore";
  import { scale, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { browser } from "$app/environment";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { FavoriteService } from "$lib/services/tokens/favoriteService";
  import { toastStore } from "$lib/stores/toastStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { auth } from "$lib/services/auth";
  import { get } from "svelte/store";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { debounce } from "$lib/utils/debounce";
  import TokenItem from "./TokenItem.svelte";
  import { virtualScroll } from "$lib/utils/virtualScroll";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import AddNewTokenModal from "$lib/components/sidebar/AddNewTokenModal.svelte";

  const props = $props();
  const {
    show = false,
    onSelect,
    onClose,
    currentToken,
    otherPanelToken = null,
    expandDirection = "down",
    allowedCanisterIds = [],
    restrictToSecondaryTokens = false,
  } = props;

  // Helper for extracting and validating token ID
  function getTokenId(token: any): string | null {
    if (!token || typeof token !== "object" || !("canister_id" in token)) {
      console.warn("Invalid token format:", token);
      return null;
    }
    return token.canister_id;
  }

  // Make tokens reactive to userTokens store changes with better validation
  let tokens = $derived(
    Object.values($userTokens.tokens).filter((token) => {
      const tokenId = getTokenId(token);
      return tokenId && $userTokens.enabledTokens[tokenId];
    }) as FE.Token[],
  );

  const BLOCKED_TOKEN_IDS = [];
  const DEFAULT_ICP_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai"; // ICP canister ID
  const TOKEN_ITEM_HEIGHT = 72; // Increased height to accommodate borders and padding

  let searchQuery = $state("");
  let searchInput: HTMLInputElement;
  let dropdownElement: HTMLDivElement;
  let scrollContainer: HTMLDivElement;
  let scrollTop = $state(0);
  let containerHeight = $state(0);
  let hideZeroBalances = $state(false);
  let isMobile = $state(false);
  let sortDirection = $state("desc");
  let sortColumn = $state("value");
  let standardFilter = $state<"all" | "ck" | "favorites">("all");
  let isSearching = $state(false);
  let apiSearchResults = $state<FE.Token[]>([]);

  // Add a state to track which token is being enabled
  let enablingTokenId = $state<string | null>(null);

  // Add a state to track which tokens have had balance loading attempts
  let balanceLoadAttempts = $state(new Set<string>());

  // Add a state to control the visibility of the AddNewTokenModal
  let isAddNewTokenModalOpen = $state(false);
  
  // Add a set to track which tokens have had their balances loaded
  let loadedBalances = $state(new Set<string>());
  
  // Update the loadedBalances set when the currentUserBalancesStore changes
  $effect(() => {
    if ($currentUserBalancesStore) {
      Object.keys($currentUserBalancesStore).forEach(tokenId => {
        loadedBalances.add(tokenId);
      });
    }
  });
  
  type FilterType = "all" | "ck" | "favorites";

  // Define filter tabs constant
  const FILTER_TABS = [
    { id: "all" as const, label: "All" },
    { id: "ck" as const, label: "CK" },
    { id: "favorites" as const, label: "Favorites" },
  ];

  function setStandardFilter(filter: FilterType) {
    standardFilter = filter;
    searchQuery = ""; // Reset search when changing filters
    scrollTop = 0; // Reset scroll position
  }

  // First, create a reactive store for favorites
  let favoriteTokens = $state(new Map<string, boolean>());
  let favoritesLoaded = $state(false);

  // Filter functions moved from TokenFilterService
  function filterBySearchQuery(token: FE.Token, query: string): boolean {
    if (!query) return true;
    
    const searchLower = query.toLowerCase();
    return token.symbol.toLowerCase().includes(searchLower) ||
           token.name.toLowerCase().includes(searchLower) ||
           token.canister_id.toLowerCase().includes(searchLower);
  }

  function filterByStandardFilter(token: FE.Token, filter: "all" | "ck" | "favorites", favorites: Map<string, boolean>): boolean {
    switch (filter) {
      case "ck":
        return token.symbol.toLowerCase().startsWith("ck");
      case "favorites":
        return favorites.get(token.canister_id) || false;
      case "all":
      default:
        return true;
    }
  }

  function filterByBalance(token: FE.Token, hideZeroBalances: boolean, balances: Record<string, { in_tokens: bigint }>): boolean {
    if (!hideZeroBalances) return true;
    
    const balance = balances[token.canister_id]?.in_tokens;
    return balance ? balance > BigInt(0) : false;
  }

  function sortTokens(a: FE.Token, b: FE.Token, sortColumn: string, sortDirection: string, favorites: Map<string, boolean>, balances: Record<string, { in_usd: string }>): number {
    // Sort by favorites first
    const aFavorite = favorites.get(a.canister_id) || false;
    const bFavorite = favorites.get(b.canister_id) || false;
    if (aFavorite !== bFavorite) return bFavorite ? 1 : -1;

    // Then sort by value if that's selected
    if (sortColumn === 'value') {
      const aBalance = balances[a.canister_id]?.in_usd || "0";
      const bBalance = balances[b.canister_id]?.in_usd || "0";
      const aValue = Number(aBalance);
      const bValue = Number(bBalance);
      return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    }

    return 0;
  }

  // Create a function to handle all token filtering and sorting logic
  function getFilteredAndSortedTokens(
    allTokens: FE.Token[],
    searchQuery: string,
    standardFilter: FilterType,
    hideZeroBalances: boolean,
    favoriteTokens: Map<string, boolean>,
    sortColumn: string,
    sortDirection: string,
    apiTokens: FE.Token[],
    balances: Record<string, { in_tokens: bigint; in_usd: string }>
  ) {
    return Array.from(new Map(
      // Combine both sources and map by canister_id to deduplicate
      [...allTokens, ...apiTokens].map(token => [token.canister_id, token])
    ).values())
      .filter((token) => {
        if (!token?.canister_id || !token?.symbol || !token?.name) {
          console.warn("Incomplete token data:", token);
          return false;
        }
        
        // Apply all filters
        return filterBySearchQuery(token, searchQuery) && 
               filterByStandardFilter(token, standardFilter, favoriteTokens) &&
               filterByBalance(token, hideZeroBalances, balances);
      })
      .sort((a, b) => sortTokens(a, b, sortColumn, sortDirection, favoriteTokens, balances));
  }

  // Load favorites once on component mount
  async function loadFavorites() {
    if (!browser || favoritesLoaded) return;

    await FavoriteService.loadFavorites();

    const newFavorites = new Map<string, boolean>();
    const promises = baseFilteredTokens.map(async (token) => {
      const tokenId = getTokenId(token);
      if (tokenId) {
        newFavorites.set(tokenId, await FavoriteService.isFavorite(tokenId));
      }
    });

    // Use Promise.all to load all favorites in parallel
    await Promise.all(promises);
    favoriteTokens = newFavorites;
    favoritesLoaded = true;
  }

  function isFavoriteToken(tokenId: string): boolean {
    return favoriteTokens.get(tokenId) || false;
  }

  // Get filtered tokens before any UI filters (search, favorites, etc)
  let baseFilteredTokens = $derived(
    browser
      ? tokens.filter((token) => {
          const tokenId = getTokenId(token);
          if (!tokenId) return false;

          // Then check if we should restrict to secondary tokens
          if (restrictToSecondaryTokens) {
            return SECONDARY_TOKEN_IDS.includes(tokenId);
          }

          // Then check allowed canister IDs if provided
          if (allowedCanisterIds.length > 0) {
            return allowedCanisterIds.includes(tokenId);
          }

          return true;
        })
      : [],
  );

  // Get counts based on the base filtered tokens
  let allTokensCount = $derived(baseFilteredTokens.length);
  let ckTokensCount = $derived(
    baseFilteredTokens.filter((t) => t.symbol.toLowerCase().startsWith("ck"))
      .length,
  );

  // Create a memoized debounced search function
  const debouncedApiSearch = debounce(async (query: string) => {
    if (!browser || !query || query.length < 2) {
      apiSearchResults = [];
      return;
    }

    // Check if we already have items matching the search
    const matchingLocalTokens = baseFilteredTokens.filter(
      (token) =>
        (token.symbol.toLowerCase().includes(query.toLowerCase()) ||
          token.name.toLowerCase().includes(query.toLowerCase()) ||
          token.canister_id.toLowerCase().includes(query.toLowerCase())) &&
        $userTokens.enabledTokens[token.canister_id],
    );

    // If we have enough local matches, skip the API call
    if (matchingLocalTokens.length >= 10) {
      apiSearchResults = [];
      return;
    }

    isSearching = true;
    try {
      const { tokens } = await fetchTokens({
        search: query,
        limit: 20, // Limit API results to prevent overwhelming the UI
      });

      // Filter out tokens that are already enabled
      apiSearchResults = tokens.filter(
        (token) => !$userTokens.enabledTokens[token.canister_id],
      );
    } catch (error) {
      console.error("Error searching tokens:", error);
      apiSearchResults = [];
    } finally {
      isSearching = false;
    }
  }, 300);

  // Update search effect
  $effect(() => {
    if (!browser) return;
    if (searchQuery) {
      void debouncedApiSearch(searchQuery);
    } else {
      apiSearchResults = [];
    }
  });

  // Memoize filtered tokens to avoid recalculation
  let filteredTokens = $derived(
    browser
      ? getFilteredAndSortedTokens(
          baseFilteredTokens,
          searchQuery,
          standardFilter,
          hideZeroBalances,
          favoriteTokens,
          sortColumn,
          sortDirection,
          apiSearchResults,
          $currentUserBalancesStore,
        )
      : [],
  );

  // Separate enabled tokens from API tokens for virtual scrolling
  let enabledFilteredTokens = $derived(
    filteredTokens.filter((token) => isTokenEnabled(token)),
  );

  let apiFilteredTokens = $derived(
    filteredTokens.filter((token) => isApiToken(token)),
  );

  // Virtual scrolling state for enabled tokens
  let enabledTokensVirtualState = $derived(
    virtualScroll({
      items: enabledFilteredTokens,
      containerHeight,
      scrollTop,
      itemHeight: TOKEN_ITEM_HEIGHT,
      buffer: 5,
    }),
  );

  // Virtual scrolling state for API tokens
  let apiTokensVirtualState = $derived(
    virtualScroll({
      items: apiFilteredTokens,
      containerHeight,
      scrollTop,
      itemHeight: TOKEN_ITEM_HEIGHT,
      buffer: 5,
    }),
  );

  const SECONDARY_TOKEN_IDS = [
    "ryjl3-tyaaa-aaaaa-aaaba-cai", // ICP
    "cngnf-vqaaa-aaaar-qag4q-cai", // ckUSDT
  ];

  // Check if we're on mobile
  $effect(() => {
    if (browser) {
      isMobile = window.innerWidth <= 768;
      const handleResize = () => {
        isMobile = window.innerWidth <= 768;
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  });

  async function handleFavoriteClick(e: MouseEvent, token: FE.Token) {
    e.preventDefault();
    e.stopPropagation();
    const isFavorite = favoriteTokens.get(token.canister_id) || false;

    if (isFavorite) {
      await FavoriteService.removeFavorite(token.canister_id);
    } else {
      await FavoriteService.addFavorite(token.canister_id);
    }

    // Update the local state immediately
    favoriteTokens.set(token.canister_id, !isFavorite);
    favoriteTokens = new Map(favoriteTokens); // Trigger reactivity
  }

  // Create tokens map once for TokenBalanceService
  let tokensMap = $derived(
    tokens.reduce(
      (acc, token) => {
        acc[token.canister_id] = token;
        return acc;
      },
      {} as Record<string, FE.Token>,
    ),
  );

  // Update balance functions to use TokenBalanceService with caching and error handling
  async function getTokenBalance(token: FE.Token): Promise<bigint> {
    try {
      // Use the centralized balanceStore function
      const balance = await loadBalances([token], $auth.account?.owner, true);
      return balance[token.canister_id]?.in_tokens || 0n;
    } catch (error) {
      console.warn(`Error getting balance for ${token.symbol}:`, error);
      return 0n;
    }
  }

  // Helper for token selection
  function canSelectToken(token: FE.Token): boolean {
    // Can't select currently selected token on other panel
    if (otherPanelToken?.canister_id === token.canister_id) return false;
    // Can't select blocked tokens
    if (BLOCKED_TOKEN_IDS.includes(token.canister_id)) return false;
    // Can't directly select non-enabled tokens from API
    if (isApiToken(token)) return false;

    return true;
  }

  function handleSelect(token: FE.Token) {
    if (BLOCKED_TOKEN_IDS.includes(token.canister_id)) {
      toastStore.warning(
        "BIL token is currently in read-only mode. Trading will resume when the ledger is stable.",
        {
          title: "Token Temporarily Unavailable",
          duration: 8000,
        },
      );
      return;
    }

    // Check if token is from API results and not already enabled
    if (isApiToken(token)) {
      // Enable the token first
      userTokens.enableToken(token);
    }

    onSelect(token);
    searchQuery = "";
  }

  // Update the handleEnableToken function to avoid unnecessary balance loading
  async function handleEnableToken(e: MouseEvent, token: FE.Token) {
    e.preventDefault();
    e.stopPropagation();

    // Set loading state
    enablingTokenId = token.canister_id;

    try {
      // Enable the token
      userTokens.enableToken(token);
      console.log(`Enabling token: ${token.symbol} (${token.canister_id})`);

      // Check if token was already in balance attempts to avoid duplicate attempts
      if (!balanceLoadAttempts.has(token.canister_id)) {
        balanceLoadAttempts.add(token.canister_id);
        
        // Load balance for the newly enabled token if user is connected
        const authStore = get(auth);
        const principal = authStore?.account?.owner?.toString();

        if (principal) {          
          // Use centralized balance refreshing with a slight delay to ensure token is registered
          setTimeout(async () => {
            try {
              await refreshSingleBalance(token, principal, false);
              console.log(`Updated balance for newly enabled token: ${token.symbol}`);
            } catch (err) {
              console.warn(`Failed to load balance for ${token.symbol} after enabling:`, err);
            }
          }, 200);
        }
      }
      
      // If this is an API token being enabled, select it after enabling
      if (isApiToken(token) && canSelectToken(token)) {
        handleSelect(token);
        onClose();
      }
    } catch (error) {
      console.warn(`Error enabling token ${token.symbol}:`, error);
    } finally {
      // Clear loading state
      enablingTokenId = null;
    }
  }

  // Update the handleTokenClick function to properly handle selection flow
  function handleTokenClick(e: MouseEvent | TouchEvent, token: FE.Token) {
    e.stopPropagation();

    // Handle API tokens differently - they need to be enabled first
    if (isApiToken(token)) {
      // For API tokens, we delegate to handleEnableToken which will handle the full flow
      if (e instanceof MouseEvent) {
        handleEnableToken(e, token);
      }
      return;
    }

    if (!canSelectToken(token)) return;

    // For already enabled tokens, load balance if needed before selecting
    if ($auth.account?.owner && !$currentUserBalancesStore[token.canister_id]) {
      void refreshSingleBalance(token, $auth.account.owner.toString(), false);
    }

    handleSelect(token);
    onClose();
  }

  // Handle when a custom token is added through the modal
  function handleCustomTokenAdded(event: CustomEvent<FE.Token>) {
    const newToken = event.detail;
    
    // Close the modal
    isAddNewTokenModalOpen = false;
    
    // If the token was successfully added, select it
    if (newToken && canSelectToken(newToken)) {
      handleSelect(newToken);
      onClose();
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
  }

  // Add a function to load balances for visible tokens with debouncing
  let loadBalancesDebounceTimer: ReturnType<typeof setTimeout>;
  function loadVisibleTokenBalances() {
    if (!browser) return;

    const authStore = get(auth);
    const principal = authStore?.account?.owner?.toString();
    if (!principal) return;

    // Clear previous debounce timer
    clearTimeout(loadBalancesDebounceTimer);
    
    // Set a new debounce timer
    loadBalancesDebounceTimer = setTimeout(() => {
      // Get all currently visible tokens
      const visibleTokens = [
        ...enabledTokensVirtualState.visible.map((v) => v.item),
        ...apiTokensVirtualState.visible.map((v) => v.item),
      ];

      // Filter tokens that need balance loading to avoid unnecessary requests
      const tokensNeedingBalances = visibleTokens.filter(
        token => token.canister_id && 
                !$currentUserBalancesStore[token.canister_id] && 
                !loadedBalances.has(token.canister_id)
      );
      
      if (tokensNeedingBalances.length > 0) {
        console.log(`Loading balances for ${tokensNeedingBalances.length} visible tokens`);
        
        // Mark these tokens as having their balances loaded
        tokensNeedingBalances.forEach(token => {
          loadedBalances.add(token.canister_id);
        });
        
        // Load balances for these tokens
        void loadBalances(tokensNeedingBalances, principal, true);
      }
    }, 200); // 200ms debounce
  }

  // Add an effect to load balances when visible tokens change
  $effect(() => {
    if (show && browser) {
      // When virtual scroll state changes, load balances for newly visible tokens
      loadVisibleTokenBalances();
    }
  });

  // Update the handleScroll function to load balances for newly visible tokens
  function handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    scrollTop = target.scrollTop;

    // Debounce balance loading during scroll to avoid too many requests
    clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(() => {
      loadVisibleTokenBalances();
    }, 200);
  }

  // Add a debounce timer for scroll events
  let scrollDebounceTimer: ReturnType<typeof setTimeout>;

  // Clean up the timer on component destroy
  onDestroy(() => {
    cleanup();
    clearTimeout(scrollDebounceTimer);
    clearTimeout(loadBalancesDebounceTimer);
  });

  // Focus search input when dropdown opens
  $effect(() => {
    if (show && browser) {
      // Only load balances if user is connected
      const authStore = get(auth);
      const principal = authStore?.account?.owner?.toString();

      if (principal) {
        // Load balances for visible tokens first, to reduce initial loading time
        setTimeout(() => {
          if (show) { // Check if dropdown is still open
            loadVisibleTokenBalances();
            
            // Then load all token balances with a delay to avoid overwhelming the system
            setTimeout(() => {
              if (show && tokens.length > 0) { // Double-check dropdown is still open
                // Filter tokens that don't have balances loaded yet
                const tokensNeedingBalances = tokens.filter(
                  token => token.canister_id && 
                          !$currentUserBalancesStore[token.canister_id] && 
                          !loadedBalances.has(token.canister_id)
                );
                
                if (tokensNeedingBalances.length > 0) {
                  console.log(`Loading balances for ${tokensNeedingBalances.length} remaining tokens with delay`);
                  
                  // Mark these tokens as having their balances loaded
                  tokensNeedingBalances.forEach(token => {
                    loadedBalances.add(token.canister_id);
                  });
                  
                  // Load balances for these tokens
                  void loadBalances(tokensNeedingBalances, principal, false);
                }
              }
            }, 500);
          }
        }, 0);
      }

      // Load favorites
      void loadFavorites();

      setTimeout(() => {
        searchInput?.focus();
        window.addEventListener("click", handleClickOutside);
        window.addEventListener("keydown", handleKeydown);
      }, 0);
    }
  });

  // Cleanup event listeners
  function cleanup() {
    if (browser) {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeydown);
    }
  }

  onDestroy(cleanup);

  let favoritesCount = $derived(
    Array.from(favoriteTokens.values()).filter(Boolean).length,
  );

  // Get counts for the tabs
  function getTabCount(tabId: string): number {
    switch (tabId) {
      case "all":
        return allTokensCount;
      case "ck":
        return ckTokensCount;
      case "favorites":
        return favoritesCount;
      default:
        return 0;
    }
  }

  // Remove the template string function
  function isTokenEnabled(token: FE.Token): boolean {
    return !isApiToken(token) || $userTokens.enabledTokens[token.canister_id];
  }

  // Define the isApiToken function to check if a token is from API results
  function isApiToken(token: FE.Token): boolean {
    // A token is considered from API if it's not already enabled in the user's tokens
    return !!token && !$userTokens.enabledTokens[token.canister_id];
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="modal-backdrop"
    on:click|self={() => {
      swapState.closeTokenSelector();
      onClose();
    }}
    role="dialog"
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="dropdown-container {expandDirection} {isMobile ? 'mobile' : ''}"
      bind:this={dropdownElement}
      on:click|stopPropagation
      transition:scale={{
        duration: 200,
        start: 0.95,
        opacity: 0,
        easing: cubicOut,
      }}
    >
      <div class="modal-content">
        <header class="modal-header">
          <h2 class="modal-title">Tokens</h2>
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <button
            class="close-button"
            on:click={(e) => {
              e.stopPropagation();
              swapState.closeTokenSelector();
              onClose();
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div class="modal-body">
          <div class="fixed-section">
            <div class="search-section">
              <div class="search-input-wrapper">
                <input
                  bind:this={searchInput}
                  bind:value={searchQuery}
                  type="text"
                  placeholder="Search by name, symbol, canister ID, or standard"
                  class="search-input"
                  on:click={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div class="pb-2 shadow-md z-20">
              <div class="filter-buttons">
                {#each FILTER_TABS as tab}
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <button
                    on:click={() => setStandardFilter(tab.id as FilterType)}
                    class="filter-btn"
                    class:active={standardFilter === tab.id}
                    aria-label="Show {tab.label.toLowerCase()} tokens"
                  >
                    <span class="tab-label">{tab.label}</span>
                    <span
                      class="tab-count"
                      class:has-items={getTabCount(tab.id) > 0}
                    >
                      {getTabCount(tab.id)}
                    </span>
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <div
            class="scrollable-section"
            bind:this={scrollContainer}
            bind:clientHeight={containerHeight}
            on:scroll={handleScroll}
          >
            <div class="tokens-container">
              <!-- Local tokens -->
              {#if enabledFilteredTokens.length > 0}
                <div class="token-section">
                  <div
                    style="height: {enabledFilteredTokens.length *
                      TOKEN_ITEM_HEIGHT}px; position: relative;"
                  >
                    {#each enabledTokensVirtualState.visible as { item: token, index }, i (token.canister_id)}
                      <div
                        style="position: absolute; top: {index *
                          TOKEN_ITEM_HEIGHT}px; width: 100%; height: {TOKEN_ITEM_HEIGHT}px; padding: 4px 0; box-sizing: border-box;"
                      >
                        <TokenItem
                          {token}
                          index={i}
                          {currentToken}
                          {otherPanelToken}
                          isApiToken={isApiToken(token)}
                          isFavorite={isFavoriteToken(token.canister_id)}
                          {enablingTokenId}
                          blockedTokenIds={BLOCKED_TOKEN_IDS}
                          balance={{
                            loading: !$currentUserBalancesStore[token.canister_id],
                            tokens: $currentUserBalancesStore[token.canister_id]
                              ? formatBalance(
                                $currentUserBalancesStore[token.canister_id]?.in_tokens || 0n,
                                token.decimals || 8
                              )
                              : "0",
                            usd: $currentUserBalancesStore[token.canister_id]
                              ? formatUsdValue(
                                $currentUserBalancesStore[token.canister_id]?.in_usd || "0"
                              )
                              : "$0.00"
                          }}
                          onTokenClick={(e) => handleTokenClick(e, token)}
                          onFavoriteClick={(e) => handleFavoriteClick(e, token)}
                          onEnableClick={(e) => handleEnableToken(e, token)}
                        />
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- API search results -->
              {#if apiFilteredTokens.length > 0 || isSearching}
                <div class="token-section">
                  <div class="token-section-header">
                    <span>Available Tokens</span>
                  </div>
                  
                  {#if isSearching}
                    <div class="loading-indicator">
                      <span class="loading-spinner"></span>
                      <span>Searching...</span>
                    </div>
                  {:else}
                    <div style="height: {apiFilteredTokens.length * TOKEN_ITEM_HEIGHT}px; position: relative;">
                      {#each apiTokensVirtualState.visible as { item: token, index }, i (token.canister_id)}
                        <div
                          style="position: absolute; top: {index * TOKEN_ITEM_HEIGHT}px; width: 100%; height: {TOKEN_ITEM_HEIGHT}px; padding: 4px 0; box-sizing: border-box;"
                        >
                          <TokenItem
                            {token}
                            index={i}
                            currentToken={currentToken}
                            otherPanelToken={otherPanelToken}
                            isApiToken={true}
                            isFavorite={isFavoriteToken(token.canister_id)}
                            enablingTokenId={enablingTokenId}
                            blockedTokenIds={BLOCKED_TOKEN_IDS}
                            balance={{
                              loading: !$currentUserBalancesStore[token.canister_id],
                              tokens: $currentUserBalancesStore[token.canister_id]
                                ? formatBalance(
                                  $currentUserBalancesStore[token.canister_id]?.in_tokens || 0n,
                                  token.decimals || 8
                                )
                                : "0",
                              usd: $currentUserBalancesStore[token.canister_id]
                                ? formatUsdValue(
                                  $currentUserBalancesStore[token.canister_id]?.in_usd || "0"
                                )
                                : "$0.00"
                            }}
                            onTokenClick={(e) => e.stopPropagation()}
                            onFavoriteClick={(e) => handleFavoriteClick(e, token)}
                            onEnableClick={(e) => handleEnableToken(e, token)}
                          />
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
              
              <!-- Add New Token Button -->
              <div class="add-token-button-container">
                <button 
                  class="add-token-button"
                  on:click={(e) => {
                    e.stopPropagation();
                    isAddNewTokenModalOpen = true;
                  }}
                >
                  <div class="add-icon">+</div>
                  <span>Add New Token</span>
                </button>
              </div>
              
              {#if filteredTokens.length === 0}
                <div class="empty-state">
                  <span>No tokens found</span>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style scoped lang="postcss">
  .modal-backdrop {
    @apply fixed inset-0 bg-black/30 backdrop-blur-md z-[9999] grid place-items-center p-6 overflow-y-auto;
  }

  .dropdown-container {
    @apply relative border transition-all duration-200 overflow-hidden;
    @apply w-[420px] h-[min(600px,85vh)];
    background: var(--token-selector-bg, theme('colors.kong.bg-dark'));
    border: var(--token-selector-border, 1px solid theme('colors.kong.border'));
    border-radius: var(--token-selector-roundness, theme('borderRadius.xl'));
    box-shadow: var(--token-selector-shadow, theme('boxShadow.lg'));
  }

  .dropdown-container.mobile {
    @apply fixed inset-0 w-full h-screen rounded-none border-0;
  }

  .modal-content {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .modal-header {
    @apply px-4 py-3 flex justify-between items-center;
    background: var(--token-selector-header-bg, theme('colors.kong.bg-dark'));
  }

  .modal-title {
    @apply text-kong-text-primary text-xl font-semibold;
  }

  .close-button {
    @apply text-kong-text-secondary hover:bg-kong-border/10;
  }

  .modal-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .fixed-section {
    @apply relative;
    z-index: 20;
    flex-shrink: 0;
  }

  .scrollable-section {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    overscroll-behavior-y: contain;
    position: relative;
    z-index: 10;
    will-change: transform;
  }

  .scrollable-section::-webkit-scrollbar {
    width: 4px;
  }

  .scrollable-section::-webkit-scrollbar-track {
    background: rgba(26, 29, 46, 0.4);
    border-radius: 0.25rem;
  }

  .scrollable-section::-webkit-scrollbar-thumb {
    background: #e9e9f0;
    border-radius: 0.25rem;
  }

  .search-section {
    z-index: 10;
    @apply pb-3;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    @apply px-4;
  }

  .search-input {
    @apply flex-1 border-none text-kong-text-primary text-base rounded-md px-4 py-3;
    background: var(--token-selector-search-bg, theme('colors.kong.bg-light'));
  }

  .search-input::placeholder {
    @apply text-kong-text-secondary;
  }

  .search-input:focus {
    outline: none;
  }

  .filter-buttons {
    @apply px-4;
    display: flex;
    width: 100%;
    margin-bottom: 0.25rem;
    border-bottom: none;
    gap: 8px;
  }

  .filter-btn {
    @apply flex-1 px-3 py-2 flex items-center justify-center gap-2 text-kong-text-secondary text-sm relative transition-all duration-200 font-medium;
    @apply bg-kong-bg-light/30 rounded-2xl;
  }

  .filter-btn:hover {
    @apply bg-kong-bg-light/60;
  }

  .filter-btn.active {
    @apply text-white font-semibold;
    background: var(--token-selector-item-active-bg, theme('colors.kong.primary'));
  }

  .tab-label {
    position: relative;
    z-index: 10;
  }

  .tab-count {
    @apply text-kong-text-secondary text-xs;
    @apply px-2 py-1;
    @apply rounded-full;
    @apply bg-kong-border/10;
    @apply min-w-[1.5rem];
    @apply text-center;
    transition: all 0.2s;
  }

  .tab-count.has-items {
    @apply bg-kong-primary/10 text-kong-text-primary;
  }

  .tokens-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 100%;
    touch-action: pan-y;
    padding: 0.5rem;
  }

  .token-section {
    @apply space-y-2;
  }

  .token-section:not(:first-child) {
    @apply mt-4;
  }

  .token-section-header {
    @apply p-2 text-sm font-medium text-kong-text-secondary;
    @apply rounded-lg border border-kong-border/10;
    @apply backdrop-blur-sm mx-2 my-2;
    background: var(--token-selector-item-bg, theme('colors.kong.bg-light/50'));
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }

  .loading-spinner {
    @apply w-4 h-4;
    @apply border-2 border-white/20 border-t-white;
    @apply rounded-full;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    @apply flex items-center justify-center p-8 text-kong-text-secondary text-sm;
    @apply flex-col gap-4;
  }

  @media (max-width: 768px) {
    .modal-backdrop {
      padding: 0;
    }

    .dropdown-container {
      width: 100%;
      height: 100%;
      max-height: 100vh;
    }
  }

  .scrollable-section::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 32px;
    @apply px-2;
    pointer-events: none;
    z-index: 5;
  }
  
  /* Add Token Button Styles */
  .add-token-button-container {
    @apply px-2 py-3 mt-2;
  }
  
  .add-token-button {
    @apply w-full flex items-center justify-center gap-2 py-3 px-4 
           hover:bg-kong-bg-light/80
           text-kong-text-primary font-medium rounded-lg
           border border-kong-border/30 transition-all duration-200;
    background: var(--token-selector-item-bg, theme('colors.kong.bg-light/50'));
  }
  
  .add-token-button:hover {
    @apply border-kong-primary/40;
    background: var(--token-selector-item-hover-bg, theme('colors.kong.primary/10'));
  }
  
  .add-icon {
    @apply flex items-center justify-center w-5 h-5 rounded-full
           text-kong-primary font-bold;
    background: var(--token-selector-item-active-bg, theme('colors.kong.primary/20'));
  }
</style>

<!-- Add New Token Modal -->
<AddNewTokenModal 
  isOpen={isAddNewTokenModalOpen}
  onClose={() => isAddNewTokenModalOpen = false}
  on:tokenAdded={handleCustomTokenAdded}
/>
