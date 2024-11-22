<script lang="ts">
    import { onMount } from 'svelte';
    import { auth } from '$lib/services/auth';
    import { fly, fade } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import LoadingIndicator from '$lib/components/stats/LoadingIndicator.svelte';
    import { formatTokenAmount } from '$lib/utils/numberFormatUtils';
    import { tokenStore } from '$lib/services/tokens';

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

    // Process transactions data when it changes
    let processedTransactions = transactions
        .sort((a, b) => Number(b.ts) - Number(a.ts))
        .map(tx => ({
            ...tx,
            formattedDate: new Date(Number(tx.ts)).toLocaleString(),
            payAmount: tx.pay_amount ? formatTokenAmount(tx.pay_amount, $tokenStore.tokens.find(t => t.symbol === tx.pay_symbol)?.decimals) : '',
            receiveAmount: tx.receive_amount ? formatTokenAmount(tx.receive_amount, $tokenStore.tokens.find(t => t.symbol === tx.receive_symbol)?.decimals) : ''
        }));

    onMount(() => {
        if ($auth.isConnected) {
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
                    <span class="status {tx.status.toLowerCase()}">{tx.status}</span>
                </div>
                <div class="transaction-details">
                    {#if tx.pay_amount}
                        <div class="amount-row">
                            <span>Paid:</span>
                            <span>{tx.payAmount} {tx.pay_symbol}</span>
                        </div>
                    {/if}
                    {#if tx.receive_amount}
                        <div class="amount-row">
                            <span>Received:</span>
                            <span>{tx.receiveAmount} {tx.receive_symbol}</span>
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
</style>
