<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import Modal from '$lib/components/common/Modal.svelte';
    import TokenImages from '$lib/components/common/TokenImages.svelte';
    import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
    import { tokenStore } from '$lib/services/tokens/tokenStore';
    import { PoolService } from '$lib/services/pools';
    import { poolsList } from "$lib/services/pools/poolStore";
    import { auth } from '$lib/services/auth';
    import { poolStore } from "$lib/services/pools/poolStore";
    import { toastStore } from '$lib/stores/toastStore';

    const dispatch = createEventDispatcher();

    export let pool: any;
    export let showModal: boolean = false;
    
    // Calculate USD value for tokens using proper price lookup
    function calculateTokenUsdValue(amount: string, tokenSymbol: string): string {
        console.log("Calculating USD value for:", {
            amount,
            tokenSymbol,
            tokenStore: $tokenStore
        });

        // Find token to get its canister_id
        const token = $tokenStore.tokens.find(t => t.symbol === tokenSymbol);
        
        console.log("Found token:", token);

        if (!token?.canister_id || !amount) {
            console.log("Missing token data:", { token, amount });
            return '0';
        }

        // Get price from prices object using canister_id
        const price = $tokenStore.prices[token.canister_id];
        
        if (!price) {
            console.log("No price found for token:", {
                canisterId: token.canister_id,
                prices: $tokenStore.prices
            });
            return '0';
        }

        // Calculate USD value
        const usdValue = Number(amount) * price;
        console.log("USD calculation:", {
            amount: Number(amount),
            price,
            result: usdValue
        });

        return formatToNonZeroDecimal(usdValue);
    }

    let removeLiquidityAmount = '';
    let estimatedAmounts = { amount0: '0', amount1: '0' };
    let isRemoving = false;
    let error: string | null = null;
    let showConfirmation = false;
    let isCalculating = false;

    // Get token objects for images
    $: token0 = $tokenStore.tokens.find(t => t.symbol === pool.symbol_0);
    $: token1 = $tokenStore.tokens.find(t => t.symbol === pool.symbol_1);

    // Get the actual pool data with APY
    $: actualPool = $poolsList.find(p => 
        p.symbol_0 === pool.symbol_0 && 
        p.symbol_1 === pool.symbol_1
    );

    // Reset state when modal opens/closes
    $: if (!showModal) {
        resetState();
    }

    function resetState() {
        removeLiquidityAmount = '';
        estimatedAmounts = { amount0: '0', amount1: '0' };
        error = null;
        showConfirmation = false;
        isRemoving = false;
        isCalculating = false;
    }

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
            isCalculating = true;
            const numericAmount = parseFloat(removeLiquidityAmount);
            
            // Add validation
            if (numericAmount <= 0) {
                throw new Error('Amount must be greater than 0');
            }
            
            if (numericAmount > Number(pool.balance)) {
                throw new Error('Amount exceeds balance');
            }

            const [amount0, amount1] = await PoolService.calculateRemoveLiquidityAmounts(
                pool.symbol_0,
                pool.symbol_1,
                numericAmount
            );

            // Get token decimals from tokenStore
            const token0Decimals = $tokenStore.tokens.find(t => t.symbol === pool.symbol_0)?.decimals || 8;
            const token1Decimals = $tokenStore.tokens.find(t => t.symbol === pool.symbol_1)?.decimals || 8;
            
            // First adjust for decimals, then store as string
            estimatedAmounts = {
                amount0: (Number(amount0) / Math.pow(10, token0Decimals)).toString(),
                amount1: (Number(amount1) / Math.pow(10, token1Decimals)).toString()
            };
        } catch (err) {
            console.error('Error calculating removal amounts:', err);
            error = err.message;
            estimatedAmounts = { amount0: '0', amount1: '0' };
        } finally {
            isCalculating = false;
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
            toastStore.info('Removing liquidity...', 3000);
            const numericAmount = parseFloat(removeLiquidityAmount);
            
            console.log('Removing liquidity:', {
                token0: pool.symbol_0,
                token1: pool.symbol_1,
                lpTokenAmount: numericAmount
            });

            // Convert to proper decimal places for backend
            const lpTokenBigInt = BigInt(Math.floor(numericAmount * 1e8));
            
            // Get the request ID from remove_liquidity_async
            const requestId = await PoolService.removeLiquidity({
                token0: pool.symbol_0,
                token1: pool.symbol_1,
                lpTokenAmount: lpTokenBigInt
            });

            showModal = false;
            
            // Poll for request completion
            let isComplete = false;
            let attempts = 0;
            const maxAttempts = 30; // 30 seconds timeout
            
            while (!isComplete && attempts < maxAttempts) {
                const requestStatus = await PoolService.pollRequestStatus(BigInt(requestId));
                console.log('Current status:', requestStatus);
                
                // Check for the complete success sequence
                const expectedStatuses = [
                    'Started',
                    'Updating user LP token amount',
                    'User LP token amount updated',
                    'Updating liquidity pool',
                    'Liquidity pool updated',
                    'Receiving token 0',
                    'Token 0 received',
                    'Receiving token 1',
                    'Token 1 received',
                    'Success'
                ];
                
                // Check if all expected statuses are present in order
                const hasAllStatuses = expectedStatuses.every((status, index) => 
                    requestStatus.statuses[index] === status
                );

                if (hasAllStatuses) {
                    isComplete = true;
                    toastStore.success('Successfully removed liquidity from the pool', 5000, 'Success');
                    await Promise.all([
                        tokenStore.loadBalance(token0, auth.pnp.account.principalId, true),
                        tokenStore.loadBalance(token1, auth.pnp.account.principalId, true),
                        poolStore.loadUserPoolBalances()
                    ]);
                    break;
                } else if (requestStatus.reply?.Failed) {
                    throw new Error(requestStatus.reply.Failed || 'Transaction failed');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 400));
                    attempts++;
                }
            }

            if (!isComplete) {
                throw new Error('Operation timed out');
            }

            // Refresh the balances
            await Promise.all([
                tokenStore.loadBalance(token0, auth.pnp.account.principalId, true),
                tokenStore.loadBalance(token1, auth.pnp.account.principalId, true),
                poolStore.loadUserPoolBalances()
            ]);

            // Reset state and dispatch event
            isRemoving = false;
            error = null;
            removeLiquidityAmount = '';
            estimatedAmounts = { amount0: '0', amount1: '0' };
            dispatch('liquidityRemoved');

        } catch (err) {
            console.error('Error removing liquidity:', err);
            error = err.message;
            isRemoving = false;
        }
    }

    let activeTab: 'info' | 'remove' | 'earnings' = 'info';

    // Add price calculation
    function calculateUsdValue(amount: string, token: any): string {
        if (!token?.usdValue || !amount) return '0';
        return formatToNonZeroDecimal(Number(amount) * token.usd_value);
    }

    // Calculate earnings based on APY
    function calculateEarnings(timeframe: number): string {
        // Use APY from the actual pool
        if (!actualPool?.rolling_24h_apy || !pool.usd_balance) {
            console.log("Missing data for earnings calc:", { 
                apy: actualPool?.rolling_24h_apy, 
                balance: pool.usd_balance 
            });
            return '0';
        }
        
        // Convert APY to daily rate and calculate linear projection
        const apyDecimal = actualPool.rolling_24h_apy / 100; // rolling_24h_apy is already a number
        const dailyRate = apyDecimal / 365;
        const earnings = parseFloat(pool.usd_balance) * dailyRate * timeframe;
        
        return formatToNonZeroDecimal(earnings);
    }

    // Calculate total USD value of tokens to receive
    function calculateTotalUsdValue(): string {
        const amount0Usd = Number(calculateTokenUsdValue(estimatedAmounts.amount0, pool.symbol_0));
        const amount1Usd = Number(calculateTokenUsdValue(estimatedAmounts.amount1, pool.symbol_1));
        return formatToNonZeroDecimal(amount0Usd + amount1Usd);
    }
</script>

<Modal
    bind:isOpen={showModal}
    title="Pool Position"
    onClose={() => showModal = false}
    width="600px"
    height="auto"
>
    <div class="pool-details">
        <div class="pool-header">
            <div class="token-info">
                <TokenImages tokens={[token0, token1]} overlap={12} size={28} />
                <h3 class="token-pair">{pool.symbol_0}/{pool.symbol_1}</h3>
            </div>
        </div>

        <div class="action-tabs">
            <button
                class="tab-button"
                class:active={activeTab === 'info'}
                on:click={() => activeTab = 'info'}
            >
                Info
            </button>
            <button
                class="tab-button"
                class:active={activeTab === 'earnings'}
                on:click={() => activeTab = 'earnings'}
            >
                Earnings
            </button>
            <button
                class="tab-button"
                class:active={activeTab === 'remove'}
                on:click={() => activeTab = 'remove'}
            >
                Remove
            </button>
        </div>

        <div class="tab-content">
            {#if activeTab === 'info'}
                <div class="info-section">
                    <div class="stats-grid">
                        <!-- Position Value -->
                        <div class="stat-item highlight">
                            <span class="stat-label">Position Value</span>
                            <span class="stat-value">
                                ${formatToNonZeroDecimal(pool.usd_balance)}
                            </span>
                        </div>

                        <!-- LP Token Balance -->
                        <div class="stat-item">
                            <span class="stat-label">LP Token Balance</span>
                            <span class="stat-value">
                                {Number(pool.balance).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 8
                                })} LP
                            </span>
                        </div>

                        <!-- Token Amounts -->
                        <div class="stat-item mobile-full">
                            <div class="token-amount-header">
                                <TokenImages tokens={[token0]} size={20} />
                                <span class="stat-label">{pool.symbol_0} Amount</span>
                            </div>
                            <span class="stat-value">
                                {Number(pool.amount_0).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 8
                                })}
                            </span>
                        </div>
                        <div class="stat-item mobile-full">
                            <div class="token-amount-header">
                                <TokenImages tokens={[token1]} size={20} />
                                <span class="stat-label">{pool.symbol_1} Amount</span>
                            </div>
                            <span class="stat-value">
                                {Number(pool.amount_1).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 8
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            {:else if activeTab === 'earnings'}
                <div class="earnings-section">
                    {#if actualPool?.rolling_24h_apy}
                        <div class="earnings-header">
                            <div class="apy-card">
                                <div class="apy-label">Current APY</div>
                                <div class="apy-value" style="color: {actualPool.rolling_24h_apy > 100 ? '#FFD700' : actualPool.rolling_24h_apy > 50 ? '#FFA500' : '#FF8C00'}">
                                    {actualPool.rolling_24h_apy}%
                                </div>
                            </div>
                        </div>
                        <div class="earnings-grid">
                            <div class="stat-item">
                                <span class="stat-label">Daily Earnings</span>
                                <span class="stat-value">${calculateEarnings(1)}</span>
                                <span class="stat-subtitle">Based on 24h returns</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Weekly Earnings</span>
                                <span class="stat-value">${calculateEarnings(7)}</span>
                                <span class="stat-subtitle">Based on 7-day returns</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Monthly Earnings</span>
                                <span class="stat-value">${calculateEarnings(30)}</span>
                                <span class="stat-subtitle">Based on 30-day returns</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Yearly Earnings</span>
                                <span class="stat-value">${calculateEarnings(365)}</span>
                                <span class="stat-subtitle">Based on annual returns</span>
                            </div>
                        </div>
                        <div class="earnings-disclaimer">
                            * Returns based on current APY and position value. May vary.
                        </div>
                    {:else}
                        <div class="no-apy-message">
                            APY data is not available for this pool.
                        </div>
                    {/if}
                </div>
            {:else}
                <div class="remove-liquidity-section">
                    <div class="input-container">
                        <label class="input-label">
                            Remove Liquidity Amount (LP Tokens)
                        </label>
                        <div class="input-wrapper pt-2">
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
                        <div class="estimated-returns mt-4">
                            <div class="returns-header">
                                <span class="returns-label">You will receive:</span>
                                <div class="returns-divider" />
                            </div>
                            <div class="return-amounts flex flex-col gap-y-2 pt-2">
                                <div class="token-return">
                                    <div class="token-info">
                                        <TokenImages tokens={[token0]} size={20} />
                                        <div class="token-details">
                                            <span class="token-amount">
                                                {Number(estimatedAmounts.amount0).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: token0?.decimals || 8
                                                })} {pool.symbol_0}
                                            </span>
                                            <span class="usd-value">
                                                ${calculateTokenUsdValue(estimatedAmounts.amount0, pool.symbol_0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div class="token-return">
                                    <div class="token-info">
                                        <TokenImages tokens={[token1]} size={20} />
                                        <div class="token-details">
                                            <span class="token-amount">
                                                {Number(estimatedAmounts.amount1).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: token1?.decimals || 8
                                                })} {pool.symbol_1}
                                            </span>
                                            <span class="usd-value">
                                                ${calculateTokenUsdValue(estimatedAmounts.amount1, pool.symbol_1)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div class="total-value">
                                    Total Value: <span class="value">${calculateTotalUsdValue()}</span>
                                </div>
                            </div>
                        </div>
                    {/if}

                    <button 
                        class="remove-btn"
                        disabled={!removeLiquidityAmount || isRemoving || isCalculating}
                        on:click={handleRemoveLiquidity}
                    >
                        {#if isRemoving}
                            Removing...
                        {:else if isCalculating}
                            Calculating...
                        {:else}
                            Remove Liquidity
                        {/if}
                    </button>
                </div>
            {/if}

            {#if error}
                <div class="error-message">
                    <span>{error}</span>
                </div>
            {/if}
        </div>
    </div>
</Modal>

<style lang="postcss">
    .pool-details {
        @apply flex flex-col min-h-0;
        min-height: min(550px, 90vh);
    }

    .pool-header {
        @apply py-3 sm:py-4 border-b border-white/10;
    }

    .token-info {
        @apply flex items-center gap-2 sm:gap-3;
    }

    .token-pair {
        @apply text-lg sm:text-xl font-medium text-white;
    }

    .action-tabs {
        @apply flex gap-1 p-1 mt-3 sm:mt-4 mb-4 sm:mb-6
               bg-black/20 rounded-lg;
    }

    .tab-button {
        @apply flex-1 px-2 sm:px-4 py-2 sm:py-2.5
               text-xs sm:text-sm font-medium text-white/60 
               rounded-md transition-all
               hover:text-white hover:bg-white/5;
    }

    .tab-button.active {
        @apply bg-white/10 text-white;
    }

    .tab-content {
        @apply flex-1 overflow-y-auto min-h-0 
               pb-3 sm:pb-6;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
    }

    .tab-content::-webkit-scrollbar {
        @apply w-1;
    }

    .tab-content::-webkit-scrollbar-track {
        @apply bg-transparent;
    }

    .tab-content::-webkit-scrollbar-thumb {
        @apply bg-white/10 rounded-full;
    }

    .stats-grid {
        @apply grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4;
    }

    .stat-item {
        @apply flex flex-col gap-1.5 sm:gap-2 p-3 sm:p-4 
               rounded-xl bg-[#1a1d2d] border border-white/5;
    }

    .stat-label {
        @apply text-xs sm:text-sm font-medium text-[#8890a4];
    }

    .stat-value {
        @apply text-base sm:text-lg font-semibold text-white;
    }

    .percentage-buttons {
        @apply grid grid-cols-2 sm:grid-cols-4 gap-2;
    }

    .percent-btn {
        @apply px-2 sm:px-3 py-1.5 sm:py-2 
               bg-[#2a2d3d] rounded-lg hover:bg-[#3a3d4d] 
               transition-colors text-white font-medium text-xs sm:text-sm 
               border border-white/5;
    }

    .token-return {
        @apply flex items-center justify-between gap-2 sm:gap-3 
               p-2 sm:p-3 bg-[#2a2d3d]/50 rounded-lg;
    }

    .token-details {
        @apply flex flex-col gap-0.5 flex-1 min-w-0;
    }

    .token-amount {
        @apply text-sm sm:text-base text-white font-medium truncate;
    }

    .usd-value {
        @apply text-xs sm:text-sm text-white/60;
    }

    .earnings-grid {
        @apply grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4;
    }

    .earnings-disclaimer {
        @apply text-xs sm:text-sm text-[#8890a4] mt-3 sm:mt-4 
               text-center px-3 sm:px-0;
    }

    .remove-btn {
        @apply fixed sm:relative bottom-0 left-0 right-0 sm:bottom-auto
               w-full mt-4 py-4
               bg-gradient-to-r from-red-600 to-red-500
               text-white font-semibold text-lg
               rounded-none sm:rounded-xl
               transition-all duration-200
               disabled:opacity-50 disabled:cursor-not-allowed
               border border-white/10;
        box-shadow: 0 2px 6px rgba(239, 68, 68, 0.2);
    }

    .remove-btn:hover:not(:disabled) {
        @apply from-red-500 to-red-400;
        transform: translateY(-1px);
        box-shadow: 
            0 4px 12px rgba(239, 68, 68, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    .remove-btn:active:not(:disabled) {
        transform: translateY(0);
        @apply from-red-700 to-red-600;
        box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
        transition-duration: 0.1s;
    }

    .remove-liquidity-section {
        @apply pb-20 sm:pb-0;
    }

    .error-message {
        @apply fixed bottom-[72px] sm:relative sm:bottom-auto
               left-3 right-3 sm:left-auto sm:right-auto
               p-3 sm:p-4 mb-0 sm:mb-4
               bg-red-500/20 border border-red-500/30 
               rounded-xl text-red-400;
    }

    .liquidity-input {
        @apply w-full bg-[#1a1d2d] border border-white/5 
               rounded-xl p-3 sm:p-4 
               text-base sm:text-lg font-medium text-white
               focus:outline-none focus:ring-2 focus:ring-blue-500/50;
        -webkit-appearance: none;
        appearance: none;
    }

    .token-amount-header {
        @apply flex items-center gap-1.5 sm:gap-2 mb-1;
    }

    .total-value {
        @apply mt-3 sm:mt-4 text-right text-xs sm:text-sm text-[#8890a4]
               px-2 sm:px-0;
    }

    .earnings-header {
        @apply mb-6;
    }

    .apy-card {
        @apply bg-[#1a1d2d] rounded-xl p-4 sm:p-6
               border border-white/5
               flex flex-col items-center gap-2;
    }

    .apy-label {
        @apply text-sm sm:text-base text-[#8890a4] font-medium;
    }

    .apy-value {
        @apply text-2xl sm:text-4xl font-bold;
        text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
    }
</style>
