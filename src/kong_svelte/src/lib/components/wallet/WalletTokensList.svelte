<script lang="ts">
	import { formatToNonZeroDecimal, formatBalance } from '$lib/utils/numberFormatUtils';
  import { Coins, Loader2, RefreshCw } from "lucide-svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import TokenDropdown from "./TokenDropdown.svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import { currentUserBalancesStore, loadBalances } from "$lib/stores/balancesStore";

  // Define props using the $props syntax
  type TokenBalance = {
    symbol: string;
    name: string;
    balance: string;
    usdValue: number;
    icon: string;
    change24h: number;
    token: FE.Token;
  };

  type WalletTokensListProps = {
    isLoading?: boolean;
    walletId?: string;
    forceRefresh?: boolean;
    // Optional pre-processed token balances (for backward compatibility)
    tokenBalances?: TokenBalance[];
    // Callback props instead of event dispatchers
    onAction?: (action: 'send' | 'receive' | 'swap' | 'info', token: TokenBalance) => void;
    onRefresh?: () => void;
    onTokenAdded?: (token: FE.Token) => void;
    onBalancesLoaded?: () => void;
  };

  let { 
    isLoading = false,
    walletId = "",
    forceRefresh = false,
    tokenBalances = [],
    onAction = () => {},
    onRefresh = () => {},
    onTokenAdded = () => {},
    onBalancesLoaded = () => {}
  }: WalletTokensListProps = $props();

  // Process tokens with balance information when we need to do it internally
  const processedTokenBalances = $derived(
    // If tokenBalances were provided, use them (backward compatibility)
    tokenBalances.length > 0 ? tokenBalances : 
    // Otherwise process them internally
    $userTokens.tokens.map((token) => {
      const balanceInfo = $currentUserBalancesStore?.[token.canister_id] || {
        in_tokens: 0n,
        in_usd: "0",
      };

      return {
        symbol: token.symbol,
        name: token.name,
        balance: formatBalance(balanceInfo.in_tokens, token.decimals || 0),
        usdValue: Number(balanceInfo.in_usd),
        icon: token.logo_url || "",
        change24h: token.metrics?.price_change_24h
          ? parseFloat(token.metrics.price_change_24h)
          : 0,
        token: token, // Store the original token object for TokenImages
      };
    })
    .sort((a, b) => b.usdValue - a.usdValue) // Sort by value, highest first
  );

  let isLoadingBalances = $state(false);
  let balanceLoadError = $state<string | null>(null);
  let lastRefreshed = $state(Date.now());

  // Load user balances function
  async function loadUserBalances(forceRefresh = false) {
    if (!walletId || $userTokens.tokens.length === 0) return;

    balanceLoadError = null;
    isLoadingBalances = true;
    
    try {
      // First try to get stored balances for immediate UI display
      $currentUserBalancesStore[walletId];

      // Only refresh if forced or if we don't have recent data
      const needsRefresh =
        forceRefresh ||
        Object.keys($currentUserBalancesStore || {}).length === 0 ||
        Date.now() - lastRefreshed > 60000; // 1 minute

      if (needsRefresh) {
        await loadBalances($userTokens.tokens, walletId, true);
        lastRefreshed = Date.now();
        onBalancesLoaded();
      }
    } catch (err) {
      console.error("Error loading balances:", err);
      balanceLoadError =
        err instanceof Error ? err.message : "Failed to load balances";
    } finally {
      isLoadingBalances = false;
    }
  }

  // Format currency with 2 decimal places
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  // For dropdown - use $state for proper reactivity in Svelte 5
  let selectedToken = $state<TokenBalance | null>(null);
  let dropdownPosition = $state({ top: 0, left: 0, width: 0 });
  let showDropdown = $state(false);
  
  // Handle token click to show dropdown
  function handleTokenClick(event: MouseEvent, token: TokenBalance) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    dropdownPosition = {
      top: rect.bottom,
      left: rect.left,
      width: rect.width
    };
    
    selectedToken = token;
    showDropdown = true;
  }
  
  // Close the dropdown
  function closeDropdown() {
    showDropdown = false;
  }
  
  // Handle dropdown action selection
  function handleDropdownAction(action: 'send' | 'receive' | 'swap' | 'info') {
    if (selectedToken) {
      onAction(action, selectedToken);
    }
    closeDropdown();
  }

  // Handle refresh button click
  function handleRefresh() {
    if (walletId) {
      loadUserBalances(true);
    }
    onRefresh();
  }

  // Effect to load balances when walletId changes or on forceRefresh
  $effect(() => {
    if (walletId) {
      // Always load balances on initial component mount or when explicitly requested
      loadUserBalances(forceRefresh);
    }
  });
</script>

<div class="py-2">
  <div class="flex items-center justify-between mb-3 px-4">
    {#if isLoading || isLoadingBalances}
      <div class="text-xs text-kong-text-secondary flex items-center gap-1.5">
        <Loader2 size={12} class="animate-spin" />
        <span>Refreshing balances...</span>
      </div>
    {:else}
      <div class="text-xs text-kong-text-secondary">
        {processedTokenBalances.length} token{processedTokenBalances.length !== 1 ? 's' : ''}
      </div>
    {/if}
    
    <button 
      class="text-xs text-kong-text-secondary/70 hover:text-kong-primary px-2 py-1 rounded flex items-center gap-1.5 hover:bg-kong-bg-light/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      on:click={handleRefresh}
      disabled={isLoading || isLoadingBalances}
    >
      <RefreshCw size={12} class={isLoading || isLoadingBalances ? 'animate-spin' : ''} />
      <span>Refresh</span>
    </button>
  </div>

  {#if balanceLoadError}
    <div class="text-xs text-kong-accent-red mt-1 px-4 mb-2">
      Error: {balanceLoadError}
    </div>
  {/if}

  {#if processedTokenBalances.length === 0}
    <div class="py-10 text-center">
      <div
        class="p-5 rounded-full bg-kong-text-primary/5 inline-block mb-3 mx-auto"
        style="box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.03);"
      >
        <Coins size={24} class="text-kong-primary/40" />
      </div>
      <p class="text-base font-medium text-kong-text-primary">
        {isLoading || isLoadingBalances ? "Loading balances..." : "No Tokens Found"}
      </p>
      <p class="text-sm text-kong-text-secondary/70 mt-1 max-w-[280px] mx-auto">
        {isLoading || isLoadingBalances
          ? "Please wait while we fetch your token balances."
          : "You may not have any tokens yet or need to connect your wallet."}
      </p>
    </div>
  {:else}
    <div class="space-y-0">
      {#each processedTokenBalances as tokenBalance}
        <div
          class="px-4 py-3.5 bg-kong-bg-light/5 border-b border-kong-border/30 hover:bg-kong-bg-light/10 transition-colors cursor-pointer relative"
          on:click={(e) => handleTokenClick(e, tokenBalance)}
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              {#if tokenBalance.token}
                <div class="flex-shrink-0">
                  <TokenImages
                    tokens={[tokenBalance.token]}
                    size={36}
                    showSymbolFallback={true}
                    tooltip={{
                      text: tokenBalance.name,
                      direction: "top",
                    }}
                  />
                </div>
              {:else}
                <div
                  class="w-9 h-9 rounded-full bg-kong-text-primary/10 flex items-center justify-center border border-kong-border flex-shrink-0"
                >
                  <span class="text-xs font-bold text-kong-primary"
                    >{tokenBalance.symbol}</span
                  >
                </div>
              {/if}
              <div class="flex flex-col justify-center">
                <div class="font-medium text-kong-text-primary text-sm leading-tight">
                  {tokenBalance.name}
                </div>
                <div class="text-xs text-kong-text-secondary mt-1 leading-tight">
                  {#if Number(tokenBalance.balance) > 0 && Number(tokenBalance.balance) < 0.00001}
                    <span title={tokenBalance.balance.toString()}>~0.00001</span> {tokenBalance.symbol}
                  {:else}
                    {tokenBalance.balance} {tokenBalance.symbol}
                  {/if}
                </div>
              </div>
            </div>

            <div class="text-right flex flex-col justify-center">
              <div class="font-medium text-kong-text-primary text-sm leading-tight">
                {formatCurrency(tokenBalance.usdValue)}
              </div>
              <div
                class="text-xs {tokenBalance.change24h >= 0
                  ? 'text-kong-accent-green'
                  : 'text-kong-accent-red'} font-medium mt-1 leading-tight"
              >
                {Number(formatToNonZeroDecimal(tokenBalance.change24h)) >= 0
                  ? "+"
                  : ""}{formatToNonZeroDecimal(tokenBalance.change24h)}%
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
  
  <!-- Token Dropdown -->
  {#if selectedToken && showDropdown}
    <div class="fixed inset-0 z-20 pointer-events-none">
      <div class="absolute inset-0 bg-black/20 pointer-events-auto" on:click={closeDropdown}></div>
      <div class="pointer-events-auto">
        <TokenDropdown 
          token={selectedToken} 
          position={dropdownPosition}
          visible={showDropdown}
          onClose={closeDropdown}
          onAction={handleDropdownAction}
        />
      </div>
    </div>
  {/if}
</div>
