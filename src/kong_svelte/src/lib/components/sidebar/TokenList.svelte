<script lang="ts">
  import { fade } from "svelte/transition";
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import { storedBalancesStore } from "$lib/services/tokens/tokenStore";
  import { onMount } from "svelte";
  import { FavoriteService } from "$lib/services/tokens/favoriteService";
  import { Search, Loader2 } from "lucide-svelte";
  import { searchToken, getMatchDisplay } from "$lib/utils/searchUtils";
  import { sortTokens, filterByBalance } from "$lib/utils/sortUtils";
  import { handleSearchKeyboard } from "$lib/utils/keyboardUtils";
  import { browser } from "$app/environment";
  import { writable, derived, get } from "svelte/store";
  import { userTokens } from "$lib/stores/userTokens";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { loadBalances } from "$lib/services/tokens/tokenStore";
  import { auth } from "$lib/services/auth";

  type SearchMatch = {
    type: "name" | "symbol" | "canister" | null;
    query: string;
    matchedText?: string;
  };

  // Create persistent hideZero store
  const hideZeroStore = writable(
    browser
      ? localStorage.getItem("kong_hide_zero_balances") === "true"
      : false,
  );

  // Store for user's tokens
  const userTokenList = writable<FE.Token[]>([]);

  // Persist hideZero changes
  $: if (browser) {
    localStorage.setItem("kong_hide_zero_balances", $hideZeroStore.toString());
  }

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

  // Watch for changes in enabled tokens
  $: {
    if ($userTokens.enabledTokens) {
      fetchUserTokenList();
    }
  }

  // Create derived store for filtered and sorted tokens
  const filteredTokens = derived(
    [
      userTokenList,
      debouncedSearch,
      hideZeroStore,
      storedBalancesStore,
      sortDirectionStore,
    ],
    ([$tokens, $search, $hideZero, $balances, $sortDirection], set) => {
      const matches: Record<string, SearchMatch> = {};

      const filtered = $tokens.filter((token) => {
        // Check zero balance
        if (!filterByBalance(token, $balances, $hideZero)) {
          return false;
        }

        if (!$search) {
          matches[token.canister_id] = { type: null, query: "" };
          return true;
        }

        const match = searchToken(token, $search as string);
        if (match) {
          matches[token.canister_id] = match;
          return true;
        }

        return false;
      });

      // Sort tokens using the current sort direction
      sortTokens(filtered, $balances, FavoriteService, $sortDirection).then(
        (sorted) => {
          set({ tokens: sorted, matches });
        },
      );
    },
    { tokens: [], matches: {} },
  );

  let isInitialLoad = true;

  // Function to fetch user tokens
  async function fetchUserTokenList() {
    const enabledTokens = Object.entries($userTokens.enabledTokens)
      .filter(([_, enabled]) => enabled)
      .map(([canisterId]) => canisterId);

    if (enabledTokens.length > 0) {
      try {
        const response = await fetchTokensByCanisterId(enabledTokens);
        if (response) {
          userTokenList.set(response.filter(token => enabledTokens.includes(token.canister_id)));
        }
      } catch (error) {
        console.error('Error fetching user tokens:', error);
      }
    } else {
      userTokenList.set([]);
    }
  }

  // Watch for auth changes to reload balances
  $: if ($auth.isConnected && $auth.account?.owner) {
    console.log('Auth changed, loading balances for:', $auth.account.owner.toString());
    fetchUserTokenList().then(() => {
      loadBalances($auth.account.owner.toString(), {
        tokens: get(userTokenList),
        forceRefresh: true
      });
    });
  }

  onMount(async () => {
    await FavoriteService.loadFavorites();
    const authStore = get(auth);
    console.log('On mount auth state:', authStore);
    if (authStore.isConnected && authStore.account?.owner) {
      console.log('Loading balances for:', authStore.account.owner.toString());
      await fetchUserTokenList();
      await loadBalances(authStore.account.owner.toString(), {
        tokens: get(userTokenList),
        forceRefresh: true
      });
    }
    isInitialLoad = false;
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

  // Function to toggle sort direction
  function toggleSort() {
    sortDirectionStore.update((current) =>
      current === "desc" ? "asc" : "desc",
    );
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
          bind:value={$searchQuery}
          type="text"
          placeholder="Search tokens..."
          class="search-input"
          on:keydown={handleKeydown}
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

        <button class="sort-toggle" on:click={toggleSort}>
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
            class:ascending={$sortDirectionStore === "asc"}
          >
            <path d="M12 20V4M5 13l7 7 7-7" />
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div class="token-list-content">
    <div class="token-rows">
      {#each $filteredTokens.tokens as token (token.canister_id)}
        <div class="token-row-wrapper">
          <TokenRow
            {token}
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

      {#if $filteredTokens.tokens.length === 0}
        <div class="empty-state" transition:fade>
          {#if isInitialLoad || $userTokenList.length === 0}
            <Loader2 class="animate-spin" size={20} />
            <p>Loading tokens...</p>
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
    </div>
  </div>
</div>

<style scoped lang="postcss">
  .token-list-container {
    @apply flex flex-col min-h-[87dvh] relative;
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
    @apply flex items-center gap-1.5 text-kong-text-secondary cursor-pointer 
           hover:text-kong-text-primary transition-colors whitespace-nowrap bg-kong-bg-dark/40
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
           min-h-[89vh] text-kong-text-secondary text-xs;
  }

  .clear-search-button {
    @apply px-3 py-1.5 bg-kong-bg-dark/70 text-kong-text-primary/70 text-xs font-medium rounded-md
           transition-all duration-200 hover:bg-gray-700/90 hover:text-kong-text-primary;
  }
</style>
