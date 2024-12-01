<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import Modal from '$lib/components/common/Modal.svelte';
    import TokenImages from '$lib/components/common/TokenImages.svelte';
    import { formatTokenAmount, formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
    import Button from '$lib/components/common/Button.svelte';
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
        calculateRemoveAmounts();
    }

    async function calculateRemoveAmounts() {
        if (!removeLiquidityAmount) {
            estimatedAmounts = { amount0: '0', amount1: '0' };
            return;
        }
        
        try {
            const amount = BigInt(parseFloat(removeLiquidityAmount) * 10 ** 8);
            const result = await PoolService.calculateRemoveLiquidityAmounts(pool.pool_id, amount);
            
            if (result) {
                estimatedAmounts = {
                    amount0: formatTokenAmount(result[0].toString(), 8),
                    amount1: formatTokenAmount(result[1].toString(), 8)
                };
            }
        } catch (err) {
            console.error('Error calculating removal amounts:', err);
        }
    }

    async function handleRemoveLiquidity() {
        if (!removeLiquidityAmount) return;
        
        try {
            isRemoving = true;
            const amount = BigInt(parseFloat(removeLiquidityAmount) * 10 ** 8);
            await PoolService.removeLiquidity(pool.pool_id, amount);
            dispatch('liquidityRemoved');
            removeLiquidityAmount = '';
            showModal = false;
        } catch (err) {
            error = err.message;
        } finally {
            isRemoving = false;
            showConfirmation = false;
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
    <div class="modal-body">
        <div class="flex items-center gap-4 mb-6">
            <TokenImages tokens={[token0, token1]} size={36} />
            <div>
                <h3 class="text-xl font-semibold">{pool.symbol_0}/{pool.symbol_1}</h3>
                <p class="text-gray-400">Your Pool Position</p>
            </div>
        </div>

        <div class="bg-gray-800/50 rounded-lg p-4">
            <div class="space-y-2">
                <p>LP Token Balance: {pool.balance}</p>
                <p>{pool.symbol_0}: {pool.amount_0}</p>
                <p>{pool.symbol_1}: {pool.amount_1}</p>
                <p class="text-gray-400">Total Value: ${formatToNonZeroDecimal(pool.usd_balance)}</p>
            </div>

            {#if !showConfirmation}
                <div class="mt-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">
                            Remove Liquidity Amount (LP Tokens)
                        </label>
                        <input
                            type="number"
                            bind:value={removeLiquidityAmount}
                            on:input={calculateRemoveAmounts}
                            class="w-full bg-gray-700 rounded p-2"
                            placeholder="0.0"
                            max={pool.balance}
                        />
                    </div>

                    <div class="flex gap-2">
                        {#each [25, 50, 75, 100] as percent}
                            <button
                                class="flex-1 px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                                on:click={() => setPercentage(percent)}
                            >
                                {percent}%
                            </button>
                        {/each}
                    </div>

                    {#if removeLiquidityAmount}
                        <div class="bg-gray-700 rounded p-3">
                            <p class="text-sm text-gray-400 mb-2">You will receive:</p>
                            <p>{estimatedAmounts.amount0} {pool.symbol_0}</p>
                            <p>{estimatedAmounts.amount1} {pool.symbol_1}</p>
                        </div>
                    {/if}

                    <Button
                        disabled={!removeLiquidityAmount || isRemoving}
                        on:click={() => showConfirmation = true}
                    >
                        Preview Removal
                    </Button>
                </div>
            {:else}
                <div class="mt-6 space-y-4">
                    <div class="bg-gray-700 rounded p-4">
                        <h4 class="text-lg font-medium mb-3">Confirm Removal</h4>
                        <div class="space-y-2">
                            <p>Removing: {removeLiquidityAmount} LP Tokens</p>
                            <p>You will receive:</p>
                            <p class="pl-4">{estimatedAmounts.amount0} {pool.symbol_0}</p>
                            <p class="pl-4">{estimatedAmounts.amount1} {pool.symbol_1}</p>
                        </div>
                    </div>

                    <div class="flex gap-3">
                        <Button
                            variant="blue"
                            disabled={isRemoving}
                            on:click={() => showConfirmation = false}
                        >
                            Back
                        </Button>
                        <Button
                            variant="green"
                            disabled={isRemoving}
                            on:click={handleRemoveLiquidity}
                        >
                            {isRemoving ? 'Removing...' : 'Confirm Remove'}
                        </Button>
                    </div>
                </div>
            {/if}

            {#if error}
                <p class="text-red-500 text-sm mt-3">{error}</p>
            {/if}
        </div>
    </div>
</Modal>

<style>
    input[type="number"]::-webkit-outer-spin-button,
    input[type="number"]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    input[type="number"] {
        -moz-appearance: textfield;
    }
</style>
