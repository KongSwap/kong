<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import Modal from '$lib/components/common/Modal.svelte';
    import TokenImages from '$lib/components/common/TokenImages.svelte';
    import { formatTokenAmount, formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
    import Button from '$lib/components/common/Button.svelte';
    import { X } from 'lucide-svelte';
    import { PoolService } from '$lib/services/pools';

    const dispatch = createEventDispatcher();

    // Props
    export let pool: BE.UserPoolBalance;
    export let showModal: boolean = false;
    
    let removeLiquidityAmount = '';
    let estimatedAmounts = { amount0: '0', amount1: '0' };
    let isRemoving = false;
    let error: string | null = null;

    async function calculateRemoveAmounts() {
        if (!removeLiquidityAmount) return;
        
        try {
            const amount = BigInt(parseFloat(removeLiquidityAmount) * 10 ** 8);
            const result = await PoolService.calculateRemoveLiquidityAmounts(
                pool.symbol_0,
                pool.symbol_1,
                amount
            );
            
            if (result.Ok) {
                estimatedAmounts = {
                    amount0: formatTokenAmount(result.Ok[0].toString(), 6),
                    amount1: formatTokenAmount(result.Ok[1].toString(), 6)
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
            await PoolService.removeLiquidity(pool.symbol_0, pool.symbol_1, amount);
            dispatch('liquidityRemoved');
            removeLiquidityAmount = '';
            showModal = false;
        } catch (err) {
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
    <div class="modal-body">
        <div class="flex items-center gap-4 mb-6">
            <TokenImages tokens={[pool.symbol_0, pool.symbol_1]} />
            <div>
                <h3 class="text-xl font-semibold">{pool.symbol_0}/{pool.symbol_1}</h3>
                <p class="text-gray-400">Your Pool Position</p>
            </div>
        </div>

        <div class="bg-gray-700 rounded-lg p-4">
            <div class="space-y-2">
                <p>LP Token Balance: {formatTokenAmount(pool.balance.toString(), 8)}</p>
                <p>{pool.symbol_0}: {formatTokenAmount(pool.amount_0.toString(), 6)}</p>
                <p>{pool.symbol_1}: {formatTokenAmount(pool.amount_1.toString(), 6)}</p>
                <p class="text-gray-400">Total Value: ${formatToNonZeroDecimal(pool.usd_balance)}</p>
            </div>

            <div class="mt-4 space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">
                        Remove Liquidity Amount (LP Tokens)
                    </label>
                    <input
                        type="number"
                        bind:value={removeLiquidityAmount}
                        on:input={calculateRemoveAmounts}
                        class="w-full bg-gray-600 rounded p-2"
                        placeholder="0.0"
                    />
                </div>

                {#if removeLiquidityAmount}
                    <div class="bg-gray-600 rounded p-3">
                        <p class="text-sm text-gray-400 mb-2">You will receive:</p>
                        <p>{estimatedAmounts.amount0} {pool.symbol_0}</p>
                        <p>{estimatedAmounts.amount1} {pool.symbol_1}</p>
                    </div>
                {/if}

                <Button
                    disabled={!removeLiquidityAmount || isRemoving}
                    loading={isRemoving}
                    on:click={handleRemoveLiquidity}
                >
                    {isRemoving ? 'Removing...' : 'Remove Liquidity'}
                </Button>

                {#if error}
                    <p class="text-red-500 text-sm">{error}</p>
                {/if}
            </div>
        </div>
    </div>
</Modal>
