<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import { formattedTokens, tokenStore, isTokenFavorite, toggleFavoriteToken, getFavoritesForWallet } from "$lib/services/tokens/tokenStore";
  import { walletStore } from '$lib/services/wallet/walletStore';

  export let show = false;
  export let onSelect: (token: string) => void;
  export let onClose: () => void;
  export let currentToken: string;

  let searchQuery = "";
  let standardFilter = "all";

  // Get current wallet ID for favorites
  $: walletId = $walletStore?.account?.owner?.toString() || 'anonymous';

  $: filteredTokens = $formattedTokens
    .filter((token) => {
      const matchesSearch =
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      switch (standardFilter) {
        case "ck":
          return token.symbol.toLowerCase().startsWith("ck");
        case "favorites":
          return isTokenFavorite(token.canister_id);
        case "all":
        default:
          return true;
      }
    });

  function handleSelect(token: string) {
    onSelect(token);
    onClose();
  }

  function handleFavoriteClick(event: MouseEvent, canisterId: string) {
    event.stopPropagation();
    toggleFavoriteToken(canisterId);
  }

  $: favoriteCount = $getFavoritesForWallet.length;
</script>

<Modal {show} title="Select Token" {onClose} variant="green">
  <div class="search-container">
    <label for="token-search" class="sr-only">Search tokens</label>
    <input
      id="token-search"
      type="text"
      bind:value={searchQuery}
      placeholder="Search tokens..."
      class="search-input"
      aria-label="Search tokens"
    />
    <div class="filter-buttons">
      <button
        class="filter-btn {standardFilter === 'all' ? 'active' : ''}"
        on:click={() => (standardFilter = "all")}
      >
        All
      </button>
      <button
        class="filter-btn {standardFilter === 'favorites' ? 'active' : ''}"
        on:click={() => (standardFilter = "favorites")}
      >
        Favorites {favoriteCount > 0 ? `(${favoriteCount})` : ''}
      </button>
      <button
        class="filter-btn {standardFilter === 'ck' ? 'active' : ''}"
        on:click={() => (standardFilter = "ck")}
      >
        ckTokens
      </button>
    </div>
  </div>

  <div class="token-list" role="listbox" aria-label="Token list">
    {#each filteredTokens as token}
      <div class="token-row-container">
        <button
          class="token-button"
          class:active={token.symbol === currentToken}
          on:click={() => handleSelect(token.symbol)}
          role="option"
          aria-selected={token.symbol === currentToken}
        >
          <TokenRow {token} />
        </button>
        <button
          class="favorite-button"
          on:click={(e) => handleFavoriteClick(e, token.canister_id)}
          aria-label={$tokenStore.favoriteTokens[walletId]?.includes(token.canister_id) ? "Remove from favorites" : "Add to favorites"}
        >
          {#if $tokenStore.favoriteTokens[walletId]?.includes(token.canister_id)}
            <span class="star filled">★</span>
          {:else}
            <span class="star outline">☆</span>
          {/if}
        </button>
      </div>
    {/each}
  </div>
</Modal>

<style>
  .search-container {
    margin-bottom: 1rem;
  }

  .search-input {
    width: 100%;
    background-color: rgba(0, 0, 0, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    padding: 0.5rem;
    color: white;
    font-size: 1.125rem;
    font-weight: 500;
    transition: all 100ms;
  }

  .search-input:hover {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .search-input:focus {
    border-color: rgba(253, 224, 71, 0.5);
    outline: none;
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }

  .filter-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    justify-content: flex-start;
    margin-top: 0.5rem;
  }

  .filter-btn {
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    background-color: rgba(0, 0, 0, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 100ms;
  }

  .filter-btn:hover {
    border-color: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .filter-btn.active {
    border-color: rgba(253, 224, 71, 0.5);
    color: rgb(253, 224, 71);
    background-color: rgba(0, 0, 0, 0.5);
  }

  .token-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    margin: 0;
    padding: 0.25rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    scrollbar-width: thin;
  }

  .token-list::-webkit-scrollbar {
    width: 6px;
  }

  .token-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .token-list::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 9999px;
  }

  .token-list::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.3);
  }

  .token-row-container {
    display: flex;
    align-items: center;
    padding: 0 1rem;
    border-radius: 0.5rem;
    transition: all 100ms;
  }

  .token-row-container:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .token-button {
    flex: 1;
    padding: 0.5rem 0;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 100ms;
    min-width: 0;
    text-align: left;
  }

  .token-button:hover {
    transform: translateX(0.25rem);
  }

  .favorite-button {
    background: transparent;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.5);
    transition: all 100ms;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .favorite-button:hover {
    color: rgb(253, 224, 71);
    transform: scale(1.1);
  }

  .star {
    font-size: 1.25rem;
    line-height: 1;
    outline: none;
  }

  .star.filled {
    color: rgb(253, 224, 71);
  }

  .star.outline {
    opacity: 0.7;
  }

  .token-button.active {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .token-button.active:hover {
    transform: none;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .favorite-indicator {
    color: rgb(253, 224, 71);
    margin-right: 0.5rem;
    outline: none;
  }
</style>
