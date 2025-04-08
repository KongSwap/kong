<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { onDestroy } from "svelte";
  import {
    currentUserBalancesStore,
  } from "$lib/stores/tokenStore";
  import { loadBalances, refreshSingleBalance } from "$lib/stores/balancesStore";
  import { scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { browser } from "$app/environment";
  import { swapState } from "$lib/services/swap/SwapStateService";
	import { favoriteStore } from "$lib/stores/favoriteStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { auth } from "$lib/stores/auth";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { debounce } from "$lib/utils/debounce";
  import TokenItem from "./TokenItem.svelte";
  import { virtualScroll } from "$lib/utils/virtualScroll";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import AddNewTokenModal from "$lib/components/wallet/AddNewTokenModal.svelte";

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

  // Constants
  const BLOCKED_TOKEN_IDS = [];
  const TOKEN_ITEM_HEIGHT = 72;
  const SECONDARY_TOKEN_IDS = [
    "ryjl3-tyaaa-aaaaa-aaaba-cai", // ICP
    "cngnf-vqaaa-aaaar-qag4q-cai", // ckUSDT
  ];
  const FILTER_TABS = [
    { id: "all" as const, label: "All" },
    { id: "ck" as const, label: "CK" },
    { id: "favorites" as const, label: "Favorites" },
  ];
  
  type FilterType = "all" | "ck" | "favorites";

  // Helper for extracting and validating token ID
  function getTokenId(token: any): string | null {
    return token?.canister_id || null;
  }

  // UI state
  let dropdownElement: HTMLDivElement | null = $state(null);
  let scrollContainer: HTMLDivElement | null = $state(null);
  
  // UI state with reactivity
  let state = $state({
    searchInput: null as HTMLInputElement | null,
    dropdownElement: null as HTMLDivElement | null,
    scrollContainer: null as HTMLDivElement | null,
    searchQuery: "",
    scrollTop: 0,
    containerHeight: 0,
    hideZeroBalances: false,
    isMobile: false,
    sortDirection: "desc",
    sortColumn: "value",
    standardFilter: "all" as FilterType,
    isSearching: false,
    enablingTokenId: null as string | null,
    isAddNewTokenModalOpen: false,
    favoritesLoaded: false,
    favoriteTokens: new Map<string, boolean>(),
    loadedTokens: new Set<string>(),
    apiSearchResults: [] as FE.Token[]
  });

  // Timers for debouncing
  let loadBalancesDebounceTimer: ReturnType<typeof setTimeout>;
  let scrollDebounceTimer: ReturnType<typeof setTimeout>;

  // Make tokens reactive to userTokens store changes
  let tokens = $derived(
    browser 
      ? Array.from($userTokens.tokenData.values()).filter((token) => {
          const tokenId = getTokenId(token);
          return tokenId && $userTokens.enabledTokens.has(tokenId);
        }) as FE.Token[]
      : []
  );
  
  // Update loadedTokens when the balancesStore changes
  $effect(() => {
    if ($currentUserBalancesStore) {
      Object.keys($currentUserBalancesStore).forEach(tokenId => {
        state.loadedTokens.add(tokenId);
      });
    }
  });

  // Helper functions for token state
  function isApiToken(token: FE.Token): boolean {
    return !!token && !$userTokens.enabledTokens.has(token.canister_id);
  }
  
  function isFavoriteToken(tokenId: string): boolean {
    return state.favoriteTokens.get(tokenId) || false;
  }

  function canSelectToken(token: FE.Token): boolean {
    return !(
      otherPanelToken?.canister_id === token.canister_id ||
      BLOCKED_TOKEN_IDS.includes(token.canister_id) ||
      isApiToken(token)
    );
  }

  // Get filtered tokens before UI filters
  let baseFilteredTokens = $derived(
    browser
      ? tokens.filter((token) => {
          const tokenId = getTokenId(token);
          if (!tokenId) return false;

          if (restrictToSecondaryTokens) {
            return SECONDARY_TOKEN_IDS.includes(tokenId);
          }

          if (allowedCanisterIds.length > 0) {
            return allowedCanisterIds.includes(tokenId);
          }

          return true;
        })
      : [],
  );

  // User authentication state
  let isUserAuthenticated = $derived($userTokens.isAuthenticated);

  // Get counts for filter tabs
  let allTokensCount = $derived(baseFilteredTokens.length);
  let ckTokensCount = $derived(
    baseFilteredTokens.filter((t) => t.symbol.toLowerCase().startsWith("ck")).length
  );
  let favoritesCount = $derived(
    Array.from(state.favoriteTokens.values()).filter(Boolean).length
  );

  // Consolidated filter and sort function
  function filterAndSortTokens(
    tokens: FE.Token[],
    query: string,
    filter: FilterType,
    hideZero: boolean,
    favorites: Map<string, boolean>,
    sortCol: string,
    sortDir: string,
    balances: Record<string, { in_tokens: bigint; in_usd: string }>,
    currentToken: FE.Token | null
  ): FE.Token[] {
    return tokens.filter(token => {
      // Basic validation
      if (!token?.canister_id || !token?.symbol || !token?.name) return false;
      
      // Search query filter
      if (query && !token.symbol.toLowerCase().includes(query.toLowerCase()) && 
          !token.name.toLowerCase().includes(query.toLowerCase()) &&
          !token.canister_id.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      
      // Standard filter (all, ck, favorites)
      if (filter === "ck" && !token.symbol.toLowerCase().startsWith("ck")) return false;
      if (filter === "favorites" && !favorites.get(token.canister_id)) return false;
      
      // Balance filter
      if (hideZero) {
        const balance = balances[token.canister_id]?.in_tokens;
        if (!balance || balance <= BigInt(0)) return false;
      }
      
      return true;
    }).sort((a, b) => {
      // Sort by current token first
      const aIsCurrent = currentToken?.canister_id === a.canister_id;
      const bIsCurrent = currentToken?.canister_id === b.canister_id;
      if (aIsCurrent) return -1;
      if (bIsCurrent) return 1;

      // Sort by favorites first
      const aFavorite = favorites.get(a.canister_id) || false;
      const bFavorite = favorites.get(b.canister_id) || false;
      if (aFavorite !== bFavorite) return bFavorite ? 1 : -1;

      // Then sort by value if that's selected
      if (sortCol === 'value') {
        const aBalance = balances[a.canister_id]?.in_usd || "0";
        const bBalance = balances[b.canister_id]?.in_usd || "0";
        const aValue = Number(aBalance);
        const bValue = Number(bBalance);
        return sortDir === 'desc' ? bValue - aValue : aValue - bValue;
      }

      return 0;
    });
  }

  // Get filtered and sorted tokens
  function getFilteredAndSortedTokens(
    allTokens: FE.Token[],
    apiTokens: FE.Token[],
    currentToken: FE.Token | null
  ): FE.Token[] {
    // Deduplicate tokens from both sources
    const uniqueTokens = Array.from(new Map(
      [...allTokens, ...apiTokens].map(token => [token.canister_id, token])
    ).values());
    
    return filterAndSortTokens(
      uniqueTokens,
      state.searchQuery,
      state.standardFilter,
      state.hideZeroBalances,
      state.favoriteTokens,
      state.sortColumn,
      state.sortDirection,
      $currentUserBalancesStore,
      currentToken
    );
  }

  // Derived lists and virtual scroll states
  let filteredTokens = $derived(
    browser ? getFilteredAndSortedTokens(baseFilteredTokens, state.apiSearchResults, currentToken) : []
  );
  
  let enabledFilteredTokens = $derived(filteredTokens.filter(token => $userTokens.enabledTokens.has(token.canister_id)));
  let apiFilteredTokens = $derived(filteredTokens.filter(token => isApiToken(token)));
  
  let enabledTokensVirtualState = $derived(
    virtualScroll({
      items: enabledFilteredTokens,
      containerHeight: state.containerHeight,
      scrollTop: state.scrollTop,
      itemHeight: TOKEN_ITEM_HEIGHT,
      buffer: 5,
    })
  );
  
  let apiTokensVirtualState = $derived(
    virtualScroll({
      items: apiFilteredTokens,
      containerHeight: state.containerHeight,
      scrollTop: state.scrollTop,
      itemHeight: TOKEN_ITEM_HEIGHT,
      buffer: 5,
    })
  );

  // Helper function to get tab counts
  function getTabCount(tabId: string): number {
    switch (tabId) {
      case "all": return allTokensCount;
      case "ck": return ckTokensCount;
      case "favorites": return favoritesCount;
      default: return 0;
    }
  }

  // UI Event handlers
  function setStandardFilter(filter: FilterType) {
    state.standardFilter = filter;
    state.searchQuery = "";
    state.scrollTop = 0;
  }
  
  function handleScroll(e: Event) {
    state.scrollTop = (e.target as HTMLElement).scrollTop;
    clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(loadVisibleTokenBalances, 200);
  }
  
  function handleClickOutside(event: MouseEvent) {
    if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
      onClose();
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") onClose();
  }
  
  function closeWithCleanup() {
    swapState.closeTokenSelector();
    onClose();
  }

  // Token-related actions
  async function handleFavoriteClick(e: MouseEvent, token: FE.Token) {
    e.preventDefault();
    e.stopPropagation();
    
    const isFavorite = state.favoriteTokens.get(token.canister_id) || false;
    await (isFavorite 
      ? favoriteStore.removeFavorite(token.canister_id)
      : favoriteStore.addFavorite(token.canister_id));

    // Update the local state
    state.favoriteTokens.set(token.canister_id, !isFavorite);
    state.favoriteTokens = new Map(state.favoriteTokens); // Trigger reactivity
  }
  
  function handleSelect(token: FE.Token) {
    if (BLOCKED_TOKEN_IDS.includes(token.canister_id)) {
      toastStore.warning(
        "BIL token is currently in read-only mode. Trading will resume when the ledger is stable.",
        { title: "Token Temporarily Unavailable", duration: 8000 }
      );
      return;
    }

    // Enable the token first if it's from API
    if (isApiToken(token)) userTokens.enableToken(token);

    onSelect(token);
    state.searchQuery = "";
  }
  
  async function handleEnableToken(e: MouseEvent, token: FE.Token) {
    e.preventDefault();
    e.stopPropagation();
    state.enablingTokenId = token.canister_id;

    try {
      userTokens.enableToken(token);
      
      if (isUserAuthenticated && !state.loadedTokens.has(token.canister_id)) {
        state.loadedTokens.add(token.canister_id);
        const principal = $auth.account?.owner?.toString();

        if (principal) {          
          setTimeout(async () => {
            try {
              await refreshSingleBalance(token, principal, false);
            } catch (err) {
              console.warn(`Failed to load balance for ${token.symbol}:`, err);
            }
          }, 200);
        }
      }
      
      if (isApiToken(token) && canSelectToken(token)) {
        handleSelect(token);
        onClose();
      }
    } catch (error) {
      console.warn(`Error enabling token ${token.symbol}:`, error);
    } finally {
      state.enablingTokenId = null;
    }
  }
  
  function handleTokenClick(e: MouseEvent | TouchEvent, token: FE.Token) {
    e.stopPropagation();

    if (isApiToken(token)) {
      // API tokens need to be enabled first
      if (e instanceof MouseEvent) handleEnableToken(e, token);
      return;
    }

    if (!canSelectToken(token)) return;

    // Load balance if needed before selecting
    if (isUserAuthenticated && $auth.account?.owner && 
        !$currentUserBalancesStore[token.canister_id]) {
      void refreshSingleBalance(token, $auth.account.owner.toString(), false);
    }

    handleSelect(token);
    onClose();
  }
  
  function handleCustomTokenAdded(event: CustomEvent<FE.Token>) {
    const newToken = event.detail;
    state.isAddNewTokenModalOpen = false;
    
    if (newToken && canSelectToken(newToken)) {
      handleSelect(newToken);
      onClose();
    }
  }

  // Balance loading
  function loadVisibleTokenBalances() {
    if (!browser || !isUserAuthenticated) return;

    const principal = $auth.account?.owner?.toString();
    if (!principal) return;

    clearTimeout(loadBalancesDebounceTimer);
    loadBalancesDebounceTimer = setTimeout(() => {
      // Get visible tokens
      const visibleTokens = [
        ...enabledTokensVirtualState.visible.map(v => v.item),
        ...apiTokensVirtualState.visible.map(v => v.item)
      ];

      // Filter tokens that need balance loading
      const tokensNeedingBalances = visibleTokens.filter(
        token => token.canister_id && 
                !$currentUserBalancesStore[token.canister_id] && 
                !state.loadedTokens.has(token.canister_id)
      );
      
      if (tokensNeedingBalances.length > 0) {
        tokensNeedingBalances.forEach(token => state.loadedTokens.add(token.canister_id));
        void loadBalances(tokensNeedingBalances, principal, true);
      }
    }, 200);
  }

  // API search
  const debouncedApiSearch = debounce(async (query: string) => {
    if (!browser || !query || query.length < 2) {
      state.apiSearchResults = [];
      return;
    }

    // If we have enough local matches, skip the API call
    const matchingLocalTokens = baseFilteredTokens.filter(
      token => (token.symbol.toLowerCase().includes(query.toLowerCase()) ||
               token.name.toLowerCase().includes(query.toLowerCase()) ||
               token.canister_id.toLowerCase().includes(query.toLowerCase())) &&
               $userTokens.enabledTokens.has(token.canister_id)
    );

    if (matchingLocalTokens.length >= 10) {
      state.apiSearchResults = [];
      return;
    }

    state.isSearching = true;
    try {
      const { tokens } = await fetchTokens({ search: query, limit: 20 });
      state.apiSearchResults = tokens.filter(
        token => !$userTokens.enabledTokens.has(token.canister_id)
      );
    } catch (error) {
      console.error("Error searching tokens:", error);
      state.apiSearchResults = [];
    } finally {
      state.isSearching = false;
    }
  }, 300);

  // Async loaders
  async function loadFavorites() {
    if (!browser || state.favoritesLoaded) return;

    await favoriteStore.loadFavorites();

    const newFavorites = new Map<string, boolean>();
    const promises = baseFilteredTokens.map(async (token) => {
      const tokenId = getTokenId(token);
      if (tokenId) newFavorites.set(tokenId, await favoriteStore.isFavorite(tokenId));
    });

    await Promise.all(promises);
    state.favoriteTokens = newFavorites;
    state.favoritesLoaded = true;
  }

  // Reactive effects
  $effect(() => {
    // Search effect
    if (browser && state.searchQuery) {
      void debouncedApiSearch(state.searchQuery);
    } else {
      state.apiSearchResults = [];
    }
  });

  $effect(() => {
    // Mobile detection
    if (browser) {
      state.isMobile = window.innerWidth <= 768;
      const handleResize = () => state.isMobile = window.innerWidth <= 768;
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  });

  $effect(() => {
    // Load data when dropdown is shown
    if (show && browser) {
      // Load balances if authenticated
      if (isUserAuthenticated && $auth.account?.owner) {
        loadVisibleTokenBalances();
        
        // Load remaining tokens with delay
        setTimeout(() => {
          if (show && tokens.length > 0) {
            const tokensNeedingBalances = tokens.filter(
              token => token.canister_id && 
                      !$currentUserBalancesStore[token.canister_id] && 
                      !state.loadedTokens.has(token.canister_id)
            );
            
            if (tokensNeedingBalances.length > 0) {
              tokensNeedingBalances.forEach(token => state.loadedTokens.add(token.canister_id));
              void loadBalances(tokensNeedingBalances, $auth.account!.owner.toString(), false);
            }
          }
        }, 500);
      }

      // Load favorites
      void loadFavorites();

      // Focus search and add event listeners
      setTimeout(() => {
        state.searchInput?.focus();
        window.addEventListener("click", handleClickOutside);
        window.addEventListener("keydown", handleKeydown);
      }, 0);
    }
  });

  $effect(() => {
    // Balance loading when visible tokens change
    if (show && browser) loadVisibleTokenBalances();
  });

  // Cleanup
  function cleanup() {
    if (browser) {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeydown);
      clearTimeout(scrollDebounceTimer);
      clearTimeout(loadBalancesDebounceTimer);
    }
  }

  onDestroy(cleanup);
</script>

{#if show}
  <div class="fixed inset-0 bg-kong-bg-dark/30 backdrop-blur-md z-[9999] grid place-items-center p-6 overflow-y-auto md:p-6 sm:p-0" on:click|self={closeWithCleanup} role="dialog">
    <div
      class="relative border bg-kong-bg-dark transition-all duration-200 overflow-hidden w-[420px] h-[min(600px,85vh)] bg-kong-token-selector-bg {expandDirection} {state.isMobile ? 'fixed inset-0 w-full h-screen rounded-none border-0' : 'border-kong-border border-1 rounded-xl'}"
      bind:this={dropdownElement}
      on:click|stopPropagation
      transition:scale={{ duration: 200, start: 0.95, opacity: 0, easing: cubicOut }}
    >
      <div class="relative bg-kong-bg-dark flex flex-col h-full">
        <header class="px-4 py-3 flex justify-between items-center bg-kong-bg-dark">
          <h2 class="text-kong-text-primary text-xl font-semibold">Tokens</h2>
          <button class="text-kong-text-secondary hover:bg-kong-border/10 p-1 rounded" on:click|stopPropagation={closeWithCleanup}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div class="flex-1 flex flex-col overflow-hidden relative">
          <div class="relative z-20 flex-shrink-0">
            <!-- Search Input -->
            <div class="z-10 pb-3">
              <div class="relative flex items-center px-4">
                <input
                  bind:this={state.searchInput}
                  bind:value={state.searchQuery}
                  type="text"
                  placeholder="Search by name, symbol, canister ID, or standard"
                  class="flex-1 border-none text-kong-text-primary text-base rounded-md px-4 py-3 outline-none placeholder:text-kong-text-secondary bg-kong-token-selector-search-bg" 
                  on:click|stopPropagation
                />
              </div>
            </div>

            <!-- Filter Tabs -->
            <div class="pb-2 shadow-md z-20">
              <div class="px-4 flex w-full mb-1 gap-2">
                {#each FILTER_TABS as tab}
                  <button
                    on:click={() => setStandardFilter(tab.id as FilterType)}
                    class="flex-1 px-3 py-2 flex items-center justify-center gap-2 text-kong-text-secondary text-sm relative transition-all duration-200 font-medium bg-kong-bg-light/30 rounded-2xl {state.standardFilter === tab.id ? 'text-white font-semibold bg-kong-primary text-kong-bg-light hover:bg-kong-primary' : 'hover:bg-kong-bg-light/60'}"
                    aria-label="Show {tab.label.toLowerCase()} tokens"
                  >
                    <span class="relative z-10">{tab.label}</span>
                    <span
                      class="text-kong-text-secondary text-xs px-2 py-1 rounded-full bg-kong-border/10 min-w-[1.5rem] text-center transition-all duration-200 {state.standardFilter === tab.id ? 'bg-kong-primary/10 text-kong-bg-light' : ''}"
                    >
                      {getTabCount(tab.id)}
                    </span>
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <!-- Scrollable Token List -->
          <div
            class="scrollable-section bg-kong-bg-dark flex-1 overflow-y-auto relative z-10 touch-pan-y overscroll-contain will-change-transform"
            bind:this={state.scrollContainer}
            bind:clientHeight={state.containerHeight}
            on:scroll={handleScroll}
            style="-webkit-overflow-scrolling: touch;"
          >
            <div class="flex flex-col gap-2 min-h-full p-2 touch-pan-y">
              <!-- Enabled Tokens -->
              {#if enabledFilteredTokens.length > 0}
                <div class="space-y-2">
                  <div style="height: {enabledFilteredTokens.length * TOKEN_ITEM_HEIGHT}px; position: relative;">
                    {#each enabledTokensVirtualState.visible as { item: token, index }, i (token.canister_id)}
                      <div
                        style="position: absolute; top: {index * TOKEN_ITEM_HEIGHT}px; width: 100%; height: {TOKEN_ITEM_HEIGHT}px; padding: 4px 0; box-sizing: border-box;"
                      >
                        <TokenItem
                          {token}
                          index={i}
                          currentToken={currentToken}
                          otherPanelToken={otherPanelToken}
                          isApiToken={isApiToken(token)}
                          isFavorite={isFavoriteToken(token.canister_id)}
                          enablingTokenId={state.enablingTokenId}
                          blockedTokenIds={BLOCKED_TOKEN_IDS}
                          balance={{
                            loading: isUserAuthenticated && !$currentUserBalancesStore[token.canister_id],
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

              <!-- API Search Results -->
              {#if apiFilteredTokens.length > 0 || state.isSearching}
                <div class="space-y-2 mt-4">
                  <div class="p-2 text-sm font-medium text-kong-text-secondary rounded-lg border border-kong-border/10 backdrop-blur-sm mx-2 my-2 bg-kong-token-selector-item-bg">
                    <span>Available Tokens</span>
                  </div>
                  
                  {#if state.isSearching}
                    <div class="flex items-center justify-center gap-2 p-4 text-sm text-white/70">
                      <span class="w-4 h-4 rounded-full border-2 border-kong-text-primary/20 border-t-kong-text-primary animate-spin"></span>
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
                            enablingTokenId={state.enablingTokenId}
                            blockedTokenIds={BLOCKED_TOKEN_IDS}
                            balance={{
                              loading: isUserAuthenticated && !$currentUserBalancesStore[token.canister_id],
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
              <div class="px-2 py-3 mt-2">
                <button 
                  class="group w-full hover:bg-kong-primary hover:text-kong-bg-light flex items-center justify-center gap-2 py-3 px-4 text-kong-text-primary font-medium rounded-lg border border-kong-border/30 transition-all duration-200 hover:border-kong-primary/40 bg-kong-token-selector-item-bg"
                  on:click|stopPropagation={() => state.isAddNewTokenModalOpen = true}
                >
                  <div class="flex items-center justify-center w-5 h-5 rounded-full text-kong-bg-light font-bold bg-kong-primary group-hover:text-kong-primary group-hover:bg-kong-bg-light">+</div>
                  <span>Add New Token</span>
                </button>
              </div>
              
              {#if filteredTokens.length === 0}
                <div class="flex items-center justify-center p-8 text-kong-text-secondary text-sm flex-col gap-4">
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
  .scrollable-section::-webkit-scrollbar {
    width: 4px;
  }

  .scrollable-section::-webkit-scrollbar-track {
    background-color: rgba(theme('colors.kong.bg-dark'), 0.4);
    border-radius: 0.25rem;
  }

  .scrollable-section::-webkit-scrollbar-thumb {
    background-color: theme('colors.kong.text-secondary');
    border-radius: 0.25rem;
  }
  
  .scrollable-section::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2rem;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    pointer-events: none;
    z-index: 10;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

<!-- Add New Token Modal -->
<AddNewTokenModal 
  isOpen={state.isAddNewTokenModalOpen}
  onClose={() => state.isAddNewTokenModalOpen = false}
  on:tokenAdded={handleCustomTokenAdded}
/>
