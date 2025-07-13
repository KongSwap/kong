<script lang="ts">
  import { onMount } from 'svelte';
  import type { SwapToken } from '../types/swap.types';
  import { userTokens } from '$lib/stores/userTokens';
  import { currentUserBalancesStore } from '$lib/stores/balancesStore';
  import { auth } from '$lib/stores/auth';
  import { formatBalance } from '$lib/utils/numberFormatUtils';
  import { formatUsdValue } from '$lib/utils/tokenFormatters';
  import Icon from '@iconify/svelte';
  import Modal from '$lib/components/common/Modal.svelte';
  
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
  let isOpen = $state(true);
  
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
    handleClose();
  }
  
  function handleClose() {
    isOpen = false;
    onClose();
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
    // Focus search input after modal opens
    setTimeout(() => {
      searchInput?.focus();
    }, 150);
    
    // Ensure tokens are initialized when modal opens
    userTokens.ensureInitialized();
    
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
  });
</script>

<Modal
  bind:isOpen
  title="Select Token"
  width="400px"
  onClose={handleClose}
  className="token-selector-modal"
  closeOnEscape={true}
  closeOnClickOutside={true}
>
  <!-- Search -->
  <div class="search-container p-4 border-b border-kong-border/30">
    <div class="relative">
      <Icon 
        icon="heroicons:magnifying-glass" 
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kong-text-tertiary" 
      />
      <input
        bind:this={searchInput}
        bind:value={searchQuery}
        type="text"
        inputmode="search"
        placeholder="Search tokens..."
        class="w-full pl-10 pr-10 py-3 bg-kong-bg-secondary rounded-kong-roundness outline-none focus:ring-2 focus:ring-kong-ui-focus/30 text-kong-text-primary placeholder-kong-text-tertiary border border-kong-border/30 focus:border-kong-ui-focus/70 hover:border-kong-border/50 transition-all duration-200"
      />
      {#if searchQuery}
        <button
          onclick={() => searchQuery = ''}
          class="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-kong-bg-tertiary hover:scale-110 rounded-full transition-all duration-200 group focus:ring-2 focus:ring-kong-ui-focus/30"
          aria-label="Clear search"
        >
          <Icon 
            icon="heroicons:x-mark" 
            class="w-4 h-4 text-kong-text-tertiary group-hover:text-kong-semantic-warning transition-colors" 
          />
        </button>
      {/if}
    </div>
  </div>
  
  <!-- Token List -->
  <div class="flex-1 overflow-y-auto max-h-96">
    {#if filteredTokens.length === 0}
      <div class="empty-state p-12 text-center">
        <Icon 
          icon={searchQuery ? "heroicons:magnifying-glass" : "heroicons:face-frown"} 
          class="w-16 h-16 mx-auto mb-4 {searchQuery ? 'text-kong-semantic-info' : 'text-kong-text-tertiary'}" 
        />
        <p class="text-kong-text-secondary">
          {searchQuery ? 'No tokens found matching your search' : 'No tokens available'}
        </p>
        {#if searchQuery}
          <button 
            onclick={() => searchQuery = ''}
            class="mt-3 text-kong-brand-primary hover:text-kong-brand-secondary text-sm font-medium transition-colors"
          >
            Clear search to see all tokens
          </button>
        {/if}
      </div>
    {:else}
      <div class="token-list p-2">
        {#each filteredTokens as token (token.address)}
          {@const balance = getTokenBalance(token)}
          <button
            onclick={() => handleTokenSelect(token)}
            class="token-item w-full p-3 hover:bg-kong-bg-tertiary/50 hover:scale-[1.02] rounded-kong-roundness transition-all duration-200 flex items-center gap-3 group focus:ring-2 focus:ring-kong-ui-focus/30 focus:outline-none
                   {currentToken?.address === token.address ? 'bg-kong-brand-primary/10 ring-1 ring-kong-brand-primary/30' : ''}"
            type="button"
          >
            <!-- Token Icon -->
            <div class="token-icon relative flex-shrink-0">
              {#if token.logo_url}
                <img 
                  src={token.logo_url} 
                  alt={token.symbol} 
                  class="w-10 h-10 rounded-full ring-2 ring-kong-border/20 group-hover:ring-kong-brand-primary/40 group-hover:scale-110 transition-all duration-200"
                  onerror={handleImageError}
                />
                <div class="token-fallback w-10 h-10 bg-gradient-to-br from-kong-brand-primary/20 to-kong-brand-secondary/10 rounded-full items-center justify-center group-hover:scale-110 transition-transform duration-200" style="display: none;">
                  <span class="text-sm font-bold text-kong-brand-primary">{token.symbol.substring(0, 2).toUpperCase()}</span>
                </div>
              {:else}
                <div class="token-fallback w-10 h-10 bg-gradient-to-br from-kong-brand-primary/20 to-kong-brand-secondary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <span class="text-sm font-bold text-kong-brand-primary">{token.symbol.substring(0, 2).toUpperCase()}</span>
                </div>
              {/if}
            </div>
            
            <!-- Token Info -->
            <div class="flex-1 text-left">
              <div class="font-semibold text-kong-text-primary flex items-center gap-2 group-hover:text-kong-brand-primary transition-colors">
                {token.symbol}
                {#if currentToken?.address === token.address}
                  <span class="text-xs bg-kong-brand-primary/20 text-kong-brand-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Icon icon="heroicons:check" class="w-3 h-3" />
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
                      class="animate-spin h-4 w-4 text-kong-semantic-info" 
                    />
                    <span class="text-xs text-kong-text-tertiary">Loading...</span>
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
  <div class="token-count border-t border-kong-border/30 bg-kong-bg-tertiary/30 p-3 text-center">
    <p class="text-sm text-kong-text-secondary">
      <span class="font-semibold {filteredTokens.length > 0 ? 'text-kong-semantic-success' : 'text-kong-text-primary'}">{filteredTokens.length}</span> 
      {filteredTokens.length === 1 ? 'token' : 'tokens'} 
      {searchQuery ? 'found' : 'available'}
    </p>
  </div>
</Modal>

<style>
  /* Token item responsive sizing */
  .token-item {
    min-height: 68px;
    border-radius: var(--kong-roundness, 0.5rem);
  }
  
  @media (max-width: 374px) {
    .token-item {
      min-height: 60px;
      padding: 0.5rem;
    }
    
    .token-icon img,
    .token-icon .token-fallback {
      width: 36px;
      height: 36px;
    }
  }
  
  /* Enhanced hover and active states */
  .token-item:hover {
    box-shadow: 0 4px 12px rgba(var(--kong-brand-primary-rgb, 55 114 255), 0.1);
  }
  
  .token-item:active {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }
  
  /* Custom scrollbar styling */
  .token-list::-webkit-scrollbar {
    width: 6px;
  }
  
  .token-list::-webkit-scrollbar-track {
    background: rgba(var(--kong-bg-tertiary-rgb, 58 65 84), 0.3);
    border-radius: 3px;
  }
  
  .token-list::-webkit-scrollbar-thumb {
    background-color: rgba(var(--kong-ui-border-rgb, 64 64 64), 0.5);
    border-radius: 3px;
    transition: background-color 0.2s ease;
  }
  
  .token-list::-webkit-scrollbar-thumb:hover {
    background-color: rgba(var(--kong-ui-border-rgb, 64 64 64), 0.8);
  }
  
  /* Enhanced focus states */
  .token-item:focus-visible {
    outline: 2px solid rgba(var(--kong-ui-focus-rgb, 55 114 255), 0.6);
    outline-offset: 2px;
  }
  
  /* Performance optimizations */
  .token-item {
    will-change: background-color, transform;
  }
  
  .token-icon img,
  .token-icon .token-fallback {
    will-change: transform;
  }
  
  /* Improve touch responsiveness */
  @media (hover: none) and (pointer: coarse) {
    .token-item:hover {
      background-color: transparent;
    }
    
    .token-item:active {
      background-color: rgba(var(--kong-bg-tertiary-rgb, 58 65 84), 0.5);
      transform: scale(0.98);
      transition: all 0.15s ease;
    }
  }
</style>