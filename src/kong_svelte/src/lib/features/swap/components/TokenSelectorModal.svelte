<script lang="ts">
  import Portal from 'svelte-portal';
  import { onMount } from 'svelte';
  import type { SwapToken } from '../types/swap.types';
  import { userTokens } from '$lib/stores/userTokens';
  import { currentUserBalancesStore } from '$lib/stores/balancesStore';
  import { auth } from '$lib/stores/auth';
  import { formatBalance } from '$lib/utils/numberFormatUtils';
  import { formatUsdValue } from '$lib/utils/tokenFormatters';
  import Icon from '@iconify/svelte';
  
  interface Props {
    currentToken: SwapToken | null;
    excludeToken: SwapToken | null;
    onSelect: (token: SwapToken) => void;
    onClose: () => void;
  }
  
  let { currentToken, excludeToken, onSelect, onClose }: Props = $props();
  
  let searchQuery = $state('');
  let searchInput: HTMLInputElement;
  let loadingBalances = $state(false);
  
  // Get only enabled tokens
  let tokens = $derived(
    Array.from($userTokens.enabledTokens)
      .map(address => $userTokens.tokenData.get(address))
      .filter((token): token is Kong.Token => token !== undefined)
  );
  
  // Filter and sort tokens
  let filteredTokens = $derived(
    tokens
      .filter((token: Kong.Token) => {
        // Exclude the other panel's token
        if (excludeToken && token.address === excludeToken.address) return false;
        
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            token.symbol.toLowerCase().includes(query) ||
            token.name.toLowerCase().includes(query) ||
            token.address.toLowerCase().includes(query)
          );
        }
        
        return true;
      })
      .sort((a: Kong.Token, b: Kong.Token) => {
        // Current token first
        if (currentToken?.address === a.address) return -1;
        if (currentToken?.address === b.address) return 1;
        
        // Sort by USD balance if connected
        if ($auth.isConnected && $currentUserBalancesStore) {
          const balanceA = parseFloat($currentUserBalancesStore[a.address]?.in_usd || '0');
          const balanceB = parseFloat($currentUserBalancesStore[b.address]?.in_usd || '0');
          
          // Sort by highest USD balance first
          if (balanceB !== balanceA) {
            return balanceB - balanceA;
          }
        }
        
        // Fall back to alphabetical sort by symbol
        return a.symbol.localeCompare(b.symbol);
      })
  );
  
  // Get formatted balance for a token
  function getTokenBalance(token: Kong.Token) {
    const balanceData = $currentUserBalancesStore?.[token.address];
    if (!balanceData) return { formatted: '0', usd: '$0.00' };
    
    // Ensure in_tokens is properly handled as bigint
    const tokensBalance = balanceData.in_tokens || BigInt(0);
    const formatted = formatBalance(
      tokensBalance,
      token.decimals || 8
    );
    
    // Ensure in_usd is a string and format it
    const usdValue = balanceData.in_usd || '0';
    const usd = formatUsdValue(usdValue);
    
    return { formatted, usd };
  }
  
  function handleTokenSelect(token: Kong.Token) {
    // SwapToken extends Kong.Token, so this is safe
    onSelect(token as any as SwapToken);
    onClose();
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
  
  function handleClickOutside(event: MouseEvent) {
    const modal = (event.target as HTMLElement).closest('.modal-content');
    if (!modal) {
      onClose();
    }
  }
  
  function handleImageError(event: Event) {
    const img = event.currentTarget as HTMLImageElement;
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement;
    if (fallback) {
      fallback.style.display = 'flex';
    }
  }
  
  onMount(() => {
    searchInput?.focus();
    document.addEventListener('keydown', handleKeydown);
    
    // Load balances if connected and not already loaded
    if ($auth.isConnected && $auth.account?.owner) {
      // Check if we already have balances in the store
      const hasBalances = Object.keys($currentUserBalancesStore).length > 0;
      
      if (!hasBalances) {
        loadingBalances = true;
        
        // Load balances only for enabled tokens
        import('$lib/stores/balancesStore').then(({ loadBalances }) => {
          // Get only enabled tokens
          const enabledTokensArray = Array.from($userTokens.enabledTokens)
            .map(address => $userTokens.tokenData.get(address))
            .filter((token): token is Kong.Token => token !== undefined);
          
          // Don't force refresh if we're just checking for the first time
          return loadBalances(enabledTokensArray, $auth.account.owner, false);
        }).catch(error => {
          console.error('Failed to load balances:', error);
        }).finally(() => {
          loadingBalances = false;
        });
      }
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<Portal target="body">
  <div class="fixed inset-0 z-50 overflow-y-auto" onclick={handleClickOutside}>
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-kong-bg-primary/80 backdrop-blur-md"></div>
    
    <!-- Modal -->
    <div class="relative min-h-screen flex items-center justify-center p-4 !max-w-[520px] mx-auto">
      <div class="modal-content relative bg-kong-bg-secondary rounded-kong-roundness shadow-2xl w-full max-w-[480px] max-h-[80vh] flex flex-col border border-kong-border/40 overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 bg-kong-bg-tertiary/50 backdrop-blur-sm border-b border-kong-border/30">
          <h2 class="text-xl font-bold text-kong-text-primary">Select Token</h2>
          <button
            onclick={onClose}
            class="p-2 hover:bg-kong-bg-secondary rounded-full transition-all duration-200 group"
            aria-label="Close token selector"
          >
            <Icon 
              icon="heroicons:x-mark" 
              class="w-5 h-5 text-kong-text-secondary group-hover:text-kong-text-primary transition-colors" 
            />
          </button>
        </div>
        
        <!-- Search -->
        <div class="p-4 bg-kong-bg-tertiary/30">
          <div class="relative">
            <Icon 
              icon="heroicons:magnifying-glass" 
              class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kong-text-tertiary" 
            />
            <input
              bind:this={searchInput}
              bind:value={searchQuery}
              type="text"
              placeholder="Search tokens..."
              class="w-full pl-10 pr-10 py-3 bg-kong-bg-secondary rounded-kong-roundness outline-none focus:ring-2 focus:ring-kong-primary/30 text-kong-text-primary placeholder-kong-text-tertiary border border-kong-border/30 focus:border-kong-primary/50 transition-all duration-200"
            />
            {#if searchQuery}
              <button
                onclick={() => searchQuery = ''}
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-kong-bg-tertiary rounded-full transition-colors group"
                aria-label="Clear search"
              >
                <Icon 
                  icon="heroicons:x-mark" 
                  class="w-4 h-4 text-kong-text-tertiary group-hover:text-kong-text-primary transition-colors" 
                />
              </button>
            {/if}
          </div>
        </div>
        
        <!-- Token List -->
        <div class="flex-1 overflow-y-auto max-h-[400px]">
          {#if filteredTokens.length === 0}
            <div class="p-12 text-center">
              <Icon 
                icon="heroicons:face-frown" 
                class="w-16 h-16 mx-auto mb-4 text-kong-text-tertiary" 
              />
              <p class="text-kong-text-secondary">
                {searchQuery ? 'No tokens found matching your search' : 'No tokens available'}
              </p>
            </div>
          {:else}
            <div class="p-2">
              {#each filteredTokens as token (token.address)}
                {@const balance = getTokenBalance(token)}
                <button
                  onclick={() => handleTokenSelect(token)}
                  class="w-full p-3 hover:bg-kong-bg-tertiary/50 rounded-kong-roundness transition-all duration-200 flex items-center gap-3 group
                         {currentToken?.address === token.address ? 'bg-kong-primary/10 ring-1 ring-kong-primary/30' : ''}"
                  type="button"
                >
                  <!-- Token Icon -->
                  <div class="relative">
                    {#if token.logo_url}
                      <img 
                        src={token.logo_url} 
                        alt={token.symbol} 
                        class="w-10 h-10 rounded-full ring-2 ring-kong-border/20 group-hover:ring-kong-primary/30 transition-all duration-200"
                        onerror={handleImageError}
                      />
                      <div class="w-10 h-10 bg-gradient-to-br from-kong-primary/20 to-kong-primary/10 rounded-full items-center justify-center" style="display: none;">
                        <span class="text-sm font-bold text-kong-primary">{token.symbol.substring(0, 2).toUpperCase()}</span>
                      </div>
                    {:else}
                      <div class="w-10 h-10 bg-gradient-to-br from-kong-primary/20 to-kong-primary/10 rounded-full flex items-center justify-center">
                        <span class="text-sm font-bold text-kong-primary">{token.symbol.substring(0, 2).toUpperCase()}</span>
                      </div>
                    {/if}
                  </div>
                  
                  <!-- Token Info -->
                  <div class="flex-1 text-left">
                    <div class="font-semibold text-kong-text-primary flex items-center gap-2 group-hover:text-kong-primary transition-colors">
                      {token.symbol}
                      {#if currentToken?.address === token.address}
                        <span class="text-xs bg-kong-primary/20 text-kong-primary px-2 py-0.5 rounded-full font-medium">
                          Selected
                        </span>
                      {/if}
                    </div>
                    <div class="text-sm text-kong-text-secondary">{token.name}</div>
                  </div>
                  
                  <!-- Balance (only show if user is connected) -->
                  {#if $auth.isConnected}
                    <div class="text-right">
                      {#if loadingBalances && !$currentUserBalancesStore[token.address]}
                        <div class="flex items-center gap-2">
                          <Icon 
                            icon="eos-icons:loading" 
                            class="animate-spin h-4 w-4 text-kong-text-tertiary" 
                          />
                        </div>
                      {:else}
                        <div class="font-semibold text-kong-text-primary">
                          {balance.formatted}
                        </div>
                        <div class="text-sm text-kong-text-secondary">
                          {balance.usd}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        
        <!-- Token count -->
        <div class="p-3 border-t border-kong-border/30 bg-kong-bg-tertiary/30 text-center">
          <p class="text-sm text-kong-text-secondary">
            <span class="font-semibold text-kong-text-primary">{filteredTokens.length}</span> {filteredTokens.length === 1 ? 'token' : 'tokens'} available
          </p>
        </div>
      </div>
    </div>
  </div>
</Portal>

<style>
  /* Custom scrollbar styling */
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-track {
    background: rgb(var(--bg-tertiary) / 0.3);
    border-radius: 3px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background-color: rgb(var(--ui-border) / 0.5);
    border-radius: 3px;
    transition: background-color 0.2s;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background-color: rgb(var(--ui-border));
  }
  
  /* Modal animation */
  .modal-content {
    animation: slideUp 0.2s ease-out;
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>