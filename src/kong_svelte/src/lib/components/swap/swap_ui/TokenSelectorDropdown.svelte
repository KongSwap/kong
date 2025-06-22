<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { onDestroy } from "svelte";
  import {
    currentUserBalancesStore,
  } from "$lib/stores/tokenStore";
  import { refreshSingleBalance } from "$lib/stores/balancesStore";
  import { scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { browser } from "$app/environment";
  import { swapState } from "$lib/stores/swapStateStore";
	import { favoriteStore } from "$lib/stores/favoriteStore";
  import { toastStore } from "$lib/stores/toastStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { auth } from "$lib/stores/auth";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { debounce } from "$lib/utils/debounce";
  import TokenItem from "./TokenItem.svelte";
  import { virtualScroll } from "$lib/utils/virtualScroll";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { app } from "$lib/state/app.state.svelte";
  import AddNewTokenModal from "$lib/components/wallet/AddNewTokenModal.svelte";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { loadUserBalances } from "$lib/services/balanceService";
  import { enableBodyScroll, disableBodyScroll } from "$lib/utils/scrollUtils";

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
    title = "Tokens",
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
    return token?.address || null;
  }

  // Individual reactive state variables
  let searchInput: HTMLInputElement | null = $state(null);
  let searchQuery = $state("");
  let scrollContainer: HTMLDivElement | null = $state(null);
  let containerHeight = $state(0);
  let scrollTop = $state(0);

  // Grouped UI state
  let selectorState = $state({
    dropdownElement: null as HTMLDivElement | null,
    hideZeroBalances: false,
    sortDirection: "desc",
    sortColumn: "value",
    standardFilter: "all" as FilterType,
    isSearching: false,
    enablingTokenId: null as string | null,
    isAddNewTokenModalOpen: false,
    favoritesLoaded: false,
    favoriteTokens: new Map<string, boolean>(),
    apiSearchResults: [] as Kong.Token[]
  });

  let isMobile = $derived(app.isMobile);

  // Timers for debouncing
  let scrollDebounceTimer: ReturnType<typeof setTimeout>;

  // Make tokens reactive to userTokens store changes
  let tokens = $derived(
    browser 
      ? Array.from($userTokens.tokenData.values()).filter((token) => {
          const tokenId = getTokenId(token);
          return tokenId && $userTokens.enabledTokens.has(tokenId);
        }) as Kong.Token[]
      : []
  );
  


  // Helper functions for token state
  function isApiToken(token: Kong.Token): boolean {
    return !!token && !$userTokens.enabledTokens.has(token.address);
  }
  
  function isFavoriteToken(tokenId: string): boolean {
    return selectorState.favoriteTokens.get(tokenId) || false;
  }

  function canSelectToken(token: Kong.Token): boolean {
    return !(
      otherPanelToken?.address === token.address ||
      BLOCKED_TOKEN_IDS.includes(token.address) ||
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
    Array.from(selectorState.favoriteTokens.values()).filter(Boolean).length
  );

  // Consolidated filter and sort function
  function filterAndSortTokens(
    tokens: Kong.Token[],
    query: string,
    filter: FilterType,
    hideZero: boolean,
    favorites: Map<string, boolean>,
    sortCol: string,
    sortDir: string,
    balances: Record<string, { in_tokens: bigint; in_usd: string }>,
    currentToken: Kong.Token | null
  ): Kong.Token[] {
    return tokens.filter(token => {
      // Basic validation
      if (!token?.address || !token?.symbol || !token?.name) return false;
      
      // Search query filter
      if (query && !token.symbol.toLowerCase().includes(query.toLowerCase()) && 
          !token.name.toLowerCase().includes(query.toLowerCase()) &&
          !token.address.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      
      // Standard filter (all, ck, favorites)
      if (filter === "ck" && !token.symbol.toLowerCase().startsWith("ck")) return false;
      if (filter === "favorites" && !favorites.get(token.address)) return false;
      
      // Balance filter
      if (hideZero) {
        const balance = balances[token.address]?.in_tokens;
        if (!balance || balance <= BigInt(0)) return false;
      }
      
      return true;
    }).sort((a, b) => {
      // Sort by current token first
      const aIsCurrent = currentToken?.address === a.address;
      const bIsCurrent = currentToken?.address === b.address;
      if (aIsCurrent) return -1;
      if (bIsCurrent) return 1;

      // Sort by favorites first
      const aFavorite = favorites.get(a.address) || false;
      const bFavorite = favorites.get(b.address) || false;
      if (aFavorite !== bFavorite) return bFavorite ? 1 : -1;

      // Then sort by value if that's selected
      if (sortCol === 'value') {
        const aBalance = balances[a.address]?.in_usd || "0";
        const bBalance = balances[b.address]?.in_usd || "0";
        const aValue = Number(aBalance);
        const bValue = Number(bBalance);
        return sortDir === 'desc' ? bValue - aValue : aValue - bValue;
      }

      return 0;
    });
  }

  // Get filtered and sorted tokens
  function getFilteredAndSortedTokens(
    allTokens: Kong.Token[],
    apiTokens: Kong.Token[],
    currentToken: Kong.Token | null
  ): Kong.Token[] {
    // Deduplicate tokens from both sources
    const uniqueTokens = Array.from(new Map(
      [...allTokens, ...apiTokens].map(token => [token.address, token])
    ).values());
    
    return filterAndSortTokens(
      uniqueTokens,
      searchQuery,
      selectorState.standardFilter,
      selectorState.hideZeroBalances,
      selectorState.favoriteTokens,
      selectorState.sortColumn,
      selectorState.sortDirection,
      $currentUserBalancesStore,
      currentToken
    );
  }

  // Derived lists and virtual scroll states
  let filteredTokens = $derived(
    browser ? getFilteredAndSortedTokens(baseFilteredTokens, selectorState.apiSearchResults, currentToken) : []
  );
  
  let enabledFilteredTokens = $derived(filteredTokens.filter(token => $userTokens.enabledTokens.has(token.address)));
  let apiFilteredTokens = $derived(filteredTokens.filter(token => isApiToken(token)));
  
  let enabledTokensVirtualState = $derived(
    virtualScroll({
      items: enabledFilteredTokens,
      containerHeight: containerHeight,
      scrollTop: scrollTop,
      itemHeight: TOKEN_ITEM_HEIGHT,
      buffer: 5,
    })
  );
  
  let apiTokensVirtualState = $derived(
    virtualScroll({
      items: apiFilteredTokens,
      containerHeight: containerHeight,
      scrollTop: scrollTop,
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
    selectorState.standardFilter = filter;
    searchQuery = "";
    scrollTop = 0;
  }
  
  function handleScroll(e: Event) {
    scrollTop = (e.target as HTMLElement).scrollTop;
    clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(loadVisibleTokenBalances, 200);
  }
  
  function handleClickOutside(event: MouseEvent) {
    if (selectorState.dropdownElement && !selectorState.dropdownElement.contains(event.target as Node)) {
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
  async function handleFavoriteClick(e: MouseEvent, token: Kong.Token) {
    e.preventDefault();
    e.stopPropagation();
    
    const isFavorite = selectorState.favoriteTokens.get(token.address) || false;
    await (isFavorite 
      ? favoriteStore.removeFavorite(token.address)
      : favoriteStore.addFavorite(token.address));

    // Update the local state
    selectorState.favoriteTokens.set(token.address, !isFavorite);
    selectorState.favoriteTokens = new Map(selectorState.favoriteTokens); // Trigger reactivity
  }
  
  function handleSelect(token: Kong.Token) {
    if (BLOCKED_TOKEN_IDS.includes(token.address)) {
      toastStore.warning(
        "BIL token is currently in read-only mode. Trading will resume when the ledger is stable.",
        { title: "Token Temporarily Unavailable", duration: 8000 }
      );
      return;
    }

    // Enable the token first if it's from API
    if (isApiToken(token)) userTokens.enableToken(token);

    // --- PATCH: Always use the full token object from userTokens if available ---
    let selectedToken = token;
    const userToken = $userTokens.tokenData.get(token.address);
    if (userToken) {
      selectedToken = userToken;
    }
    onSelect(selectedToken);
    searchQuery = "";
  }
  
  async function handleEnableToken(e: MouseEvent, token: Kong.Token) {
    e.preventDefault();
    e.stopPropagation();
    selectorState.enablingTokenId = token.address;

    try {
      userTokens.enableToken(token);
      
      if (isUserAuthenticated) {
        const principal = $auth.account?.owner;

        if (principal) {          
          setTimeout(async () => {
            try {
              // Use loadUserBalances to properly update the store
              await loadUserBalances(principal, true);
            } catch (err) {
              console.warn(`Failed to load balance for ${token.symbol}:`, err);
            } finally {
              selectorState.enablingTokenId = null;
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
      selectorState.enablingTokenId = null;
    }
  }
  
  function handleTokenClick(e: MouseEvent | TouchEvent, token: Kong.Token) {
    e.stopPropagation();

    if (isApiToken(token)) {
      // API tokens need to be enabled first
      if (e instanceof MouseEvent) handleEnableToken(e, token);
      return;
    }

    if (!canSelectToken(token)) return;

    // Load balance if needed before selecting
    if (isUserAuthenticated && $auth.account?.owner && 
        !$currentUserBalancesStore[token.address]) {
      void loadUserBalances($auth.account.owner, true);
    }

    handleSelect(token);
    onClose();
  }
  
  function handleCustomTokenAdded(event: CustomEvent<Kong.Token>) {
    const newToken = event.detail;
    selectorState.isAddNewTokenModalOpen = false;
    
    if (newToken && canSelectToken(newToken)) {
      handleSelect(newToken);
      onClose();
    }
  }

  // Balance loading - simplified using existing service
  function loadVisibleTokenBalances() {
    if (!browser || !isUserAuthenticated) return;

    const principal = $auth.account?.owner;
    if (!principal) return;

    clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(async () => {
      // Update balances using the existing service
      await loadUserBalances(principal);
    }, 200);
  }

  // API search
  const debouncedApiSearch = debounce(async (query: string) => {
    if (!browser || !query || query.length < 2) {
      selectorState.apiSearchResults = [];
      return;
    }

    // If we have enough local matches, skip the API call
    const matchingLocalTokens = baseFilteredTokens.filter(
      token => (token.symbol.toLowerCase().includes(query.toLowerCase()) ||
               token.name.toLowerCase().includes(query.toLowerCase()) ||
               token.address.toLowerCase().includes(query.toLowerCase())) &&
               $userTokens.enabledTokens.has(token.address)
    );

    if (matchingLocalTokens.length >= 10) {
      selectorState.apiSearchResults = [];
      return;
    }

    selectorState.isSearching = true;
    try {
      const { tokens } = await fetchTokens({ search: query, limit: 20 });
      selectorState.apiSearchResults = tokens.filter(
        token => !$userTokens.enabledTokens.has(token.address)
      );
    } catch (error) {
      console.error("Error searching tokens:", error);
      selectorState.apiSearchResults = [];
    } finally {
      selectorState.isSearching = false;
    }
  }, 300);

  // Async loaders
  async function loadFavorites() {
    if (!browser || selectorState.favoritesLoaded) return;

    await favoriteStore.loadFavorites();

    const newFavorites = new Map<string, boolean>();
    const promises = baseFilteredTokens.map(async (token) => {
      const tokenId = getTokenId(token);
      if (tokenId) newFavorites.set(tokenId, await favoriteStore.isFavorite(tokenId));
    });

    await Promise.all(promises);
    selectorState.favoriteTokens = newFavorites;
    selectorState.favoritesLoaded = true;
  }

  // Reactive effects
  $effect(() => {
    if (show) {
      disableBodyScroll();
    } else {
      enableBodyScroll();
    }

    // Search effect
    if (browser && searchQuery) {
      void debouncedApiSearch(searchQuery);
    } else {
      selectorState.apiSearchResults = [];
    }
  });

  $effect(() => {
    // Load data when dropdown is shown
    if (show && browser) {
      // Load balances if authenticated
      if (isUserAuthenticated && $auth.account?.owner) {
        loadVisibleTokenBalances();
        
        // Use the balanceService to load all balances with a delay
        setTimeout(() => {
          if (show && $auth.account?.owner) {
            void loadUserBalances($auth.account.owner, true);
          }
        }, 500);
      }

      // Load favorites
      void loadFavorites();

      // Focus search and add event listeners
      setTimeout(() => {
        searchInput?.focus();
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
    }
  }

  onDestroy(cleanup);
</script>

{#if show}
  <div class="fixed inset-0 bg-kong-bg-primary/30 backdrop-blur-md z-[9999] grid place-items-center overflow-y-auto md:p-6 sm:p-0" on:click|self={closeWithCleanup} role="dialog">
    <div
      class="relative border bg-kong-bg-primary transition-all duration-200 overflow-hidden w-[420px] bg-kong-bg-secondary {expandDirection} {$panelRoundness} {isMobile ? 'fixed inset-0 w-full h-screen rounded-none border-0' : 'border-kong-border border-1'}"
      bind:this={selectorState.dropdownElement}
      on:click|stopPropagation
      transition:scale={{ duration: 200, start: 0.95, opacity: 0, easing: cubicOut }}
    >
      <div class="relative bg-kong-bg-primary flex flex-col h-full">
        <header class="px-4 py-3 flex justify-between items-center bg-kong-bg-primary">
          <h2 class="text-kong-text-primary text-xl font-semibold">{title}</h2>
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
            {#if allowedCanisterIds.length === 0}
              <div class="z-10 pb-3">
                <div class="relative flex items-center px-4">
                  <input
                    bind:this={searchInput}
                    bind:value={searchQuery}
                    type="text"
                    placeholder="Search by name, symbol, canister ID, or standard"
                    class="flex-1 border-none text-kong-text-primary text-base rounded-md px-4 py-3 outline-none placeholder:text-kong-text-secondary bg-kong-bg-secondary" 
                    on:click|stopPropagation
                  />
                </div>
              </div>
            {/if}

            <!-- Filter Tabs -->
            {#if allowedCanisterIds.length === 0}
              <div class="pb-2 shadow-md z-20">
                <div class="px-4 flex w-full mb-1 gap-2">
                  {#each FILTER_TABS as tab}
                    <button
                      on:click={() => setStandardFilter(tab.id as FilterType)}
                      class="flex-1 px-3 py-2 flex items-center justify-center gap-2 text-kong-text-secondary text-sm relative transition-all duration-200 font-medium bg-kong-bg-primary/30 rounded-2xl {selectorState.standardFilter === tab.id ? 'text-white font-semibold bg-kong-primary text-kong-bg-secondary hover:bg-kong-primary' : 'hover:bg-kong-bg-secondary/60'}"
                      aria-label="Show {tab.label.toLowerCase()} tokens"
                    >
                      <span class="relative z-10">{tab.label}</span>
                      <span
                        class="text-kong-text-on-primary text-xs px-2 py-1 rounded-full bg-kong-bg-primary/50 min-w-[1.5rem] text-center transition-all duration-200 {selectorState.standardFilter === tab.id ? 'bg-kong-primary/10 text-kong-bg-secondary' : ''}"
                      >
                        {getTabCount(tab.id)}
                      </span>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          <!-- Scrollable Token List -->
          <div
            class="scrollable-section bg-kong-bg-primary flex-1 overflow-y-auto relative z-10 touch-pan-y overscroll-contain will-change-transform max-h-[450px]"
            bind:this={scrollContainer}
            bind:clientHeight={containerHeight}
            on:scroll={handleScroll}
            style="-webkit-overflow-scrolling: touch;"
          >
            <div class="flex flex-col gap-2 min-h-full p-2 touch-pan-y">
              <!-- Enabled Tokens -->
              {#if enabledFilteredTokens.length > 0}
                <div class="space-y-2">
                  <div style="height: {enabledFilteredTokens.length * TOKEN_ITEM_HEIGHT}px; position: relative;">
                    {#each enabledTokensVirtualState.visible as { item: token, index }, i (token.address)}
                      <div
                        style="position: absolute; top: {index * TOKEN_ITEM_HEIGHT}px; width: 100%; height: {TOKEN_ITEM_HEIGHT}px; padding: 4px 0; box-sizing: border-box;"
                      >
                        <TokenItem
                          {token}
                          index={i}
                          currentToken={currentToken}
                          otherPanelToken={otherPanelToken}
                          isApiToken={isApiToken(token)}
                          isFavorite={isFavoriteToken(token.address)}
                          enablingTokenId={selectorState.enablingTokenId}
                          blockedTokenIds={BLOCKED_TOKEN_IDS}
                          balance={{
                            loading: isUserAuthenticated && !$currentUserBalancesStore[token.address],
                            tokens: $currentUserBalancesStore[token.address]
                              ? formatBalance(
                                $currentUserBalancesStore[token.address]?.in_tokens || 0n,
                                token.decimals || 8
                              )
                              : "0",
                            usd: $currentUserBalancesStore[token.address]
                              ? formatUsdValue(
                                $currentUserBalancesStore[token.address]?.in_usd || "0"
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
              {#if apiFilteredTokens.length > 0 || selectorState.isSearching}
                <div class="space-y-2 mt-4">
                  <div class="p-2 text-sm font-medium text-kong-text-secondary rounded-lg border border-kong-border/10 backdrop-blur-sm mx-2 my-2 bg-kong-bg-secondary">
                    <span>Available Tokens</span>
                  </div>
                  
                  {#if selectorState.isSearching}
                    <div class="flex items-center justify-center gap-2 p-4 text-sm text-kong-text-primary/70">
                      <span class="w-4 h-4 rounded-full border-2 border-kong-text-primary/20 border-t-kong-text-primary animate-spin"></span>
                      <span>Searching...</span>
                    </div>
                  {:else}
                    <div style="height: {apiFilteredTokens.length * TOKEN_ITEM_HEIGHT}px; position: relative;">
                      {#each apiTokensVirtualState.visible as { item: token, index }, i (token.address)}
                        <div
                          style="position: absolute; top: {index * TOKEN_ITEM_HEIGHT}px; width: 100%; height: {TOKEN_ITEM_HEIGHT}px; padding: 4px 0; box-sizing: border-box;"
                        >
                          <TokenItem
                            {token}
                            index={i}
                            currentToken={currentToken}
                            otherPanelToken={otherPanelToken}
                            isApiToken={true}
                            isFavorite={isFavoriteToken(token.address)}
                            enablingTokenId={selectorState.enablingTokenId}
                            blockedTokenIds={BLOCKED_TOKEN_IDS}
                            balance={{
                              loading: isUserAuthenticated && !$currentUserBalancesStore[token.address],
                              tokens: $currentUserBalancesStore[token.address]
                                ? formatBalance(
                                  $currentUserBalancesStore[token.address]?.in_tokens || 0n,
                                  token.decimals || 8
                                )
                                : "0",
                              usd: $currentUserBalancesStore[token.address]
                                ? formatUsdValue(
                                  $currentUserBalancesStore[token.address]?.in_usd || "0"
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
              
              <!-- No Tokens Found Message -->
              {#if filteredTokens.length === 0 && !selectorState.isSearching}
                <div class="flex items-center justify-center p-8 text-kong-text-secondary text-sm flex-col gap-4">
                  <span>No tokens found</span>
                </div>
              {/if}

              <!-- Add New Token Button (Correct location) -->
              {#if allowedCanisterIds.length === 0}
                <div class="px-2 py-3 mt-2">
                  <button 
                    class="group w-full hover:bg-kong-primary hover:text-kong-bg-secondary flex items-center justify-center gap-2 py-3 px-4 text-kong-text-primary font-medium rounded-lg border border-kong-border/30 transition-all duration-200 hover:border-kong-primary/40 "
                    on:click|stopPropagation={() => selectorState.isAddNewTokenModalOpen = true}
                  >
                    <div class="flex items-center justify-center w-5 h-5 rounded-full text-kong-bg-secondary font-bold bg-kong-primary group-hover:text-kong-primary group-hover:bg-kong-bg-secondary">+</div>
                    <span>Add New Token</span>
                  </button>
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
  isOpen={selectorState.isAddNewTokenModalOpen}
  onClose={() => selectorState.isAddNewTokenModalOpen = false}
  on:tokenAdded={handleCustomTokenAdded}
/>
