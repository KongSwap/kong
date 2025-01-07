<script lang="ts">
  import { page } from "$app/stores";
  import { onDestroy } from "svelte";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import { fetchTransactions } from "$lib/services/transactions";
  import TransactionRow from "./TransactionRow.svelte";

  // Function to generate a consistent color from a principal ID
  function getPrincipalColor(principalId: string): string {
    // Use a simple hash function to generate a number from the string
    const hash = principalId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    // Generate HSL color with fixed saturation and lightness for readability
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 65%)`;
  }

  // Ensure formattedTokens is initialized
  if (!formattedTokens) {
    throw new Error("Stores are not initialized");
  }

  // Declare our state variables
  let { token, className = '' } = $props<{ 
    token: FE.Token;
    className?: string;
  }>();
  let transactions = $state<FE.Transaction[]>([]);
  let isLoadingTxns = $state(false);
  let error = $state<string | null>(null);
  const tokenAddress = $page.params.id;
  let refreshInterval: number;
  let newTransactionIds = $state<Set<string>>(new Set());

  // Function to clear transaction highlight after animation
  const clearTransactionHighlight = (txId: string) => {
    setTimeout(() => {
      newTransactionIds.delete(txId);
      newTransactionIds = newTransactionIds; // Trigger reactivity
    }, 1000); // Match this with CSS animation duration
  };

  // Update fetch function to handle new transactions
  const loadTransactionData = async (
    page: number = 1,
    append: boolean = false,
    isRefresh: boolean = false,
  ) => {
    if (!token?.token_id) {
      console.log("No token ID available, skipping transaction load");
      isLoadingTxns = false;
      return;
    }

    if ((!append && !isRefresh && isLoadingTxns) || (append && isLoadingMore)) {
      console.log("Already loading transactions, skipping");
      return;
    }

    if (!hasMore && append) {
      console.log("No more transactions to load");
      return;
    }

    const maxRetries = 3;
    let retryCount = 0;
    let lastError;

    while (retryCount < maxRetries) {
      try {
        if (append) {
          isLoadingMore = true;
        } else if (!isRefresh) {
          isLoadingTxns = true;
        }

        const newTransactions = await fetchTransactions(
          token.token_id,
          page,
          pageSize,
        );

        if (isRefresh) {
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
          newTransactionIds = newTransactionIds; // Trigger reactivity
        } else if (append) {
          transactions = [...transactions, ...newTransactions];
        } else {
          transactions = newTransactions;
        }

        hasMore = newTransactions.length === pageSize;
        currentPage = page;
        error = null;
        break; // Success, exit retry loop
      } catch (err) {
        lastError = err;
        console.warn(`Attempt ${retryCount + 1} failed:`, err);
        retryCount++;
        
        if (retryCount < maxRetries) {
          // Wait before retrying, with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }
    }

    if (retryCount === maxRetries) {
      console.error("Failed to fetch transactions after", maxRetries, "attempts:", lastError);
      error = lastError instanceof Error ? lastError.message : "Failed to load transactions";
      hasMore = false;
    }

    isLoadingMore = false;
    isLoadingTxns = false;
  };

  // Set up auto-refresh interval with error handling
  $effect(() => {
    if (token?.token_id) {
      // Clear existing interval if any
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }

      // Set up new interval with error handling
      refreshInterval = setInterval(() => {
        loadTransactionData(1, false, true).catch(err => {
          console.error("Error in refresh interval:", err);
          // Don't show error UI for background refresh failures
        });
      }, 10000) as unknown as number;

      // Clean up on token change
      return () => {
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
      };
    }
  });

  // Clean up interval on component destroy
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  // Add pagination state
  let currentPage = $state(1);
  const pageSize = 20;

  // Derived values
  let ckusdtToken = $state<FE.Token | undefined>(undefined);
  $effect(() => {
    const found = $formattedTokens?.find((t) => t.symbol === "ckUSDT");
    if (found) {
      ckusdtToken = found;
    }
  });

  $effect(() => {
    const found = $formattedTokens?.find(
      (t) => t.address === tokenAddress || t.canister_id === tokenAddress,
    );
    if (found) {
      token = found;
    }
  });

  let isLoadingMore = $state(false);
  let hasMore = $state(true);
  let observer: IntersectionObserver;
  let loadMoreTrigger: HTMLElement = $state<HTMLElement | null>(null);
  let currentTokenId = $state<number | null>(null);

  // Watch for token changes
  $effect(() => {
    const newTokenId = token?.token_id ?? null;
    if (newTokenId !== currentTokenId) {
      currentTokenId = newTokenId;
      if (newTokenId !== null) {
        transactions = []; // Clear existing transactions
        currentPage = 1;
        hasMore = true;
        error = null;
        loadTransactionData(1, false);
      } else {
        isLoadingTxns = false; // Clear loading state if no token
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
  <div class="flex flex-col max-h-[300px]">
    <div class="p-4 pb-0">
      <h2 class="text-xl font-semibold text-kong-text-primary/80">Recent Transactions</h2>
    </div>
    <div class="flex-1 overflow-y-auto p-4">
      {#if isLoadingTxns && transactions.length === 0}
        <div class="flex items-center justify-center h-full">
          <div class="loader"></div>
        </div>
      {:else if error}
        <div class="text-red-400 text-center py-4">{error}</div>
      {:else if transactions.length === 0}
        <div class="text-kong-text-primary text-center py-4">No transactions found</div>
      {:else}
        <div class="-mx-4">
          <table class="w-full text-left text-kong-text-primary/80">
            <tbody>
              {#each transactions as tx}
                <TransactionRow
                  {tx}
                  {token}
                  formattedTokens={$formattedTokens}
                  isNew={newTransactionIds.has(tx.tx_id || "")}
                />
              {/each}

              <!-- Loading more indicator -->
              <tr bind:this={loadMoreTrigger} use:setupIntersectionObserver>
                <td colspan="2" class="p-4 text-center">
                  {#if isLoadingMore}
                    <div class="flex justify-center">
                      <div class="loader"></div>
                    </div>
                  {:else if !hasMore}
                    <div class="text-slate-400 text-sm">
                      No more transactions
                    </div>
                  {/if}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</Panel>
