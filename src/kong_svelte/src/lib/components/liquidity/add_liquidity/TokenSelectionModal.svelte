<script lang="ts">
    import { Search, Star } from "lucide-svelte";
    import Modal from "$lib/components/common/Modal.svelte";
    import TokenRowCompact from "$lib/components/sidebar/TokenRowCompact.svelte";
    import { FavoriteService } from "$lib/services/tokens/favoriteService";
  
    export let show: boolean = false;
    export let tokens: FE.Token[] = [];
    export let helperText: string = "";
    export let searchQuery: string = "";
    export let onClose: () => void;
    export let onSelect: (token: FE.Token) => void;

    let standardFilter = "all";
    let favoriteCount = 0;
    let filteredTokens: FE.Token[] = [];

    async function updateFavoriteCount() {
        const favorites = await Promise.all(
            tokens.map(token => FavoriteService.isFavorite(token.canister_id))
        );
        favoriteCount = favorites.filter(Boolean).length;
    }

    async function updateFilteredTokens() {
        const tokensWithFavorites = await Promise.all(
            tokens.map(async (token) => {
                const isFavorite = await FavoriteService.isFavorite(token.canister_id);
                const matchesSearch = searchQuery ? (
                    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    token.name.toLowerCase().includes(searchQuery.toLowerCase())
                ) : true;

                if (!matchesSearch) return null;

                switch (standardFilter) {
                    case "ck": 
                        return token.symbol.toLowerCase().startsWith("ck") ? { token, isFavorite } : null;
                    case "favorites": 
                        return isFavorite ? { token, isFavorite } : null;
                    default: 
                        return { token, isFavorite };
                }
            })
        );

        filteredTokens = tokensWithFavorites
            .filter((item): item is {token: FE.Token, isFavorite: boolean} => item !== null)
            .sort((a, b) => {
                if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
                return a.token.symbol.localeCompare(b.token.symbol);
            })
            .map(({ token }) => token);
    }

    $: {
        if (tokens) updateFavoriteCount();
        if (tokens || searchQuery || standardFilter) updateFilteredTokens();
    }
</script>

<Modal isOpen={show} {onClose} title="Select Token" variant="solid">
  <div class="bg-white dark:bg-emerald-800 dark:bg-opacity-80 dark:backdrop-blur-md rounded-2xl w-full max-w-md p-6 space-y-4">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Select Token</h2>
        {#if helperText}
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{helperText}</p>
        {/if}
      </div>
      <button
        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        onclick={onClose}
      >
        ✕
      </button>
    </div>

    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search class="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search by name or symbol"
        class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
      />
    </div>

    <div class="filter-buttons">
      <button
        onclick={() => standardFilter = "all"}
        class="filter-btn"
        class:active={standardFilter === "all"}
        aria-label="Show all tokens"
      >
        All
      </button>
      <button
        onclick={() => standardFilter = "ck"}
        class="filter-btn"
        class:active={standardFilter === "ck"}
        aria-label="Show CK tokens"
      >
        CK
      </button>
      <button
        onclick={() => standardFilter = "favorites"}
        class="filter-btn"
        class:active={standardFilter === "favorites"}
        aria-label="Show favorite tokens"
      >
        Favorites ({favoriteCount})
      </button>
    </div>

    <div class="space-y-2 max-h-96 overflow-y-auto">
      {#each filteredTokens as token}
        <TokenRowCompact
          {token}
          onClick={() => {
            onSelect(token);
            onClose();
          }}
        />
      {/each}
    </div>
  </div>
</Modal>

<style>
  :global(.dark) .dark\:bg-emerald-800 {
    background-color: rgba(6, 95, 70, var(--tw-bg-opacity));
  }
  
  :global(.dark) .dark\:hover\:bg-gray-700:hover {
    background-color: rgba(55, 65, 81, var(--tw-bg-opacity));
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
</style>
