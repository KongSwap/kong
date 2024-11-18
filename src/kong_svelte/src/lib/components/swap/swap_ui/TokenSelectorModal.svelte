<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenRow from "$lib/components/sidebar/TokenRow.svelte";
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import { walletStore } from '$lib/services/wallet/walletStore';
  import { tokenLogoStore, getTokenLogo } from '$lib/services/tokens/tokenLogos';

  export let show = false;
  export let onSelect: (token: FE.Token) => void;
  export let onClose: () => void;
  export let currentToken: FE.Token;

  let searchQuery = "";
  let standardFilter = "all";

  // Get current wallet ID for favorites
  $: walletId = $walletStore?.account?.owner?.toString() || 'anonymous';

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

<Modal {show} title="Select Token" {onClose} variant="green">
  <div class="space-y-4">
    <div class="w-full">
      <label for="token-search" class="sr-only">Search tokens</label>
      <div class="flex gap-2">
        <input
          id="token-search"
          type="text"
          bind:value={searchQuery}
          placeholder="Search tokens..."
          class="flex-1 bg-black/30 border-2 border-white/10 rounded-xl px-4 py-2 text-white text-lg font-medium 
                 placeholder-white/60 transition-all duration-100 
                 hover:border-white/20 focus:border-yellow-300/50 focus:outline-none"
          aria-label="Search tokens"
        />
        <button
          on:click={handlePaste}
          class="px-4 py-2 bg-black/30 border-2 border-white/10 rounded-xl text-white/80 font-medium
                 transition-all duration-100 hover:border-white/20 hover:text-white
                 focus:border-yellow-300/50 focus:outline-none"
          aria-label="Paste from clipboard"
        >
          Paste
        </button>
      </div>
      <div class="flex flex-wrap gap-1 mt-2">
        <button
          class="px-3 py-1.5 rounded-lg bg-black/30 border-2 border-white/10 text-white/80 text-sm font-medium
                 transition-all duration-100 hover:border-white/20 hover:text-white
                 {standardFilter === 'all' ? 'border-yellow-300/50 text-yellow-300 bg-black/50' : ''}"
          on:click={() => (standardFilter = "all")}
        >
          All
        </button>
        <button
          class="px-3 py-1.5 rounded-lg bg-black/30 border-2 border-white/10 text-white/80 text-sm font-medium
                 transition-all duration-100 hover:border-white/20 hover:text-white
                 {standardFilter === 'favorites' ? 'border-yellow-300/50 text-yellow-300 bg-black/50' : ''}"
          on:click={() => (standardFilter = "favorites")}
        >
          Favorites {favoriteCount > 0 ? `(${favoriteCount})` : ''}
        </button>
        <button
          class="px-3 py-1.5 rounded-lg bg-black/30 border-2 border-white/10 text-white/80 text-sm font-medium
                 transition-all duration-100 hover:border-white/20 hover:text-white
                 {standardFilter === 'ck' ? 'border-yellow-300/50 text-yellow-300 bg-black/50' : ''}"
          on:click={() => (standardFilter = "ck")}
        >
          ckTokens
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto overflow-x-hidden py-1 space-y-2 token-list" role="listbox" aria-label="Token list">
      {#each filteredTokens as token}
        <div class="flex items-center px-4 rounded-lg transition-all duration-100 hover:bg-white/5">
          <button
            class="flex-1 py-2 bg-transparent border-none cursor-pointer transition-all duration-100 text-left
                   hover:translate-x-1 min-w-0"
            on:click={() => handleSelect(token)}
            role="option"
            aria-selected={token.canister_id === currentToken?.canister_id}
          >
            <TokenRow {token} />
          </button>
          <button
            class="p-2 bg-transparent border-none cursor-pointer text-white/50 transition-all duration-100
                   hover:text-yellow-300 hover:scale-110 flex items-center justify-center"
            on:click={(e) => handleFavoriteClick(e, token.canister_id)}
            aria-label={$tokenStore.favoriteTokens[walletId]?.includes(token.canister_id) 
              ? "Remove from favorites" 
              : "Add to favorites"}
          >
            <span class="text-xl leading-none outline-none
                       {$tokenStore.favoriteTokens[walletId]?.includes(token.canister_id) 
                         ? 'text-yellow-300' 
                         : 'opacity-70'}">
              {$tokenStore.favoriteTokens[walletId]?.includes(token.canister_id) ? '★' : '☆'}
            </span>
          </button>
        </div>
      {/each}
    </div>
  </div>
</Modal>

<style lang="postcss">
  /* Custom scrollbar styles - can't be done with Tailwind */
  .token-list {
    scrollbar-width: thin;
    
    &::-webkit-scrollbar {
      @apply w-1.5;
    }
    
    &::-webkit-scrollbar-track {
      @apply bg-transparent;
    }
    
    &::-webkit-scrollbar-thumb {
      @apply bg-white/20 rounded-full;
      
      &:hover {
        @apply bg-white/30;
      }
    }
  }

  /* Screen reader only utility */
  .sr-only {
    @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
    clip: rect(0, 0, 0, 0);
  }
</style>
