<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { fetchTransactions } from "$lib/api/transactions";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { writable } from "svelte/store";
  import TransactionFeedItem from "./TransactionFeedItem.svelte";
  import { LoadingStateManager } from "$lib/utils/transactionUtils";

  // Props
  let { token } = $props<{ token: Kong.Token }>();

  let previousTokenId = $state<string | null>(null);

  // State
  const tokensStore = writable<Kong.Token[]>([]);
  let transactions = $state<FE.Transaction[]>([]);
  let error = $state<string | null>(null);
  let hasMore = $state(true);
  let currentPage = $state(1);
  let newTransactionIds = $state(new Set<string>());
  let refreshInterval: number;
  let observer: IntersectionObserver;

  const pageSize = 20;
  const loadingManager = new LoadingStateManager();
  const isLoading = $derived(loadingManager.isAnyLoading());

  // Load tokens once on mount
  onMount(async () => {
    try {
      const response = await fetchTokens({ limit: 200, page: 1 });
      tokensStore.set(response.tokens);
    } catch (error) {
      console.error("Error loading tokens:", error);
    }
  });

  // Main transaction loading function
  async function loadTransactions(page = 1, append = false, isRefresh = false) {
    if (!token?.id || (append && !hasMore)) return;

    const loadingKey = isRefresh ? 'refresh' : append ? 'pagination' : 'initial';
    if (loadingManager.isLoading(loadingKey)) return;
    
    loadingManager.setLoading(loadingKey, true);

    try {
      const newTransactions = await fetchTransactions(token.address, page, pageSize);
      const sortedTransactions = newTransactions.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      if (isRefresh) {
        const existingIds = new Set(transactions.map(t => `${t.tx_id}-${t.timestamp}`));
        const uniqueNew = sortedTransactions.filter(tx => 
          !existingIds.has(`${tx.tx_id}-${tx.timestamp}`)
        );
        
        if (uniqueNew.length > 0) {
          transactions = [...uniqueNew, ...transactions];
          // Highlight new transactions temporarily
          uniqueNew.forEach((tx, index) => {
            if (tx.tx_id) {
              const key = `${tx.tx_id}-${tx.timestamp}-${index}`;
              newTransactionIds.add(key);
              setTimeout(() => newTransactionIds.delete(key), 2000);
            }
          });
        }
      } else {
        transactions = append ? [...transactions, ...sortedTransactions] : sortedTransactions;
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

  // React to token changes and set up refresh
  $effect(() => {
    if (!token?.id || previousTokenId === token.id) return;

    previousTokenId = token.id;

    // Reset state for new token
    transactions = [];
    currentPage = 1;
    hasMore = true;
    error = null;
    
    // Load initial data
    loadTransactions(1);

    // Clear existing interval
    if (refreshInterval) clearInterval(refreshInterval);
    
    // Set up refresh interval
    refreshInterval = setInterval(() => {
      if (!loadingManager.isLoading('refresh')) loadTransactions(1, false, true);
    }, 10000) as unknown as number;

    return () => clearInterval(refreshInterval);
  });

  // Intersection observer for pagination
  function setupIntersectionObserver(element: HTMLElement) {
    observer?.disconnect();
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingManager.isLoading('pagination') && hasMore) {
          loadTransactions(currentPage + 1, true);
        }
      },
      { rootMargin: "100px", threshold: 0.1 }
    );
    observer.observe(element);
  }

  onDestroy(() => {
    observer?.disconnect();
    if (refreshInterval) clearInterval(refreshInterval);
  });
</script>

<div class="flex flex-col max-h-[36vh] overflow-hidden bg-kong-bg-secondary border border-kong-border/50 rounded-lg">
  {#if isLoading && !transactions.length}
    <div class="flex justify-center items-center p-6 flex-1">
      <span class="loading loading-spinner loading-md" />
    </div>
  {:else if error}
    <div class="text-kong-error p-6 text-sm font-medium flex-1">
      {error}
    </div>
  {:else if !transactions.length}
    <div class="text-kong-text-primary/70 text-center p-6 flex-1 flex items-center justify-center text-sm">
      No transactions found
    </div>
  {:else}
    <div class="flex flex-col h-full overflow-hidden">
      <!-- Scrollable Container with both X and Y overflow -->
      <div class="flex h-full overflow-auto">
        <table class="w-full">
          <thead class="sticky top-0 bg-kong-bg-secondary border-b border-kong-border shadow-sm z-10">
            <tr>
              {#each ['Age', 'Type', 'Value', token.symbol, 'Trader'] as header, i}
                <th class="py-3 text-left text-xs font-semibold text-kong-text-primary/70 uppercase tracking-wider whitespace-nowrap px-4 {i === 4 ? 'w-[80px]' : ''}">
                  {header}
                </th>
              {/each}
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
    </div>

    {#if hasMore}
             <div
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
  {/if}
</div>

<style>
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

  table {
    border-collapse: separate;
    border-spacing: 0;
    table-layout: auto;
  }
  
  /* Ensure smooth horizontal scrolling */
  .overflow-auto {
    scrollbar-width: thin;
    scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
  }
</style>
