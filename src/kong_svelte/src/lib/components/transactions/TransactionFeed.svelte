<script lang="ts">
  import { formatDistance } from "date-fns";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { type Transaction } from "$lib/services/transactions";
  import { onMount, onDestroy } from "svelte";
  import { INDEXER_URL } from "$lib/constants/canisterConstants";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";

  const props = $props<{
    token: FE.Token;
    token2?: FE.Token;
    userId?: string;
    pageSize?: number;
  }>();

  let transactions = $state<Transaction[]>([]);
  let isLoadingTxns = $state(false);
  let isLoadingMore = $state(false);
  let error = $state<string | null>(null);
  let currentPage = $state(1);
  let hasMore = $state(true);
  let loadMoreTrigger: HTMLElement;
  let refreshInterval: number;
  let backoffDelay = 1000; // Initial backoff delay in ms
  let maxBackoffDelay = 30000; // Max backoff delay
  let lastErrorTime = 0; // Track when the last error occurred
  let retryTimeout: number | null = null;

  // Add state for tracking new transactions
  let newTransactionIds = $state<Set<string>>(new Set());

  // Function to clear transaction highlight after animation
  const clearTransactionHighlight = (txId: string) => {
    setTimeout(() => {
      newTransactionIds.delete(txId);
      newTransactionIds = newTransactionIds; // Trigger reactivity
    }, 1000); // Match this with CSS animation duration
  };

  // Function to check if a transaction involves our tokens and user
  const isRelevantTransaction = (tx: Transaction): boolean => {
    const tokenIds = new Set([props.token.token_id]);
    if (props.token2) tokenIds.add(props.token2.token_id);
    
    // Check token relevance
    const isTokenRelevant = props.token2
      ? tokenIds.has(tx.pay_token_id) && tokenIds.has(tx.receive_token_id)
      : tokenIds.has(tx.pay_token_id) || tokenIds.has(tx.receive_token_id);

    // If userId is provided, also check user relevance
    if (props.userId) {
      return isTokenRelevant && tx.user?.principal_id === props.userId;
    }

    return isTokenRelevant;
  };

  const isResourceError = (error: any) => {
    return error?.message?.includes('ERR_INSUFFICIENT_RESOURCES') || 
           error?.message?.includes('Resource limit reached') ||
           error?.message?.includes('429');
  };

  const scheduleRetry = () => {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }
    retryTimeout = setTimeout(() => {
      if (!isLoadingTxns && !isLoadingMore) {
        error = null;
        loadTransactionData();
      }
      retryTimeout = null;
    }, backoffDelay) as unknown as number;
  };

  // Update fetch function to handle new transactions
  const loadTransactionData = async (
    page: number = 1,
    append: boolean = false,
    isRefresh: boolean = false,
  ) => {
    if (!props.token?.token_id) return;
    if (isLoadingTxns || isLoadingMore) return;
    
    // Check if we're in backoff period after an error
    const now = Date.now();
    if (error && (now - lastErrorTime) < backoffDelay) {
      return;
    }

    if (append) {
      isLoadingMore = true;
    } else {
      isLoadingTxns = true;
    }

    try {
      const pageSize = props.pageSize || 20;

      // If we have a token pair, we need to fetch transactions for both tokens
      // and merge them
      const urls = [
        `${INDEXER_URL}/api/tokens/${props.token.token_id}/transactions?page=${page}&limit=${pageSize}${
          props.userId ? `&user=${props.userId}` : ''
        }`,
      ];
      
      if (props.token2) {
        urls.push(
          `${INDEXER_URL}/api/tokens/${props.token2.token_id}/transactions?page=${page}&limit=${pageSize}${
            props.userId ? `&user=${props.userId}` : ''
          }`
        );
      }

      const responses = await Promise.all(
        urls.map(url => 
          fetch(url).catch(e => {
            // Convert network errors to a standard format
            throw new Error(e.message || 'Network error');
          })
        )
      );
      
      // Check for resource errors
      for (const response of responses) {
        if (!response.ok) {
          const status = response.status;
          const text = await response.text().catch(() => '');
          
          if (status === 429 || text.includes('INSUFFICIENT_RESOURCES')) {
            throw new Error('Resource limit reached. Please try again later.');
          }
          throw new Error(`API error: ${status} ${text}`);
        }
      }

      const datas = await Promise.all(responses.map(r => r.json()));
      
      // Reset backoff on successful request
      backoffDelay = 1000;
      error = null;
      lastErrorTime = 0;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      
      // Merge and filter transactions
      let newTransactions = datas.flatMap(data => data.transactions || [])
        .filter(isRelevantTransaction)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, pageSize);

      if (isRefresh && transactions.length > 0) {
        // Compare new transactions with existing ones and highlight differences
        const existingIds = new Set(transactions.map((t) => t.tx_id));
        const updatedTransactions = newTransactions.map((tx) => {
          if (!existingIds.has(tx.tx_id)) {
            newTransactionIds.add(tx.tx_id);
            clearTransactionHighlight(tx.tx_id);
          }
          return tx;
        });
        transactions = updatedTransactions;
      } else if (append) {
        transactions = [...transactions, ...newTransactions];
      } else {
        transactions = newTransactions;
      }

      hasMore = newTransactions.length === pageSize;
      currentPage = page;
    } catch (e) {
      console.error("Error loading transactions:", e);
      error = e instanceof Error ? e.message : "Unknown error occurred";
      
      // Update error tracking and increase backoff
      lastErrorTime = Date.now();
      
      if (isResourceError(e)) {
        backoffDelay = Math.min(backoffDelay * 2, maxBackoffDelay);
        
        // Clear refresh interval on resource errors
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = 0;
        }
        
        // Schedule a retry
        scheduleRetry();
      } else {
        // For non-resource errors, use shorter backoff
        backoffDelay = Math.min(backoffDelay * 1.5, 5000);
      }
    } finally {
      isLoadingTxns = false;
      isLoadingMore = false;
    }
  };

  // Set up infinite scroll
  const setupInfiniteScroll = () => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          loadTransactionData(currentPage + 1, true);
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreTrigger) {
      observer.observe(loadMoreTrigger);
    }

    return () => {
      if (loadMoreTrigger) {
        observer.unobserve(loadMoreTrigger);
      }
    };
  };

  // Initial load and refresh setup
  onMount(() => {
    loadTransactionData();
    setupInfiniteScroll();

    // Set up periodic refresh with longer interval
    refreshInterval = setInterval(() => {
      if (!isLoadingTxns && !isLoadingMore && !error) {
        loadTransactionData(1, false, true);
      }
    }, 30000) as unknown as number;

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  });

  // Clean up on unmount
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = 0;
    }
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
  });

  // Watch for prop changes and reload data
  $effect(() => {
    const tokenId = props.token?.token_id;
    const token2Id = props.token2?.token_id;
    const userId = props.userId;
    
    // Reset state
    transactions = [];
    currentPage = 1;
    hasMore = true;
    error = null;
    isLoadingTxns = false;
    isLoadingMore = false;
    backoffDelay = 1000;
    lastErrorTime = 0;
    
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    
    // Clear existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = 0;
    }
    
    if (tokenId) {
      // Initial load with a small delay to prevent immediate loading on mount
      setTimeout(() => {
        loadTransactionData();
      }, 100);
      
      // Set up new refresh interval only if no errors
      if (!error) {
        refreshInterval = setInterval(() => {
          if (!isLoadingTxns && !isLoadingMore && !error) {
            loadTransactionData(1, false, true);
          }
        }, 30000) as unknown as number;
      }
    }
  });

  const getTransactionType = (tx: Transaction): { type: 'buy' | 'sell', amount: number, token: FE.Token } => {
    if (props.token2) {
      // For token pairs, show which token was bought/sold relative to token1
      if (tx.pay_token_id === props.token.token_id) {
        return {
          type: 'sell',
          amount: tx.pay_amount,
          token: props.token
        };
      } else {
        return {
          type: 'buy',
          amount: tx.receive_amount,
          token: props.token
        };
      }
    } else {
      // For single token view
      if (tx.pay_token_id === props.token.token_id) {
        return {
          type: 'sell',
          amount: tx.pay_amount,
          token: props.token
        };
      } else {
        return {
          type: 'buy',
          amount: tx.receive_amount,
          token: props.token
        };
      }
    }
  };
</script>

<div class="transaction-feed">
  {#if isLoadingTxns && transactions.length === 0}
    <div class="flex items-center justify-center h-full">
      <div class="loading loading-spinner loading-lg"></div>
    </div>
  {:else if error}
    <div class="flex items-center justify-center h-full text-error">
      <div class="flex flex-col items-center gap-2">
        <span>{error}</span>
        {#if error.includes('Resource limit')}
          <span class="text-sm">Will retry in {Math.ceil(backoffDelay/1000)}s</span>
        {/if}
        <button 
          class="btn btn-error btn-sm" 
          on:click={() => {
            error = null;
            loadTransactionData();
          }}
        >
          Retry
        </button>
      </div>
    </div>
  {:else}
    <div class="transactions-list">
      {#each transactions as tx}
        {@const txType = getTransactionType(tx)}
        <div 
          class="transaction-item"
          class:highlight={newTransactionIds.has(tx.tx_id)}
        >
          <div class="transaction-info">
            <div class="token-images">
              <img 
                src={txType.token.logo_url || '/images/default-token.png'} 
                alt={txType.token.symbol}
                class="token-image"
              />
            </div>
            <div class="transaction-details">
              <div class="transaction-type">
                <span class={txType.type === 'buy' ? 'text-green-500' : 'text-red-500'}>
                  {txType.type === 'buy' ? 'Buy' : 'Sell'}
                </span>
                <span class="text-sm text-white/60">
                  {formatDistance(new Date(tx.timestamp), new Date(), { addSuffix: true })}
                </span>
              </div>
              <div class="transaction-amount">
                {formatToNonZeroDecimal(txType.amount)} {txType.token.symbol}
              </div>
            </div>
          </div>
        </div>
      {/each}
      
      {#if hasMore}
        <div 
          class="load-more" 
          bind:this={loadMoreTrigger}
        >
          {#if isLoadingMore}
            <div class="loading loading-spinner loading-sm"></div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  .transaction-feed {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .transactions-list {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .transaction-item {
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-border);
    transition: background-color 0.3s ease;
  }

  .transaction-item:hover {
    background: var(--color-background-hover);
  }

  .transaction-item.highlight {
    animation: highlight 2s ease-out;
  }

  @keyframes highlight {
    0% {
      background: var(--color-highlight);
    }
    100% {
      background: transparent;
    }
  }

  .transaction-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .token-images {
    position: relative;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
  }

  .token-image {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    object-fit: cover;
  }

  .transaction-details {
    flex: 1;
    min-width: 0;
  }

  .transaction-type {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .transaction-amount {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .load-more {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    color: var(--color-text-secondary);
  }
</style>
