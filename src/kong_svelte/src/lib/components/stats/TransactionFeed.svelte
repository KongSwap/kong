<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { fetchTransactions } from "$lib/api/transactions";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { writable } from "svelte/store";
  import TransactionFeedItem from "./TransactionFeedItem.svelte";
  import { LoadingStateManager } from "$lib/utils/transactionUtils";

  // Props
  let { token, className = "!border-none !rounded-t-none" } = $props<{
    token: Kong.Token;
    className?: string;
  }>();

  // Stores and state
  const tokensStore = writable<Kong.Token[]>([]);
  let transactions = $state<FE.Transaction[]>([]);
  let error = $state<string | null>(null);
  let hasMore = $state(true);
  let currentPage = $state(1);
  let newTransactionIds = $state<Set<string>>(new Set());
  let previousTokenId = $state<string | null>(null);
  let refreshInterval: number;
  let observer: IntersectionObserver;
  let loadMoreTrigger: HTMLElement;

  const pageSize = 20;
  const loadingManager = new LoadingStateManager();
  let isLoading = $derived(loadingManager.isAnyLoading());

  // Load tokens on mount
  async function loadTokens() {
    try {
      const response = await fetchTokens({ limit: 200, page: 1 });
      tokensStore.set(response.tokens);
    } catch (error) {
      console.error("Error loading tokens:", error);
    }
  }

  // Simplified transaction loading
  async function loadTransactionData(page = 1, append = false, isRefresh = false) {
    if (!token?.id) return;
    if (append && !hasMore) return;

    const loadingKey = isRefresh ? 'refresh' : append ? 'pagination' : 'initial';
    
    if (loadingManager.isLoading(loadingKey)) return;
    
    loadingManager.setLoading(loadingKey, true);

    try {
      const newTransactions = await fetchTransactions(token.address, page, pageSize);
      const sortedTransactions = newTransactions.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      if (isRefresh) {
        // Find unique new transactions for refresh
        const existingIds = new Set(transactions.map(t => `${t.tx_id}-${t.timestamp}`));
        const uniqueNew = sortedTransactions.filter(tx => 
          !existingIds.has(`${tx.tx_id}-${tx.timestamp}`)
        );
        
        if (uniqueNew.length > 0) {
          transactions = [...uniqueNew, ...transactions];
          // Highlight new transactions
          uniqueNew.forEach((tx, index) => {
            if (tx.tx_id) {
              const key = `${tx.tx_id}-${tx.timestamp}-${index}`;
              newTransactionIds.add(key);
              newTransactionIds = new Set(newTransactionIds);
              // Clear highlight after 2 seconds
              setTimeout(() => {
                newTransactionIds.delete(key);
                newTransactionIds = new Set(newTransactionIds);
              }, 2000);
            }
          });
        }
      } else if (append) {
        transactions = [...transactions, ...sortedTransactions];
      } else {
        transactions = sortedTransactions;
      }

      hasMore = newTransactions.length === pageSize;
      currentPage = page;
      error = null;
    } catch (err) {
      console.error("Transaction fetch error:", err);
      error = err instanceof Error ? err.message : "Failed to load transactions";
    } finally {
      loadingManager.setLoading(loadingKey, false);
    }
  }

  // Token change and refresh effect
  $effect(() => {
    const currentTokenId = token?.id;
    
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    if (currentTokenId) {
      // Handle token change
      if (currentTokenId !== previousTokenId) {
        previousTokenId = currentTokenId;
        transactions = [];
        currentPage = 1;
        hasMore = true;
        error = null;
        loadTransactionData(1, false, false);
      }

      // Set up refresh interval
      refreshInterval = setInterval(() => {
        if (!loadingManager.isLoading('refresh')) {
          loadTransactionData(1, false, true);
        }
      }, 10000) as unknown as number;
    }

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  });

  // Intersection observer for pagination
  function setupIntersectionObserver(element: HTMLElement) {
    if (observer) observer.disconnect();

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingManager.isLoading('pagination') && hasMore) {
          loadTransactionData(currentPage + 1, true);
        }
      },
      { root: null, rootMargin: "100px", threshold: 0.1 }
    );

    observer.observe(element);
  }

  onMount(() => {
    loadTokens();
  });

  onDestroy(() => {
    if (observer) observer.disconnect();
    if (refreshInterval) clearInterval(refreshInterval);
  });
</script>

<Panel type="main" {className}>
  <div class="flex flex-col gap-4 h-full">
    {#if isLoading && !transactions.length}
      <div class="flex justify-center items-center p-6 flex-1">
        <span class="loading loading-spinner loading-md" />
      </div>
    {:else if error}
      <div class="text-kong-error p-6 text-sm font-medium flex-1">
        {error}
      </div>
    {:else if transactions.length === 0}
      <div class="text-kong-text-primary/70 text-center p-6 flex-1 flex items-center justify-center text-sm">
        No transactions found
      </div>
    {:else}
      <div class="flex-1 overflow-auto">
        <div class="min-w-max h-[400px] overflow-auto">
          <table class="w-full">
            <thead class="sticky top-0 bg-kong-bg-primary/95 backdrop-blur-sm border-b border-kong-border/20">
              <tr>
                <th class="px-2 py-3 text-left text-xs font-semibold text-kong-text-primary/70 uppercase tracking-wider">
                  Age
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-kong-text-primary/70 uppercase tracking-wider">
                  Type
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-kong-text-primary/70 uppercase tracking-wider">
                  Price
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-kong-text-primary/70 uppercase tracking-wider">
                  Value
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-kong-text-primary/70 uppercase tracking-wider">
                  {token.symbol}
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-kong-text-primary/70 uppercase tracking-wider w-[80px]">
                  Trader
                </th>
                <th class="px-4 py-3 w-20"></th> <!-- Actions column without header -->
              </tr>
            </thead>
            <tbody>
              {#each transactions as tx, index (tx.tx_id ? `${tx.tx_id}-${tx.timestamp}-${index}` : crypto?.randomUUID())}
                <TransactionFeedItem
                  {tx}
                  {token}
                  tokens={$tokensStore}
                  isHighlighted={newTransactionIds.has(tx.tx_id ? `${tx.tx_id}-${tx.timestamp}-${index}` : "")}
                />
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Load More Trigger -->
        {#if hasMore}
          <div
            bind:this={loadMoreTrigger}
            use:setupIntersectionObserver
            class="flex justify-center p-4 border-t border-kong-border/10"
          >
            {#if loadingManager.isLoading('pagination')}
              <span class="loading loading-spinner loading-sm" />
            {:else}
              <span class="text-kong-text-primary/50 text-xs uppercase tracking-wider font-medium">
                Load more
              </span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</Panel>

<style>
  /* Custom scrollbar styling */
  :global(.overflow-auto::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }

  :global(.overflow-auto::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(.overflow-auto::-webkit-scrollbar-thumb) {
    background-color: rgba(156, 163, 175, 0.3);
    border-radius: 3px;
  }

  :global(.overflow-auto::-webkit-scrollbar-thumb:hover) {
    background-color: rgba(156, 163, 175, 0.5);
  }

  :global(.overflow-auto::-webkit-scrollbar-corner) {
    background: transparent;
  }

  /* Table styling */
  table {
    border-collapse: separate;
    border-spacing: 0;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 10;
  }
</style>
