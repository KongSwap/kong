<script lang="ts">
  import { fade } from "svelte/transition";
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import {
    Clock,
    RefreshCw,
    Download,
    Loader2,
  } from "lucide-svelte";
  import { auth } from "$lib/services/auth";
  import { toastStore } from "$lib/stores/toastStore";
  import { writable } from "svelte/store";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { fetchUserTransactions } from "$lib/api/users";
  import TransactionModal from "./TransactionModal.svelte";
  import TransactionItem from "./TransactionItem.svelte";
  import { processTransaction, formatAmount } from "$lib/utils/transactionUtils";
  import DownloadTransactionsModal from "./DownloadTransactionsModal.svelte";

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    refresh: void;
  }>();

  // Create a store for tokens
  const tokensStore = writable<FE.Token[]>([]);

  // State variables
  let isLoading = false;
  let error: string | null = null;
  let transactions: any[] = [];
  let hasMore = true;
  let loadingMore = false;
  let authSubscription: () => void;

  // Filter state
  type FilterType = "swap" | "pool" | "send" | "all";
  let selectedFilter: FilterType = "all";
  const filterOptions = [
    { id: "all" as const, label: "All" },
    { id: "swap" as const, label: "Swaps" },
    { id: "pool" as const, label: "Pools" },
    { id: "send" as const, label: "Transfers" },
  ];

  // Current API cursor for pagination
  let currentCursor: number | undefined = undefined;
  const PAGE_SIZE = 20;

  // Transaction details modal
  let selectedTransaction: any = null;
  let showTransactionModal = false;
  let showDownloadModal = false;

  // Function to load tokens
  async function loadTokens() {
    try {
      const response = await fetchTokens({
        limit: 500,
        page: 1,
      });
      tokensStore.set(response.tokens);
      return tokensStore.subscribe(() => {});
    } catch (error) {
      console.error("Error loading tokens:", error);
      return undefined;
    }
  }

  // Function to handle filter changes
  function handleFilterChange(filter: FilterType) {
    if (filter === selectedFilter) return;

    selectedFilter = filter;
    transactions = [];
    currentCursor = undefined;
    hasMore = true;

    loadTransactions();
  }

  // Function to load transactions
  async function loadTransactions(loadMore = false) {
    if (!$auth.isConnected || !$auth.account?.owner) {
      if (!error) {
        error = "Waiting for wallet connection...";
        setTimeout(() => {
          error = null;
          loadTransactions();
        }, 1500);
      }
      return;
    }

    const principal = $auth.account.owner.toString();
    
    if (!loadMore) {
      isLoading = true;
      currentCursor = undefined;
      error = null;
    } else {
      if (loadingMore || !hasMore) return;
      loadingMore = true;
    }

    try {
      let txType: "swap" | "pool" | "send" = "swap";
      
      if (selectedFilter === "swap") txType = "swap";
      else if (selectedFilter === "pool") txType = "pool";
      else if (selectedFilter === "send") txType = "send";

      const response = await fetchUserTransactions(
        principal,
        currentCursor,
        PAGE_SIZE,
        selectedFilter === "all" ? undefined : txType,
      );

      if (response.transactions) {
        const newTransactions = response.transactions
          .map((tx) => processTransaction(tx, formatAmount))
          .filter(Boolean);

        transactions = loadMore ? [...transactions, ...newTransactions] : newTransactions;
        hasMore = response.has_more;
        currentCursor = response.next_cursor || undefined;
        
        if (!response.next_cursor) {
          hasMore = false;
        }
      } else {
        if (!loadMore) transactions = [];
        hasMore = false;
      }
    } catch (err) {
      console.error("Error loading transactions:", err);
      toastStore.add({
        type: "error",
        title: "Failed to Load Transactions",
        message: err.message || "Could not load transaction history.",
        duration: 5000,
      });

      if (!loadMore) transactions = [];
      hasMore = false;
      error = err.message || "Failed to load transactions";
    } finally {
      isLoading = false;
      loadingMore = false;
    }
  }

  // Handle refresh button click
  function handleRefresh() {
    transactions = [];
    currentCursor = undefined;
    hasMore = true;
    loadTransactions();
    dispatch("refresh");
  }

  function handleTransactionClick(tx: any) {
    selectedTransaction = tx;
    showTransactionModal = true;
  }

  // Download transaction history as CSV
  function downloadTransactionHistory() {
    if (!transactions.length) return;

    const headers = ["Date", "Type", "Status", "Details", "Transaction ID"];
    const rows = transactions.map((tx) => {
      let details = "";

      if (tx.type === "Swap") {
        details = `${tx.details.pay_amount} ${tx.details.pay_token_symbol} → ${tx.details.receive_amount} ${tx.details.receive_token_symbol}`;
      } else if (tx.type === "Send") {
        details = `${tx.details.amount} ${tx.details.token_symbol}`;
      } else {
        details = `${tx.details.amount_0} ${tx.details.token_0_symbol} + ${tx.details.amount_1} ${tx.details.token_1_symbol}`;
      }

      return [tx.formattedDate, tx.type, tx.status, details, tx.tx_id];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `kong-transaction-history-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Load data on mount and subscribe to auth changes
  onMount(() => {
    const tokenUnsubscribePromise = loadTokens();

    // Subscribe to auth changes
    authSubscription = auth.subscribe((authState) => {
      if (authState?.isConnected && authState?.account?.owner) {
        if (transactions.length === 0 && !isLoading) {
          loadTransactions();
        }
      }
    });

    // Initial load attempt
    if ($auth.isConnected && $auth.account?.owner) {
      loadTransactions();
    }

    // Clean up function
    return () => {
      if (authSubscription) authSubscription();
      tokenUnsubscribePromise.then((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
    };
  });
</script>

<!-- Transaction Details Modal -->
<TransactionModal
  isOpen={showTransactionModal}
  onClose={() => (showTransactionModal = false)}
  transaction={selectedTransaction}
  tokens={$tokensStore}
/>

<!-- Download Transactions Modal -->
<DownloadTransactionsModal
  isOpen={showDownloadModal}
  onClose={() => (showDownloadModal = false)}
/>

<div class="py-3">
  <!-- Header with filters -->
  <div class="px-4 mb-2 flex items-center justify-between">
    <div
      class="text-xs font-medium text-kong-text-secondary uppercase tracking-wide"
    >
      Transaction History
    </div>

    <div class="flex items-center gap-2">
      <!-- Refresh button -->
      <button
        class="p-1.5 rounded-md text-kong-text-secondary hover:text-kong-primary hover:bg-kong-text-primary/5 transition-colors"
        on:click={handleRefresh}
        disabled={isLoading}
        title="Refresh transaction history"
      >
        <RefreshCw size={14} class={isLoading ? "animate-spin" : ""} />
      </button>

      <!-- Download options dropdown button -->
      <div class="relative">
        <button
          class="p-1.5 rounded-md text-kong-text-secondary hover:text-kong-primary hover:bg-kong-text-primary/5 transition-colors"
          on:click={() => showDownloadModal = true}
          disabled={isLoading}
          title="Download transaction history"
        >
          <Download size={14} />
        </button>
      </div>
    </div>
  </div>

  <!-- Filter tabs -->
  <div class="px-4 mb-3 flex items-center gap-1.5">
    {#each filterOptions as option}
      <button
        class="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors {selectedFilter ===
        option.id
          ? 'bg-kong-primary/10 text-kong-primary'
          : 'text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-text-primary/5'}"
        on:click={() => handleFilterChange(option.id)}
      >
        {option.label}
      </button>
    {/each}
  </div>

  <!-- Loading state -->
  {#if isLoading && !transactions.length}
    <div class="py-10 text-center">
      <div class="flex justify-center items-center h-32">
        <Loader2 class="w-6 h-6 animate-spin text-kong-text-secondary" />
      </div>
    </div>
  {:else if error}
    <div class="text-kong-accent-red text-sm text-center py-4">
      {error}
    </div>
  {:else if transactions.length === 0}
    <!-- Empty state -->
    <div class="py-10 text-center">
      <div
        class="p-5 rounded-full bg-kong-text-primary/5 inline-block mb-3 mx-auto"
        style="box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.03);"
      >
        <Clock size={24} class="text-kong-primary/40" />
      </div>
      <p class="text-base font-medium text-kong-text-primary">
        No Transaction History
      </p>
      <p class="text-sm text-kong-text-secondary/70 mt-1 max-w-[280px] mx-auto">
        Your transaction history will appear here once you start using the
        platform.
      </p>
    </div>
  {:else}
    <!-- Transaction list -->
    <div class="space-y-0">
      {#each transactions as tx (tx.tx_id)}
        <TransactionItem {tx} onClick={() => handleTransactionClick(tx)} />
      {/each}

      <!-- Load more button -->
      {#if hasMore}
        <div class="p-4 text-center">
          <button
            class="px-4 py-2 text-xs font-medium rounded-lg bg-kong-text-primary/10 text-kong-text-primary hover:bg-kong-text-primary/15 transition-colors"
            on:click={() => loadTransactions(true)}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load More Transactions"}
          </button>
        </div>
      {/if}

      <!-- Loading more indicator -->
      {#if loadingMore}
        <div class="flex justify-center py-4">
          <Loader2 class="w-5 h-5 animate-spin text-kong-text-secondary" />
        </div>
      {/if}
    </div>
  {/if}
</div>
