<script lang="ts">
    import { onMount } from 'svelte';
    import { auth } from '$lib/services/auth';
    import { fly, fade } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import LoadingIndicator from '$lib/components/stats/LoadingIndicator.svelte';
    import { formatTokenAmount } from '$lib/utils/numberFormatUtils';
    import { TokenService, tokenStore } from '$lib/services/tokens';

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

    function processTransaction(tx: any) {
        if ('AddLiquidity' in tx) {
            return {
                type: 'Add Liquidity',
                status: tx.AddLiquidity.status,
                formattedDate: new Date(Number(tx.AddLiquidity.ts) / 1000000).toLocaleString(),
                symbol_0: tx.AddLiquidity.symbol_0,
                symbol_1: tx.AddLiquidity.symbol_1,
                amount_0: formatTokenAmount(tx.AddLiquidity.amount_0.toString(), 8),
                amount_1: formatTokenAmount(tx.AddLiquidity.amount_1.toString(), 8),
                lp_amount: formatTokenAmount(tx.AddLiquidity.add_lp_token_amount.toString(), 8)
            };
        }
        // Add other transaction types here if needed
        return null;
    }

    onMount(() => {
        if ($auth.isConnected) {
            TokenService.fetchUserTransactions().then(response => {
                console.log("TXS", response);
                
                if (response.Ok) {
                    processedTransactions = response.Ok
                        .map(processTransaction)
                        .filter(tx => tx !== null);
                } else if (response.Err) {
                    error = response.Err;
                }
            }).catch(err => {
                console.error("Error fetching transactions:", err);
                error = err.message || "Failed to load transactions";
            });
            isLoading = false;
        }
    });
</script>

<div class="transaction-history" in:fly={{ y: 20, duration: 400, easing: cubicOut }}>
    {#if isLoading}
        <div class="loading-state" in:fade>
            <LoadingIndicator />
            <p>Loading your transaction history...</p>
        </div>
    {:else if error}
        <div class="error-state" in:fade>
            <p>{error}</p>
        </div>
    {:else if processedTransactions.length === 0}
        <div class="empty-state" in:fade>
            <p>No transactions found</p>
        </div>
    {:else}
        {#each processedTransactions as tx}
            <div class="transaction-item" in:fade>
                <div class="transaction-header">
                    <span class="timestamp">{tx.formattedDate}</span>
                    <span class="status {tx.status?.toLowerCase() || 'pending'}">{tx.status || 'Pending'}</span>
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
                    {/if}
                </div>
            </div>
        {/each}
    {/if}
</div>

<style lang="postcss">
    .transaction-history {
        @apply flex flex-col gap-4 p-4;
    }

    .transaction-item {
        @apply bg-gray-800/50 rounded-lg p-4;
    }

    .transaction-header {
        @apply flex justify-between items-center mb-2;
    }

    .timestamp {
        @apply text-sm text-gray-400;
    }

    .status {
        @apply text-sm px-2 py-1 rounded;
    }

    .status.completed {
        @apply bg-green-500/20 text-green-400;
    }

    .status.pending {
        @apply bg-yellow-500/20 text-yellow-400;
    }

    .status.failed {
        @apply bg-red-500/20 text-red-400;
    }

    .transaction-details {
        @apply space-y-2;
    }

    .amount-row {
        @apply flex justify-between items-center text-sm;
    }

    .loading-state, .error-state, .empty-state {
        @apply text-center p-8 text-gray-400;
    }

    .transaction-type {
        @apply text-sm font-medium text-white/80 mb-2;
    }

    .status.success {
        @apply bg-green-500/20 text-green-400;
    }

    .status.pending {
        @apply bg-yellow-500/20 text-yellow-400;
    }

    .status.failed {
        @apply bg-red-500/20 text-red-400;
    }
</style>
