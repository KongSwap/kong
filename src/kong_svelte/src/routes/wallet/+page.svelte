<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { fetchUsers } from '$lib/api/users';
  import { fetchTokens } from '$lib/api/tokens';

  interface User {
    user_id: number;
    principal_id: string;
    my_referral_code: string;
    referred_by: string | null;
    fee_level: number;
  }

  interface SearchResult {
    type: 'user' | 'token';
    data: User | FE.Token;
  }

  let searchQuery = $state('');
  let isSearching = $state(false);
  let showDropdown = $state(false);
  let searchResults = $state<SearchResult[]>([]);
  let selectedIndex = $state(-1);

  let searchTimeout: NodeJS.Timeout;

  async function handleSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      showDropdown = false;
      return;
    }

    isSearching = true;
    try {
      const [usersResponse, tokensResponse] = await Promise.all([
        fetchUsers(searchQuery),
        fetchTokens({ canister_id: searchQuery })
      ]);

      const userResults: SearchResult[] = usersResponse.items.map(item => ({
        type: 'user',
        data: {
          user_id: item.user_id,
          principal_id: item.principal_id,
          my_referral_code: item.my_referral_code,
          referred_by: item.referred_by,
          fee_level: item.fee_level
        }
      }));

      const tokenResults: SearchResult[] = tokensResponse.tokens.map(token => ({
        type: 'token',
        data: token
      }));

      searchResults = [...userResults, ...tokenResults];
      showDropdown = searchResults.length > 0;
    } catch (error) {
      console.error('Error fetching results:', error);
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  function handleInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(handleSearch, 300);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!showDropdown) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0) {
          selectResult(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        showDropdown = false;
        selectedIndex = -1;
        break;
    }
  }

  function selectResult(result: SearchResult) {
    if (result.type === 'user') {
      const user = result.data as User;
      searchQuery = user.principal_id;
    } else {
      const token = result.data as FE.Token;
      searchQuery = token.canister_id;
    }
    showDropdown = false;
    selectedIndex = -1;
    // TODO: Navigate to details page based on type
  }

  function handleClickOutside(node: HTMLElement) {
    const handleClick = (event: MouseEvent) => {
      if (!node.contains(event.target as Node)) {
        showDropdown = false;
        selectedIndex = -1;
      }
    };

    document.addEventListener('click', handleClick, true);

    return {
      destroy() {
        document.removeEventListener('click', handleClick, true);
      }
    };
  }

  function formatPrice(price: number | string | undefined): string {
    if (!price) return '$0.00';
    const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(numericPrice);
  }

  function formatPriceChange(change: number | string | undefined): string {
    if (!change) return '0.00%';
    const numericChange = typeof change === 'string' ? parseFloat(change) : change;
    return `${numericChange >= 0 ? '+' : ''}${numericChange.toFixed(2)}%`;
  }

  function getPriceChangeClass(change: number | string | undefined): string {
    if (!change) return '';
    const numericChange = typeof change === 'string' ? parseFloat(change) : change;
    return numericChange >= 0 ? 'bg-kong-accent-green/20 text-kong-accent-green' : 'bg-kong-accent-red/20 text-kong-accent-red';
  }
</script>

<div 
  class="min-h-screen flex flex-col items-center px-4 py-12 md:py-24"
  in:fade={{ duration: 200 }}
>
  <div class="w-full max-w-3xl mx-auto text-center mb-12">
    <div class="inline-flex items-center gap-2 mb-8">
      <h1 class="text-4xl md:text-5xl font-bold text-white">
        Kong Data
      </h1>
      <span class="px-3 py-1 bg-kong-accent-blue/20 text-kong-accent-blue rounded-full text-sm font-medium">
        Beta
      </span>
    </div>
    
    <!-- Search Section -->
    <div class="relative w-full" use:handleClickOutside>
      <div class="relative flex gap-2">
        <div class="flex-1 relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search by principal ID or token..."
            class="w-full h-14 px-6 rounded-xl bg-kong-surface-dark border border-kong-border focus:border-kong-accent-blue focus:outline-none text-white placeholder-kong-text-secondary transition-colors"
            on:input={handleInput}
            on:keydown={handleKeydown}
            autocomplete="off"
          />
          {#if isSearching}
            <div class="absolute right-4 top-1/2 -translate-y-1/2">
              <div class="w-6 h-6 border-2 border-kong-accent-blue border-t-transparent rounded-full animate-spin" />
            </div>
          {/if}
          
          {#if showDropdown && searchResults.length > 0}
            {@const tokenResults = searchResults.filter(r => r.type === 'token')}
            {@const userResults = searchResults.filter(r => r.type === 'user')}
            <div 
              class="absolute top-full left-0 right-0 mt-2 bg-kong-surface-dark border border-kong-border rounded-xl overflow-hidden z-50 shadow-lg max-h-[400px]"
              transition:slide|local={{ duration: 200 }}
            >
              <div class="divide-y divide-kong-border overflow-y-auto scrollbar-custom">
                {#if tokenResults.length > 0}
                  <div class="py-2">
                    <div class="px-4 py-1.5 text-xs font-medium text-kong-text-secondary uppercase tracking-wider sticky top-0 bg-kong-surface-dark">
                      Tokens
                    </div>
                    {#each tokenResults as result, index}
                      {@const token = result.data as FE.Token}
                      <button
                        class="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-4 {selectedIndex === index ? 'bg-white/10' : ''}"
                        on:click={() => selectResult(result)}
                      >
                        <div class="flex-1">
                          <div class="text-white font-medium truncate flex items-center gap-2">
                            {#if token.logo_url}
                              <img src={token.logo_url} alt={token.name} class="w-6 h-6 rounded-full" />
                            {/if}
                            {token.name}
                          </div>
                          <div class="text-sm text-kong-text-secondary">
                            {token.symbol} • {formatPrice(token.metrics?.price)}
                          </div>
                        </div>
                        {#if token.metrics?.price_change_24h}
                          <span class="px-2 py-0.5 rounded text-sm {getPriceChangeClass(token.metrics.price_change_24h)}">
                            {formatPriceChange(token.metrics.price_change_24h)}
                          </span>
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}

                {#if userResults.length > 0}
                  <div class="py-2">
                    <div class="px-4 py-1.5 text-xs font-medium text-kong-text-secondary uppercase tracking-wider sticky top-0 bg-kong-surface-dark">
                      Wallets
                    </div>
                    {#each userResults as result, index}
                      {@const user = result.data as User}
                      <button
                        class="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-4 {selectedIndex === tokenResults.length + index ? 'bg-white/10' : ''}"
                        on:click={() => selectResult(result)}
                      >
                        <div class="flex-1">
                          <div class="text-white font-medium truncate">
                            {user.principal_id}
                          </div>
                          <div class="text-sm text-kong-text-secondary">
                            Referral: {user.my_referral_code}
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          {#if user.fee_level > 0}
                            <span class="px-2 py-0.5 bg-kong-accent-green/20 text-kong-accent-green rounded text-sm">
                              Level {user.fee_level}
                            </span>
                          {/if}
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}

                {#if tokenResults.length === 0 && userResults.length === 0}
                  <div class="px-4 py-3 text-sm text-kong-text-secondary">
                    No results found
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Results Section (loading state) -->
  {#if isSearching}
    <div 
      class="absolute top-full left-0 right-0 mt-2 bg-kong-surface-dark border border-kong-border rounded-xl overflow-hidden z-50 shadow-lg max-h-[400px]"
    >
      <div class="divide-y divide-kong-border overflow-y-auto scrollbar-custom">
        <!-- Token Loading Section -->
        <div class="py-2">
          <div class="px-4 py-1.5 text-xs font-medium text-kong-text-secondary uppercase tracking-wider sticky top-0 bg-kong-surface-dark">
            Tokens
          </div>
          {#each Array(2) as _}
            <div class="w-full px-4 py-3 flex items-center gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-full bg-white/10 animate-pulse"></div>
                  <div class="h-5 w-32 bg-white/10 rounded animate-pulse"></div>
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <div class="h-4 w-24 bg-white/10 rounded animate-pulse"></div>
                </div>
              </div>
              <div class="h-6 w-16 bg-white/10 rounded animate-pulse"></div>
            </div>
          {/each}
        </div>

        <!-- Wallet Loading Section -->
        <div class="py-2">
          <div class="px-4 py-1.5 text-xs font-medium text-kong-text-secondary uppercase tracking-wider sticky top-0 bg-kong-surface-dark">
            Wallets
          </div>
          {#each Array(2) as _}
            <div class="w-full px-4 py-3 flex items-center gap-4">
              <div class="flex-1">
                <div class="h-5 w-64 bg-white/10 rounded animate-pulse"></div>
                <div class="mt-1 h-4 w-32 bg-white/10 rounded animate-pulse"></div>
              </div>
              <div class="h-6 w-16 bg-white/10 rounded animate-pulse"></div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
