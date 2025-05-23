<script lang="ts">
  import { page } from "$app/stores";
  import { onDestroy, onMount } from "svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { fetchTransactions } from "$lib/api/transactions";
  import TransactionRow from "./TransactionRow.svelte";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { writable } from "svelte/store";
  import { browser } from "$app/environment";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { WalletIcon } from "lucide-svelte";
  import { goto } from "$app/navigation";

  // Create a store for tokens
  const tokensStore = writable<Kong.Token[]>([]);

  // Function to load tokens
  async function loadTokens() {
    try {
      const response = await fetchTokens({
        limit: 200,
        page: 1,
      });
      tokensStore.set(response.tokens);
    } catch (error) {
      console.error("Error loading tokens:", error);
    }
  }

  // Utility function to format principal IDs
  function formatPrincipalId(principalId: string): string {
    // Check if the principal ID ends with "-2" and remove it if it does
    if (principalId && principalId.endsWith("-2")) {
      return principalId.slice(0, -2);
    }
    return principalId;
  }

  onMount(() => {
    loadTokens();
  });

  let mobile = $derived(browser ? window.innerWidth < 768 : false);

  // Declare our state variables
  let { token, className = "!border-none !rounded-t-none" } = $props<{
    token: Kong.Token;
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
    const currentTokenId = token?.id;

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
        if (!isRefreshActive) {
          // Only refresh if not already refreshing
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
    if (token?.id !== previousTokenId) {
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
            console.warn("Refresh already in progress, skipping");
            return;
          }
          if (!isRefresh && !append && isInitialLoadActive) {
            console.warn("Initial load already in progress, skipping");
            return;
          }
          if (append && isPaginationActive) {
            console.warn("Pagination already in progress, skipping");
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
            if (!token?.id) {
              return;
            }

            if (!hasMore && append) {
              return;
            }

            // Set UI loading state
            if (append) {
              isLoadingMore = true;
            } else if (!isRefresh) {
              isLoadingTxns = true;
            }

            const newTransactions = await fetchTransactions(
              token.address,
              page,
              pageSize,
              { signal: currentAbortController.signal },
            );

            // If request was aborted, exit early
            if (currentAbortController?.signal.aborted) {
              return;
            }

            // Ensure transactions are sorted descending by timestamp before processing
            const sortedTransactions = newTransactions.sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime(),
            );

            if (isRefresh) {
              // Create a map of existing transactions for better duplicate detection
              const existingTransactions = new Map(
                transactions.map((t) => [
                  t.tx_id ? `${t.tx_id}-${t.timestamp}` : null,
                  t,
                ]),
              );

              // Filter out any transactions that already exist
              const uniqueNewTransactions = sortedTransactions.filter((tx) => {
                const key = tx.tx_id ? `${tx.tx_id}-${tx.timestamp}` : null;
                if (!key) return false;

                const existing = existingTransactions.get(key);
                if (!existing) return true;

                // If timestamps match exactly, it's definitely a duplicate
                return tx.timestamp !== existing.timestamp;
              });

              if (uniqueNewTransactions.length > 0) {
                // Prepend new transactions while maintaining sort order
                transactions = [...uniqueNewTransactions, ...transactions];

                // Highlight new transactions
                uniqueNewTransactions.forEach((tx, index) => {
                  if (tx.tx_id) {
                    const key = `${tx.tx_id}-${tx.timestamp}-${index}`;
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
            if (err.name === "AbortError") {
              return;
            }
            console.error("Transaction fetch error:", err);
            error =
              err instanceof Error
                ? err.message
                : "Failed to load transactions";
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
  let ckusdtToken = $state<Kong.Token | undefined>(undefined);
  $effect(() => {
    const found = $tokensStore?.find((t) => t.symbol === "ckUSDT");
    if (found) {
      ckusdtToken = found;
    }
  });

  $effect(() => {
    const found = $tokensStore?.find(
      (t) => t.address === tokenAddress || t.address === tokenAddress,
    );

    // Only update token if we find a different token ID
    if (found && found.id !== token?.id) {
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
    const newTokenId = token?.id ?? null;
    // Add additional check for token address to prevent false changes
    if (
      newTokenId !== currentTokenId ||
      token?.address !== currentTokenCanister
    ) {
      currentTokenId = newTokenId;
      currentTokenCanister = token?.address;

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

  const calculateTotalUsdValue = (tx: FE.Transaction): string => {
    const payToken = $tokensStore?.find((t) => t.id === tx.pay_token_id);
    const receiveToken = $tokensStore?.find(
      (t) => t.id === tx.receive_token_id,
    );
    if (!payToken || !receiveToken) return "0.00";

    // Calculate USD value from pay side
    const payUsdValue =
      payToken.symbol === "ckUSDT"
        ? tx.pay_amount
        : tx.pay_amount * (Number(payToken.metrics.price) || 0);

    // Calculate USD value from receive side
    const receiveUsdValue =
      receiveToken.symbol === "ckUSDT"
        ? tx.receive_amount
        : tx.receive_amount * (Number(receiveToken.metrics.price) || 0);

    // Use the higher value
    return formatUsdValue(Math.max(payUsdValue, receiveUsdValue));
  };

  onDestroy(() => {
    if (observer) observer.disconnect();
  });
</script>

<Panel type="main" {className}>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <h2 class="text-sm font-semibold uppercase px-4 pt-4">
      <div class="grid grid-cols-2 gap-x-8">
        <div class="text-kong-text-primary tracking-wider">
          Transaction
        </div>
        <div class="text-kong-text-primary tracking-wider text-right">
          Value
        </div>
      </div>
    </h2>
    {#if isLoadingTxns && !transactions.length}
      <div class="flex justify-center items-center p-6 flex-1">
        <span class="loading loading-spinner loading-md" />
      </div>
    {:else if error}
      <div class="text-kong-accent-red p-6 text-sm font-medium flex-1">{error}</div>
    {:else if transactions.length === 0}
      <div
        class="text-kong-text-primary/70 text-center p-6 flex-1 flex items-center justify-center text-sm"
      >
        No transactions found
      </div>
    {:else}
      <div class="flex-1 overflow-hidden">
        <!-- Transaction List -->
        <div class="h-full overflow-y-auto overflow-x-hidden">
          <!-- Desktop View -->
          <div class="hidden md:block h-[400px]">
            {#each transactions as tx, index (tx.tx_id ? `${tx.tx_id}-${tx.timestamp}-${index}` : crypto.randomUUID())}
              <div
                class={`border-b border-kong-border/20 hover:bg-kong-bg-dark/20 hover:bg-kong-bg-secondary/20 transition-all duration-200 ${
                  newTransactionIds.has(
                    tx.tx_id ? `${tx.tx_id}-${tx.timestamp}-${index}` : "",
                  )
                    ? "transaction-highlight"
                    : ""
                }`}
              >
                <div class="px-4 py-4">
                  <div class="grid grid-cols-2 gap-x-8 items-center">
                    <!-- Transaction Info -->
                    <div class="flex flex-col gap-2">
                      <div class="flex items-center gap-2 mb-1">
                        {#if tx.receive_token_id === token.id}
                          <span
                            class="bg-kong-accent-green/10 text-kong-accent-green px-2 py-1 rounded-md text-xs font-medium"
                          >
                            BUY
                          </span>
                        {:else}
                          <span
                            class="bg-kong-accent-red/10 text-kong-accent-red px-2 py-1 rounded-md text-xs font-medium"
                          >
                            SELL
                          </span>
                        {/if}
                        <span
                          class="text-xs text-kong-text-primary/60 font-medium"
                        >
                          {new Date(tx.timestamp).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <!-- Transaction amounts -->
                      <div class="flex items-center gap-2 text-sm">
                        {#if tx.receive_token_id === token.id}
                          <span class="text-kong-text-primary/70 font-medium">
                            {tx.pay_amount.toFixed(
                              tx.pay_amount < 0.01 ? 6 : 4,
                            )}
                            {$tokensStore.find((t) => t.id === tx.pay_token_id)
                              ?.symbol}
                          </span>
                          <span class="text-kong-text-primary/50">→</span>
                          <span class="font-semibold text-kong-text-primary">
                            {tx.receive_amount.toFixed(
                              tx.receive_amount < 0.01 ? 6 : 4,
                            )}
                            {$tokensStore.find(
                              (t) => t.id === tx.receive_token_id,
                            )?.symbol}
                          </span>
                        {:else}
                          <span class="font-semibold text-kong-text-primary">
                            {tx.pay_amount.toFixed(
                              tx.pay_amount < 0.01 ? 6 : 4,
                            )}
                            {$tokensStore.find((t) => t.id === tx.pay_token_id)
                              ?.symbol}
                          </span>
                          <span class="text-kong-text-primary/50">→</span>
                          <span class="text-kong-text-primary/70 font-medium">
                            {tx.receive_amount.toFixed(
                              tx.receive_amount < 0.01 ? 6 : 4,
                            )}
                            {$tokensStore.find(
                              (t) => t.id === tx.receive_token_id,
                            )?.symbol}
                          </span>
                        {/if}
                      </div>
                    </div>

                    <!-- Value and Actions -->
                    <div class="flex items-center justify-end gap-3">
                      <div class="flex flex-col items-end gap-1">
                        <span
                          class="text-sm font-semibold text-kong-text-primary"
                          >{calculateTotalUsdValue(tx)}</span
                        >
                        <div class="flex items-center gap-2">
                          <button
                            title="View wallet"
                            class="text-kong-text-primary/60 hover:text-kong-primary transition-colors duration-200 p-1 rounded-md hover:bg-kong-bg-secondary/30"
                            on:click|preventDefault={() =>
                              goto(
                                `/wallets/${formatPrincipalId(tx.user.principal_id)}`,
                              )}
                          >
                            <WalletIcon class="w-4 h-4" />
                          </button>
                          <button
                            title="View on explorer"
                            class="text-kong-text-primary/60 hover:text-kong-primary transition-colors duration-200 p-1 rounded-md hover:bg-kong-bg-secondary/30"
                            on:click|preventDefault={() => {
                              window.open(
                                `https://www.icexplorer.io/address/detail/${formatPrincipalId(tx.user.principal_id)}`,
                                "_blank",
                              );
                            }}
                          >
                            <svg
                              class="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <!-- Mobile View -->
          <div class="md:hidden">
            {#each transactions as tx, index (tx.tx_id ? `${tx.tx_id}-${tx.timestamp}-${index}` : crypto.randomUUID())}
              <div
                class={`border-b border-kong-border/20 hover:bg-kong-bg-secondary/20 transition-all duration-200 ${
                  newTransactionIds.has(
                    tx.tx_id ? `${tx.tx_id}-${tx.timestamp}-${index}` : "",
                  )
                    ? "transaction-highlight"
                    : ""
                }`}
              >
                <div class="p-4">
                  <div class="flex flex-col gap-3">
                    <!-- Header row -->
                    <div class="flex justify-between items-center">
                      {#if tx.receive_token_id === token.id}
                        <span
                          class="bg-kong-accent-green/10 text-kong-accent-green px-2 py-1 rounded-md text-xs font-medium"
                        >
                          {token.symbol} BUY
                        </span>
                      {:else}
                        <span
                          class="bg-kong-accent-red/10 text-kong-accent-red px-2 py-1 rounded-md text-xs font-medium"
                        >
                          {token.symbol} SELL
                        </span>
                      {/if}
                      <span
                        class="text-xs text-kong-text-primary/60 font-medium"
                      >
                        {new Date(tx.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <!-- Transaction amounts -->
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2 text-sm">
                        {#if tx.receive_token_id === token.id}
                          <span class="text-kong-text-primary/70 font-medium">
                            {tx.pay_amount.toFixed(
                              tx.pay_amount < 0.01 ? 4 : 2,
                            )}
                            {$tokensStore.find((t) => t.id === tx.pay_token_id)
                              ?.symbol}
                          </span>
                          <span class="text-kong-text-primary/50">→</span>
                          <span class="font-semibold text-kong-text-primary">
                            {tx.receive_amount.toFixed(
                              tx.receive_amount < 0.01 ? 4 : 2,
                            )}
                            {$tokensStore.find(
                              (t) => t.id === tx.receive_token_id,
                            )?.symbol}
                          </span>
                        {:else}
                          <span class="font-semibold text-kong-text-primary">
                            {tx.pay_amount.toFixed(
                              tx.pay_amount < 0.01 ? 4 : 2,
                            )}
                            {$tokensStore.find((t) => t.id === tx.pay_token_id)
                              ?.symbol}
                          </span>
                          <span class="text-kong-text-primary/50">→</span>
                          <span class="text-kong-text-primary/70 font-medium">
                            {tx.receive_amount.toFixed(
                              tx.receive_amount < 0.01 ? 4 : 2,
                            )}
                            {$tokensStore.find(
                              (t) => t.id === tx.receive_token_id,
                            )?.symbol}
                          </span>
                        {/if}
                      </div>
                    </div>

                    <!-- Value and actions row -->
                    <div
                      class="flex items-center justify-between pt-1 border-t border-kong-border/10"
                    >
                      <span
                        class="text-sm font-semibold text-kong-text-primary"
                      >
                        {calculateTotalUsdValue(tx)}
                      </span>
                      <div class="flex items-center gap-2">
                        <button
                          title="View wallet"
                          class="text-kong-text-primary/60 hover:text-kong-primary transition-colors duration-200 p-1.5 rounded-md hover:bg-kong-bg-secondary/30"
                          on:click|preventDefault={() =>
                            goto(
                              `/wallets/${formatPrincipalId(tx.user.principal_id)}`,
                            )}
                        >
                          <WalletIcon class="w-4 h-4" />
                        </button>
                        <button
                          title="View on explorer"
                          class="text-kong-text-primary/60 hover:text-kong-primary transition-colors duration-200 p-1.5 rounded-md hover:bg-kong-bg-secondary/30"
                          on:click|preventDefault={() => {
                            window.open(
                              `https://www.icexplorer.io/address/detail/${formatPrincipalId(tx.user.principal_id)}`,
                              "_blank",
                            );
                          }}
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <!-- Load More Trigger -->
          {#if hasMore}
            <div
              bind:this={loadMoreTrigger}
              use:setupIntersectionObserver
              class="flex justify-center p-4 border-t border-kong-border/10"
            >
              {#if isLoadingMore}
                <span class="loading loading-spinner loading-sm" />
              {:else}
                <span
                  class="text-kong-text-primary/50 text-xs uppercase tracking-wider font-medium"
                  >Load more</span
                >
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</Panel>

<style>
  /* Custom scrollbar styling to match other components */
  :global(.overflow-y-auto::-webkit-scrollbar) {
    width: 4px;
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

  /* Highlight animation for new transactions */
  .transaction-highlight {
    animation: highlight 2s ease-out;
  }

  @keyframes highlight {
    0% {
      background-color: rgba(99, 102, 241, 0.15);
    }
    100% {
      background-color: transparent;
    }
  }

  /* Mobile responsive optimizations */
  @media (max-width: 767px) {
    :global(.overflow-y-auto) {
      height: calc(100vh - 200px);
      -webkit-overflow-scrolling: touch;
    }

    .transaction-highlight {
      animation: mobile-highlight 1.5s ease-out;
    }

    @keyframes mobile-highlight {
      0% {
        background-color: rgba(99, 102, 241, 0.1);
      }
      100% {
        background-color: transparent;
      }
    }
  }

  /* Consistent hover effects */
  button:hover {
    transform: translateY(-1px);
  }

  /* Better spacing for touch devices */
  @media (hover: none) and (pointer: coarse) {
    button {
      padding: 0.625rem;
    }
  }
</style>
