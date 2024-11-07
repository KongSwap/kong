<script lang="ts">
    import { onMount } from 'svelte';
    import { TokenService } from '$lib/services/TokenService';
    import { tokenStore } from '$lib/stores/tokenStore';
    import { walletStore } from '$lib/stores/walletStore';
    import { fly, fade } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import LoadingIndicator from '$lib/components/stats/LoadingIndicator.svelte';

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

    let transactions: Array<Record<string, TransactionData>> = [];
    let isLoading = true;
    let error: string | null = null;

    function getTransactionData(tx: Record<string, TransactionData>): { type: string, data: TransactionData } {
        const type = Object.keys(tx)[0];
        return { type, data: tx[type] };
    }

    function formatTimestamp(ts: bigint): string {
        const date = new Date(Number(ts) / 1_000_000);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return `${Math.round(diffInHours)} hours ago`;
        } else if (diffInHours < 48) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString();
        }
    }

    function formatAmount(amount: string, symbol: string): string {
        const token = $tokenStore.tokens.find(t => t.symbol === symbol);
        if (!token) return amount;

        const decimals = token.decimals || 8; // Default to 8 if not specified
        const amountBigInt = BigInt(amount);
        const divisor = BigInt(10) ** BigInt(decimals);
        const wholePart = amountBigInt / divisor;
        const fractionalPart = amountBigInt % divisor;

        let formattedFraction = fractionalPart.toString().padStart(decimals, '0');
        // Trim trailing zeros
        formattedFraction = formattedFraction.replace(/0+$/, '');

        return formattedFraction ? 
            `${wholePart}.${formattedFraction}` : 
            wholePart.toString();
    }

    function getTransactionIcon(type: string): string {
        switch(type) {
            case 'Swap': return '🔄';
            case 'Send': return '↗️';
            case 'Receive': return '↙️';
            default: return '📝';
        }
    }

    onMount(async () => {
        try {
            isLoading = true;
            const txs = await TokenService.fetchUserTransactions($walletStore.account.owner);
            console.log(txs);
            if(txs.Ok) {
                transactions = txs.Ok;
            } else {
                error = txs.Err;
            }
        } catch (err) {
            error = 'Failed to load transactions';
            console.error(err);
        } finally {
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
            <span class="error-icon">⚠️</span>
            <p class="error-text">{error}</p>
        </div>
    {:else if !transactions || transactions.length === 0}
        <div class="empty-state" in:fade>
            <span class="empty-icon">📜</span>
            <p class="empty-text">No transactions yet</p>
            <p class="empty-subtext">Your transaction history will appear here</p>
        </div>
    {:else}
        {#each transactions as tx}
            {@const { type, data } = getTransactionData(tx)}
            <button 
                class="transaction-item"
                class:success={data.status === 'Success'}
                class:pending={data.status === 'Pending'}
                class:failed={data.status === 'Failed'}
                type="button"
                in:fly={{ x: -20, duration: 300, delay: 100 }}
            >
                <div class="tx-info">
                    {#if type === "Swap"}
                        <div class="token-pair">
                            <img
                                src={$tokenStore.tokens.find(t => t.symbol === data.pay_symbol)?.logo || "/tokens/not_verified.webp"}
                                alt={data.pay_symbol}
                                class="h-[48px] w-[48px] rounded-full"
                            />
                            <img
                                src={$tokenStore.tokens.find(t => t.symbol === data.receive_symbol)?.logo || "/tokens/not_verified.webp"}
                                alt={data.receive_symbol}
                                class="h-[48px] w-[48px] rounded-full receive-logo"
                            />
                        </div>
                    {:else}
                        <div class="tx-icon" class:success={data.status === 'Success'}>
                            {getTransactionIcon(type)}
                        </div>
                    {/if}
                    
                    <div class="flex flex-col text-left">
                        <span class="symbol">{type}</span>
                        <span class="name text-nowrap text-ellipsis text-xs">
                            {#if type === "Swap"}
                                {formatAmount(data.pay_amount || '0', data.pay_symbol || '')} {data.pay_symbol} → 
                                {formatAmount(data.receive_amount || '0', data.receive_symbol || '')} {data.receive_symbol}
                            {/if}
                        </span>
                    </div>
                </div>

                <div class="tx-values">
                    <span class="tx-status" class:success={data.status === 'Success'}>
                        {data.status}
                    </span>
                    <span class="tx-date">{formatTimestamp(data.ts)}</span>
                </div>
            </button>
        {/each}
    {/if}
</div>

<style lang="postcss">
    .transaction-history {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 4px;
    }

    .loading-state,
    .error-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 32px;
        background: rgba(0, 0, 0, 0.2);
        border: 2px solid var(--sidebar-border);
        border-radius: 8px;
        text-align: center;
    }

    .transaction-item {
        width: 100%;
        text-align: left;
        border: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .transaction-item:hover {
        border: 2px solid #f7bf26c8;
        background: rgba(0, 0, 0, 0.2);
        padding: 10px;
        transform: scale(1.02);
    }

    .tx-info {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .tx-values {
        text-align: right;
        display: flex;
        flex-direction: column;
        font-size: 0.875rem;
    }

    .symbol {
        color: #fbbf24;
        font-size: 1rem;
        font-weight: bold;
    }

    .name {
        opacity: 0.7;
    }

    .token-pair {
        position: relative;
        width: 48px;
        height: 48px;
    }

    .receive-logo {
        position: absolute;
        bottom: -6px;
        right: -6px;
        transform: scale(0.9);
    }

    .tx-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 50%;
    }

    .tx-status {
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(251, 191, 36, 0.1);
        color: #fbbf24;
    }

    .tx-date {
        font-size: 0.75rem;
        opacity: 0.7;
    }

    @media (max-width: 768px) {
        .transaction-history {
            padding: 12px 4px;
        }

        .transaction-item {
            padding: 8px;
        }

        .tx-icon {
            width: 32px;
            height: 32px;
            font-size: 1rem;
        }
    }
</style>
