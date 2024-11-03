be the glue

<script lang="ts">
    import { fade } from 'svelte/transition';
    import { formatCurrency } from '$lib/utils/formatters';

    export let transaction: { type: string; data: TransactionData };
    export let onClose: () => void;

    $: currentValue = transaction.type === 'Swap' 
        ? (transaction.data.receive_amount * getCurrentPrice(transaction.data.receive_symbol))
        : (transaction.data.pay_amount * getCurrentPrice(transaction.data.pay_symbol));

    $: historicalValue = transaction.type === 'Swap'
        ? (transaction.data.receive_amount * transaction.data.receive_price_usd)
        : (transaction.data.pay_amount * transaction.data.pay_price_usd);

    async function getCurrentPrice(symbol: string): Promise<number> {
        // Implement price fetching logic
        return TokenService.getCurrentPrice(symbol);
    }
</script>

<div class="modal-backdrop" on:click={onClose} transition:fade>
    <div class="modal-content" on:click|stopPropagation>
        <button class="close-button" on:click={onClose}>×</button>
        
        <h2>{transaction.type} Details</h2>
        
        <div class="transaction-details">
            <div class="detail-row">
                <span>Status:</span>
                <span class="status {transaction.data.status.toLowerCase()}">
                    {transaction.data.status}
                </span>
            </div>

            {#if transaction.type === 'Swap'}
                <div class="swap-info">
                    <div class="coin-detail">
                        <img src={getCoinLogo(transaction.data.pay_symbol, transaction.data.pay_chain)} 
                             alt={transaction.data.pay_symbol} />
                        <span>{transaction.data.pay_amount} {transaction.data.pay_symbol}</span>
                    </div>
                    <span class="arrow">→</span>
                    <div class="coin-detail">
                        <img src={getCoinLogo(transaction.data.receive_symbol, transaction.data.receive_chain)} 
                             alt={transaction.data.receive_symbol} />
                        <span>{transaction.data.receive_amount} {transaction.data.receive_symbol}</span>
                    </div>
                </div>
            {/if}

            <div class="value-comparison">
                <div class="value-then">
                    <span>Value at transaction:</span>
                    <span>{formatCurrency(historicalValue)}</span>
                </div>
                <div class="value-now">
                    <span>Current value:</span>
                    <span>{formatCurrency(currentValue)}</span>
                </div>
                <div class="value-change" class:positive={currentValue > historicalValue}>
                    {((currentValue - historicalValue) / historicalValue * 100).toFixed(2)}%
                </div>
            </div>
        </div>
    </div>
</div>

<style lang="postcss">
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .modal-content {
        background: #1a1a1a;
        border-radius: 12px;
        padding: 24px;
        max-width: 480px;
        width: 90%;
        position: relative;
    }

</style>

