<script lang="ts">
  import { onMount } from "svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import { currentUserBalancesStore } from "$lib/stores/balancesStore";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { fetchAllTokens } from "$lib/api/tokens";
  import { Search, Check, Eye, EyeOff, Loader2, Plus } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { fade } from "svelte/transition";
  import AddNewTokenModal from "$lib/components/wallet/AddNewTokenModal.svelte";

  // Props
  const props = $props<{
    isOpen: boolean;
    onClose: () => void;
  }>();

  // State
  let allTokens = $state<Kong.Token[]>([]);
  let filteredTokens = $state<Kong.Token[]>([]);
  let searchQuery = $state("");
  let isLoading = $state(true);
  let activeTab = $state<"enabled" | "all">("enabled");
  let showAddNewTokenModal = $state(false);
  
  // Track which tokens have balances (for quick reference)
  let tokensWithBalances = $state<Set<string>>(new Set());
  
  // Effects
  $effect(() => {
    if (props.isOpen) {
      loadTokens();
    }
  });
  
  // Use a specific effect that runs only when the dependencies change
  $effect(() => {
    // Only update when these dependencies change
    // Directly depend on the derived store - Svelte 5 tracks this
    const currentEnabledTokens = $userTokens.enabledTokens;
    const _ = [searchQuery, activeTab, allTokens, currentEnabledTokens];

    if (allTokens.length > 0) {
      updateFilteredTokens();
    }
  });
  
  // Methods
  async function loadTokens() {
    isLoading = true;
    try {
      // Fetch all available tokens
      allTokens = await fetchAllTokens();
      
      // Mark which tokens have balances
      tokensWithBalances = new Set();
      for (const token of allTokens) {
        if (!token.address) continue;
        
        const balanceInfo = $currentUserBalancesStore?.[token.address];
        if (balanceInfo && balanceInfo.in_tokens > 0n) {
          tokensWithBalances.add(token.address);
        }
      }
    } catch (error) {
      console.error("Error loading tokens:", error);
    } finally {
      isLoading = false;
    }
  }
  
  function updateFilteredTokens() {
    // Get enabled token IDs directly from the store
    const enabledTokenIds = $userTokens.enabledTokens;
    
    // Filter tokens based on current tab and search query
    const filtered = allTokens.filter(token => {
      // Skip tokens without canister_id
      if (!token.address) return false;
      
      // Check if token matches the active tab
      const isEnabled = enabledTokenIds.has(token.address);
      if (activeTab === "enabled" && !isEnabled) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          token.name?.toLowerCase().includes(query) ||
          token.symbol?.toLowerCase().includes(query) ||
          token.address.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
    
    // Sort tokens: enabled first, then by name
    filtered.sort((a, b) => {
      const aEnabled = enabledTokenIds.has(a.address);
      const bEnabled = enabledTokenIds.has(b.address);
      
      if (aEnabled && !bEnabled) return -1;
      if (!aEnabled && bEnabled) return 1;
      
      // If both enabled or both disabled, sort by balance (descending)
      const aHasBalance = tokensWithBalances.has(a.address);
      const bHasBalance = tokensWithBalances.has(b.address);
      
      if (aHasBalance && !bHasBalance) return -1;
      if (!aHasBalance && bHasBalance) return 1;
      
      // Otherwise sort by name
      return a.name.localeCompare(b.name);
    });
    
    // Only update the state variable once, with the final result
    filteredTokens = filtered;
  }
  
  function toggleToken(token: Kong.Token) {
    if (!token.address) return;
    
    // Check if token is currently enabled using enabledTokens directly
    const isCurrentlyEnabled = $userTokens.enabledTokens.has(token.address);

    if (isCurrentlyEnabled) {
      userTokens.disableToken(token.address);
    } else {  
      userTokens.enableToken(token);
    }
  }
  
  function getFormattedBalance(token: Kong.Token): string {
    if (!token.address) return "0";
    
    const balanceInfo = $currentUserBalancesStore?.[token.address];
    if (!balanceInfo || !balanceInfo.in_tokens) return "0";
    
    return formatBalance(balanceInfo.in_tokens, token.decimals || 0);
  }
  
  // Check if token is enabled
  function isTokenEnabled(token: Kong.Token): boolean {
    if (!token.address) return false;
    return $userTokens.enabledTokens.has(token.address);
  }
  
  // Check if token has a balance
  function hasBalance(token: Kong.Token): boolean {
    if (!token.address) return false;
    return tokensWithBalances.has(token.address);
  }
  
  // Handle newly added token
  function handleTokenAdded(event: CustomEvent<Kong.Token>) {
    showAddNewTokenModal = false;
    
    // Refresh token list
    loadTokens();
  }
  
  // Load tokens on component mount
  onMount(() => {
    if (props.isOpen) {
      loadTokens();
    }
  });
</script>

<Modal
  isOpen={props.isOpen}
  title="Manage Tokens"
  onClose={props.onClose}
  width="600px"
  isPadded={true}
  variant="solid"
>
  <div class="flex flex-col">
    <!-- Search and tabs -->
    <div class="flex flex-col gap-4 mb-4">
      <div class="relative">
        <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search size={16} class="text-kong-text-secondary/70" />
        </div>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search by name, symbol, or canister ID"
          class="w-full pl-10 pr-4 py-2.5 bg-kong-bg-primary/70 border border-kong-border/40 rounded-lg text-kong-text-primary placeholder-kong-text-secondary/70 focus:outline-none focus:ring-1 focus:ring-kong-accent-blue/40"
        />
      </div>
      
      <div class="flex border-b border-kong-border">
        <button
          class="py-2 px-4 text-sm font-medium border-b-2 {activeTab === 'enabled' ? 'border-kong-primary text-kong-primary' : 'border-transparent text-kong-text-secondary hover:text-kong-text-primary'} transition-colors"
          onclick={() => activeTab = "enabled"}
        >
          Enabled Tokens
        </button>
        <button
          class="py-2 px-4 text-sm font-medium border-b-2 {activeTab === 'all' ? 'border-kong-primary text-kong-primary' : 'border-transparent text-kong-text-secondary hover:text-kong-text-primary'} transition-colors"
          onclick={() => activeTab = "all"}
        >
          All Tokens
        </button>
      </div>
    </div>
    
    <!-- Token list -->
    <div class="overflow-y-auto max-h-[400px] scrollbar-thin">
      {#if isLoading}
        <div class="py-10 flex flex-col items-center justify-center">
          <Loader2 size={32} class="text-kong-primary animate-spin mb-3" />
          <p class="text-kong-text-secondary">Loading tokens...</p>
        </div>
      {:else if filteredTokens.length === 0}
        <div class="py-10 text-center">
          <p class="text-lg font-medium text-kong-text-primary mb-1">No tokens found</p>
          <p class="text-sm text-kong-text-secondary mb-4">
            {searchQuery 
              ? `No tokens match "${searchQuery}"`
              : activeTab === "enabled"
                ? "You don't have any enabled tokens"
                : "No tokens available"
            }
          </p>
          <button
            class="inline-flex items-center gap-2 px-4 py-2 bg-kong-primary text-white rounded-md hover:bg-kong-primary/90 transition-colors"
            onclick={() => {
              showAddNewTokenModal = true;
              props.onClose();
            }}
          >
            <Plus size={16} />
            Add New Token
          </button>
        </div>
      {:else}
        <div class="space-y-0 border-b border-kong-border/30">
          {#each filteredTokens as token}
            {@const enabled = isTokenEnabled(token)}
            {@const balance = getFormattedBalance(token)}
            {@const hasTokenBalance = hasBalance(token)}
            
            <div 
              class="p-3 border-t border-kong-border/30 flex items-center justify-between hover:bg-kong-bg-secondary/5 transition-colors"
              transition:fade={{ duration: 150 }}
            >
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0">
                  <TokenImages
                    tokens={[token]}
                    size={32}
                    showSymbolFallback={true}
                  />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-kong-text-primary">{token.symbol}</span>
                    <span class="text-sm text-kong-text-secondary">{token.name}</span>
                  </div>
                  <div class="text-xs text-kong-text-secondary/70 font-mono mt-0.5">
                    {token.address}
                  </div>
                </div>
              </div>
              
              <div class="flex items-center gap-4">
                {#if hasTokenBalance}
                  <div class="text-sm text-kong-text-primary">
                    {balance} <span class="text-kong-text-secondary">{token.symbol}</span>
                  </div>
                {/if}
                
                <button
                  class="flex items-center justify-center rounded-full p-1.5 {enabled ? 'bg-kong-primary/10 text-kong-primary hover:bg-kong-primary/20' : 'bg-kong-bg-secondary/10 text-kong-text-secondary hover:bg-kong-bg-secondary/20'} transition-colors"
                  onclick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleToken(token);
                  }}
                  title={enabled ? "Disable token" : "Enable token"}
                >
                  {#if enabled}
                    <EyeOff size={18} />
                  {:else}
                    <Eye size={18} />
                  {/if}
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    
    <!-- Footer -->
    <div class="mt-6 flex justify-end">
      <button
        class="px-4 py-2 bg-kong-primary text-white rounded-md hover:bg-kong-primary/90 transition-colors"
        onclick={props.onClose}
      >
        Done
      </button>
    </div>
  </div>
</Modal>

<!-- Add New Token Modal -->
{#if showAddNewTokenModal}
  <AddNewTokenModal 
    isOpen={showAddNewTokenModal}
    onClose={() => showAddNewTokenModal = false}
    on:tokenAdded={handleTokenAdded}
  />
{/if}

<style>
  /* Scrollbar styling */
  :global(.scrollbar-thin::-webkit-scrollbar) {
    width: 0.375rem; /* w-1.5 */
  }

  :global(.scrollbar-thin::-webkit-scrollbar-track) {
    background-color: transparent; /* bg-transparent */
  }

  :global(.scrollbar-thin::-webkit-scrollbar-thumb) {
    background-color: var(--kong-border); /* bg-kong-border */
    border-radius: 9999px; /* rounded-full */
  }
</style> 