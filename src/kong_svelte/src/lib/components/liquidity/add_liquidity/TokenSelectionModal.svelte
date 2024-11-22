<script lang="ts">
    import { Search } from "lucide-svelte";
    import { tokenStore } from "$lib/services/tokens/tokenStore";
    import Modal from "$lib/components/common/Modal.svelte";
  
    export let show: boolean = false;
    export let tokens: FE.Token[] = [];
    export let helperText: string = "";
    export let searchQuery: string = "";
    export let onClose: () => void;
    export let onSelect: (token: FE.Token) => void;

    $: filteredTokens = tokens.filter((token) =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
</script>

<Modal isOpen={show} {onClose} title="Select Token" variant="green">
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
        on:click={onClose}
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

    <div class="space-y-2 max-h-96 overflow-y-auto">
      {#each filteredTokens as token}
        <button
          class="w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
          on:click={() => {
            onSelect(token);
            onClose();
          }}
        >
          <div class="flex-1 flex items-center space-x-3">
            <img
              src={$tokenStore.logos[token.canister_id] || "/tokens/not_verified.webp"}
              alt={token.symbol}
              class="w-8 h-8 rounded-full"
              on:error={(e) => {
                // @ts-ignore
                e.currentTarget.src = "/tokens/not_verified.webp";
              }}
            />
            <div class="flex-1">
              <div class="font-medium text-gray-900 dark:text-white">
                {token.symbol}
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                {token.name}
              </div>
            </div>
          </div>
        </button>
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
</style>
