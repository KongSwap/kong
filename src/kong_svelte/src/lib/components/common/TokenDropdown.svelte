<script lang="ts">
  import { dropdownStore, closeDropdown } from '$lib/stores/dropdownStore';
  import { slide } from 'svelte/transition';
  import { clickOutside } from '$lib/actions/clickOutside';
  import { formatTokenAmount } from '$lib/utils/numberFormatUtils';
  import { writable } from 'svelte/store';
  import { getTokenLogo } from '$lib/services/tokens/tokenLogos';

  let searchQuery = '';
  let searchInput: HTMLInputElement;
  let activeTab: 'all' | 'favorites' = 'all';
  
  // Mock favorites store - replace with actual implementation
  const favoriteTokens = writable<string[]>(['1', '2']); // Example with BTC and ETH as favorites

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      searchQuery = text;
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  }

  function toggleFavorite(tokenId: string) {
    favoriteTokens.update(favs => {
      if (favs.includes(tokenId)) {
        return favs.filter(id => id !== tokenId);
      }
      return [...favs, tokenId];
    });
  }

  function selectToken(token: FE.Token) {
    if ($dropdownStore.onSelect) {
      $dropdownStore.onSelect(token);
    }
    closeDropdown();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeDropdown();
    }
  }

  $: filteredTokens = $dropdownStore.tokens.filter(token => {
    const matchesSearch = searchQuery === '' || 
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.canister_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'favorites') {
      return matchesSearch && $favoriteTokens.includes(token.canister_id);
    }
    return matchesSearch;
  });

  $: if ($dropdownStore.isOpen && searchInput) {
    setTimeout(() => searchInput.focus(), 0);
  }
</script>

{#if $dropdownStore.isOpen}
  <div
    class="dropdown-overlay"
    use:clickOutside={{ enabled: true }}
    on:click_outside={closeDropdown}
  >
    <div
      class="dropdown-container"
      class:up={$dropdownStore.direction === 'up'}
      transition:slide={{ duration: 200 }}
      style="
        width: {$dropdownStore.width}px;
        left: {$dropdownStore.position.x}px;
        {$dropdownStore.direction === 'up' ? `bottom: ${window.innerHeight - $dropdownStore.position.y}px` : `top: ${$dropdownStore.position.y}px`}
      "
    >
      <div class="search-container">
        <div class="search-input-wrapper">
          <input
            type="text"
            bind:value={searchQuery}
            bind:this={searchInput}
            placeholder="Search by name or paste address"
            class="search-input"
            on:keydown={handleKeydown}
          />
          <button class="paste-button" on:click={handlePaste}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
          </button>
        </div>

        <div class="tabs">
          <button
            class="tab-button"
            class:active={activeTab === 'all'}
            on:click={() => activeTab = 'all'}
          >
            All Tokens
          </button>
          <button
            class="tab-button"
            class:active={activeTab === 'favorites'}
            on:click={() => activeTab = 'favorites'}
          >
            Favorites
          </button>
        </div>
      </div>

      <div class="token-list">
        {#each filteredTokens as token (token.canister_id)}
          <div 
            class="token-item"
            on:click|stopPropagation={() => selectToken(token)}
            on:keydown={(e) => {
              if (e.key === 'Enter') selectToken(token);
            }}
            role="button"
            tabindex="0"
          >
            <div class="token-info">
              <img src={await getTokenLogo(token.canister_id)} alt={token.symbol} class="token-logo" />
              <div class="token-details">
                <div class="token-header">
                  <span class="token-symbol">{token.symbol}</span>
                </div>
                <span class="token-name">{token.name}</span>
              </div>
            </div>
            <div class="token-actions">
              <div class="token-balance">
                {#if token.balance !== undefined}
                  <span class="balance-amount">{formatTokenAmount(token.balance.toString(), token.decimals)}</span>
                {/if}
              </div>
              <button 
                class="favorite-button"
                on:click|stopPropagation={() => toggleFavorite(token.canister_id)}
                aria-label={$favoriteTokens.includes(token.canister_id) ? "Remove from favorites" : "Add to favorites"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={$favoriteTokens.includes(token.canister_id) ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .dropdown-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 99999;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    opacity: 0;
    transition: opacity 0.2s ease;

    &:has(.dropdown-container) {
      opacity: 1;
    }
  }

  .dropdown-container {
    position: fixed;
    min-width: 420px;
    background: rgba(23, 25, 35, 0.98);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    box-shadow: 
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06),
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 8px 24px rgba(0, 0, 0, 0.2);
    max-height: 480px;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    transform-origin: top center;
    animation: dropdown-in 0.2s ease;
  }

  @keyframes dropdown-in {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .search-container {
    padding: 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .search-input-wrapper {
    position: relative;
    margin-bottom: 1rem;
  }

  .search-input {
    width: 100%;
    padding: 0.875rem 1rem;
    padding-right: 3rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: white;
    font-size: 0.9375rem;
    transition: all 0.2s ease;

    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

    &:hover {
      border-color: rgba(255, 255, 255, 0.15);
    }

    &:focus {
      outline: none;
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }
  }

  .paste-button {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    padding: 0.5rem;
    color: rgba(255, 255, 255, 0.5);
    transition: all 0.2s ease;

    &:hover {
      color: white;
    }
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
  }

  .tab-button {
    flex: 1;
    padding: 0.625rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.15);
      color: white;
    }

    &.active {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
      color: white;
    }
  }

  .token-list {
    overflow-y: auto;
    padding: 0.75rem;
    max-height: 360px;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.02);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;

      &:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    }
  }

  .token-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border-radius: 12px;
    margin: 0.25rem 0;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    &:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.5);
    }
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .token-logo {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .token-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .token-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .token-symbol {
    font-weight: 600;
    font-size: 1rem;
    color: white;
  }

  .token-name {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .token-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .token-balance {
    text-align: right;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
  }

  .favorite-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 8px;

    &:hover {
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.05);
    }

    &:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.5);
    }
  }
</style>
