<script lang="ts">
    import { auth } from '$lib/services/auth';
    import { fly, fade } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import LoadingIndicator from '$lib/components/stats/LoadingIndicator.svelte';
    import { formatBalance } from '$lib/utils/numberFormatUtils';
    import { TokenService, tokenStore } from '$lib/services/tokens';
    import { onMount } from 'svelte';
    import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';

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
    let selectedFilter: string = 'all';
    const filterOptions = [
        { id: 'all', label: 'All' },
        { id: 'swap', label: 'Swaps' },
        { id: 'pool', label: 'Pool' },
        { id: 'send', label: 'Send' }
    ];

    function processTransaction(tx: any) {
        // First check if we have a valid transaction object
        if (!tx) return null;

        // Helper function to format timestamp
        const formatTimestamp = (ts: bigint | number | string) => {
            // Convert to number and ensure it's in milliseconds
            const timestamp = typeof ts === 'bigint' ? Number(ts) : Number(ts);
            // If timestamp is in nanoseconds or microseconds, convert to milliseconds
            const msTimestamp = timestamp > 1e12 ? timestamp / 1e6 : timestamp;
            return new Date(msTimestamp).toLocaleString();
        };

        if ('AddLiquidity' in tx) {
            const data = tx.AddLiquidity;
            return {
                type: 'Add Liquidity',
                status: data.status,
                formattedDate: formatTimestamp(data.ts),
                symbol_0: data.symbol_0,
                symbol_1: data.symbol_1,
                amount_0: formatBalance(data.amount_0.toString(), 8),
                amount_1: formatBalance(data.amount_1.toString(), 8),
                lp_amount: formatBalance(data.add_lp_token_amount.toString(), 8)
            };
        } else if ('Swap' in tx) {
            const data = tx.Swap;
            return {
                type: 'Swap',
                status: data.status,
                formattedDate: formatTimestamp(data.ts),
                pay_symbol: data.pay_symbol,
                receive_symbol: data.receive_symbol,
                pay_amount: formatBalance(data.pay_amount.toString(), 8),
                receive_amount: formatBalance(data.receive_amount.toString(), 8),
                price: data.price,
                slippage: data.slippage
            };
        } else if ('RemoveLiquidity' in tx) {
            const data = tx.RemoveLiquidity;
            return {
                type: 'Remove Liquidity',
                status: data.status,
                formattedDate: formatTimestamp(data.ts),
                symbol_0: data.symbol_0,
                symbol_1: data.symbol_1,
                amount_0: formatBalance(data.amount_0.toString(), 8),
                amount_1: formatBalance(data.amount_1.toString(), 8),
                lp_amount: formatBalance(data.remove_lp_token_amount.toString(), 8)
            };
        }
        console.log('Unhandled transaction type:', tx);
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
                processedTransactions = response.Ok
                    .map(processTransaction)
                    .filter(tx => tx !== null);
                console.log("Processed transactions:", processedTransactions);
            } else if (response.Err) {
                error = typeof response.Err === 'string' ? response.Err : 'Failed to load transactions';
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
    <div class="notice-banner">
        {#if selectedFilter === 'send'}
            Note: Send transaction tracking will be available soon!
        {:else}
            Showing your 20 most recent actions. More insights coming soon! 🌎
        {/if}
    </div>

    <!-- Add filter buttons at the top -->
    <div class="filter-buttons">
        {#each filterOptions as option}
            <button 
                class="filter-btn {selectedFilter === option.id ? 'active' : ''}"
                on:click={() => selectedFilter = option.id}
            >
                {option.label}
            </button>
        {/each}
    </div>
    
    <div class="transaction-history-content">
        <div class="transaction-history">
            {#if isLoading}
                <div class="loading-state" in:fade>
                    <LoadingIndicator />
                    <p>Loading your transaction history...</p>
                </div>
            {:else if error}
                <div class="error-state" in:fade>
                    <p>{error}</p>
                </div>
            {:else if selectedFilter === 'send'}
                <div class="empty-state" in:fade>
                    <p>Send transaction tracking is coming soon!</p>
                </div>
            {:else if processedTransactions.length === 0}
                <div class="empty-state" in:fade>
                    <p>No actions found</p>
                </div>
            {:else}
                {#each processedTransactions.filter(tx => {
                    if (selectedFilter === 'all') return true;
                    if (selectedFilter === 'swap') return tx.type === 'Swap';
                    if (selectedFilter === 'pool') return tx.type === 'Add Liquidity' || tx.type === 'Remove Liquidity';
                    if (selectedFilter === 'send') return tx.type === 'Send';
                    return true;
                }) as tx}
                    <div class="transaction-item" in:fade>
                        <div class="transaction-header">
                            <span class="timestamp">{tx.formattedDate}</span>
                            <span class="status {tx.status ? tx.status.toLowerCase().replace('_', '-') : 'pending'}">{tx.status ? tx.status.replace('_', ' ') : 'Pending'}</span>
                        </div>
                        <div class="transaction-details">
                            <div class="transaction-type">{tx.type}</div>
                            {#if tx.type === 'Add Liquidity'}
                                <div class="amount-row">
                                    <span>Added:</span>
                                    <span>
                                        {tx.amount_0} {tx.symbol_0} + 
                                        {tx.amount_1} {tx.symbol_1}
                                    </span>
                                </div>
                                <div class="amount-row">
                                    <span>Received:</span>
                                    <span>{tx.lp_amount} LP</span>
                                </div>
                            {:else if tx.type === 'Swap'}
                                <div class="amount-row">
                                    <span>Paid:</span>
                                    <span>{tx.pay_amount} {tx.pay_symbol}</span>
                                </div>
                                <div class="amount-row">
                                    <span>Received:</span>
                                    <span>{tx.receive_amount} {tx.receive_symbol}</span>
                                </div>
                                <div class="amount-row">
                                    <span>Slippage:</span>
                                    <span>{tx.slippage}%</span>
                                </div>
                            {:else if tx.type === 'Remove Liquidity'}
                                <div class="amount-row">
                                    <span>Removed:</span>
                                    <span>
                                        {tx.amount_0} {tx.symbol_0} + 
                                        {tx.amount_1} {tx.symbol_1}
                                    </span>
                                </div>
                                <div class="amount-row">
                                    <span>Received:</span>
                                    <span>{tx.lp_amount} LP</span>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
</div>

<style lang="postcss">
  .transaction-history-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .notice-banner {
    background-color: rgba(59, 130, 246, 0.1);
    color: rgb(147, 197, 253);
    padding: 0.75rem;
    text-align: center;
    font-size: 0.875rem;
    border-bottom: 1px solid rgba(59, 130, 246, 0.2);
  }

  .transaction-history-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
    margin-top: 1rem;
  }

  .transaction-history-content::-webkit-scrollbar {
    width: 6px;
  }

  .transaction-history-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .transaction-history-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .transaction-history-content::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .transaction-history {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 100%;
  }

  .transaction-item {
    background-color: rgba(31, 41, 55, 0.5);
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .transaction-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .timestamp {
    font-size: 0.875rem;
    color: rgb(156, 163, 175);
  }

  .status {
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }

  .status.completed {
    background-color: rgba(34, 197, 94, 0.2);
    color: rgb(74, 222, 128);
  }

  .status.pending {
    background-color: rgba(234, 179, 8, 0.2);
    color: rgb(250, 204, 21);
  }

  .status.failed {
    background-color: rgba(239, 68, 68, 0.2);
    color: rgb(248, 113, 113);
  }

  .transaction-details {
    margin-top: 0.5rem;
  }

  .amount-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
  }

  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-height: 160px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.875rem;
  }

  .transaction-type {
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 0.5rem;
  }

  .status.success {
    background-color: rgba(34, 197, 94, 0.2);
    color: rgb(74, 222, 128);
  }

  .status.pending {
    background-color: rgba(234, 179, 8, 0.2);
    color: rgb(250, 204, 21);
  }

  .status.failed {
    background-color: rgba(239, 68, 68, 0.2);
    color: rgb(248, 113, 113);
  }

  .filter-buttons {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 0;
    border-bottom: 1px solid rgb(55, 65, 81);
  }

  .filter-btn {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    color: rgb(156, 163, 175);
    transition: background-color 0.2s;
  }

  .filter-btn:hover {
    background-color: rgba(55, 65, 81, 0.5);
  }

  .filter-btn.active {
    background-color: rgba(59, 130, 246, 0.2);
    color: rgb(96, 165, 250);
  }
</style>
