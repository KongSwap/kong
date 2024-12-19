<script lang="ts">
    import Modal from "$lib/components/common/Modal.svelte";
    import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
    import { onDestroy } from 'svelte';

    export let token0: FE.Token;
    export let token1: FE.Token;
    export let amount0: string;
    export let amount1: string;
    export let pool: BE.Pool | null;
    export let onClose: () => void;
    export let onConfirm: () => Promise<void>;
    export let isOpen: boolean;

    let isLoading = false;
    let error: string | null = null;
    let mounted = true;
    
    onDestroy(() => {
        mounted = false;
    });

    async function handleConfirm() {
        if (isLoading) return;
        
        isLoading = true;
        error = null;
        
        try {
            await onConfirm();
            if (mounted) {
                isLoading = false;
            }
        } catch (err) {
            console.error("Error in confirmation:", err);
            if (mounted) {
                error = err instanceof Error ? err.message : "Failed to add liquidity";
                isLoading = false;
            }
        }
    }

    $: token0Amount = amount0;
    $: token1Amount = amount1;
    $: token0Value = (Number(amount0) * token0.metrics.price).toFixed(2);
    $: token1Value = (Number(amount1) * token1.metrics.price).toFixed(2);
    $: totalValue = (Number(token0Value) + Number(token1Value)).toFixed(2);
    
    $: {
        if (pool) {
            console.log('Pool Debug:', {
                pool_balance_0: pool.balance_0,
                pool_balance_1: pool.balance_1,
                token0_price: token0.metrics.price,
                token1_price: token1.metrics.price,
                pool_value: (Number(pool.balance_0) * Number(token0.metrics.price) + Number(pool.balance_1) * Number(token1.metrics.price)).toFixed(2),
                your_value: totalValue
            });
        }
    }
    
    $: poolRate = pool ? formatToNonZeroDecimal(Number(pool.balance_1) / Number(pool.balance_0)) : "0";
</script>

<Modal isOpen={isOpen} title="Review Liquidity" onClose={onClose} variant="green">
    <div class="confirmation-container">
        {#if error}
            <div class="error-message">
                {error}
            </div>
        {/if}

        <div class="content-wrapper">
            <div class="token-amounts">
                <div class="token-amount">
                    <div class="token-info">
                        <img src={token0.logo_url} alt={token0.symbol} class="token-logo" />
                        <span class="token-symbol">{token0.symbol}</span>
                    </div>
                    <div class="amount-info">
                        <span class="amount">{token0Amount}</span>
                        <span class="usd-value">${token0Value}</span>
                    </div>
                </div>

                <div class="plus">+</div>

                <div class="token-amount">
                    <div class="token-info">
                        <img src={token1.logo_url} alt={token1.symbol} class="token-logo" />
                        <span class="token-symbol">{token1.symbol}</span>
                    </div>
                    <div class="amount-info">
                        <span class="amount">{token1Amount}</span>
                        <span class="usd-value">${token1Value}</span>
                    </div>
                </div>
            </div>

            <div class="pool-info">
                <div class="info-row">
                    <span>Total Value:</span>
                    <span>${totalValue}</span>
                </div>
                {#if pool}
                    <div class="info-row">
                        <span>Current Rate:</span>
                        <span>1 {token0.symbol} = {poolRate} {token1.symbol}</span>
                    </div>
                {/if}
            </div>
        </div>

        <div class="button-wrapper">
            <button
                class="confirm-button"
                on:click={handleConfirm}
                disabled={isLoading}
            >
                <span>{isLoading ? "Confirming..." : "Confirm Add Liquidity"}</span>
                {#if isLoading}
                    <div class="loading-spinner" />
                {/if}
            </button>
        </div>
    </div>
</Modal>

<style lang="postcss">
    .confirmation-container {
        @apply flex flex-col h-full min-h-[400px];
    }

    .content-wrapper {
        @apply flex-1 flex flex-col gap-6 overflow-y-auto;
    }

    .button-wrapper {
        @apply sticky bottom-0 pt-4 mt-auto bg-[#0F1114];
        @apply border-t border-white/10;
    }

    .token-amounts {
        @apply flex flex-col gap-4 bg-white/5 rounded-xl p-4;
    }

    .token-amount {
        @apply flex items-center justify-between;
    }

    .token-info {
        @apply flex items-center gap-2;
    }

    .token-logo {
        @apply w-8 h-8 rounded-full;
    }

    .token-symbol {
        @apply text-white text-lg font-medium;
    }

    .amount-info {
        @apply flex flex-col items-end;
    }

    .amount {
        @apply text-white text-xl font-medium;
    }

    .usd-value {
        @apply text-white/60 text-sm;
    }

    .plus {
        @apply text-white/60 text-xl text-center my-2;
    }

    .pool-info {
        @apply flex flex-col gap-3 bg-white/5 rounded-xl p-4;
    }

    .info-row {
        @apply flex justify-between text-white/80 text-sm;
    }

    .confirm-button {
        @apply w-full px-6 py-4 rounded-xl;
        @apply bg-blue-600 text-white font-medium;
        @apply flex items-center justify-center gap-2;
        @apply disabled:opacity-50 disabled:cursor-not-allowed;
        @apply hover:bg-blue-700 transition-colors duration-200;
    }

    .loading-spinner {
        @apply w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin;
    }

    .error-message {
        @apply text-red-400 text-center p-4 bg-red-400/20 rounded-xl;
    }
</style> 
