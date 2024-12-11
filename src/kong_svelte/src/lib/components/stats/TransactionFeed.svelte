<script lang="ts">
  import { page } from "$app/stores";
  import { onDestroy } from "svelte";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import { fetchTransactions } from "$lib/services/transactions";
  import TransactionRow from "./TransactionRow.svelte";

  // Ensure formattedTokens is initialized
  if (!formattedTokens) {
    throw new Error("Stores are not initialized");
  }

  // Declare our state variables
  let { token } = $props<{ token: FE.Token }>();
  let transactions = $state<FE.Transaction[]>([]);
  let isLoadingTxns = $state(false);
  let isLoadingMore = $state(false);
  let error = $state<string | null>(null);
  let currentPage = $state(1);
  let hasMore = $state(true);
  let pageSize = 20;
  let newTransactionIds = $state<Set<string>>(new Set());
  let allTransactions = $state<FE.Transaction[]>([]);  // Store for all transactions
  const tokenAddress = $page.params.id;
  let refreshInterval: number;

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
        // For refresh, just replace all transactions
        allTransactions = newTransactions;
      } else if (append) {
        // For append, add to existing transactions
        allTransactions = [...allTransactions, ...newTransactions];
      } else {
        // For initial load
        allTransactions = newTransactions;
      }

      // Sort all transactions by timestamp
      allTransactions.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      // Update the displayed transactions
      transactions = allTransactions;

      // Handle new transaction highlighting
      if (isRefresh) {
        const existingIds = new Set(transactions.map((t) => t.tx_id));
        newTransactions.forEach(tx => {
          if (!existingIds.has(tx.tx_id)) {
            newTransactionIds.add(tx.tx_id);
            clearTransactionHighlight(tx.tx_id);
          }
        });
        newTransactionIds = newTransactionIds; // Trigger reactivity
      }

      hasMore = newTransactions.length === pageSize;
      currentPage = page;
      error = null;
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      error =
        error instanceof Error ? error.message : "Failed to load transactions";
      hasMore = false;
    } finally {
      isLoadingMore = false;
      isLoadingTxns = false;
    }
  };

  // Set up auto-refresh interval
  $effect(() => {
    if (token?.token_id) {
      // Clear existing interval if any
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }

      // Set up new interval
      refreshInterval = setInterval(() => {
        loadTransactionData(1, false, true);
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

<Panel variant="blue" type="main" className="flex-1 md:w-1/2 !p-0">
  <div class="flex flex-col h-[600px]">
    <div class="p-4">
      <h2 class="text-2xl font-semibold text-white/80">Transaction Feed</h2>
    </div>
    <div class="flex-1 overflow-y-auto p-4">
      {#if isLoadingTxns && transactions.length === 0}
        <div class="flex items-center justify-center h-full">
          <div class="loader"></div>
        </div>
      {:else if error}
        <div class="text-red-400 text-center py-4">{error}</div>
      {:else if transactions.length === 0}
        <div class="text-white text-center py-4">No transactions found</div>
      {:else}
        <div class="-mx-4">
          <table class="w-full text-left text-white/80">
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
