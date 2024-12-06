<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
    import { fade, scale } from 'svelte/transition';
    import { flip } from 'svelte/animate';
    import { cubicOut } from 'svelte/easing';
    import { formatBalance, formatTokenValue } from '$lib/utils/tokenFormatters';
    import { browser } from '$app/environment';
    import Portal from 'svelte-portal';
    import { Star } from 'lucide-svelte';
  
    const props = $props();
    const { 
      show = false,
      onSelect,
      onClose,
      currentToken,
      otherPanelToken = null,
      expandDirection = 'down'
    } = props;
  
    let searchQuery = $state("");
    let searchInput: HTMLInputElement;
    let dropdownElement: HTMLDivElement;
    let hideZeroBalances = $state(false);
    let isMobile = $state(false);
    let sortDirection = $state('desc');
    let standardFilter = $state("all");
    let favorites = $derived($tokenStore.getFavorites());
    let favoriteCount = $derived($formattedTokens.filter(token => tokenStore.isFavorite(token.canister_id)).length);

    // Check if we're on mobile
    $effect(() => {
      if (browser) {
        isMobile = window.innerWidth <= 768;
        const handleResize = () => {
          isMobile = window.innerWidth <= 768;
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      }
    });

    function handleFavoriteClick(e: MouseEvent, token: FE.Token) {
      e.preventDefault();
      e.stopPropagation();
      tokenStore.toggleFavorite(token.canister_id);
    }

    type TokenMatch = {
      token: FE.Token;
      matches: {
        type: 'symbol' | 'name' | 'canister' | 'standard';
        text: string;
        index: number;
      }[];
    };

    function findMatches(token: FE.Token, searchLower: string): TokenMatch['matches'] {
      const matches: TokenMatch['matches'] = [];
      
      if (token.symbol?.toLowerCase().includes(searchLower)) {
        matches.push({
          type: 'symbol',
          text: token.symbol,
          index: token.symbol.toLowerCase().indexOf(searchLower)
        });
      }
      
      if (token.name?.toLowerCase().includes(searchLower)) {
        matches.push({
          type: 'name', 
          text: token.name,
          index: token.name.toLowerCase().indexOf(searchLower)
        });
      }
      
      if (token.canister_id?.toLowerCase().includes(searchLower)) {
        matches.push({
          type: 'canister',
          text: token.canister_id,
          index: token.canister_id.toLowerCase().indexOf(searchLower)
        });
      }
      
      if (token.standard?.toLowerCase().includes(searchLower)) {
        matches.push({
          type: 'standard',
          text: token.standard,
          index: token.standard.toLowerCase().indexOf(searchLower)
        });
      }
      
      return matches;
    }

    // Filter tokens based on search and balance
    let filteredTokens = $derived(
      $formattedTokens
        .map((token): TokenMatch | null => {
          if (!token?.symbol || !token?.name) return null;
          
          const searchLower = searchQuery.toLowerCase();
          const matches = findMatches(token, searchLower);
          
          return matches.length > 0 ? { token, matches } : null;
        })
        .filter((match): match is TokenMatch => {
          if (!match) return false;

          // Apply standard filter
          switch (standardFilter) {
            case "ck":
              return match.token.symbol.toLowerCase().startsWith("ck");
            case "favorites":
              return tokenStore.isFavorite(match.token.canister_id);
            case "all":
            default:
              // Apply balance filter if enabled
              if (hideZeroBalances) {
                const balance = $tokenStore.balances[match.token.canister_id]?.in_tokens || BigInt(0);
                return balance > 0;
              }
              return true;
          }
        })
        .sort((a, b) => {
          // Sort by favorites first
          const aFavorite = tokenStore.isFavorite(a.token.canister_id);
          const bFavorite = tokenStore.isFavorite(b.token.canister_id);
          if (aFavorite !== bFavorite) return bFavorite ? 1 : -1;
          
          // Then sort by best match (lowest index)
          if (searchQuery) {
            const aMinIndex = Math.min(...a.matches.map(m => m.index));
            const bMinIndex = Math.min(...b.matches.map(m => m.index));
            if (aMinIndex !== bMinIndex) return aMinIndex - bMinIndex;
          }
          
          // Then sort by balance
          const balanceA = Number($tokenStore.balances[a.token.canister_id]?.in_tokens || 0);
          const balanceB = Number($tokenStore.balances[b.token.canister_id]?.in_tokens || 0);
          return sortDirection === 'desc' ? balanceB - balanceA : balanceA - balanceB;
        })
    );

    function getStaggerDelay(index: number) {
      return index * 30; // 30ms delay between each item
    }
  
    function handleSelect(token: FE.Token) {
      onSelect({
        ...token,
        balance: BigInt(token.balance?.toString() || '0')
      });
      searchQuery = "";
    }
  
    function handleClickOutside(event: MouseEvent) {
      if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
  
    // Focus search input when dropdown opens
    $effect(() => {
      if (show) {
        setTimeout(() => {
          searchInput?.focus();
          window.addEventListener('click', handleClickOutside);
          window.addEventListener('keydown', handleKeydown);
        }, 0);
      }
    });

    // Cleanup event listeners
    function cleanup() {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeydown);
    }

    onDestroy(cleanup);

    onMount(async () => {
      await tokenStore.loadFavorites();
    });
</script>

{#if show}
  <Portal target="body">
    <div 
      class="modal-backdrop"
      on:click={() => onClose()}
      transition:fade={{ duration: 200 }}
    >
      <div
        class="dropdown-container {expandDirection} {isMobile ? 'mobile' : ''}"
        bind:this={dropdownElement}
        transition:scale={{
          duration: 250,
          start: 0.95,
          opacity: 0,
          easing: cubicOut,
        }}
        on:click={(e) => e.stopPropagation()}
      >
        <div class="modal-content">
          <header class="modal-header">
            <h2 class="modal-title">Select Token</h2>
            <button class="close-button" on:click={onClose}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                  {#each [
                    { id: 'all', label: 'All', count: $formattedTokens.length },
                    { id: 'ck', label: 'CK', count: $formattedTokens.filter(t => t.symbol.toLowerCase().startsWith('ck')).length },
                    { id: 'favorites', label: 'Favorites', count: favoriteCount }
                  ] as tab}
                    <button
                      on:click={() => standardFilter = tab.id}
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

                  <div class="sort-toggle" on:click={() => {
                    sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
                  }}>
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
                      class:ascending={sortDirection === 'asc'}
                    >
                      <path d="M12 20V4M5 13l7 7 7-7"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div class="scrollable-section">
              <div class="tokens-container">
                {#each filteredTokens as {token, matches}, i (token.canister_id)}
                  <div
                    animate:flip={{ duration: 200 }}
                    in:fade={{ 
                      delay: getStaggerDelay(i),
                      duration: 150,
                      easing: cubicOut
                    }}
                    class="token-item"
                    class:selected={currentToken?.canister_id === token.canister_id}
                    class:disabled={otherPanelToken?.canister_id === token.canister_id}
                    on:click={(e) => {
                      e.stopPropagation();
                      if (otherPanelToken?.canister_id !== token.canister_id) {
                        handleSelect(token);
                      }
                    }}
                  >
                    <div class="token-info">
                      <img
                        src={token?.logo_url}
                        alt={token.symbol}
                        class="token-logo"
                      />
                      <div class="token-details">
                        <div class="token-symbol-row">
                          <button 
                            class="favorite-button"
                            class:active={tokenStore.isFavorite(token.canister_id)}
                            on:click={(e) => handleFavoriteClick(e, token)}
                            title={tokenStore.isFavorite(token.canister_id) ? "Remove from favorites" : "Add to favorites"}
                          >
                            <Star 
                              size={14} 
                              fill={tokenStore.isFavorite(token.canister_id) ? "#ffd700" : "none"} 
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
                    <div class="token-right">
                      {#if $tokenStore.balances[token.canister_id]}
                        <span class="token-balance">
                          {formatBalance($tokenStore.balances[token.canister_id].in_tokens.toString(), token.decimals)}
                        </span>
                      {/if}
                      {#if currentToken?.canister_id === token.canister_id}
                        <div class="selected-indicator">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
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
    scrollbar-width: thin;
    scrollbar-color: #2a2d3d transparent;
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
    content: '';
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
    flex: 1;
  }

  .token-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: all 0.2s;
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

  .token-logo {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 9999px;
    background-color: #2a2d3d;
    padding: 0.125rem;
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

  .token-balance {
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
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
