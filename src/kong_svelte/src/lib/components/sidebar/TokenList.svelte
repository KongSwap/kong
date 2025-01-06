<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import { formattedTokens, tokenStore, liveTokens, storedBalancesStore } from "$lib/services/tokens/tokenStore";
  import { onMount } from "svelte";
  import { FavoriteService } from "$lib/services/tokens/favoriteService";
  import { Search, Loader2 } from "lucide-svelte";
  import { searchToken, getMatchDisplay } from "$lib/utils/searchUtils";
  import { sortTokens, filterByBalance } from "$lib/utils/sortUtils";
  import { handleSearchKeyboard } from "$lib/utils/keyboardUtils";
  import { browser } from "$app/environment";
  import { writable } from "svelte/store";

  type SearchMatch = {
    type: "name" | "symbol" | "canister" | null;
    query: string;
    matchedText?: string;
  };

  // Create a writable store for hideZeroBalances
  const hideZeroStore = writable(false);
  if (browser) {
    const storedValue = localStorage.getItem('kong_hide_zero_balances');
    hideZeroStore.set(storedValue === 'true');
  }

  // Subscribe to changes and save to localStorage
  if (browser) {
    hideZeroStore.subscribe((value) => {
      localStorage.setItem('kong_hide_zero_balances', value.toString());
    });
  }

  let searchQuery = "";
  let searchInput: HTMLInputElement;
  let sortDirection = "desc";
  let searchDebounceTimer: NodeJS.Timeout;
  let debouncedSearchQuery = "";
  let searchMatches: Record<string, SearchMatch> = {};
  let filteredTokens: FE.Token[] = [];
  let isInitialLoad = true;
  let isRefreshing = false;

  // Add a writable store for tracking refresh state
  let refreshingTokens = new Set<string>();

  // Update the onMount to only load favorites
  onMount(async () => {
    await FavoriteService.loadFavorites();
    isInitialLoad = false;
  });

  // Debounce search input
  $: {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchQuery = searchQuery.toLowerCase();
    }, 400);
  }

  async function updateFilteredTokens() {
    const filteredAndSorted = await sortTokens(
      $formattedTokens.filter((token) => {
        // Check zero balance condition
        if (!filterByBalance(token, $storedBalancesStore, $hideZeroStore)) {
          return false;
        }

        if (!debouncedSearchQuery) {
          searchMatches[token.canister_id] = { type: null, query: "" };
          return true;
        }

        const match = searchToken(token, debouncedSearchQuery);
        if (match) {
          searchMatches[token.canister_id] = match;
          return true;
        }

        return false;
      }),
      $storedBalancesStore,
      FavoriteService,
      sortDirection as "asc" | "desc",
    );

    filteredTokens = filteredAndSorted;
  }

  // Update the watch statement to use storedBalancesStore
  $: if (
    debouncedSearchQuery ||
    $hideZeroStore ||
    sortDirection ||
    $storedBalancesStore
  ) {
    updateFilteredTokens();
  }

  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    handleSearchKeyboard(event, {
      searchQuery,
      searchInput,
      onClear: () => (searchQuery = ""),
    });
  }

  // Update the isRefreshing computed property
  $: isRefreshing = refreshingTokens.size > 0;

  // Add this to track pending balance requests
  $: {
    const pendingRequests = $tokenStore.pendingBalanceRequests;
    refreshingTokens = pendingRequests;
  }

  function getTokenBalance(tokenId: string): string {
    if (!tokenId) return "0";
    const balance = $storedBalancesStore[tokenId]?.in_tokens ?? "0";
    const token = $liveTokens.find((t) => t.canister_id === tokenId);
    return token
      ? (Number(balance) / Math.pow(10, token.decimals)).toString()
      : "0";
  }
</script>

<div
  class="token-list-container h-full min-h-full"
  on:keydown={handleKeydown}
  role="listbox"
  aria-label="Token List"
  tabindex="0"
>
  <div class="search-section">
    <div class="flex items-center gap-2 px-2">
      <div class="search-input-wrapper flex-1">
        <div class="search-icon-wrapper">
          <Search size={16} class="search-icon" />
        </div>
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
            aria-label="Clear search"
            on:click|stopPropagation={() => {
              searchQuery = "";
              searchInput.focus();
            }}
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
          class="filter-toggle flex items-center gap-2 text-gray-400 hover:text-white"
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

        <button
          class="sort-toggle"
          on:click={() => {
            sortDirection = sortDirection === "desc" ? "asc" : "desc";
          }}
        >
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
            class:ascending={sortDirection === "asc"}
          >
            <path d="M12 20V4M5 13l7 7 7-7" />
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div class="token-list-content">
    {#if isRefreshing}
      <div class="refresh-indicator" transition:fade>
        <Loader2 class="animate-spin" size={16} />
        <span>Refreshing balances...</span>
      </div>
    {/if}
    
    <div class="token-rows">
      {#each filteredTokens as token (token.canister_id)}
        <div class="token-row-wrapper" transition:slide={{ duration: 200 }}>
          <TokenRow
            {token}
            on:toggleFavorite={async ({ detail }) => {
              await FavoriteService.toggleFavorite(detail.canisterId);
              filteredTokens = [...filteredTokens];
            }}
          />
          {#if searchQuery && searchMatches[token.canister_id]?.type === "canister"}
            <div class="match-indicator" transition:fade>
              <span class="match-type">canister:</span>
              <code class="match-label">{token.canister_id}</code>
            </div>
          {:else if searchQuery && searchMatches[token.canister_id]?.type}
            <div class="match-indicator" transition:fade>
              <span class="match-type"
                >{searchMatches[token.canister_id].type}:</span
              >
              <span class="match-label">
                {@html getMatchDisplay(searchMatches[token.canister_id])}
              </span>
            </div>
          {/if}
        </div>
      {/each}

      {#if filteredTokens.length === 0}
        <div class="empty-state" transition:fade>
          {#if isInitialLoad}
            <Loader2 class="animate-spin" size={20} />
            <p>Loading tokens...</p>
          {:else if searchQuery}
            <p>No tokens found matching "{searchQuery}"</p>
            <button
              class="clear-search-button"
              on:click={() => {
                searchQuery = "";
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

<style scoped lang="postcss">
  .token-list-container {
    @apply flex flex-col min-h-[86dvh] relative;
  }

  .search-section {
    @apply sticky top-0 z-20 py-2 bg-kong-bg-light;
    @apply border-b border-kong-border;
  }

  .token-list-content {
    @apply flex-1 overflow-hidden;
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
  }

  .clear-button {
    @apply absolute right-2 text-kong-text-secondary hover:text-kong-text-primary transition-colors p-1;
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
           min-h-[120px] text-kong-text-secondary text-xs;
  }

  .clear-search-button {
    @apply px-3 py-1.5 bg-kong-bg-dark/70 text-white/70 text-xs font-medium rounded-md
           transition-all duration-200 hover:bg-gray-700/90 hover:text-white;
  }

  .refresh-indicator {
    @apply flex items-center justify-center gap-2 py-2 
           text-kong-text-secondary text-xs bg-kong-bg-light/50
           border-b border-kong-border/30;
  }
</style>
