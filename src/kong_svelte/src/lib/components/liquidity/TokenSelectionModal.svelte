<script lang="ts">
  import { fade } from "svelte/transition";
  import { Search } from "lucide-svelte";
  import { tokenStore, isTokenFavorite } from "$lib/services/tokens/tokenStore";
  import { tokenLogoStore } from "$lib/services/tokens/tokenLogos";
  
  export let show: boolean = false;
  export let tokens: FE.Token[] = [];
  export let helperText: string = "";
  export let searchQuery: string = "";
  export let onClose: () => void;
  export let onSelect: (token: FE.Token) => void;

  $: sortedTokens = tokens.sort((a, b) => {
    // First sort by favorite status
    const aFavorite = isTokenFavorite(a.canister_id);
    const bFavorite = isTokenFavorite(b.canister_id);
    
    if (aFavorite && !bFavorite) return -1;
    if (!bFavorite && aFavorite) return 1;

    // Then sort by USD balance
    const balanceA = Number($tokenStore.balances[a.canister_id]?.in_usd || 0);
    const balanceB = Number($tokenStore.balances[b.canister_id]?.in_usd || 0);
    return balanceB - balanceA;
  });

  function toggleFavorite(event: MouseEvent, token: FE.Token) {
    event.stopPropagation();
    tokenStore.toggleFavorite(token.canister_id);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if show}
  <div
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md"
    transition:fade
    on:click|self={onClose}
  >
    <div
      class="bg-white dark:bg-emerald-800 dark:bg-opacity-80 dark:backdrop-blur-md rounded-2xl w-full max-w-md p-6 space-y-4"
    >
      <div class="flex justify-between items-center">
        <div>
          <h3 class="text-lg font-bold dark:text-white">Select Token</h3>
          {#if helperText}
            <p class="text-sm text-white/50 mt-1">{helperText}</p>
          {/if}
        </div>
        <button
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          on:click={onClose}
        >
          ✕
        </button>
      </div>

      <div class="relative">
        <Search
          class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
        />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search by name or symbol"
          class="w-full pl-10 pr-4 py-3 rounded-xl border border-emerald-200
                       dark:border-emerald-600 dark:bg-emerald-700 focus:ring-2
                       focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      <div class="max-h-96 overflow-y-auto space-y-2">
        {#each sortedTokens as token}
          <div
            class="w-full p-3 flex items-center space-x-3 hover:bg-gray-50
                   dark:hover:bg-gray-700/50 rounded-xl transition-colors"
            on:click={() => onSelect(token)}
          >
            <img
              src={$tokenLogoStore[token.canister_id] ?? "/default-token.png"}
              alt={token.symbol}
              class="w-8 h-8 rounded-full"
            />
            <div class="flex-1 text-left">
              <div class="font-medium dark:text-white">{token.symbol}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                {token.name}
              </div>
            </div>
            <button
              class="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full"
              on:click|stopPropagation={(e) => toggleFavorite(e, token)}
            >
              <svg
                class={`w-5 h-5 ${
                  isTokenFavorite(token.canister_id)
                    ? "text-yellow-400 fill-current"
                    : "text-gray-400 dark:text-gray-500"
                }`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
