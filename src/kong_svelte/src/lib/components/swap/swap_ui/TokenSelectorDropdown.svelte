<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { formattedTokens, storedBalancesStore, tokenStore } from "$lib/services/tokens/tokenStore";
  import { scale, fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";
  import { browser } from "$app/environment";
  import Portal from "svelte-portal";
  import { Star } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatUsdValue, formatTokenBalance } from "$lib/utils/tokenFormatters";
  import { swapState } from "$lib/services/swap/SwapStateService";
    import { FavoriteService } from "$lib/services/tokens/favoriteService";

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
    tokens = $formattedTokens,
  } = props;

  let searchQuery = $state("");
  let searchInput: HTMLInputElement;
  let dropdownElement: HTMLDivElement;
  let hideZeroBalances = $state(false);
  let isMobile = $state(false);
  let sortDirection = $state("desc");
  let sortColumn = $state("value");
  let standardFilter = $state("all");

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
    tokens.filter((token) => {
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
    }),
  );

  // Get counts based on the base filtered tokens
  let allTokensCount = $derived(baseFilteredTokens.length);
  let ckTokensCount = $derived(
    baseFilteredTokens.filter((t) => t.symbol.toLowerCase().startsWith("ck"))
      .length,
  );

  // Then apply UI filters for display
  let filteredTokens = $derived(
    baseFilteredTokens
      .map((token): TokenMatch | null => {
        if (!token?.canister_id || !token?.symbol || !token?.name) {
          console.warn("Incomplete token data:", token);
          return null;
        }

        const searchLower = searchQuery.toLowerCase();
        const matches = findMatches(token, searchLower);

        return matches.length > 0 ? { token, matches } : null;
      })
      .filter((match): match is TokenMatch => {
        if (!match?.token?.canister_id) return false;

        // Apply standard filter
        switch (standardFilter) {
          case "ck":
            return match.token.symbol.toLowerCase().startsWith("ck");
          case "favorites":
            return favoriteTokens.get(match.token.canister_id) || false;
          case "all":
          default:
            if (hideZeroBalances) {
              const balance = getTokenBalance(match.token);
              return balance > BigInt(0);
            }
            return true;
        }
      })
      .sort((a, b) => {
        // Sort by favorites
        const aFavorite = favoriteTokens.get(a.token.canister_id) || false;
        const bFavorite = favoriteTokens.get(b.token.canister_id) || false;
        if (aFavorite !== bFavorite) return bFavorite ? 1 : -1;

                // Secondary token sorting
                const isASecondary = SECONDARY_TOKEN_IDS.includes(a.token.canister_id);
        const isBSecondary = SECONDARY_TOKEN_IDS.includes(b.token.canister_id);
        
        if (isASecondary || isBSecondary) {
          if (isASecondary && !isBSecondary) return -1;
          if (!isASecondary && isBSecondary) return 1;
          return SECONDARY_TOKEN_IDS.indexOf(a.token.canister_id) - SECONDARY_TOKEN_IDS.indexOf(b.token.canister_id);
        }

        // Get USD values from tokenStore balances
        const aBalance = $storedBalancesStore[a.token.canister_id]?.in_usd || 0n;
        const bBalance = $storedBalancesStore[b.token.canister_id]?.in_usd || 0n;
        
        // Convert BigInts to numbers for comparison
        const aValue = Number(aBalance);
        const bValue = Number(bBalance);

        // Sort based on direction
        if (sortColumn === 'value') {
          return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
        }

        // Sort by volume if that's selected
        const volumeA = Number(a.token.metrics?.volume_24h || 0);
        const volumeB = Number(b.token.metrics?.volume_24h || 0);
        return sortDirection === 'desc' ? volumeB - volumeA : volumeA - volumeB;
      })
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

  type TokenMatch = {
    token: FE.Token;
    matches: {
      type: "symbol" | "name" | "canister" | "standard";
      text: string;
      index: number;
    }[];
  };

  function findMatches(
    token: FE.Token,
    searchLower: string,
  ): TokenMatch["matches"] {
    const matches: TokenMatch["matches"] = [];

    if (token.symbol?.toLowerCase().includes(searchLower)) {
      matches.push({
        type: "symbol",
        text: token.symbol,
        index: token.symbol.toLowerCase().indexOf(searchLower),
      });
    }

    if (token.name?.toLowerCase().includes(searchLower)) {
      matches.push({
        type: "name",
        text: token.name,
        index: token.name.toLowerCase().indexOf(searchLower),
      });
    }

    if (token.canister_id?.toLowerCase().includes(searchLower)) {
      matches.push({
        type: "canister",
        text: token.canister_id,
        index: token.canister_id.toLowerCase().indexOf(searchLower),
      });
    }

    return matches;
  }

  function getStaggerDelay(index: number) {
    return index * 30; // 30ms delay between each item
  }

  function handleSelect(token: FE.Token) {
    const balance = getTokenBalance(token);
    onSelect({
      ...token,
      balance
    });
    searchQuery = "";
  }

  function handleTokenClick(e: MouseEvent | TouchEvent, token: FE.Token) {
    // Only stop propagation, don't prevent default to allow scrolling
    e.stopPropagation();

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
  <Portal target="body">
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
        on:click|preventDefault
        transition:scale={{
          duration: 200,
          start: 0.95,
          opacity: 0,
          easing: cubicOut,
        }}
      >
        <div class="modal-content">
          <header class="modal-header">
            <h2 class="modal-title">Select Token</h2>
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

              <div class="filter-bar">
                <div class="filter-buttons">
                  {#each [{ id: "all", label: "All", count: allTokensCount }, { id: "ck", label: "CK", count: ckTokensCount }, { id: "favorites", label: "Favorites", count: favoritesCount }] as tab}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <button
                      on:click={() => (standardFilter = tab.id)}
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

                <div class="filter-options">
                  <label class="filter-toggle">
                    <input type="checkbox" bind:checked={hideZeroBalances} />
                    <span class="toggle-label">Hide zero balances</span>
                  </label>

                  <div
                    class="sort-toggle"
                    on:click={() => {
                      sortDirection = sortDirection === "desc" ? "asc" : "desc";
                      sortColumn = sortColumn === "value" ? "volume" : "value";
                    }}
                  >
                    <span class="toggle-label">Sort by value</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      class="sort-arrow"
                      class:ascending={sortDirection === "asc"}
                    >
                      <path d="M12 20V4M5 13l7 7 7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div class="scrollable-section">
              <div class="tokens-container">
                {#each filteredTokens as { token, matches }, i (token.canister_id)}
                  {@const balance = $storedBalancesStore[token?.canister_id]}

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
                    class:selected={currentToken?.canister_id ===
                      token.canister_id}
                    class:disabled={otherPanelToken?.canister_id ===
                      token.canister_id}
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
                        {#if searchQuery && matches.length > 0}
                          <div class="match-indicators">
                            {#each matches as match}
                              <span class="match-indicator">
                                Matched {match.type}: {match.text}
                              </span>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                    <div class="token-right text-white text-sm">
                      <span class="token-balance flex flex-col text-right">
                        {formatTokenBalance(balance?.in_tokens?.toString() || "0", token.decimals)}
                        <span class="token-balance-label text-xs">
                          {formatUsdValue(balance?.in_usd || "0")}
                        </span>
                      </span>
                      {#if currentToken?.canister_id === token.canister_id}
                        <div class="selected-indicator">
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
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Portal>
{/if}

<style scoped lang="postcss">
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    z-index: 9999;
    display: grid;
    place-items: center;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .dropdown-container {
    position: relative;
    background: rgba(26, 29, 46, 0.4);
    backdrop-filter: blur(11px);
    border: 1px solid rgba(255, 255, 255, 0.03);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    width: 480px;
    height: min(600px, 85vh);
    border-radius: 16px;
  }

  .dropdown-container.mobile {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100vh;
    border-radius: 0;
    border: none;
  }

  .modal-content {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .modal-header {
    @apply p-4 border-b border-white/10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .modal-title {
    @apply text-lg font-semibold text-white;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.0rem;
    height: 2.0rem;
    border-radius: 0.5rem;
    color: white;
    transition: all 0.2s;
  }

  .close-button:hover {
    transform: translateY(-2px);
  }

  .modal-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .fixed-section {
    flex-shrink: 0;
  }

  .scrollable-section {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    overscroll-behavior-y: contain;
  }

  .scrollable-section::-webkit-scrollbar {
    width: 0.375rem;
  }

  .scrollable-section::-webkit-scrollbar-track {
    background: rgba(26, 29, 46, 0.4);
    border-radius: 0.25rem;
  }

  .scrollable-section::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.06);
    border-radius: 0.25rem;
  }

  .search-section {
    z-index: 10;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    padding: 1rem;
  }

  .search-input {
    flex: 1;
    background-color: transparent;
    border: none;
    color: white;
    font-size: 1rem;
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .search-input:focus {
    outline: none;
  }

  .filter-bar {
    @apply pb-1 border-b border-white/10;
  }

  .filter-buttons {
    display: flex;
    width: 100%;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .filter-btn {
    flex: 1;
    padding: 0.75rem 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
    position: relative;
    transition: all 0.2s;
    font-weight: 500;
  }

  .filter-btn:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .tab-label {
    position: relative;
    z-index: 10;
  }

  .tab-count {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background-color: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.5);
    min-width: 1.5rem;
    text-align: center;
    transition: all 0.2s;
  }

  .tab-count.has-items {
    background-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  .filter-btn.active {
    @apply text-kong-primary bg-kong-primary/10;
  }

  .filter-btn::after {
    @apply absolute bottom-0 left-0 w-full h-px;
    @apply bg-kong-primary;
    content: "";
    width: 100%;
    transform: scaleX(0);
    transition: transform 0.2s;
    transform-origin: center;
  }

  .filter-btn.active::after {
    transform: scaleX(1);
  }

  .filter-options {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem 0.4rem;
  }

  .sort-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    user-select: none;
  }

  .sort-toggle:hover {
    color: white;
  }

  .sort-arrow {
    transition: transform 0.2s;
  }

  .sort-arrow.ascending {
    transform: rotate(180deg);
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
  }

  .filter-toggle:hover {
    color: white;
  }

  .filter-toggle input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    border-radius: 0.25rem;
    border: 1px solid #2a2d3d;
    background-color: #2a2d3d;
    transition: background-color 0.2s;
  }

  .filter-toggle input[type="checkbox"]:checked {
    background-color: #3b82f6;
  }

  .filter-toggle input[type="checkbox"]:focus {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
  }

  .tokens-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    touch-action: pan-y;
  }

  .token-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    border-radius: 0.5rem;
    background-color: var(--color-background-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    touch-action: pan-y;
    user-select: none;
  }

  .token-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .token-item.selected {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .token-item.selected:hover {
    background-color: rgba(255, 255, 255, 0.1);
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
    padding: 0.25rem;
    border-radius: 0.375rem;
    color: rgba(255, 255, 255, 0.5);
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
    font-size: 1rem;
    font-weight: 600;
    color: white;
  }

  .token-name {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .token-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .selected-indicator {
    color: #4ade80;
  }

  .match-indicators {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin-top: 0.25rem;
  }

  .match-indicator {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 0.25rem;
    padding: 0.125rem 0.375rem;
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
</style>
