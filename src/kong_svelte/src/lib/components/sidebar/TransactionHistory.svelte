<script lang="ts">
	import { onMount } from 'svelte';
    import {TokenService} from '$lib/services/TokenService';
    import { walletStore } from '$lib/stores/walletStore';

    interface TransactionData {
        ts: bigint;
        txs: Array<any>;
        request_id: bigint;
        status: string;
        tx_id: bigint;
    }

    let transactions: Array<Record<string, TransactionData>>;

    function getTransactionData(tx: Record<string, TransactionData>): { type: string, data: TransactionData } {
        const type = Object.keys(tx)[0];
        return { type, data: tx[type] };
    }

    function formatTimestamp(ts: bigint): string {
        return new Date(Number(ts) / 1_000_000).toLocaleString();
    }

    onMount(async () => {
     await TokenService.fetchUserTransactions($walletStore.account.owner).then(txs => {
        if(txs.Ok) {
            transactions = txs.Ok;
            console.log(transactions);
        } else {
            console.error(txs.Err);
        }
     });
    });
</script>

<div class="transaction-history">
    {#if !transactions || transactions.length === 0}
        <div class="empty-state">
            <span class="empty-icon">📜</span>
            <p class="empty-text">No transactions yet</p>
        </div>
    {:else}
        {#each transactions as tx}
            {@const { type, data } = getTransactionData(tx)}
            <button 
                class="transaction-item"
                type="button"
            >
                <div class="tx-icon">
                    {#if type === "Swap"}
                        ↔️
                    {/if}
                </div>
                <div class="tx-details">
                    <div class="tx-header">
                        <span class="tx-type">
                            {type} 
                            {#if type === "Swap"}
                                {data.pay_symbol} ({data.pay_chain})
                                to 
                                {data.receive_symbol} ({data.receive_chain})
                            {/if}
                        </span>
                        <span class="tx-status" class:success={data.status === 'Success'}>
                            {data.status}
                        </span>
                    </div>
                    <div class="tx-info">
                        <span class="tx-id">ID: {data.request_id.toString()}</span>
                        <span class="tx-date">{formatTimestamp(data.ts)}</span>
                    </div>
                </div>
            </button>
        {/each}
    {/if}
</div>

<style scoped>
    .transaction-history {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px 8px;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 24px;
        background: var(--sidebar-bg);
        border: 2px solid var(--sidebar-border);
        position: relative;
        overflow: hidden;
    }

    .empty-state::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, var(--shine-color) 0%, transparent 50%);
        pointer-events: none;
    }

    .empty-icon {
        font-size: 24px;
        opacity: 0.6;
    }

    .empty-text {
        font-family: 'Press Start 2P', monospace;
        color: var(--sidebar-border);
        text-align: center;
        margin: 0;
    }

    .transaction-item {
        width: 100%;
        text-align: left;
        border: none;
        background: var(--sidebar-bg);
        cursor: pointer;
        padding: 12px;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        border: 2px solid var(--sidebar-border);
        position: relative;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .transaction-item::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, var(--shine-color) 0%, transparent 50%);
        pointer-events: none;
    }

    .transaction-item:hover {
        transform: translateX(4px);
        border-color: var(--sidebar-border-dark);
        box-shadow: -2px 2px 8px var(--shadow-color);
    }

    .tx-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: var(--sidebar-bg);
        border: 1px solid var(--sidebar-border);
        font-size: 1rem;
    }

    .send .tx-icon {
        color: var(--error-color);
    }

    .receive .tx-icon {
        color: var(--success-color);
    }

    .tx-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .tx-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .tx-type {
        font-family: 'Press Start 2P', monospace;
        text-transform: uppercase;
    }

    .tx-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
    }

    .tx-date {
        font-family: monospace;
        font-size: 9px;
        color: var(--sidebar-border);
        opacity: 0.6;
    }

    @media (max-width: 768px) {
        .transaction-history {
            padding: 12px 4px;
        }

        .transaction-item {
            padding: 8px;
        }

        .tx-icon {
            width: 24px;
            height: 24px;
            font-size: 14px;
        }

        .tx-type {
            font-size: 8px;
        }

        .tx-amount {
            font-size: 10px;
        }

        .tx-address {
            font-size: 8px;
        }

        .tx-date {
            font-size: 7px;
        }
    }
</style>
