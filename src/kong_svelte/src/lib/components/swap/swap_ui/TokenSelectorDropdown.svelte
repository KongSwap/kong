<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import { scale, fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";
  import { browser } from "$app/environment";
  import Portal from "svelte-portal";
  import { Star } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { auth } from "$lib/services/auth";

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

  // Subscribe to stores for reactivity
  let isAuthenticated = $derived($auth?.isConnected ?? false);
  let walletId = $derived($auth?.account?.owner?.toString() || "anonymous");
  let currentStore = $derived($tokenStore);
  let isFavorite = (canisterId: string) => currentStore.favoriteTokens[walletId]?.includes(canisterId) ?? false;

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

      // Apply hide zero balances filter
      if (hideZeroBalances) {
        const balance = $tokenStore.balances[token.canister_id]?.in_tokens || BigInt(0);
        if (balance <= 0n) {
          return false;
        }
      }

      return true;
    })
  );

  // Get counts based on the base filtered tokens
  let allTokensCount = $derived(baseFilteredTokens.length);
  let ckTokensCount = $derived(
    baseFilteredTokens.filter((t) => t.symbol.toLowerCase().startsWith("ck"))
      .length
  );
  let favoritesCount = $derived(
    isAuthenticated 
      ? baseFilteredTokens.filter((t) => isFavorite(t.canister_id)).length 
      : 0
  );

  // Then apply UI filters for display
  let filteredTokens = $derived(
    baseFilteredTokens
      .map((token): TokenMatch | null => {
        // Validate token before processing
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
            return isAuthenticated && isFavorite(match.token.canister_id);
          case "all":
          default:
            return true;
        }
      })
      .sort((a, b) => {
        // Then sort by favorites
        if (isAuthenticated) {
          const aFavorite = isFavorite(a.token.canister_id);
          const bFavorite = isFavorite(b.token.canister_id);
          if (aFavorite !== bFavorite) return bFavorite ? 1 : -1;
        }

        // Sort by sortColumn first
        const aValue = Number(
          parseFloat(a.token.formattedUsdValue.replaceAll(',', '')) || 0,
        );
        const bValue = Number(
          parseFloat(b.token.formattedUsdValue.replaceAll(',', '')) || 0,
        );
        if (aValue !== bValue)
          return sortDirection === "desc" ? bValue - aValue : aValue - bValue;

        // Sort by volume last
        const volumeA = Number(a.token.volume || 0);
        const volumeB = Number(b.token.volume || 0);
        if (volumeA !== volumeB)
          return sortDirection === "desc"
            ? volumeB - volumeA
            : volumeA - volumeB;

        // Then sort by best match if searching
        if (searchQuery) {
          const aMinIndex = Math.min(...a.matches.map((m) => m.index));
          const bMinIndex = Math.min(...b.matches.map((m) => m.index));
          if (aMinIndex !== bMinIndex) return aMinIndex - bMinIndex;
        }

        return 0;
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
    await tokenStore.toggleFavorite(token.canister_id);
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
    // Get the current balance from the store before updating
    const existingBalance = $tokenStore.balances[token.canister_id]?.in_tokens;
    
    // Only update if we have a valid balance
    const balance = existingBalance || token.balance || BigInt(0);
    
    onSelect({
        ...token,
        balance: balance,
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
    await tokenStore.loadFavorites();
  });

  function toggleHideZeroBalances() {
    console.log('Toggle hide zero balances:', { before: hideZeroBalances });
    hideZeroBalances = !hideZeroBalances;
    console.log('After toggle:', { after: hideZeroBalances });
  }

  function toggleSort() {
    sortDirection = sortDirection === "desc" ? "asc" : "desc";
    sortColumn = sortColumn === "value" ? "volume" : "value";
  }

  function setStandardFilter(filter: string) {
    standardFilter = filter;
  }
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
            <h2 class="modal-title">Select Token</h2>
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <button
              class="close-button"
              on:click|stopPropagation={() => {
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
                      on:click={() => setStandardFilter(tab.id)}
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
                    <input
                      type="checkbox"
                      bind:checked={hideZeroBalances}
                    />
                    <span class="toggle-label">Hide zero balances</span>
                  </label>

                  <div
                    class="sort-toggle"
                    on:click={toggleSort}
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
                  {@const balance = $tokenStore.balances[token?.canister_id]}

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
                            class:active={isFavorite(token.canister_id)}
                            on:click={(e) => handleFavoriteClick(e, token)}
                            title={isFavorite(token.canister_id)
                              ? "Remove from favorites"
                              : "Add to favorites"}
                          >
                            <Star
                              size={14}
                              fill={isFavorite(token.canister_id)
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
                    <div class="text-sm token-right text-kong-text-primary">
                      <span class="flex flex-col text-right token-balance">
                        {token.formattedBalance || "0"}
                        <span class="text-xs token-balance-label">
                          {formatUsdValue(token.formattedUsdValue || "0")}
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

<style>
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
    background-color: #1a1b23;
    border: 1px solid #2a2d3d;
    border-radius: 0.75rem;
    box-shadow:
      0 20px 25px -5px rgb(0 0 0 / 0.1),
      0 8px 10px -6px rgb(0 0 0 / 0.1);
    overflow: hidden;
    width: 400px;
    height: min(600px, 85vh);
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem;
    border-bottom: 1px solid #2a2d3d;
    background-color: #15161c;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: white;
    margin: 0;
    line-height: 1.25;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    color: white;
    transition: all 0.2s;
  }

  .close-button:hover {
    background-color: rgba(255, 255, 255, 0.15);
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
    background: #15161c;
    border-radius: 0.25rem;
  }

  .scrollable-section::-webkit-scrollbar-thumb {
    background: #2a2d3d;
    border-radius: 0.25rem;
  }

  .search-section {
    z-index: 10;
    border-bottom: 1px solid #2a2d3d;
    background-color: #15161c;
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
    border-bottom: 1px solid #2a2d3d;
    background-color: #15161c;
  }

  .filter-buttons {
    display: flex;
    width: 100%;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid #2a2d3d;
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
    color: #eab308;
    background-color: rgba(234, 179, 8, 0.05);
  }

  .filter-btn::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    transform: scaleX(0);
    background-color: #eab308;
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
    background-color: transparent;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    position: relative;
    margin: 0;
  }

  .filter-toggle input[type="checkbox"]:checked {
    background-color: #3b82f6;
    border-color: #3b82f6;
  }

  .filter-toggle input[type="checkbox"]:checked::after {
    content: "";
    position: absolute;
    left: 4px;
    top: 1px;
    width: 4px;
    height: 8px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .filter-toggle input[type="checkbox"]:focus {
    outline: none;
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

  .token-item.disabled:hover {
    background-color: transparent;
  }

  .token-item.disabled::after {
    content: "Selected in other panel";
    position: absolute;
    right: 1rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
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
