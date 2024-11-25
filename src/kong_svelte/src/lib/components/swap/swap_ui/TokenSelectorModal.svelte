<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenRowCompact from "$lib/components/sidebar/TokenRowCompact.svelte";
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import { auth } from '$lib/services/auth';
  import { tokenLogoStore, getTokenLogo } from '$lib/services/tokens/tokenLogos';
    import { AnonymousIdentity } from "@dfinity/agent";

  export let show = false;
  export let onSelect: (token: FE.Token) => void;
  export let onClose: () => void;
  export let currentToken: FE.Token;

  let searchQuery = "";
  let standardFilter = "all";

  // Get current wallet ID for favorites
  $: walletId = $auth?.account?.owner?.toString() || null;

  $: filteredTokens = $formattedTokens
    .filter((token) => {
      if (!token) return false;
      if(!token?.symbol || !token?.name) return false;
      
      // Check if search query matches canister ID
      if (searchQuery.toLowerCase() === token.canister_id.toLowerCase()) {
        return true;
      }

      const matchesSearch =
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      switch (standardFilter) {
        case "ck":
          return token.symbol.toLowerCase().startsWith("ck");
        case "favorites":
          return $tokenStore.favoriteTokens[walletId]?.includes(token.canister_id);
        case "all":
        default:
          return true;
      }
    });

  // Load logos when filtered tokens change
  $: {
    if (filteredTokens) {
      filteredTokens.forEach(async (token) => {
        if (!$tokenLogoStore[token.canister_id]) {
          await getTokenLogo(token.canister_id);
        }
      });
    }
  }

  function handleSelect(token: FE.Token) {
    onSelect(token);
    onClose();
  }

  async function handleFavoriteClick(event: MouseEvent, canisterId: string) {
    event.stopPropagation();
    tokenStore.toggleFavorite(canisterId);
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      searchQuery = text.trim();
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  }

  // Get favorite count for the button label
  $: favoriteCount = $tokenStore.favoriteTokens[walletId]?.length || 0;
</script>

<Modal isOpen={show} title="Select Token" {onClose} variant="green">
  <div class="modal-content">
    <div class="search-section">
      <label for="token-search" class="sr-only">Search tokens</label>
      <div class="flex gap-2">
        <input
          id="token-search"
          type="text"
          bind:value={searchQuery}
          placeholder="Search tokens..."
          class="search-input"
          aria-label="Search tokens"
        />
        <button
          on:click={handlePaste}
          class="paste-btn"
          aria-label="Paste from clipboard"
        >
          Paste
        </button>
      </div>
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
        <div class="token-row">
          <button
            class="token-btn"
            on:click={() => handleSelect(token)}
            role="option"
            aria-selected={token.canister_id === currentToken?.canister_id}
          >
            <TokenRowCompact {token} />
          </button>
          <button
            class="fav-btn"
            on:click={(e) => handleFavoriteClick(e, token.canister_id)}
            aria-label={$tokenStore.favoriteTokens[walletId]?.includes(token.canister_id) 
              ? "Remove from favorites" 
              : "Add to favorites"}
          >
            <span class:active={$tokenStore.favoriteTokens[walletId]?.includes(token.canister_id)}>
              {$tokenStore.favoriteTokens[walletId]?.includes(token.canister_id) ? '★' : '☆'}
            </span>
          </button>
        </div>
      {/each}
    </div>
  </div>
</Modal>

<style lang="postcss">
  .modal-content {
    @apply space-y-6 min-h-[60vh];
  }

  .search-section {
    @apply space-y-4;
  }

  .search-input {
    @apply flex-1 bg-black/30 border-2 border-white/10 rounded-xl px-4 py-3 text-white text-lg font-medium 
           placeholder-white/60 transition-all duration-100 
           hover:border-white/20 focus:border-yellow-300/50 focus:outline-none;
  }

  .paste-btn {
    @apply px-4 py-2 bg-black/30 border-2 border-white/10 rounded-xl text-white/80 font-medium
           transition-all duration-100 hover:border-white/20 hover:text-white
           focus:border-yellow-300/50 focus:outline-none;
  }

  .filter-buttons {
    @apply flex flex-wrap gap-2;
  }

  .filter-btn {
    @apply px-4 py-2 rounded-lg bg-black/30 border-2 border-white/10 text-white/80 text-sm font-medium
           transition-all duration-100 hover:border-white/20 hover:text-white;
  }

  .filter-btn.active {
    @apply border-yellow-300/50 text-yellow-300 bg-black/50;
  }

  .token-list {
    @apply flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-2 max-h-[50vh];
    scrollbar-width: thin;
    
    &::-webkit-scrollbar {
      @apply w-1.5;
    }
    
    &::-webkit-scrollbar-track {
      @apply bg-transparent;
    }
    
    &::-webkit-scrollbar-thumb {
      @apply bg-white/20 rounded-full hover:bg-white/30;
    }
  }

  .token-row {
    @apply flex items-center px-2;
  }

  .token-btn {
    @apply flex-1 bg-transparent border-none cursor-pointer text-left min-w-0;
  }

  .fav-btn {
    @apply p-2 bg-transparent border-none cursor-pointer text-white/50
           flex items-center justify-center;
  }

  .fav-btn span {
    @apply text-xl leading-none outline-none opacity-70;
  }

  .fav-btn span.active {
    @apply text-yellow-300 opacity-100;
  }

  /* Screen reader only utility */
  .sr-only {
    @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
    clip: rect(0, 0, 0, 0);
  }
</style>
