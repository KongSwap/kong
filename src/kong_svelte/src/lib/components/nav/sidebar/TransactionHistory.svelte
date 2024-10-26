<script lang="ts">
    export let transactions: {
        type: 'send' | 'receive';
        amount: string;
        token: string;
        to?: string;
        from?: string;
        date: string;
    }[];

    function formatAddress(address: string): string {
        return address.slice(0, 6) + '...' + address.slice(-4);
    }

    function getTransactionIcon(type: 'send' | 'receive'): string {
        return type === 'send' ? '↗' : '↙';
    }

    function getTransactionColor(type: 'send' | 'receive'): string {
        return type === 'send' ? '#ff4444' : '#44ff44';
    }
</script>

<div class="transaction-history">
    {#if transactions.length === 0}
        <div class="empty-state">
            <span class="empty-icon">📜</span>
            <p class="empty-text">No transactions yet</p>
        </div>
    {:else}
        {#each transactions as tx}
            <button 
                class="transaction-item"
                style="--tx-color: {getTransactionColor(tx.type)}"
                type="button"
            >
                <div class="tx-icon">
                    {getTransactionIcon(tx.type)}
                </div>
                <div class="tx-details">
                    <div class="tx-header">
                        <span class="tx-type">{tx.type}</span>
                        <span class="tx-amount">
                            {tx.type === 'send' ? '-' : '+'}{tx.amount} {tx.token}
                        </span>
                    </div>
                    <div class="tx-info">
                        <span class="tx-address">
                            {#if tx.type === 'send'}
                                To: {formatAddress(tx.to || '')}
                            {:else}
                                From: {formatAddress(tx.from || '')}
                            {/if}
                        </span>
                        <span class="tx-date">{tx.date}</span>
                    </div>
                </div>
            </button>
        {/each}
    {/if}
</div>

<style>
    .transaction-history {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px 0;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 32px;
        background: rgba(26, 71, 49, 0.1);
        border: 2px solid rgba(255, 204, 0, 0.3);
        border-radius: 8px;
    }

    .empty-icon {
        font-size: 32px;
        opacity: 0.6;
    }

    .empty-text {
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        color: #aaaaaa;
        text-align: center;
        margin: 0;
    }

    .transaction-item {
        width: 100%;
        text-align: left;
        border: none;
        background: none;
        cursor: pointer;
        padding: 0;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: rgba(26, 71, 49, 0.1);
        border: 2px solid rgba(255, 204, 0, 0.3);
        border-radius: 8px;
        transition: all 0.3s ease;
    }

    .transaction-item:hover {
        transform: translateX(5px);
        border-color: var(--tx-color);
        box-shadow: 0 0 20px rgba(255, 204, 0, 0.1);
    }

    .tx-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: rgba(255, 204, 0, 0.1);
        border-radius: 8px;
        font-size: 18px;
        color: var(--tx-color);
        border: 1px solid rgba(255, 204, 0, 0.2);
    }

    .tx-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .tx-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .tx-type {
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        color: var(--tx-color);
        text-transform: uppercase;
    }

    .tx-amount {
        font-family: monospace;
        font-size: 14px;
        color: var(--tx-color);
        font-weight: bold;
    }

    .tx-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
    }

    .tx-address {
        font-family: monospace;
        font-size: 12px;
        color: #aaaaaa;
        opacity: 0.8;
    }

    .tx-date {
        font-family: monospace;
        font-size: 10px;
        color: #aaaaaa;
        opacity: 0.6;
    }

    @media (max-width: 768px) {
        .transaction-item {
            padding: 12px;
        }

        .tx-icon {
            width: 28px;
            height: 28px;
            font-size: 16px;
        }

        .tx-type {
            font-size: 10px;
        }

        .tx-amount {
            font-size: 12px;
        }

        .tx-address {
            font-size: 10px;
        }

        .tx-date {
            font-size: 8px;
        }
    }
</style>
