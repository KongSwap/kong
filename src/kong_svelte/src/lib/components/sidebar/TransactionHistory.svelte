<script lang="ts">
  import { auth } from "$lib/services/auth";
  import { TokenService } from "$lib/services/tokens";
  import { ArrowRightLeft, Plus, Minus, Loader2 } from "lucide-svelte";
  import { onMount, onDestroy } from "svelte";
  import { formatDate } from "$lib/utils/dateUtils";
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { writable, derived } from "svelte/store";
  import { fetchTokens } from '$lib/api/tokens';

  // Create a store for tokens
  const tokensStore = writable<FE.Token[]>([]);
  
  // Function to load tokens
  async function loadTokens() {
    try {
      const response = await fetchTokens({
        limit: 500,
        page: 1
      });
      tokensStore.set(response.tokens);
      
      // Subscribe to store changes
      const unsubscribe = tokensStore.subscribe(value => {
        console.log('TokensStore updated:', value.length);
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  }

  onMount(async () => {
    // Add debug logging for tokens
    const unsubscribe = tokensStore.subscribe(tokens => {
        console.log('TokensStore updated:', tokens.length);
    });

    const resizeObserver = new ResizeObserver(
        debounce((entries: ResizeObserverEntry[]) => {
            const entry = entries[0];
            if (entry) {
                containerHeightStore.set(entry.contentRect.height);
            }
        }, 100)
    );

    if (listContainer) {
        resizeObserver.observe(listContainer);
        await loadTokens(); // Make sure tokens are loaded
        loadTransactions(false);
    }

    return () => {
        unsubscribe();
        resizeObserver.disconnect();
        observer?.disconnect();
        processedTransactionsCache.clear();
    };
  });

  let isLoading = false;
  let error: string | null = null;
  let transactions: any[] = [];
  let hasMore = true;
  let currentCursor: number | undefined;
  let loadingMore = false;
  let observer: IntersectionObserver;
  let loadMoreTrigger: HTMLDivElement;
  let listContainer: HTMLDivElement;

  // Constants for virtual scrolling
  const ITEM_HEIGHT = 56; // 48px height + 8px margin bottom
  const BUFFER_SIZE = 5; // Number of items to render above/below viewport
  const PAGE_SIZE = 25;

  type FilterType = 'swap' | 'pool';
  let selectedFilter: FilterType = "swap";
  const filterOptions = [
    { id: "swap" as const, label: "Swap" },
    { id: "pool" as const, label: "Pool" },
  ];

  // Create stores for better state management
  const transactionStore = writable<any[]>([]);
  const filterStore = writable<FilterType>("swap");
  const cursorStore = writable<number | undefined>(undefined);
  const loadingStore = writable(false);
  const loadingMoreStore = writable(false);
  const hasMoreStore = writable(true);
  const errorStore = writable<string | null>(null);
  const scrollYStore = writable(0);
  const containerHeightStore = writable(0);

  // Derived store for visible transactions
  const visibleTransactionsStore = derived(
    [transactionStore, scrollYStore, containerHeightStore],
    ([$transactions, $scrollY, $containerHeight]) => {
      const start = Math.max(0, Math.floor($scrollY / ITEM_HEIGHT) - BUFFER_SIZE);
      const end = Math.min(
        $transactions.length,
        Math.ceil(($scrollY + ($containerHeight || 0)) / ITEM_HEIGHT) + BUFFER_SIZE
      );
      return {
        transactions: $transactions.slice(start, end),
        start,
        totalHeight: $transactions.length * ITEM_HEIGHT,
        translateY: start * ITEM_HEIGHT
      };
    }
  );

  // Subscribe to stores for template use
  $: visible = $visibleTransactionsStore;
  $: isLoading = $loadingStore;
  $: loadingMore = $loadingMoreStore;
  $: hasMore = $hasMoreStore;
  $: error = $errorStore;
  $: transactions = $transactionStore;
  $: selectedFilter = $filterStore;
  $: currentCursor = $cursorStore;

  // Debounced scroll handler
  let scrollTimeout: ReturnType<typeof setTimeout>;
  function handleScroll(e: Event) {
    const target = e.target as HTMLDivElement;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      scrollYStore.set(target.scrollTop);
      
      // Check if we're near the bottom for infinite scroll
      const threshold = 100;
      const bottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
      
      if (bottom && $hasMoreStore && !$loadingMoreStore && !$loadingStore) {
        loadTransactions(true);
      }
    }, 16); // ~60fps
  }

  onDestroy(() => {
    clearTimeout(scrollTimeout);
  });

  // Memoize transaction processing
  const processedTransactionsCache = new Map<string, any>();
  function formatAmount(amount: number | string): string {
    if (typeof amount === 'string') {
      // Try to parse the string as a number
      amount = parseFloat(amount);
    }
    
    if (isNaN(amount)) return '0';
    
    // Convert to string without scientific notation
    const str = amount.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 20 });
    
    // Remove trailing zeros after decimal point
    if (str.includes('.')) {
      return str.replace(/\.?0+$/, '');
    }
    return str;
  }

  function processTransaction(tx: any) {
    const cacheKey = `${tx.tx_id}-${tx.tx_type}-${tx.status}`;
    if (processedTransactionsCache.has(cacheKey)) {
        return processedTransactionsCache.get(cacheKey);
    }

    if (!tx?.tx_type) {
        console.log('Missing tx_type:', tx);
        return null;
    }

    const { tx_type, status, timestamp, details } = tx;
    
    // Convert nanosecond timestamp to milliseconds for Date
    const dateInMs = Math.floor(Number(timestamp) / 1_000_000);
    const formattedDate = formatDate(new Date(dateInMs));
    
    let result;
    if (tx_type === 'swap') {
        result = {
            type: "Swap",
            status,
            formattedDate,
            details: {
                ...details,
                pay_amount: formatAmount(details.pay_amount),
                receive_amount: formatAmount(details.receive_amount),
                price: formatAmount(details.price)
            },
            tx_id: tx.tx_id
        };
    } else if (tx_type === 'add_liquidity' || tx_type === 'remove_liquidity' || tx_type === 'pool') {
        const type = tx_type === 'add_liquidity' ? "Add Liquidity" : 
                    tx_type === 'remove_liquidity' ? "Remove Liquidity" : 
                    details?.type === 'add' ? "Add Liquidity" : "Remove Liquidity";
        result = {
            type,
            status,
            formattedDate,
            details: {
                ...details,
                amount_0: formatAmount(details.amount_0),
                amount_1: formatAmount(details.amount_1),
                lp_token_amount: formatAmount(details.lp_token_amount)
            },
            tx_id: tx.tx_id
        };
    } else {
        console.log('Unknown transaction type:', tx_type);
        return null;
    }

    processedTransactionsCache.set(cacheKey, result);
    return result;
  }

  // Clear cache when filter changes
  function handleFilterChange(newFilter: FilterType) {
    filterStore.set(newFilter);
    cursorStore.set(undefined);
    processedTransactionsCache.clear();
    loadTransactions(false);
  }

  async function loadTransactions(loadMore = false) {
    if (!$auth.isConnected) {
        transactionStore.set([]);
        return;
    }

    if (!loadMore) {
        loadingStore.set(true);
        cursorStore.set(undefined);
        transactionStore.set([]);
        hasMoreStore.set(true);
    } else {
        if ($loadingMoreStore || !$hasMoreStore) return;
        loadingMoreStore.set(true);
    }

    try {
        const txType = $filterStore;

        const principal = $auth.account?.owner?.toString();
        if (!principal) {
            throw new Error('No principal ID available');
        }
        
        const response = await TokenService.fetchUserTransactions(
            principal,
            $cursorStore,
            PAGE_SIZE,
            txType
        );

        if (response.transactions) {
            const newTransactions = response.transactions
                .map(processTransaction)
                .filter(Boolean);


            if (loadMore) {
                transactionStore.update(txs => [...txs, ...newTransactions]);
            } else {
                transactionStore.set(newTransactions);
            }

            hasMoreStore.set(response.has_more);
            if (response.next_cursor) {
                cursorStore.set(response.next_cursor);
            } else {
                hasMoreStore.set(false);
                console.log('No next cursor, setting hasMore to false');
            }
        } else {
            errorStore.set("No transactions data received");
            hasMoreStore.set(false);
        }
    } catch (err) {
        console.error("Error fetching transactions:", err);
        errorStore.set(err.message || "Failed to load transactions");
        transactionStore.set([]);
        hasMoreStore.set(false);
    } finally {
        loadingStore.set(false);
        loadingMoreStore.set(false);
    }
  }

  // Debounce helper
  function debounce<T extends (...args: any[]) => any>(
    fn: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  let selectedTransaction: any = null;
  let isModalOpen = false;

  function handleTransactionClick(tx: any) {
    selectedTransaction = tx;
    isModalOpen = true;
  }

  function getTransactionIcon(type: string) {
    switch (type) {
      case "Swap":
        return ArrowRightLeft;
      case "Add Liquidity":
        return Plus;
      case "Remove Liquidity":
        return Minus;
      default:
        return ArrowRightLeft;
    }
  }
</script>

<Modal
  isOpen={isModalOpen}
  variant="transparent"
  onClose={() => isModalOpen = false}
  title="Transaction Details"
  width="400px"
  height="auto"
>
  {#if selectedTransaction}
    <div class="p-4 space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Type</span>
        <span class="text-sm font-medium">{selectedTransaction.type}</span>
      </div>
      
      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Status</span>
        <span class="text-xs px-2 py-1 rounded-full {selectedTransaction.status === 'Success' ? 'bg-kong-accent-green/10 text-kong-text-accent-green' : 'bg-kong-accent-red/10 text-kong-accent-red'}">
          {selectedTransaction.status}
        </span>
      </div>
      
      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Date</span>
        <span class="text-sm">{selectedTransaction.formattedDate}</span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm text-kong-text-secondary">Transaction ID</span>
        <span class="text-sm font-mono">{selectedTransaction.tx_id}</span>
      </div>

      <div class="space-y-2">
        <div class="text-sm text-kong-text-secondary mb-2">Transaction Details</div>
        {#if selectedTransaction.type === "Swap"}
          <div class="bg-kong-bg-dark/30 p-3 rounded-lg space-y-3">
            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">From</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages 
                    tokens={[$tokensStore.find(token => token.canister_id === selectedTransaction.details.pay_token_canister)]} 
                    size={22}
                  />
                  <span class="text-sm font-medium">{selectedTransaction.details.pay_amount} {selectedTransaction.details.pay_token_symbol}</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono">{selectedTransaction.details.pay_token_id}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono">{selectedTransaction.details.pay_token_canister}</span>
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">To</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages 
                    tokens={[$tokensStore.find(token => token.canister_id === selectedTransaction.details.receive_token_canister)]} 
                    size={22}
                  />
                  <span class="text-sm font-medium">{selectedTransaction.details.receive_amount} {selectedTransaction.details.receive_token_symbol}</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono">{selectedTransaction.details.receive_token_id}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono">{selectedTransaction.details.receive_token_canister}</span>
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Price</span>
                <span class="text-xs">{selectedTransaction.details.price}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Slippage</span>
                <span class="text-xs">{selectedTransaction.details.slippage}%</span>
              </div>
            </div>
          </div>
        {:else}
          <div class="bg-kong-bg-dark/30 p-3 rounded-lg space-y-3">
            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">Token 1</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages 
                    tokens={[$tokensStore.find(token => token.canister_id === selectedTransaction.details.token_0_canister)]} 
                    size={22}
                  />
                  <span class="text-sm font-medium">{selectedTransaction.details.amount_0} {selectedTransaction.details.token_0_symbol}</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono">{selectedTransaction.details.token_0_id}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono">{selectedTransaction.details.token_0_canister}</span>
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="text-xs text-kong-text-secondary">Token 2</div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <TokenImages 
                    tokens={[$tokensStore.find(token => token.canister_id === selectedTransaction.details.token_1_canister)]} 
                    size={22}
                  />
                  <span class="text-sm font-medium">{selectedTransaction.details.amount_1} {selectedTransaction.details.token_1_symbol}</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token ID</span>
                <span class="text-xs font-mono">{selectedTransaction.details.token_1_id}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister</span>
                <span class="text-xs font-mono">{selectedTransaction.details.token_1_canister}</span>
              </div>
            </div>

            <div class="border-t border-kong-border my-2"></div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">LP Token</span>
                <span class="text-xs">{selectedTransaction.details.lp_token_symbol}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">LP Amount</span>
                <span class="text-xs">{selectedTransaction.details.lp_token_amount}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Pool ID</span>
                <span class="text-xs">{selectedTransaction.details.pool_id}</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</Modal>

<div class="flex flex-col min-h-[90dvh] px-2">
  <!-- Filter Navigation -->
  <nav class="flex rounded-t-lg bg-kong-bg-dark/50 mt-2 w-full">
    {#each filterOptions as option, index}
      <button
        class="tab-button flex-1 relative"
        class:active={$filterStore === option.id}
        on:click={() => handleFilterChange(option.id)}
        role="tab"
        aria-selected={$filterStore === option.id}
        aria-controls={`${option.id}-panel`}
      >
        <div class="flex items-center justify-center gap-1.5 py-2.5">
          {#if $filterStore === option.id}
            <div class="absolute inset-0 bg-kong-accent-blue/5 {index === 0 ? 'rounded-tl-lg' : ''} {index === filterOptions.length - 1 ? 'rounded-tr-lg' : ''}" />
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-kong-accent-blue" />
          {/if}
          <span class="relative z-10 text-xs font-medium">
            {option.label}
          </span>
        </div>
      </button>
    {/each}
  </nav>

  <!-- Transaction List -->
  <div 
    class="flex-1 overflow-y-auto pt-2 mb-4 scrollbar-custom rounded-b-lg"
    bind:this={listContainer}
    on:scroll={handleScroll}
  >
    {#if isLoading && !loadingMore}
      <div class="flex justify-center items-center h-32">
        <Loader2 class="w-6 h-6 animate-spin text-kong-text-secondary" />
      </div>
    {:else if error}
      <div class="text-kong-accent-red text-sm text-center py-4">
        {error}
      </div>
    {:else if transactions.length === 0}
      <div class="text-kong-text-secondary text-sm text-center py-4">
        No transactions found
      </div>
    {:else}
      <div class="relative" style="height: {visible.totalHeight}px">
        <div class="absolute w-full" style="transform: translateY({visible.translateY}px)">
          {#each visible.transactions as tx, i (tx.tx_id)}
            <div 
              class="mb-2 sm:px-3 h-12 rounded-lg hover:bg-kong-bg-dark/40 border border-kong-border-light hover:border-kong-primary/70 transition-all duration-100 flex items-center cursor-pointer"
              on:click={() => handleTransactionClick(tx)}
            >
              <div class="p-1.5 rounded-full bg-kong-bg-dark/50 mr-2 sm:mr-3 shrink-0">
                <svelte:component 
                  this={getTransactionIcon(tx.type)} 
                  class="w-3.5 h-3.5 text-kong-text-primary"
                />
              </div>

              <div class="flex-1 min-w-0">
                {#if tx.type === "Swap"}
                  <div class="flex items-center gap-1 text-[11px] sm:text-xs text-kong-text-secondary truncate">
                    <span>{tx.details.pay_amount} {tx.details.pay_token_symbol}</span>
                    <ArrowRightLeft class="w-3 h-3 shrink-0" />
                    <span>{tx.details.receive_amount} {tx.details.receive_token_symbol}</span>
                  </div>
                {:else}
                  <div class="flex items-center gap-1 text-[11px] sm:text-xs text-kong-text-secondary truncate">
                    <span>{tx.details.amount_0} {tx.details.token_0_symbol}</span>
                    <span class="shrink-0">+</span>
                    <span>{tx.details.amount_1} {tx.details.token_1_symbol}</span>
                  </div>
                {/if}
              </div>

              <div class="ml-2 sm:ml-3 flex items-center gap-1 sm:gap-2 shrink-0">
                <span class="hidden sm:inline text-xs text-kong-text-secondary">{tx.formattedDate}</span>
                <span 
                  class="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full shrink-0 min-w-[52px] text-center {tx.status === 'Success' ? 'bg-kong-accent-green/10 text-kong-text-accent-green' : 'bg-kong-accent-red/10 text-kong-accent-red'}"
                >
                  {tx.status}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      {#if loadingMore}
        <div class="flex justify-center py-4">
          <Loader2 class="w-5 h-5 animate-spin text-kong-text-secondary" />
        </div>
      {/if}

      {#if !hasMore && transactions.length > 0}
        <div class="text-center py-4 text-xs text-kong-text-secondary">
          No more transactions
        </div>
      {/if}

      <div bind:this={loadMoreTrigger} class="h-px" />
    {/if}
  </div>
</div>