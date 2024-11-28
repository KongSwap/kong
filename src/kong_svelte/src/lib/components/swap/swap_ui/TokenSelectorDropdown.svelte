<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
    import { tokenLogoStore, getTokenLogo } from '$lib/services/tokens/tokenLogos';
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

    function clearSearch() {
      searchQuery = "";
      searchInput?.focus();
    }

    function handleFavoriteClick(e: MouseEvent, token: FE.Token) {
      e.preventDefault();
      e.stopPropagation();
      tokenStore.toggleFavorite(token.canister_id);
    }

    // Filter tokens based on search and balance
    let filteredTokens = $derived($formattedTokens
      .filter((token) => {
        if (!token?.symbol || !token?.name) return false;
        
        // Filter by search
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = token.symbol.toLowerCase().includes(searchLower) ||
               token.name.toLowerCase().includes(searchLower) ||
               token.canister_id.toLowerCase() === searchLower;

        if (!matchesSearch) return false;

        // Apply standard filter
        switch (standardFilter) {
          case "ck":
            return token.symbol.toLowerCase().startsWith("ck");
          case "favorites":
            return tokenStore.isFavorite(token.canister_id);
          case "all":
          default:
            // Apply balance filter if enabled
            if (hideZeroBalances) {
              const balance = $tokenStore.balances[token.canister_id]?.in_tokens || BigInt(0);
              return balance > 0;
            }
            return true;
        }
      })
      .sort((a, b) => {
        // Sort by favorites first
        const aFavorite = tokenStore.isFavorite(a.canister_id);
        const bFavorite = tokenStore.isFavorite(b.canister_id);
        if (aFavorite !== bFavorite) return bFavorite ? 1 : -1;
        
        // Then sort by balance
        const balanceA = Number($tokenStore.balances[a.canister_id]?.in_tokens || 0);
        const balanceB = Number($tokenStore.balances[b.canister_id]?.in_tokens || 0);
        return sortDirection === 'desc' ? balanceB - balanceA : balanceA - balanceB;
      }));

    function getStaggerDelay(index: number) {
      return index * 30; // 30ms delay between each item
    }

    // Load token logos
    $effect(() => {
      filteredTokens.forEach(token => {
        if (!$tokenLogoStore[token.canister_id]) {
          getTokenLogo(token.canister_id);
        }
      });
    });
  
    function handleSelect(token: FE.Token) {
      onSelect({
        ...token,
        balance: BigInt(token.balance?.toString() || '0')
      });
      searchQuery = "";
    }
  
    async function handlePaste() {
      try {
        searchQuery = await navigator.clipboard.readText();
        searchInput?.focus();
      } catch (err) {
        console.error('Failed to read clipboard:', err);
      }
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
            <div class="search-section">
              <div class="search-input-wrapper">
                <input
                  bind:this={searchInput}
                  bind:value={searchQuery}
                  type="text"
                  placeholder="Search tokens"
                  class="search-input"
                  on:click={(e) => e.stopPropagation()}
                />
                <button 
                  class="action-button"
                  on:click={(e) => {
                    e.stopPropagation();
                    searchQuery ? clearSearch() : handlePaste();
                  }}
                >
                  {#if searchQuery}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    </svg>
                  {/if}
                </button>
              </div>
            </div>

            <div class="filter-bar">
              <div class="filter-buttons">
                <button
                  on:click={() => standardFilter = "all"}
                  class="filter-btn"
                  class:active={standardFilter === "all"}
                  aria-label="Show all tokens"
                  data-text="All"
                >
                  All
                </button>
                <button
                  on:click={() => standardFilter = "ck"}
                  class="filter-btn"
                  class:active={standardFilter === "ck"}
                  aria-label="Show CK tokens"
                  data-text="CK"
                >
                  CK
                </button>
                <button
                  on:click={() => standardFilter = "favorites"}
                  class="filter-btn"
                  class:active={standardFilter === "favorites"}
                  aria-label="Show favorite tokens"
                  data-text="Favorites ({favoriteCount})"
                >
                  Favorites ({favoriteCount})
                </button>
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

            <div class="tokens-container">
              {#each filteredTokens as token, i (token.canister_id)}
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
                      src={$tokenLogoStore[token.canister_id] || '/tokens/not_verified.webp'}
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
  </Portal>
{/if}

<style lang="postcss">
  .modal-backdrop {
    @apply fixed inset-0 bg-black/75 z-[9999];
    @apply grid place-items-center;
    @apply p-6;
    @apply overflow-y-auto;
  }

  .dropdown-container {
    @apply relative bg-[#1a1b23] border border-[#2a2d3d];
    @apply rounded-xl shadow-xl overflow-hidden;
    @apply w-[400px];
    height: min(600px, 85vh);
  }

  .dropdown-container.mobile {
    @apply fixed inset-0 w-full h-full;
    @apply rounded-none border-none;
    height: 100vh;
  }

  .modal-content {
    @apply relative flex flex-col;
    @apply h-full;
  }

  .modal-header {
    @apply flex justify-between items-center;
    @apply p-5 border-b border-[#2a2d3d];
    @apply bg-[#15161c];
  }

  .modal-title {
    @apply text-xl font-semibold text-white m-0;
    @apply leading-tight;
  }

  .close-button {
    @apply flex items-center justify-center;
    @apply w-8 h-8 bg-[#2a2d3d];
    @apply rounded-lg text-white;
    @apply transition-all duration-200;
    @apply hover:bg-[#3a3e52] hover:-translate-y-0.5;
  }

  .modal-body {
    @apply flex-1 overflow-y-auto;
    scrollbar-width: thin;
    scrollbar-color: #2a2d3d transparent;
  }

  .modal-body::-webkit-scrollbar {
    @apply w-1.5;
  }

  .modal-body::-webkit-scrollbar-track {
    @apply bg-[#15161c] rounded;
  }

  .modal-body::-webkit-scrollbar-thumb {
    @apply bg-[#2a2d3d] rounded;
  }

  .search-section {
    @apply sticky top-0 z-10;
    @apply border-b border-[#2a2d3d];
    @apply bg-[#15161c];
  }

  .search-input-wrapper {
    @apply relative flex items-center;
    @apply bg-[#2a2d3d] p-3;
  }

  .search-input {
    @apply flex-1 bg-transparent border-none;
    @apply text-white placeholder-white/50;
    @apply focus:outline-none;
    @apply text-base pr-12;
  }

  .action-button {
    @apply absolute right-5 top-1/2 -translate-y-1/2;
    @apply flex items-center justify-center;
    @apply w-8 h-8 rounded-lg;
    @apply bg-white/10 text-white/70;
    @apply hover:bg-white/15 hover:text-white;
    @apply transition-colors;
  }

  .filter-bar {
    @apply px-4 py-3 border-b border-[#2a2d3d];
    @apply bg-[#15161c] space-y-3;
  }

  .filter-buttons {
    @apply flex flex-wrap gap-2 mb-2 justify-center items-center border-b border-[#2a2d3d];
  } 

  .filter-btn {
    @apply px-4 pb-2 flex text-white/80 text-sm;
    @apply relative;
    font-weight: 500;
    -webkit-font-smoothing: antialiased;
  }

  .filter-btn::before {
    content: attr(data-text);
    @apply hidden absolute left-0 font-semibold;
    width: max-content;
  }

  .filter-btn:hover,
  .filter-btn.active {
    @apply text-yellow-500 font-semibold;
  }

  .filter-btn::after {
    content: '';
    @apply absolute bottom-0 left-0 w-full h-[2px];
    @apply scale-x-0 bg-yellow-300;
    @apply transition-transform duration-200;
    transform-origin: center;
  }

  .filter-btn:hover::after,
  .filter-btn.active::after {
    @apply scale-x-100;
  }

  .filter-options {
    @apply flex items-center justify-between;
  }

  .sort-toggle {
    @apply flex items-center gap-2;
    @apply text-sm text-white/70;
    @apply cursor-pointer hover:text-white;
    @apply select-none;
  }

  .sort-arrow {
    @apply transition-transform duration-200;
  }

  .sort-arrow.ascending {
    @apply rotate-180;
  }

  .filter-toggle {
    @apply flex items-center gap-2;
    @apply text-sm text-white/70;
    @apply cursor-pointer hover:text-white;
  }

  .filter-toggle input[type="checkbox"] {
    @apply w-4 h-4 rounded;
    @apply border border-[#2a2d3d];
    @apply bg-[#2a2d3d];
    @apply checked:bg-blue-500;
    @apply transition-colors;
    @apply focus:ring-2 focus:ring-blue-500/50;
  }

  .tokens-container {
    @apply flex-1;
  }

  .token-item {
    @apply flex items-center justify-between;
    @apply px-4 py-3;
    @apply cursor-pointer;
    @apply transition-all duration-200;
    @apply hover:bg-white/5;
  }

  .token-item.selected {
    @apply bg-white/10;
    @apply hover:bg-white/10;
  }

  .token-item.disabled {
    @apply opacity-50 cursor-not-allowed;
    @apply hover:bg-transparent;
    @apply relative;
  }

  .token-item.disabled::after {
    content: "Selected in other panel";
    @apply absolute right-4 text-sm text-white/50;
  }

  .token-info {
    @apply flex items-center gap-3;
  }

  .token-logo {
    @apply w-10 h-10 rounded-full;
    @apply bg-[#2a2d3d] p-0.5;
  }

  .token-details {
    @apply flex flex-col gap-0.5;
  }

  .token-symbol-row {
    @apply flex items-center gap-2;
  }

  .favorite-button {
    @apply p-1 rounded-md text-white/50 bg-white/5
           transition-all duration-200 hover:bg-white/10 hover:text-white;
  }

  .favorite-button.active {
    @apply text-yellow-300 bg-yellow-300/10;
  }

  .token-symbol {
    @apply text-base font-semibold text-white;
  }

  .token-name {
    @apply text-sm text-white/50;
  }

  .token-right {
    @apply flex items-center gap-4;
  }

  .token-balance {
    @apply text-sm font-medium text-white/70;
  }

  .selected-indicator {
    @apply text-green-400;
  }

  @media (max-width: 768px) {
    .modal-backdrop {
      @apply p-0;
    }

    .dropdown-container {
      @apply w-full h-full;
      @apply max-h-screen;
    }
  }
</style>
