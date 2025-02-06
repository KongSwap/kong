<script lang="ts">
  import { page } from "$app/stores";
  import { onDestroy, onMount } from "svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { fetchTransactions } from "$lib/services/transactions";
  import TransactionRow from "./TransactionRow.svelte";
  import { fetchTokens } from '$lib/api/tokens';
  import { writable } from 'svelte/store';
  import { browser } from "$app/environment";
  
  // Create a store for tokens
  const tokensStore = writable<FE.Token[]>([]);
  
  // Function to load tokens
  async function loadTokens() {
    try {
      console.log('Fetching tokens...');
      const response = await fetchTokens({
        limit: 200,
        page: 1
      });
      tokensStore.set(response.tokens);
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  }

  onMount(() => {
    loadTokens();
  });

  let mobile = $derived(browser ? window.innerWidth < 768 : false);

  // Declare our state variables
  let { token, className = "" } = $props<{
    token: FE.Token;
    className?: string;
  }>();
  let transactions = $state<FE.Transaction[]>([]);
  let isLoadingTxns = $state(false);
  let error = $state<string | null>(null);
  const tokenAddress = $page.params.id;
  let refreshInterval: number;
  let newTransactionIds = $state<Set<string>>(new Set());

  // Add separate locks for different types of requests
  let isRefreshActive = $state(false);
  let isInitialLoadActive = $state(false);
  let isPaginationActive = $state(false);

  // Add an AbortController to cancel pending requests
  let currentAbortController: AbortController | null = $state(null);

  // Add debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | null = $state(null);

  // Remove the separate token tracking effects and consolidate them
  let previousTokenId = $state<string | null>(null);

  // Single effect to handle token changes and refresh
  $effect(() => {
    const currentTokenId = token?.token_id;
    
    // Clear any existing intervals
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = undefined;
    }

    if (currentTokenId) {
        // Handle token change
        if (currentTokenId !== previousTokenId) {
            previousTokenId = currentTokenId;
            // Reset states
            transactions = [];
            currentPage = 1;
            hasMore = true;
            error = null;
            // Initial load
            loadTransactionData(1, false, false);
        }

        // Set up refresh interval regardless of token change
        refreshInterval = setInterval(() => {
            if (!isRefreshActive) {  // Only refresh if not already refreshing
                loadTransactionData(1, false, true).catch((err) => {
                    console.error("Error in refresh interval:", err);
                });
            }
        }, 10000) as unknown as number;
    }

    // Cleanup
    return () => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = undefined;
        }
    };
  });

  // Function to clear transaction highlight after animation
  const clearTransactionHighlight = (tx: FE.Transaction, index: number) => {
    setTimeout(() => {
      const key = tx.tx_id ? `${tx.tx_id}-${tx.timestamp}-${index}` : null;
      if (key) {
        newTransactionIds.delete(key);
        newTransactionIds = new Set(newTransactionIds);
      }
    }, 2000);
  };

  // Update fetch function with debouncing and better lock handling
  const loadTransactionData = async (
    page: number = 1,
    append: boolean = false,
    isRefresh: boolean = false,
  ) => {
    // Don't start a new request if token has changed
    if (token?.token_id !== previousTokenId) {
      return;
    }

    // Clear any pending debounce timer
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    // Debounce the request
    return new Promise<void>((resolve) => {
        debounceTimer = setTimeout(async () => {
            try {
                // Check appropriate lock based on request type
                if (isRefresh && isRefreshActive) {
                    console.log("Refresh already in progress, skipping");
                    return;
                }
                if (!isRefresh && !append && isInitialLoadActive) {
                    console.log("Initial load already in progress, skipping");
                    return;
                }
                if (append && isPaginationActive) {
                    console.log("Pagination already in progress, skipping");
                    return;
                }

                // Set appropriate lock
                if (isRefresh) {
                    isRefreshActive = true;
                } else if (append) {
                    isPaginationActive = true;
                } else {
                    isInitialLoadActive = true;
                }

                // Cancel any pending request
                if (currentAbortController) {
                    currentAbortController.abort();
                }
                currentAbortController = new AbortController();

                try {
                    if (!token?.token_id) {
                        console.log("No token ID available, skipping transaction load");
                        return;
                    }

                    if (!hasMore && append) {
                        console.log("No more transactions to load");
                        return;
                    }

                    // Set UI loading state
                    if (append) {
                        isLoadingMore = true;
                    } else if (!isRefresh) {
                        isLoadingTxns = true;
                    }

                    const newTransactions = await fetchTransactions(
                        token.canister_id,
                        page,
                        pageSize,
                        { signal: currentAbortController.signal }
                    );

                    // If request was aborted, exit early
                    if (currentAbortController?.signal.aborted) {
                        return;
                    }

                    // Ensure transactions are sorted descending by timestamp before processing
                    const sortedTransactions = newTransactions.sort((a, b) => 
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );

                    if (isRefresh) {
                        // Create a map of existing transactions for better duplicate detection
                        const existingTransactions = new Map(
                            transactions.map(t => [
                                t.tx_id ? `${t.tx_id}-${t.timestamp}` : null,
                                t
                            ])
                        );
                        
                        // Filter out any transactions that already exist
                        const uniqueNewTransactions = sortedTransactions.filter(tx => {
                            const key = tx.tx_id ? `${tx.tx_id}-${tx.timestamp}` : null;
                            if (!key) return false;
                            
                            const existing = existingTransactions.get(key);
                            if (!existing) return true;
                            
                            // If timestamps match exactly, it's definitely a duplicate
                            return tx.timestamp !== existing.timestamp;
                        });
                        
                        console.log('New unique transactions:', uniqueNewTransactions.length);

                        if (uniqueNewTransactions.length > 0) {
                            // Prepend new transactions while maintaining sort order
                            transactions = [...uniqueNewTransactions, ...transactions];
                            
                            // Highlight new transactions
                            uniqueNewTransactions.forEach((tx, index) => {
                                if (tx.tx_id) {
                                    const key = `${tx.tx_id}-${tx.timestamp}-${index}`;
                                    console.log('Adding highlight for tx:', key);
                                    newTransactionIds.add(key);
                                    // Force reactivity by reassigning the Set
                                    newTransactionIds = new Set(newTransactionIds);
                                    
                                    // Clear highlight after animation
                                    clearTransactionHighlight(tx, index);
                                }
                            });
                        }
                    } else if (append) {
                        // For pagination, ensure new transactions are older than existing
                        transactions = [...transactions, ...sortedTransactions];
                    } else {
                        // Initial load should be sorted descending
                        transactions = sortedTransactions;
                    }

                    hasMore = newTransactions.length === pageSize;
                    currentPage = page;
                    error = null;
                } catch (err) {
                    if (err.name === 'AbortError') {
                        return;
                    }
                    console.error('Transaction fetch error:', err);
                    error = err instanceof Error ? err.message : "Failed to load transactions";
                } finally {
                    clearLocks(isRefresh, append);
                }
            } finally {
                debounceTimer = null;
                resolve();
            }
        }, 100); // 100ms debounce
    });
  };

  // Helper function to clear locks
  const clearLocks = (isRefresh: boolean, append: boolean) => {
    if (!currentAbortController?.signal.aborted) {
        // Clear appropriate lock
        if (isRefresh) {
            isRefreshActive = false;
        } else if (append) {
            isPaginationActive = false;
            isLoadingMore = false;
        } else {
            isInitialLoadActive = false;
            isLoadingTxns = false;
        }
        currentAbortController = null;
    }
  };

  // Add pagination state
  let currentPage = $state(1);
  const pageSize = 20;

  // Derived values
  let ckusdtToken = $state<FE.Token | undefined>(undefined);
  $effect(() => {
    const found = $tokensStore?.find((t) => t.symbol === "ckUSDT");
    if (found) {
      ckusdtToken = found;
    }
  });

  $effect(() => {
    const found = $tokensStore?.find(
      (t) => t.address === tokenAddress || t.canister_id === tokenAddress,
    );
    
    // Only update token if we find a different token ID
    if (found && found.token_id !== token?.token_id) {
      token = found;
    }
  });

  let isLoadingMore = $state(false);
  let hasMore = $state(true);
  let observer: IntersectionObserver;
  let loadMoreTrigger: HTMLElement = $state<HTMLElement | null>(null);
  let currentTokenId = $state<number | null>(null);
  let currentTokenCanister = $state<string | null>(null);

  // Watch for token changes
  $effect(() => {
    const newTokenId = token?.token_id ?? null;
    // Add additional check for token canister_id to prevent false changes
    if (newTokenId !== currentTokenId || token?.canister_id !== currentTokenCanister) {
      currentTokenId = newTokenId;
      currentTokenCanister = token?.canister_id;
      
      if (newTokenId !== null) {
        transactions = [];
        currentPage = 1;
        hasMore = true;
        error = null;
        // Add debounce to token change loader
        const timeout = setTimeout(() => loadTransactionData(1, false), 100);
        return () => clearTimeout(timeout);
      }
    }
  });

  function setupIntersectionObserver(element: HTMLElement) {
    if (observer) observer.disconnect();

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          loadTransactionData(currentPage + 1, true);
        }
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0.1,
      },
    );

    observer.observe(element);
  }

  onDestroy(() => {
    if (observer) observer.disconnect();
  });
</script>

<Panel variant="transparent" type="main" {className}>
  <div class="flex flex-col h-[300px]">
    {#if isLoadingTxns && !transactions.length}
      <div class="flex justify-center items-center p-4">
        <span class="loading loading-spinner loading-md" />
      </div>
    {:else if error}
      <div class="text-red-500 p-4">{error}</div>
    {:else if transactions.length === 0}
      <div class="text-kong-text-primary/70 text-center p-4">
        No transactions found
      </div>
    {:else}
      <div class="relative flex flex-col h-full">
        <div class="flex-1 overflow-y-auto overflow-x-hidden">
          <table class="w-full">
            <thead class="hidden md:table-header-group top-0 sticky z-10">
              <tr class="text-left text-kong-text-primary/70 bg-kong-bg-light rounded-t-lg !font-normal">
                <th class="px-4 py-2 w-[110px] sticky top-0 z-10 !font-normal">Wallet</th>
                <th class="px-4 py-2 w-[120px] sticky top-0 z-10 !font-normal">Paid</th>
                <th class="px-4 py-2 w-[140px] sticky top-0 z-10 !font-normal">Received</th>
                <th class="px-4 py-2 w-[100px] sticky top-0 z-10 !font-normal">Value</th>
                <th class="px-4 py-2 w-[120px] sticky top-0 z-10 !font-normal">Date</th>
                <th class="w-[50px] py-2 sticky top-0 z-10 !font-normal">Link</th>
              </tr>
            </thead>
            <tbody class="hidden md:table-row-group">
              {#each transactions as tx, index (tx.tx_id ? `${tx.tx_id}-${tx.timestamp}-${index}` : crypto.randomUUID())}
                <TransactionRow
                  {tx}
                  {token}
                  formattedTokens={$tokensStore}
                  isNew={newTransactionIds.has(tx.tx_id ? `${tx.tx_id}-${tx.timestamp}-${index}` : '')}
                  mobile={mobile}
                />
              {/each}
            </tbody>
            
            <tbody class="md:hidden">
              {#each transactions as tx, index (tx.tx_id ? `${tx.tx_id}-${tx.timestamp}-${index}` : crypto.randomUUID())}
                <tr class="block border-b border-kong-border/70 p-2 hover:bg-kong-bg-light">
                  <td class="block p-2">
                    <TransactionRow
                      {tx}
                      {token}
                      formattedTokens={$tokensStore}
                      isNew={newTransactionIds.has(tx.tx_id ? `${tx.tx_id}-${tx.timestamp}-${index}` : '')}
                      mobile={mobile}
                    />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>

          {#if hasMore}
            <div
              bind:this={loadMoreTrigger}
              use:setupIntersectionObserver
              class="flex justify-center p-4"
            >
              {#if isLoadingMore}
                <span class="loading loading-spinner loading-md" />
              {:else}
                <span class="text-kong-text-primary/70">Loading more...</span>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</Panel>

<style>
  /* Add custom scrollbar styling */
  :global(.overflow-y-auto::-webkit-scrollbar) {
    width: 8px;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-thumb) {
    background-color: rgba(156, 163, 175, 0.3);
    border-radius: 4px;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
    background-color: rgba(156, 163, 175, 0.5);
  }

  /* Mobile responsive styles */
  @media (max-width: 767px) {
    :global(table) {
      display: block;
    }

    :global(thead) {
      display: none;
    }

    :global(tbody) {
      display: block;
      width: 100%;
    }

    :global(.overflow-y-auto) {
      height: calc(300px - 48px); /* Adjust height for mobile */
    }
  }
</style>
