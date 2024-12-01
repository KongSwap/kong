<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import Modal from '$lib/components/common/Modal.svelte';
    import TokenImages from '$lib/components/common/TokenImages.svelte';
    import { formatTokenAmount, formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
    import { tokenStore } from '$lib/services/tokens/tokenStore';
    import { PoolService } from '$lib/services/pools';

    const dispatch = createEventDispatcher();

    export let pool: any; // Changed from BE.UserPoolBalance to any for now
    export let showModal: boolean = false;
    
    let removeLiquidityAmount = '';
    let estimatedAmounts = { amount0: '0', amount1: '0' };
    let isRemoving = false;
    let error: string | null = null;
    let showConfirmation = false;

    // Get token objects for images
    $: token0 = $tokenStore.tokens.find(t => t.symbol === pool.symbol_0);
    $: token1 = $tokenStore.tokens.find(t => t.symbol === pool.symbol_1);

    function setPercentage(percent: number) {
        const maxAmount = parseFloat(pool.balance);
        removeLiquidityAmount = ((maxAmount * percent) / 100).toString();
        handleInputChange();
    }

    async function handleInputChange() {
        if (!removeLiquidityAmount || isNaN(parseFloat(removeLiquidityAmount))) {
            estimatedAmounts = { amount0: '0', amount1: '0' };
            return;
        }

        try {
            error = null;
            const numericAmount = parseFloat(removeLiquidityAmount);
            const [amount0, amount1] = await PoolService.calculateRemoveLiquidityAmounts(
                pool.symbol_0,
                pool.symbol_1,
                numericAmount
            );

            estimatedAmounts = {
                amount0: formatTokenAmount(amount0.toString(), 8),
                amount1: formatTokenAmount(amount1.toString(), 8)
            };
        } catch (err) {
            console.error('Error calculating removal amounts:', err);
            error = err.message;
            estimatedAmounts = { amount0: '0', amount1: '0' };
        }
    }

    async function handleRemoveLiquidity() {
        if (!removeLiquidityAmount || isNaN(parseFloat(removeLiquidityAmount))) {
            error = 'Please enter a valid amount';
            return;
        }

        try {
            error = null;
            isRemoving = true;
            const numericAmount = parseFloat(removeLiquidityAmount);
            
            await PoolService.removeLiquidity({
                token0: pool.symbol_0,
                token1: pool.symbol_1,
                lpTokenAmount: numericAmount
            });

            dispatch('liquidityRemoved');
            removeLiquidityAmount = '';
            showModal = false;
            estimatedAmounts = { amount0: '0', amount1: '0' };
        } catch (err) {
            console.error('Error removing liquidity:', err);
            error = err.message;
        } finally {
            isRemoving = false;
        }
    }

    function handleClose() {
        showModal = false;
        dispatch('close');
    }
</script>

<Modal
    isOpen={showModal}
    title="Pool Position"
    onClose={handleClose}
    width="600px"
>
    <div class="pool-details">
        <div class="pool-header">
            <div class="token-info">
                <TokenImages tokens={[token0, token1]} overlap={12} size={32} />
                <h3 class="token-pair">{pool.symbol_0}/{pool.symbol_1}</h3>
            </div>
            <button class="action-btn sneedlock" disabled>
                Sneedlock (Coming Soon)
            </button>
        </div>

        <div class="stats-grid">
            <div class="stat-item">
                <span class="stat-label">LP Token Balance</span>
                <span class="stat-value">{pool.balance}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Value</span>
                <span class="stat-value">${formatToNonZeroDecimal(pool.usd_balance)}</span>
            </div>
            <div class="stat-item mobile-full">
                <span class="stat-label">{pool.symbol_0} Amount</span>
                <span class="stat-value">{pool.amount_0}</span>
            </div>
            <div class="stat-item mobile-full">
                <span class="stat-label">{pool.symbol_1} Amount</span>
                <span class="stat-value">{pool.amount_1}</span>
            </div>
        </div>

        {#if !showConfirmation}
            <div class="remove-liquidity-section">
                <div class="input-container">
                    <label class="input-label mb-2">
                        Remove Liquidity Amount (LP Tokens)
                    </label>
                    <div class="input-wrapper">
                        <input
                            type="number"
                            bind:value={removeLiquidityAmount}
                            on:input={handleInputChange}
                            class="liquidity-input"
                            placeholder="0.0"
                            max={pool.balance}
                        />
                        <div class="percentage-buttons mt-2">
                            {#each [25, 50, 75, 100] as percent}
                                <button
                                    class="percent-btn"
                                    on:click={() => setPercentage(percent)}
                                >
                                    {percent}%
                                </button>
                            {/each}
                        </div>
                    </div>
                </div>

                {#if removeLiquidityAmount}
                    <div class="estimated-returns mt-2">
                        <div class="returns-header">
                            <span class="returns-label">You will receive:</span>
                            <div class="returns-divider" />
                        </div>
                        <div class="return-amounts">
                            <div class="token-return">
                                <TokenImages tokens={[token0]} size={20} />
                                <span>{estimatedAmounts.amount0} {pool.symbol_0}</span>
                            </div>
                            <div class="token-return">
                                <TokenImages tokens={[token1]} size={20} />
                                <span>{estimatedAmounts.amount1} {pool.symbol_1}</span>
                            </div>
                        </div>
                    </div>
                {/if}

                <button class="preview-btn"
                        disabled={!removeLiquidityAmount || isRemoving}
                        on:click={() => showConfirmation = true}
                    >
                        Preview Removal
                </button>
            </div>
        {:else}
            <div class="confirmation-section">
                <div class="confirmation-details">
                    <h4 class="confirmation-title">Confirm Removal</h4>
                    <div class="confirmation-info">
                        <div class="confirmation-amount-wrapper">
                            <span>Removing:</span>
                            <span class="highlight">{removeLiquidityAmount} LP Tokens</span>
                        </div>
                        <div class="returns-header">
                            <span>You will receive:</span>
                            <div class="returns-divider" />
                        </div>
                        <div class="token-returns">
                            <div class="token-return">
                                <TokenImages tokens={[token0]} size={20} />
                                <span>{estimatedAmounts.amount0} {pool.symbol_0}</span>
                            </div>
                            <div class="token-return">
                                <TokenImages tokens={[token1]} size={20} />
                                <span>{estimatedAmounts.amount1} {pool.symbol_1}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="confirmation-buttons">
                    <button
                        class="btn-secondary"
                        disabled={isRemoving}
                        on:click={() => showConfirmation = false}
                    >
                        Back
                    </button>
                    <button
                        class="btn-primary"
                        disabled={isRemoving}
                        on:click={handleRemoveLiquidity}
                    >
                        {isRemoving ? 'Removing...' : 'Confirm Remove'}
                    </button>
                </div>
            </div>
        {/if}

        {#if error}
            <div class="error-message">
                <span>{error}</span>
            </div>
        {/if}
    </div>
</Modal>

<style lang="postcss">
    .pool-details {
        @apply flex flex-col gap-6;
    }

    .pool-header {
        @apply flex justify-between items-center;
    }

    .token-info {
        @apply flex items-center gap-3;
    }

    .token-pair {
        @apply text-xl font-semibold text-white;
    }

    .action-btn.sneedlock {
        @apply px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200
               bg-blue-500/20 text-blue-300 border border-blue-500/30
               hover:bg-blue-500/30 hover:border-blue-500/50 disabled:opacity-50;
    }

    .stats-grid {
        @apply grid grid-cols-2 gap-4;
    }

    /* Mobile styles for stats grid */
    @media (max-width: 640px) {
        .stats-grid {
            grid-template-columns: repeat(2, 1fr);
        }
        .stats-grid .mobile-full {
            grid-column: span 2;
        }
    }

    .stat-item {
        @apply flex flex-col gap-2 p-4 rounded-xl bg-[#1a1d2d] border border-white/5;
    }

    .stat-label {
        @apply text-sm font-medium text-[#8890a4];
    }

    .stat-value {
        @apply text-lg font-semibold text-white;
    }

    .remove-liquidity-section {
        @apply space-y-6;
    }

    .input-container {
        @apply space-y-3;
    }

    .input-label {
        @apply block text-sm font-medium text-[#8890a4];
    }

    .input-wrapper {
        @apply space-y-3;
    }

    .liquidity-input {
        @apply w-full bg-[#1a1d2d] border border-white/5 rounded-xl p-4 text-white text-lg font-medium
               focus:outline-none focus:ring-2 focus:ring-blue-500/50;
    }

    .percentage-buttons {
        @apply grid grid-cols-4 gap-2;
    }

    /* Mobile styles for percentage buttons */
    @media (max-width: 640px) {
        .percentage-buttons {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    .percent-btn {
        @apply px-3 py-2 bg-[#2a2d3d] rounded-lg hover:bg-[#3a3d4d] transition-colors
               text-white font-medium text-sm border border-white/5;
    }

    .estimated-returns {
        @apply bg-[#1a1d2d] rounded-xl p-4 border border-white/5;
    }

    .returns-header {
        @apply flex items-center gap-3 mb-3;
    }

    .returns-label {
        @apply text-sm font-medium text-[#8890a4];
    }

    .returns-divider {
        @apply flex-1 border-t border-white/5;
    }

    .return-amounts {
        @apply space-y-2;
    }

    .token-return {
        @apply flex items-center gap-3 text-white font-medium;
    }

    .preview-btn {
        @apply w-full mt-2 py-4 bg-blue-600
               text-white font-semibold rounded-xl transition-all duration-200
               hover:bg-blue-700
               disabled:opacity-50 disabled:cursor-not-allowed;
    }

    /* Mobile styles for preview button */
    @media (max-width: 640px) {
        .stat-item {
            padding: 0.5rem;
        }
    }

    .confirmation-section {
        @apply space-y-6;
    }

    .confirmation-details {
        @apply bg-[#1a1d2d] rounded-xl p-6 border border-white/5;
    }

    .confirmation-title {
        @apply text-lg font-semibold mb-4 text-white;
    }

    .confirmation-info {
        @apply space-y-4;
    }

    .confirmation-amount-wrapper {
        @apply flex justify-between items-center text-white;
    }

    .highlight {
        @apply text-blue-400 font-semibold;
    }

    .token-returns {
        @apply space-y-2 p-3 bg-[#2a2d3d] rounded-lg;
    }

    .confirmation-buttons {
        @apply flex gap-4;
    }

    .btn-secondary {
        @apply flex-1 px-4 py-3 bg-[#2a2d3d] text-white font-semibold rounded-xl
               hover:bg-[#3a3d4d] transition-all duration-200
               disabled:opacity-50 disabled:cursor-not-allowed
               border border-white/5;
    }

    .btn-primary {
        @apply flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl
               hover:bg-blue-700 transition-all duration-200
               disabled:opacity-50 disabled:cursor-not-allowed;
    }

    /* Mobile styles for confirmation buttons */
    @media (max-width: 640px) {
        .confirmation-buttons {
            position: fixed;
            bottom: 1.5rem;
            left: 1.5rem;
            right: 1.5rem;
            z-index: 50;
        }
    }

    .error-message {
        @apply p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm;
    }

    input[type="number"]::-webkit-outer-spin-button,
    input[type="number"]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    input[type="number"] {
        -moz-appearance: textfield;
    }
</style>
