<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import Dialog from "$lib/components/common/Dialog.svelte";
  import { Copy, Search } from "lucide-svelte";
  import { goto } from "$app/navigation";

  let { principal } = $props<{
    principal: string;
  }>();

  let searchInput = $state('');
  let isSearching = $state(false);
  let showSearchDialog = $state(false);

  // Format the principal ID for display
  let formattedAddress = $derived(
    principal 
      ? principal.length <= 12 
        ? principal 
        : `${principal.slice(0, 6)}...${principal.slice(-6)}`
      : ''
  );

  async function handleSearch(e: SubmitEvent) {
    e.preventDefault();
    if (!searchInput.trim() || searchInput.trim() === principal) return;
    
    isSearching = true;
    try {
      await goto(`/wallets/${searchInput.trim()}`);
      showSearchDialog = false;
      searchInput = '';
    } finally {
      isSearching = false;
    }
  }

  function copyAddress() {
    navigator.clipboard.writeText(principal);
  }
</script>

<Panel variant="transparent">
  <div class="flex flex-col space-y-2">
    <h2 class="text-sm uppercase font-medium text-kong-text-primary">
      Wallet Address
    </h2>
    <div class="flex items-center space-x-2">
      <p class="flex-1 font-mono text-sm text-kong-text-primary">
        {formattedAddress}
      </p>
      <button
        type="button"
        onclick={copyAddress}
        class="px-3 py-2 bg-kong-bg-tertiary border border-kong-border hover:border-kong-primary rounded-lg text-kong-text-primary transition-colors duration-200"
        title="Copy address"
      >
        <Copy size={16} />
      </button>
      <button
        type="button"
        onclick={() => showSearchDialog = true}
        class="px-3 py-2 bg-kong-bg-tertiary border border-kong-border hover:border-kong-primary rounded-lg text-kong-text-primary transition-colors duration-200"
        title="Search wallet"
      >
        <Search size={16} />
      </button>
    </div>
  </div>
</Panel>

<Dialog
  title="Search Wallet"
  bind:open={showSearchDialog}
  closeLabel="Cancel"
>
  <form class="flex flex-col space-y-4" onsubmit={handleSearch}>
    <div class="relative">
      <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Search size={16} class="text-kong-text-secondary" />
      </div>
      <input
        type="text"
        bind:value={searchInput}
        placeholder="Enter wallet address..."
        class="w-full pl-10 pr-3 py-2 bg-kong-bg-tertiary border border-kong-border rounded-lg text-kong-text-primary placeholder-kong-text-secondary focus:outline-none focus:border-kong-primary font-mono text-sm"
      />
    </div>
    <div class="flex justify-end space-x-2">
      <button
        type="submit"
        disabled={isSearching || !searchInput.trim() || searchInput.trim() === principal}
        class="px-4 py-2 bg-kong-primary hover:bg-kong-primary-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium flex-shrink-0 transition-colors duration-200"
      >
        {isSearching ? 'Searching...' : 'Search'}
      </button>
    </div>
  </form>
</Dialog>
