<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { poolStore } from '$lib/services/pools/poolStore';
    import { PoolService } from '$lib/services/pools';
    import { tokenStore } from '$lib/services/tokens/tokenStore';
    import TokenImages from '$lib/components/common/TokenImages.svelte';
    import { formatTokenAmount, formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
    import Button from '$lib/components/common/Button.svelte';
    import { X } from 'lucide-svelte';

    const dispatch = createEventDispatcher();
    export let poolId: string;
    
    let pool: BE.Pool;
    let userBalance: FE.UserPoolBalance;
    let isLoading = true;
    let error: string | null = null;
    let removeLiquidityAmount = '';
    let estimatedAmounts = { amount0: '0', amount1: '0' };
    let isRemoving = false;

    $: userPoolBalances = $poolStore.userPoolBalances;
    $: tokens = $tokenStore.tokens;
    $: {
        if (userPoolBalances && pool) {
            userBalance = userPoolBalances.find(b => 
                b.symbol_0 === pool.symbol_0 && 
                b.symbol_1 === pool.symbol_1
            );
        }
    }

    async function loadPoolDetails() {
        try {
            isLoading = true;
            error = null;
            pool = await PoolService.getPoolDetails(poolId);
        } catch (err) {
            error = err.message;
        } finally {
            isLoading = false;
        }
    }

    async function calculateRemoveAmounts() {
        if (!removeLiquidityAmount || !pool) return;
        
        try {
            const amount = BigInt(parseFloat(removeLiquidityAmount) * 10 ** 8); // Assuming 8 decimals for LP token
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
        if (!removeLiquidityAmount || !pool) return;
        
        try {
            isRemoving = true;
            error = null;
            
            const amount = BigInt(parseFloat(removeLiquidityAmount) * 10 ** 8); // Assuming 8 decimals for LP token
            await PoolService.removeLiquidity({
                token0: pool.symbol_0,
                token1: pool.symbol_1,
                lpTokenAmount: amount
            });
            
            // Refresh balances
            await poolStore.loadUserPoolBalances();
            removeLiquidityAmount = '';
            estimatedAmounts = { amount0: '0', amount1: '0' };
            dispatch('close');
        } catch (err) {
            error = err.message;
        } finally {
            isRemoving = false;
        }
    }

    function handleClose() {
        dispatch('close');
    }

    $: if (removeLiquidityAmount) {
        calculateRemoveAmounts();
    }

    onMount(loadPoolDetails);
</script>

<!-- Modal Overlay -->
<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50">
    <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
            <div class="relative w-full max-w-2xl">
                <!-- Close button -->
                <button
                    on:click={handleClose}
                    class="absolute right-4 top-4 text-gray-400 hover:text-white"
                >
                    <X size={24} />
                </button>

                {#if isLoading}
                    <div class="flex justify-center items-center h-64">
                        <div class="loading-spinner"></div>
                    </div>
                {:else if error}
                    <div class="text-red-500 p-4">
                        {error}
                    </div>
                {:else if pool}
                    <div class="bg-gray-800 rounded-lg p-6 space-y-6">
                        <!-- Pool Header -->
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-3">
                                <TokenImages 
                                    tokens={tokens.filter(t => 
                                        t.canister_id === pool.address_0 || 
                                        t.canister_id === pool.address_1
                                    )}
                                    size={40}
                                />
                                <div>
                                    <h2 class="text-xl font-bold">{pool.symbol_0}/{pool.symbol_1}</h2>
                                    <p class="text-gray-400">Pool #{pool.pool_id}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-sm text-gray-400">APY</p>
                                <p class="text-lg font-bold text-green-400">{formatToNonZeroDecimal(pool.rolling_24h_apy)}%</p>
                            </div>
                        </div>

                        <!-- Your Position -->
                        {#if userBalance}
                            <div class="border border-gray-700 rounded-lg p-4 space-y-4">
                                <h3 class="text-lg font-semibold">Your Position</h3>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <p class="text-sm text-gray-400">{pool.symbol_0}</p>
                                        <p class="text-lg font-medium">{formatTokenAmount(userBalance.amount_0.toString(), 6)}</p>
                                        <p class="text-sm text-gray-400">${formatToNonZeroDecimal(userBalance.usd_amount_0)}</p>
                                    </div>
                                    <div>
                                        <p class="text-sm text-gray-400">{pool.symbol_1}</p>
                                        <p class="text-lg font-medium">{formatTokenAmount(userBalance.amount_1.toString(), 6)}</p>
                                        <p class="text-sm text-gray-400">${formatToNonZeroDecimal(userBalance.usd_amount_1)}</p>
                                    </div>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-400">LP Tokens</p>
                                    <p class="text-lg font-medium">{formatTokenAmount(userBalance.balance.toString(), 8)}</p>
                                    <p class="text-sm text-gray-400">≈ ${formatToNonZeroDecimal(userBalance.usd_balance)}</p>
                                </div>
                            </div>

                            <!-- Remove Liquidity -->
                            <div class="border border-gray-700 rounded-lg p-4 space-y-4">
                                <h3 class="text-lg font-semibold">Remove Liquidity</h3>
                                <div>
                                    <label class="text-sm text-gray-400">Amount of LP tokens to remove</label>
                                    <input
                                        type="number"
                                        bind:value={removeLiquidityAmount}
                                        placeholder="0.0"
                                        class="w-full bg-gray-900 rounded p-2 mt-1"
                                        min="0"
                                        max={formatTokenAmount(userBalance.balance.toString(), 8)}
                                    />
                                </div>
                                
                                {#if removeLiquidityAmount}
                                    <div class="bg-gray-900 rounded p-3 space-y-2">
                                        <p class="text-sm text-gray-400">You will receive:</p>
                                        <div class="flex justify-between">
                                            <span>{estimatedAmounts.amount0} {pool.symbol_0}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span>{estimatedAmounts.amount1} {pool.symbol_1}</span>
                                        </div>
                                    </div>
                                {/if}

                                <Button
                                    on:click={handleRemoveLiquidity}
                                    disabled={!removeLiquidityAmount || isRemoving}
                                    state={isRemoving ? 'disabled' : 'default'}
                                    variant="blue"
                                    className="w-full"
                                >
                                    {isRemoving ? 'Removing...' : 'Remove Liquidity'}
                                </Button>
                            </div>
                        {:else}
                            <div class="text-center text-gray-400 py-8">
                                You don't have any liquidity in this pool
                            </div>
                        {/if}

                        <!-- Pool Stats -->
                        <div class="grid grid-cols-3 gap-4">
                            <div>
                                <p class="text-sm text-gray-400">24h Volume</p>
                                <p class="text-lg font-medium">${formatToNonZeroDecimal(Number(pool.rolling_24h_volume) / 1e6)}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-400">24h Fees</p>
                                <p class="text-lg font-medium">${formatToNonZeroDecimal(Number(pool.rolling_24h_lp_fee) / 1e6)}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-400">TVL</p>
                                <p class="text-lg font-medium">${formatToNonZeroDecimal(Number(pool.balance) / 1e6)}</p>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .loading-spinner {
        border: 4px solid rgba(255, 255, 255, 0.1);
        border-left-color: #ffffff;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
