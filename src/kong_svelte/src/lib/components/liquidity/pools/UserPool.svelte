<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import Modal from '$lib/components/common/Modal.svelte';
    import TokenImages from '$lib/components/common/TokenImages.svelte';
    import { formatTokenAmount, formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
    import { tokenStore } from '$lib/services/tokens/tokenStore';
    import { PoolService } from '$lib/services/pools';
    import { poolsList } from "$lib/services/pools/poolStore";

    const dispatch = createEventDispatcher();

    export let pool: any;
    export let showModal: boolean = false;
    
    // Debug logging for development
    $: {
        console.log("TokenStore state:", $tokenStore);
        console.log("Pool data:", pool);
        console.log("Estimated amounts:", estimatedAmounts);
    }

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
            const numericAmount = parseFloat(removeLiquidityAmount);
            
            console.log('Removing liquidity:', {
                token0: pool.symbol_0,
                token1: pool.symbol_1,
                lpTokenAmount: numericAmount
            });

            // Convert to proper decimal places for backend
            const lpTokenBigInt = BigInt(Math.floor(numericAmount * 1e8));
            
            await PoolService.removeLiquidity({
                token0: pool.symbol_0,
                token1: pool.symbol_1,
                lpTokenAmount: lpTokenBigInt
            });

            dispatch('liquidityRemoved');
            resetState();
            showModal = false;
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
    isOpen={showModal}
    title="Pool Position"
    onClose={handleClose}
    width="700px"
>
    <div class="pool-details">
        <div class="pool-header">
            <div class="token-info">
                <TokenImages tokens={[token0, token1]} overlap={12} size={32} />
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
                            <h4 class="earnings-title">Estimated Earnings</h4>
                            <div class="current-apy">
                                Current APY: <span class="apy-value" style="color: {actualPool.rolling_24h_apy > 100 ? '#FFD700' : actualPool.rolling_24h_apy > 50 ? '#FFA500' : '#FF8C00'}">{actualPool.rolling_24h_apy}%</span>
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
                            * Estimates are based on current APY and position value. Actual returns may vary.
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
                        <div class="estimated-returns mt-4">
                            <div class="returns-header">
                                <span class="returns-label">You will receive:</span>
                                <div class="returns-divider" />
                            </div>
                            <div class="return-amounts">
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
        min-height: 550px;
    }

    .pool-header {
        @apply px-6 py-4 border-b border-white/10;
    }

    .token-info {
        @apply flex items-center gap-3 flex-1;
    }

    .token-pair {
        @apply text-xl font-medium text-white;
    }

    .action-tabs {
        @apply flex gap-1 p-1 mt-4 mb-6
               bg-black/20 rounded-lg;
    }

    .tab-button {
        @apply flex-1 px-4 py-2.5
               text-sm font-medium text-white/60 
               rounded-md transition-all
               hover:text-white hover:bg-white/5;
    }

    .tab-button.active {
        @apply bg-white/10 text-white;
    }

    .tab-content {
        @apply flex-1 overflow-y-auto min-h-0 px-6;
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
        @apply flex flex-col h-full;
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
        @apply bg-[#1a1d2d] rounded-xl p-4 border border-white/5 mb-6;
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
        @apply flex items-center justify-between gap-3 p-3 bg-[#2a2d3d]/50 rounded-lg;
    }

    .token-info {
        @apply flex items-center gap-3 flex-1;
    }

    .token-details {
        @apply flex flex-col;
    }

    .token-amount {
        @apply text-white font-medium;
    }

    .usd-value {
        @apply text-sm text-white/60;
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

    .stat-item.highlight {
        @apply bg-[#2a2d3d] border-blue-500/30;
    }
    
    .stat-subtitle {
        @apply text-xs text-[#8890a4] mt-1;
    }

    .token-amount-header {
        @apply flex items-center gap-2 mb-1;
    }

    .remove-liquidity-section {
        @apply flex flex-col h-full;
    }

    .remove-content {
        @apply flex-1;
    }

    .button-container {
        @apply mt-auto pt-6;
    }

    .info-section {
        @apply pb-6;
    }

    .earnings-section {
        @apply space-y-4;
    }

    .earnings-title {
        @apply text-lg font-semibold text-white mb-4;
    }

    .earnings-grid {
        @apply grid grid-cols-2 gap-4;
    }

    .earnings-disclaimer {
        @apply text-sm text-[#8890a4] mt-4 text-center;
    }

    @media (max-width: 640px) {
        .earnings-grid {
            @apply grid-cols-1;
        }
    }

    .earnings-header {
        @apply flex justify-between items-center mb-6;
    }

    .current-apy {
        @apply text-sm text-[#8890a4];
    }

    .apy-value {
        @apply text-white font-semibold;
    }

    .no-apy-message {
        @apply text-center text-[#8890a4] py-8;
    }

    .stat-subtitle {
        @apply text-xs text-[#8890a4] mt-1;
    }

    .total-value {
        @apply mt-4 text-right text-sm text-[#8890a4];
    }

    .total-value .value {
        @apply text-white font-semibold;
    }

    .remove-btn {
        @apply w-full mt-4 py-4 bg-red-600 text-white font-semibold rounded-xl
               transition-all duration-200 hover:bg-red-700
               disabled:opacity-50 disabled:cursor-not-allowed;
    }
</style>
