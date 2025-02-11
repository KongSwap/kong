<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { loadBalances, storedBalancesStore } from "$lib/services/tokens/tokenStore";
  import { scale, fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";
  import { browser } from "$app/environment";
  import { Star } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatUsdValue, formatTokenBalance } from "$lib/utils/tokenFormatters";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { FavoriteService } from "$lib/services/tokens/favoriteService";
  import { toastStore } from "$lib/stores/toastStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { auth } from "$lib/services/auth";
  import { get } from "svelte/store";
  import { fetchTokens } from "$lib/api/tokens";
  import { debounce } from "$lib/utils/debounce";

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

  // Make tokens reactive to userTokens store changes
  let tokens = $derived(
    Object.values($userTokens.tokens).filter(token => 
      token && typeof token === 'object' && 'canister_id' in token && $userTokens.enabledTokens[token.canister_id]
    )
  );

  const BLOCKED_TOKEN_IDS = [];
  const DEFAULT_ICP_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai"; // ICP canister ID

  let searchQuery = $state("");
  let searchInput: HTMLInputElement;
  let dropdownElement: HTMLDivElement;
  let hideZeroBalances = $state(false);
  let isMobile = $state(false);
  let sortDirection = $state("desc");
  let sortColumn = $state("value");
  let standardFilter = $state("all");
  let isSearching = $state(false);
  let apiSearchResults = $state<FE.Token[]>([]);

  // Add a state to track which token is being enabled
  let enablingTokenId = $state<string | null>(null);

  function setStandardFilter(filter: "all" | "ck" | "favorites") {
    standardFilter = filter;
    searchQuery = ""; // Reset search when changing filters
  }

  // First, create a reactive store for favorites
  let favoriteTokens = $state(new Map<string, boolean>());

  // Update favorites when baseFilteredTokens changes
  $effect(() => {
    void updateFavorites();
  });

  async function updateFavorites() {
    const newFavorites = new Map<string, boolean>();
    await Promise.all(
      baseFilteredTokens.map(async (token) => {
        newFavorites.set(token.canister_id, await FavoriteService.isFavorite(token.canister_id));
      })
    );
    favoriteTokens = newFavorites;
  }

  // Get filtered tokens before any UI filters (search, favorites, etc)
  let baseFilteredTokens = $derived(
    browser ? tokens.filter((token) => {
      // First validate the token
      if (!token?.canister_id) {
        console.warn("Invalid token found:", token);
        return false;
      }

      // Then check if we should restrict to secondary tokens
      if (restrictToSecondaryTokens) {
        return SECONDARY_TOKEN_IDS.includes(token.canister_id);
      }

      // Then check allowed canister IDs if provided
      if (allowedCanisterIds.length > 0) {
        return allowedCanisterIds.includes(token.canister_id);
      }

      return true;
    }) : []
  );

  // Get counts based on the base filtered tokens
  let allTokensCount = $derived(baseFilteredTokens.length);
  let ckTokensCount = $derived(
    baseFilteredTokens.filter((t) => t.symbol.toLowerCase().startsWith("ck"))
      .length
  );

  // Create a debounced search function
  const debouncedApiSearch = debounce(async (query: string) => {
    if (!browser || !query || query.length < 2) {
      apiSearchResults = [];
      return;
    }

    isSearching = true;
    try {
      const { tokens } = await fetchTokens({ 
        search: query,
        limit: 20 // Limit API results to prevent overwhelming the UI
      });
      apiSearchResults = tokens.filter(token => 
        // Filter out tokens we already have locally
        !baseFilteredTokens.some(t => t.canister_id === token.canister_id)
      );
    } catch (error) {
      console.error('Error searching tokens:', error);
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

  // Update the filteredTokens derivation to deduplicate tokens
  let filteredTokens = $derived(
    browser ? Array.from(new Map(
      // Combine both sources and map by canister_id to deduplicate
      [...baseFilteredTokens, ...apiSearchResults].map(token => [token.canister_id, token])
    ).values())
      .filter((token) => {
        if (!token?.canister_id || !token?.symbol || !token?.name) {
          console.warn("Incomplete token data:", token);
          return false;
        }
        
        const searchLower = searchQuery.toLowerCase();
        return token.symbol.toLowerCase().includes(searchLower) ||
               token.name.toLowerCase().includes(searchLower) ||
               token.canister_id.toLowerCase().includes(searchLower);
      })
      .filter((token) => {
        // Apply standard filter
        switch (standardFilter) {
          case "ck":
            return token.symbol.toLowerCase().startsWith("ck");
          case "favorites":
            return favoriteTokens.get(token.canister_id) || false;
          case "all":
          default:
            if (hideZeroBalances) {
              const balance = $storedBalancesStore[token.canister_id]?.in_tokens;
              return balance ? balance > BigInt(0) : false;
            }
            return true;
        }
      })
      .sort((a, b) => {
        // Sort by favorites first
        const aFavorite = favoriteTokens.get(a.canister_id) || false;
        const bFavorite = favoriteTokens.get(b.canister_id) || false;
        if (aFavorite !== bFavorite) return bFavorite ? 1 : -1;

        // Then sort by value if that's selected
        if (sortColumn === 'value') {
          const aBalance = $storedBalancesStore[a.canister_id]?.in_usd || "0";
          const bBalance = $storedBalancesStore[b.canister_id]?.in_usd || "0";
          const aValue = Number(aBalance);
          const bValue = Number(bBalance);
          return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
        }

        return 0;
      }) : []
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
    
    // Then refresh all favorites to ensure sync
    void updateFavorites();
  }

  function getStaggerDelay(index: number) {
    return index * 30; // 30ms delay between each item
  }

  function handleSelect(token: FE.Token) {
    if (BLOCKED_TOKEN_IDS.includes(token.canister_id)) {
      toastStore.warning(
        "BIL token is currently in read-only mode. Trading will resume when the ledger is stable.",
        {
          title: "Token Temporarily Unavailable",
          duration: 8000
        }
      );
      return;
    }

    // Check if token is from API results and not already enabled
    if (apiSearchResults.includes(token) && !$userTokens.enabledTokens[token.canister_id]) {
      // Enable the token first
      userTokens.enableToken(token);
    }

    const balance = getTokenBalance(token);
    onSelect({
      ...token,
      balance
    });
    searchQuery = "";
  }

  // Update the handleEnableToken function
  async function handleEnableToken(e: MouseEvent, token: FE.Token) {
    e.preventDefault();
    e.stopPropagation();
    
    // Set loading state
    enablingTokenId = token.canister_id;
    
    try {
      // Enable the token
      userTokens.enableToken(token);

      // Load balance for the newly enabled token if user is connected
      const authStore = get(auth);
      if (authStore?.isConnected && authStore?.account?.owner) {
        await loadBalances(authStore.account.owner.toString(), { 
          tokens: [token],
          forceRefresh: true 
        });
      }

      // Remove from API results since it's now enabled
      apiSearchResults = apiSearchResults.filter(t => t.canister_id !== token.canister_id);
    } finally {
      // Clear loading state
      enablingTokenId = null;
    }
  }

  // Update the handleTokenClick function to prevent selection of non-enabled tokens
  function handleTokenClick(e: MouseEvent | TouchEvent, token: FE.Token) {
    e.stopPropagation();

    // Don't allow selection if token is from API and not enabled
    if (apiSearchResults.includes(token) && !$userTokens.enabledTokens[token.canister_id]) {
      return;
    }

    if (otherPanelToken?.canister_id !== token.canister_id) {
      handleSelect(token);
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

  // Focus search input when dropdown opens
  $effect(() => {
    if (show && browser) {
      const authStore = get(auth);
      if (authStore?.isConnected && authStore?.account?.owner && tokens.length > 0) {
        // Load balances and update UI when they change
        loadBalances(authStore.account.owner.toString(), { 
          tokens,
          forceRefresh: true 
        })
      }
      
      setTimeout(() => {
        searchInput?.focus();
        window.addEventListener("click", handleClickOutside);
        window.addEventListener("keydown", handleKeydown);
      }, 0);
    }
  });

  // Subscribe to balance changes
  $effect(() => {
    const balances = $storedBalancesStore;
  });

  // Helper function to safely get token balance
  function getFormattedBalance(token: FE.Token) {
    const balance = $storedBalancesStore[token.canister_id];
    if (!balance) return { tokens: "0", usd: "0" };
    
    const formattedTokens = formatTokenBalance(balance.in_tokens?.toString() || "0", token.decimals);
    const formattedUsd = formatUsdValue(balance.in_usd || "0");
        
    return {
      tokens: formattedTokens,
      usd: formattedUsd
    };
  }

  // Update the token display section
  const tokenBalances = $derived(
    new Map<string, { tokens: string; usd: string }>(
      filteredTokens.map(token => [
        token.canister_id,
        getFormattedBalance(token)
      ])
    )
  );

  // Helper function to get balance with fallback
  function getTokenDisplayBalance(canisterId: string): { tokens: string; usd: string } {
    const balance = tokenBalances.get(canisterId);
    return balance || { tokens: "0", usd: "$0.00" };
  }

  // Cleanup event listeners
  function cleanup() {
    if (browser) {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeydown);
    }
  }

  onDestroy(cleanup);

  onMount(async () => {
    await FavoriteService.loadFavorites();
  });

  function getTokenBalance(token: FE.Token): bigint {
    const balance = $storedBalancesStore[token.canister_id];
    return balance?.in_tokens || BigInt(0);
  }

  let favoritesCount = $derived(Array.from(favoriteTokens.values()).filter(Boolean).length);
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
                  {#each [{ id: "all", label: "All", count: allTokensCount }, { id: "ck", label: "CK", count: ckTokensCount }, { id: "favorites", label: "Favorites", count: favoritesCount }] as tab}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <button
                      on:click={() => setStandardFilter(tab.id as "all" | "ck" | "favorites")}
                      class="filter-btn"
                      class:active={standardFilter === tab.id}
                      aria-label="Show {tab.label.toLowerCase()} tokens"
                    >
                      <span class="tab-label">{tab.label}</span>
                      <span class="tab-count" class:has-items={tab.count > 0}>
                        {tab.count}
                      </span>
                    </button>
                  {/each}
                </div>
                  
              </div>
            </div>

            <div class="scrollable-section">
              <div class="tokens-container">
                <!-- Local tokens -->
                {#if filteredTokens.some(token => !apiSearchResults.includes(token))}
                  <div class="token-section">
                    {#each filteredTokens.filter(token => !apiSearchResults.includes(token)) as token, i (token.canister_id)}
                      <!-- svelte-ignore a11y-click-events-have-key-events -->
                      <!-- svelte-ignore a11y-no-static-element-interactions -->
                      <div
                        animate:flip={{ duration: 200 }}
                        in:fade={{
                          delay: getStaggerDelay(i),
                          duration: 150,
                          easing: cubicOut,
                        }}
                        class="token-item"
                        class:selected={currentToken?.canister_id === token.canister_id}
                        class:disabled={otherPanelToken?.canister_id === token.canister_id}
                        class:blocked={BLOCKED_TOKEN_IDS.includes(token.canister_id)}
                        on:click={(e) => handleTokenClick(e, token)}
                      >
                        <div class="token-info">
                          <TokenImages
                            tokens={[token]}
                            size={40}
                            containerClass="token-logo-container"
                          />
                          <div class="token-details">
                            <div class="token-symbol-row">
                              <!-- svelte-ignore a11y-click-events-have-key-events -->
                              <!-- svelte-ignore a11y-no-static-element-interactions -->
                              <button
                                class="favorite-button"
                                class:active={favoriteTokens.get(token.canister_id)}
                                on:click={(e) => handleFavoriteClick(e, token)}
                                title={favoriteTokens.get(token.canister_id)
                                  ? "Remove from favorites"
                                  : "Add to favorites"}
                              >
                                <Star
                                  size={14}
                                  fill={favoriteTokens.get(token.canister_id)
                                    ? "#ffd700"
                                    : "none"}
                                />
                              </button>
                              <span class="token-symbol">{token.symbol}</span>
                            </div>
                            <span class="token-name">{token.name}</span>
                          </div>
                        </div>
                        <div class="text-sm token-right text-kong-text-primary">
                          <span class="flex flex-col text-right token-balance">
                            {getTokenDisplayBalance(token.canister_id).tokens}
                            <span class="text-xs token-balance-label">
                              {getTokenDisplayBalance(token.canister_id).usd}
                            </span>
                          </span>
                          {#if currentToken?.canister_id === token.canister_id}
                            <div class="selected-indicator">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="3"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
                
                <!-- API search results -->
                {#if apiSearchResults.length > 0 || isSearching}
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
                      {#each filteredTokens.filter(token => apiSearchResults.includes(token)) as token, i (token.canister_id)}
                        <div
                          animate:flip={{ duration: 200 }}
                          in:fade={{
                            delay: getStaggerDelay(i),
                            duration: 150,
                            easing: cubicOut,
                          }}
                          class="token-item"
                          class:selected={currentToken?.canister_id === token.canister_id}
                          class:disabled={otherPanelToken?.canister_id === token.canister_id}
                          class:blocked={BLOCKED_TOKEN_IDS.includes(token.canister_id)}
                          class:not-enabled={!$userTokens.enabledTokens[token.canister_id]}
                          on:click={(e) => handleTokenClick(e, token)}
                        >
                          <div class="token-info">
                            <TokenImages
                              tokens={[token]}
                              size={40}
                              containerClass="token-logo-container"
                            />
                            <div class="token-details">
                              <div class="token-symbol-row">
                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                <!-- svelte-ignore a11y-no-static-element-interactions -->
                                <button
                                  class="favorite-button"
                                  class:active={favoriteTokens.get(token.canister_id)}
                                  on:click={(e) => handleFavoriteClick(e, token)}
                                  title={favoriteTokens.get(token.canister_id)
                                    ? "Remove from favorites"
                                    : "Add to favorites"}
                                >
                                  <Star
                                    size={14}
                                    fill={favoriteTokens.get(token.canister_id)
                                      ? "#ffd700"
                                      : "none"}
                                  />
                                </button>
                                <span class="token-symbol">{token.symbol}</span>
                              </div>
                              <span class="token-name">{token.name}</span>
                            </div>
                          </div>
                          <div class="text-sm token-right text-kong-text-primary">
                            {#if !$userTokens.enabledTokens[token.canister_id]}
                              <button
                                class="enable-token-button"
                                on:click={(e) => handleEnableToken(e, token)}
                                disabled={enablingTokenId === token.canister_id}
                              >
                                {#if enablingTokenId === token.canister_id}
                                  <div class="button-spinner" />
                                {:else}
                                  Enable
                                {/if}
                              </button>
                            {:else}
                              <span class="flex flex-col text-right token-balance">
                                {getTokenDisplayBalance(token.canister_id).tokens}
                                <span class="text-xs token-balance-label">
                                  {getTokenDisplayBalance(token.canister_id).usd}
                                </span>
                              </span>
                              {#if currentToken?.canister_id === token.canister_id}
                                <div class="selected-indicator">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="3"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                  >
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                </div>
                              {/if}
                            {/if}
                          </div>
                        </div>
                      {/each}
                    {/if}
                  </div>
                {/if}
                
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
    @apply relative bg-kong-bg-dark border border-kong-border rounded-xl shadow-lg transition-all duration-200 overflow-hidden;
    @apply w-[420px] h-[min(600px,85vh)];
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
    @apply px-4 py-3 bg-kong-bg-dark flex justify-between items-center;
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
    @apply flex-1 bg-kong-bg-light border-none text-kong-text-primary text-base rounded-md px-4 py-3;
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
    @apply text-kong-primary bg-kong-primary/20;
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
    gap: 0.25rem;
    min-height: 100%;
    touch-action: pan-y;
  }

  .token-item {
    @apply flex items-center justify-between py-3 rounded-xl bg-kong-bg-dark cursor-pointer transition-all duration-200 touch-pan-y select-none mx-4 border border-transparent;
  }

  .token-item:hover {
    @apply bg-kong-border/10 transform-none border-transparent;
  }

  .token-item.selected {
    @apply bg-kong-primary/5 px-2 border-l-4 border-l-kong-accent-green rounded-lg;
    margin-left: 0.5rem;
    margin-right: 0.5rem;
  }

  .token-item.selected:hover {
    @apply bg-kong-primary/10;
  }

  .token-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    position: relative;
  }

  .token-item.disabled .token-right {
    /* Hide the balance info when disabled */
    visibility: hidden;
  }

  .token-item.disabled::after {
    content: "Selected in other panel";
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    background-color: rgb(37, 41, 62); /* Match dropdown background */
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }

  .token-item.disabled:hover {
    background-color: transparent;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .token-logo-container {
    width: 2.5rem;
    height: 2.5rem;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .token-symbol-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .favorite-button {
    @apply text-kong-text-secondary;
    padding: 0.25rem;
    border-radius: 0.375rem;
    background-color: rgba(255, 255, 255, 0.05);
    transition: all 0.2s;
  }

  .favorite-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .favorite-button.active {
    color: #fde047;
    background-color: rgba(253, 224, 71, 0.1);
  }

  .token-symbol {
    @apply text-base font-semibold text-kong-text-primary tracking-wide;
  }

  .token-name {
    @apply text-sm text-kong-text-secondary;
  }

  .token-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .selected-indicator {
    @apply text-kong-accent-green;
    color: #4ade80;
    background: #4ade8010;
    border-radius: 50%;
    padding: 4px;
    display: flex;
  }

  .token-balance {
    margin-right: 8px;
  }

  .fixed-bottom-section {
    @apply absolute bottom-0 left-0 right-0 px-6 py-4;
    @apply bg-kong-bg-dark border-t border-kong-border/10;
    @apply z-10;
  }

  .import-token-button {
    @apply w-full flex items-center justify-center gap-3 p-2 rounded-lg;
    @apply bg-kong-border/10 text-kong-text-secondary;
    @apply text-sm font-medium transition-all duration-200;
  }

  .import-token-button:hover {
    @apply bg-kong-border/20 text-kong-text-primary;
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

  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }

  .loading-spinner,
  .button-spinner {
    @apply w-3 h-3;
    @apply border-2 border-white/20 border-t-white;
    @apply rounded-full;
    animation: spin 0.6s linear infinite;
  }

  .loading-spinner {
    @apply w-4 h-4; /* Slightly larger for the main loading indicator */
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

  .token-section {
    @apply space-y-1.5;
  }

  .token-section:not(:first-child) {
    @apply mt-4;
  }

  .token-section-header {
    @apply p-2 text-sm font-medium text-kong-text-secondary;
    @apply bg-kong-bg-light/50 rounded-lg border border-kong-border/10;
    @apply backdrop-blur-sm mx-2 my-2;
  }

  .enable-token-button {
    @apply px-4 py-2 rounded-lg text-sm font-medium;
    @apply bg-kong-primary text-white;
    @apply hover:bg-kong-primary-hover;
    @apply transition-all duration-200;
    @apply flex items-center justify-center;
    @apply min-w-[80px] h-[32px];
    @apply disabled:opacity-50 disabled:cursor-wait;
  }

  .button-spinner {
    @apply w-4 h-4;
    @apply border-2 border-white/20 border-t-white;
    @apply rounded-full;
    animation: spin 0.6s linear infinite;
    margin: 0 auto;
  }

  .token-item.not-enabled {
    @apply opacity-75;
  }

  .token-item.not-enabled:hover {
    @apply opacity-100;
  }

  .pb-2.shadow-md {
    @apply relative z-20;
  }
</style>
