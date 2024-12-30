<script lang="ts">
  import { auth } from "$lib/services/auth";
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { TokenService, tokenStore } from "$lib/services/tokens";
  import { onMount } from "svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  // Accept transactions prop for live data
  export let transactions: any[] = [];

  interface TransactionData {
    ts: bigint;
    txs: Array<any>;
    request_id: bigint;
    status: string;
    tx_id: bigint;
    pay_symbol?: string;
    pay_chain?: string;
    receive_symbol?: string;
    receive_chain?: string;
    pay_amount?: string;
    receive_amount?: string;
  }

  let isLoading = false;
  let error: string | null = null;
  let processedTransactions: any[] = [];
  let pollInterval: NodeJS.Timer;

  // Add filter state
  let selectedFilter: string = "all";
  const filterOptions = [
    { id: "all", label: "All" },
    { id: "swap", label: "Swap" },
    { id: "pool", label: "Pool" },
  ];

  function processTransaction(tx: any) {
    // First check if we have a valid transaction object
    if (!tx) return null;

    // Helper function to format timestamp
    const formatTimestamp = (ts: bigint | number | string) => {
      // Convert to number and ensure it's in milliseconds
      const timestamp = typeof ts === "bigint" ? Number(ts) : Number(ts);
      // If timestamp is in nanoseconds or microseconds, convert to milliseconds
      const msTimestamp = timestamp > 1e12 ? timestamp / 1e6 : timestamp;
      return new Date(msTimestamp).toLocaleString();
    };

    if ("AddLiquidity" in tx) {
      const data = tx.AddLiquidity;
      return {
        type: "Add Liquidity",
        status: data.status,
        formattedDate: formatTimestamp(data.ts),
        symbol_0: data.symbol_0,
        symbol_1: data.symbol_1,
        amount_0: formatBalance(data.amount_0.toString(), 8),
        amount_1: formatBalance(data.amount_1.toString(), 8),
        lp_amount: formatBalance(data.add_lp_token_amount.toString(), 8),
      };
    } else if ("Swap" in tx) {
      const data = tx.Swap;
      return {
        type: "Swap",
        status: data.status,
        formattedDate: formatTimestamp(data.ts),
        pay_symbol: data.pay_symbol,
        receive_symbol: data.receive_symbol,
        pay_amount: formatBalance(data.pay_amount.toString(), 8),
        receive_amount: formatBalance(data.receive_amount.toString(), 8),
        price: data.price,
        slippage: data.slippage,
      };
    } else if ("RemoveLiquidity" in tx) {
      const data = tx.RemoveLiquidity;
      return {
        type: "Remove Liquidity",
        status: data.status,
        formattedDate: formatTimestamp(data.ts),
        symbol_0: data.symbol_0,
        symbol_1: data.symbol_1,
        amount_0: formatBalance(data.amount_0.toString(), 8),
        amount_1: formatBalance(data.amount_1.toString(), 8),
        lp_amount: formatBalance(data.remove_lp_token_amount.toString(), 8),
      };
    }
    console.log("Unhandled transaction type:", tx);
    return null;
  }

  async function loadTransactions() {
    isLoading = true;
    error = null;

    try {
      if (!$auth.isConnected) {
        processedTransactions = [];
        return;
      }

      const response = await TokenService.fetchUserTransactions();
      if (response.Ok) {
        processedTransactions = response.Ok.map(processTransaction).filter(
          (tx) => tx !== null,
        );
        console.log("Processed transactions:", processedTransactions);
      } else if (response.Err) {
        error =
          typeof response.Err === "string"
            ? response.Err
            : "Failed to load transactions";
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      error = err.message || "Failed to load transactions";
    } finally {
      isLoading = false;
    }
  }

  // Watch auth store changes
  $: if ($auth.isConnected) {
    loadTransactions();
  }

  onMount(() => {
    // Poll every 30 seconds if connected
    pollInterval = setInterval(() => {
      if ($auth.isConnected) {
        loadTransactions();
      }
    }, 30000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  });
</script>

<div class="transaction-history-wrapper">
  <nav class="flex rounded-lg bg-kong-bg-light/50 border border-kong-border mx-2 mt-2">
    {#each filterOptions as option}
      <button
        class="tab-button flex-1 relative"
        class:active={selectedFilter === option.id}
        on:click={() => (selectedFilter = option.id)}
        role="tab"
        aria-selected={selectedFilter === option.id}
        aria-controls={`${option.id}-panel`}
      >
        <div class="flex items-center justify-center gap-1.5 py-2">
          {#if selectedFilter === option.id}
            <div class="absolute inset-0 bg-kong-accent-blue/5" />
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-kong-accent-blue" />
          {/if}
          <span class="relative z-10 text-xs font-medium">
            {option.label}
          </span>
        </div>
      </button>
    {/each}
  </nav>

  <div class="transaction-history-content">
    {#if isLoading}
      <div class="state-message" in:fade>
        <LoadingIndicator />
        <p>Loading your transaction history...</p>
      </div>
    {:else if error}
      <div class="state-message error" in:fade>
        <p>{error}</p>
      </div>
    {:else if selectedFilter === "send"}
      <div class="state-message" in:fade>
        <p>Send transaction tracking is coming soon!</p>
      </div>
    {:else if processedTransactions.length === 0}
      <div class="state-message" in:fade>
        <p>No actions found</p>
      </div>
    {:else}
      <div class="transaction-list">
        {#each processedTransactions.filter((tx) => {
          if (selectedFilter === "all") return true;
          if (selectedFilter === "swap") return tx.type === "Swap";
          if (selectedFilter === "pool") return tx.type === "Add Liquidity" || tx.type === "Remove Liquidity";
          if (selectedFilter === "send") return tx.type === "Send";
          return true;
        }) as tx}
          <div class="transaction-item" in:fade>
            <div class="transaction-header">
              <div class="flex items-center gap-2">
                <span class="transaction-type-icon">
                  {#if tx.type === "Swap"}
                    🔄
                  {:else if tx.type === "Add Liquidity"}
                    ➕
                  {:else if tx.type === "Remove Liquidity"}
                    ➖
                  {/if}
                </span>
                <span class="transaction-type">{tx.type}</span>
              </div>
              <span
                class="status {tx.status
                  ? tx.status.toLowerCase().replace('_', '-')
                  : 'pending'}"
              >
                {tx.status ? tx.status.replace("_", " ") : "Pending"}
              </span>
            </div>
            <div class="transaction-details">
              <div class="timestamp">{tx.formattedDate}</div>
              {#if tx.type === "Add Liquidity"}
                <div class="amount-row">
                  <span class="label">Added</span>
                  <span class="value">
                    {tx.amount_0}
                    {tx.symbol_0} + {tx.amount_1}
                    {tx.symbol_1}
                  </span>
                </div>
                <div class="amount-row">
                  <span class="label">Received</span>
                  <span class="value highlight">{tx.lp_amount} LP</span>
                </div>
              {:else if tx.type === "Swap"}
                <div class="amount-row">
                  <span class="label">Paid</span>
                  <span class="value">{tx.pay_amount} {tx.pay_symbol}</span>
                </div>
                <div class="amount-row">
                  <span class="label">Received</span>
                  <span class="value highlight"
                    >{tx.receive_amount} {tx.receive_symbol}</span
                  >
                </div>
                <div class="amount-row">
                  <span class="label">Slippage</span>
                  <span class="value text-gray-400">{tx.slippage}%</span>
                </div>
              {:else if tx.type === "Remove Liquidity"}
                <div class="amount-row">
                  <span class="label">Removed</span>
                  <span class="value">
                    {tx.amount_0}
                    {tx.symbol_0} + {tx.amount_1}
                    {tx.symbol_1}
                  </span>
                </div>
                <div class="amount-row">
                  <span class="label">Burned</span>
                  <span class="value">{tx.lp_amount} LP</span>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .transaction-history-wrapper {
    @apply flex flex-col h-full bg-kong-bg-dark/20;
  }

  .tab-button {
    @apply py-0 px-2 text-kong-text-secondary font-medium text-xs
           transition-all duration-200 border-r border-kong-border/50
           hover:text-kong-text-primary relative overflow-hidden;
  }

  .tab-button:last-child {
    @apply border-r-0;
  }

  .tab-button.active {
    @apply text-kong-accent-blue font-semibold;
  }

  .transaction-history-content {
    @apply flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5;
  }

  .state-message {
    @apply flex flex-col items-center justify-center gap-2 min-h-[180px] 
           text-kong-text-secondary text-xs bg-kong-bg-light/50 rounded-lg 
           border border-kong-border/50;
  }

  .state-message.error {
    @apply text-kong-accent-red bg-kong-accent-red/10 border-kong-accent-red/20;
  }

  .transaction-list {
    @apply flex flex-col gap-1.5;
  }

  .transaction-item {
    @apply bg-kong-bg-light/50 backdrop-blur-sm rounded-lg p-2 border border-kong-border/50
           hover:bg-kong-bg-light/70 transition-all duration-200
           hover:border-kong-border;
  }

  .transaction-header {
    @apply flex justify-between items-center mb-1.5;
  }

  .transaction-type-icon {
    @apply text-sm opacity-90;
  }

  .transaction-type {
    @apply text-xs font-semibold text-kong-text-primary;
  }

  .timestamp {
    @apply text-[11px] text-kong-text-secondary/80 mb-1.5 font-medium;
  }

  .status {
    @apply text-[11px] px-2 py-0.5 rounded-full font-medium border-none;
  }

  .status.completed,
  .status.success {
    @apply bg-kong-accent-green/10 text-kong-accent-green;
  }

  .status.pending {
    @apply bg-kong-warning/10 text-kong-warning;
  }

  .status.failed {
    @apply bg-kong-accent-red/10 text-kong-accent-red;
  }

  .transaction-details {
    @apply space-y-1 bg-kong-bg-dark/5 rounded-lg p-1.5;
  }

  .amount-row {
    @apply flex justify-between items-center text-xs py-0.5;
  }

  .amount-row .label {
    @apply text-kong-text-secondary/90 font-medium;
  }

  .amount-row .value {
    @apply text-kong-text-primary font-mono tracking-tight text-right flex-shrink-0 ml-2
           font-medium;
  }

  .amount-row .value.highlight {
    @apply text-kong-accent-blue font-semibold;
  }
</style>
