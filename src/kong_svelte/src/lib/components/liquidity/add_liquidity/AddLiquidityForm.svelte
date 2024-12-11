<script lang="ts">
	import { onDestroy } from 'svelte';
    import { Plus } from "lucide-svelte";
    import { formatTokenAmount, parseTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
    import { poolStore } from "$lib/services/pools/poolStore";
    import Portal from 'svelte-portal';
    import TokenSelectorDropdown from '$lib/components/swap/swap_ui/TokenSelectorDropdown.svelte';
    import { PoolService } from '$lib/services/pools/PoolService';
    import Panel from '$lib/components/common/Panel.svelte';
    import AddLiquidityConfirmation from './AddLiquidityConfirmation.svelte';
    import { tweened } from "svelte/motion";
    import { cubicOut } from "svelte/easing";
    import BigNumber from "bignumber.js";
    import { auth } from '$lib/services/auth';
    import { tokenStore } from '$lib/services/tokens';
    import debounce from 'lodash-es/debounce';

    export let token0: FE.Token | null = null;
    export let token1: FE.Token | null = null;
    export let amount0: string = "0";
    export let amount1: string = "0";
    export let loading: boolean = false;
    export let error: string | null = null;
    export let token0Balance: string = "0";
    export let token1Balance: string = "0";
    export let onTokenSelect: (index: 0 | 1) => void;
    export let onInput: (index: 0 | 1, value: string) => void;
    export let onSubmit: () => Promise<void>;
    export let pool: BE.Pool | null = null;
    export let showConfirmation = false;

    let showToken0Selector = false;
    let showToken1Selector = false;
    let loadingState = '';

    $: {
        if ($poolStore.userPoolBalances) {
            console.log('Pool balances updated:', $poolStore.userPoolBalances);
        }
    }

    // Constants for formatting and animations
    const DEFAULT_DECIMALS = 8;
    const MAX_DISPLAY_DECIMALS_DESKTOP = 12;
    const MAX_DISPLAY_DECIMALS_MOBILE = 9;
    const ANIMATION_BASE_DURATION = 200;
    const ANIMATION_MAX_DURATION = 300;

    // Input state management
    let input0Element: HTMLInputElement | null = null;
    let input1Element: HTMLInputElement | null = null;
    let input0Focused = false;
    let input1Focused = false;
    let previousValue0 = "0";
    let previousValue1 = "0";

    // Animated values for smooth transitions
    const animatedUsdValue0 = tweened(0, {
        duration: ANIMATION_BASE_DURATION,
        easing: cubicOut,
    });

    const animatedUsdValue1 = tweened(0, {
        duration: ANIMATION_BASE_DURATION,
        easing: cubicOut,
    });

    // Helper functions
    function formatWithCommas(value: string): string {
        if (!value) return "0";
        const parts = value.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    }

    function getMaxDisplayDecimals(): number {
        return window.innerWidth <= 420 ? MAX_DISPLAY_DECIMALS_MOBILE : MAX_DISPLAY_DECIMALS_DESKTOP;
    }

    function formatDisplayValue(value: string, tokenDecimals: number): string {
        if (!value || value === "0") return "0";
        
        const parts = value.split('.');
        const maxDecimals = Math.min(getMaxDisplayDecimals(), tokenDecimals);
        
        if (parts.length === 2) {
            parts[1] = parts[1].slice(0, maxDecimals);
            if (parts[1].length === 0) return parts[0];
            return parts.join('.');
        }
        
        return parts[0];
    }

    function isValidNumber(value: string): boolean {
        if (!value) return true;
        const regex = /^[0-9]*\.?[0-9]*$/;
        return regex.test(value);
    }

    // Create debounced version of the input handler
    const debouncedHandleInput = debounce(async (index: 0 | 1, value: string, currentToken: FE.Token, otherToken: FE.Token) => {
        try {
            loading = true;
            error = null;
            loadingState = `Calculating required ${otherToken.symbol} amount...`;
            
            const requiredAmount = await PoolService.addLiquidityAmounts(
                currentToken.symbol,
                parseTokenAmount(value, currentToken.decimals),
                otherToken.symbol
            );

            if (index === 0) {
                amount0 = value;
                amount1 = formatTokenAmount(requiredAmount.Ok.amount_1, otherToken.decimals).toString();
            } else {
                amount0 = formatTokenAmount(requiredAmount.Ok.amount_1, otherToken.decimals).toString();
                amount1 = value;
            }

            // Call the parent's onInput handler
            onInput(index, value);
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
            loadingState = '';
        }
    }, 400);

    // Enhanced input handling
    async function handleInput(index: 0 | 1, event: Event) {
        const inputElement = event.target as HTMLInputElement;
        if (!isValidNumber(inputElement.value)) {
            inputElement.value = index === 0 ? previousValue0 : previousValue1;
            return;
        }

        const input = inputElement.value;
        let value = input.replace(/,/g, '');
        const currentToken = index === 0 ? token0 : token1;
        const otherToken = index === 0 ? token1 : token0;

        if (!currentToken || !otherToken) {
            error = "Please select both tokens.";
            return;
        }

        // Validate input
        if (!isValidNumber(value)) {
            inputElement.value = index === 0 ? previousValue0 : previousValue1;
            return;
        }

        // Handle decimal point
        if (value.includes('.')) {
            const [whole, decimal] = value.split('.');
            value = `${whole}.${decimal.slice(0, currentToken?.decimals || DEFAULT_DECIMALS)}`;
        }

        // Remove leading zeros unless it's "0." or just "0"
        if (value.length > 1 && value.startsWith('0') && value[1] !== '.') {
            value = value.replace(/^0+/, '');
        }

        // If empty or invalid after processing, set to "0"
        if (!value || value === '.') {
            value = "0";
        }

        // Update previous value and input display immediately
        if (index === 0) {
            previousValue0 = value;
            if (input0Element) {
                input0Element.value = formatWithCommas(value);
            }
        } else {
            previousValue1 = value;
            if (input1Element) {
                input1Element.value = formatWithCommas(value);
            }
        }

        // Call debounced handler for API request
        debouncedHandleInput(index, value, currentToken, otherToken);
    }

    // Max button handler
    async function handleMaxClick(index: 0 | 1) {
        const currentToken = index === 0 ? token0 : token1;
        const currentBalance = index === 0 ? token0Balance : token1Balance;
        const otherToken = index === 0 ? token1 : token0;
        
        if (!currentToken || !otherToken) return;

        try {
            const value = formatTokenAmount(currentBalance, currentToken.decimals);
            
            // Update the input display
            if (index === 0) {
                if (input0Element) {
                    input0Element.value = formatWithCommas(value);
                }
                previousValue0 = value;
            } else {
                if (input1Element) {
                    input1Element.value = formatWithCommas(value);
                }
                previousValue1 = value;
            }

            // Call the debounced handler to calculate the other amount
            await debouncedHandleInput(index, value, currentToken, otherToken);
        } catch (err) {
            console.error("Error in handleMaxClick:", err);
            error = err.message;
        }
    }

    // Reactive declarations for USD values
    $: {
        if (token0?.price && amount0) {
            const value = parseFloat(amount0) * token0.price;
            animatedUsdValue0.set(value);
        }
        if (token1?.price && amount1) {
            const value = parseFloat(amount1) * token1.price;
            animatedUsdValue1.set(value);
        }
    }

    // Get pool when both tokens are selected
    $: if (token0 && token1) {
        pool = $poolStore.pools.find(p => 
            (p.address_0 === token0.canister_id && p.address_1 === token1.canister_id) ||
            (p.address_0 === token1.canister_id && p.address_1 === token0.canister_id)
        ) || null;
    } else {
        pool = null;
    }

    // Format display amounts
    $: displayAmount0 = formatDisplayValue(amount0, token0?.decimals || DEFAULT_DECIMALS);
    $: displayAmount1 = formatDisplayValue(amount1, token1?.decimals || DEFAULT_DECIMALS);
    $: formattedDisplayAmount0 = formatWithCommas(displayAmount0);
    $: formattedDisplayAmount1 = formatWithCommas(displayAmount1);

    function openTokenSelector(index: 0 | 1) {
        if (index === 0) {
            showToken0Selector = true;
            showToken1Selector = false;
        } else {
            showToken1Selector = true;
            showToken0Selector = false;
        }
    }

    $: hasInsufficientBalance = () => {
        if (!token0 || !token1 || !amount0 || !amount1) return false;
        
        // Convert amounts to BigInt, accounting for fees
        const parsedAmount0 = BigInt(parseTokenAmount(amount0, token0.decimals)) - BigInt(token0.fee_fixed);
        const parsedAmount1 = BigInt(parseTokenAmount(amount1, token1.decimals)) - BigInt(token1.fee_fixed);
        
        // Convert balances to BigInt
        const parsedBalance0 = BigInt(token0Balance);
        const parsedBalance1 = BigInt(token1Balance);
        
        // Compare using BigInt operations
        return parsedAmount0 > parsedBalance0 || parsedAmount1 > parsedBalance1;
    };

    $: buttonText = hasInsufficientBalance()
        ? "Insufficient Balance"
        : !token0 || !token1
        ? "Select Tokens"
        : !amount0 || !amount1
        ? "Enter Amounts"
        : !pool
        ? "No Pool Found"
        : loading
        ? loadingState || "Loading..."
        : "Review Transaction";

    $: isValid = token0 && token1 && amount0 && amount1 && !error && !hasInsufficientBalance() && pool !== null;

    // Helper function to format large numbers with commas and fixed decimals
    function formatLargeNumber(value: string | number | bigint, decimals: number = 2): string {
        const num = Number(value) / 1e6; // Convert from microdollars to dollars
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    }

    async function handleSubmit() {
        if (!isValid || loading) return;
        showConfirmation = true;
    }

    // Debounce the balance updates
    const debouncedBalanceUpdate = debounce(async () => {
        if (!token0 || !token1 || !$auth?.account?.owner) return;
        
        try {
            loadingState = 'Fetching token balances...';
            await Promise.all([
                tokenStore.loadBalance(token0, $auth.account.owner.toString(), true),
                tokenStore.loadBalance(token1, $auth.account.owner.toString(), true)
            ]);
        } catch (error) {
            console.error("Error updating balances:", error);
        } finally {
            loadingState = '';
        }
    }, 1000);

    // Update balances when tokens change
    $: {
        if (token0 || token1) {
            debouncedBalanceUpdate();
        }
    }

    // Cleanup debounced function
    onDestroy(() => {
        debouncedHandleInput.cancel();
    });
</script>

<Panel variant="green" width="auto" className="liquidity-panel w-full max-w-[690px]">
    <div class="flex flex-col min-h-[165px] box-border relative rounded-lg">
        <header>
            <div class="flex items-center justify-between gap-4 min-h-[2.5rem] mb-5">
                <h2 class="text-[clamp(1.5rem,4vw,2rem)] font-semibold text-white m-0 tracking-tight leading-none">
                    Add Liquidity
                </h2>
            </div>
        </header>

        <div class="token-input-container">
            <div class="relative flex-grow mb-2">
                <div class="flex items-center gap-4">
                    <div class="relative flex-1">
                        <input
                            bind:this={input0Element}
                            type="text"
                            inputmode="decimal"
                            pattern="[0-9]*"
                            placeholder="0.00"
                            class="amount-input"
                            value={formattedDisplayAmount0}
                            on:input={(e) => handleInput(0, e)}
                            on:focus={() => (input0Focused = true)}
                            on:blur={() => (input0Focused = false)}
                        />
                    </div>
                    <div class="token-selector-wrapper">
                        <button 
                            class="token-selector-button" 
                            on:click={() => openTokenSelector(0)}
                        >
                            {#if token0}
                                <div class="token-info">
                                    <img src={token0.logo_url} alt={token0.symbol} class="token-logo" />
                                    <span class="token-symbol">{token0.symbol}</span>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="chevron">
                                    <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                                </svg>
                            {:else}
                                <span class="select-token-text">Select Token</span>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="chevron">
                                    <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </button>
                    </div>
                </div>
            </div>
            <div class="balance-info">
                <button 
                    class="available-balance"
                    on:click={() => handleMaxClick(0)}
                >
                    Available: {token0 ? formatTokenAmount(token0Balance, token0.decimals) : '0.00'} {token0?.symbol || ''}
                </button>
                <div class="flex items-center gap-2">
                    <span class="text-white/50 font-normal tracking-wide">Est Value</span>
                    <span class="pl-1 text-white/50 font-medium tracking-wide">
                        ${formatToNonZeroDecimal($animatedUsdValue0)}
                    </span>
                </div>
            </div>
        </div>

        <div class="plus-icon">
            <Plus size={24} />
        </div>

        <div class="token-input-container">
            <div class="relative flex-grow mb-2">
                <div class="flex items-center gap-4">
                    <div class="relative flex-1">
                        <input
                            bind:this={input1Element}
                            type="text"
                            inputmode="decimal"
                            pattern="[0-9]*"
                            placeholder="0.00"
                            class="amount-input"
                            value={formattedDisplayAmount1}
                            on:input={(e) => handleInput(1, e)}
                            on:focus={() => (input1Focused = true)}
                            on:blur={() => (input1Focused = false)}
                        />
                    </div>
                    <div class="token-selector-wrapper">
                        <button 
                            class="token-selector-button" 
                            on:click={() => openTokenSelector(1)}
                        >
                            {#if token1}
                                <div class="token-info">
                                    <img src={token1.logo_url} alt={token1.symbol} class="token-logo" />
                                    <span class="token-symbol">{token1.symbol}</span>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="chevron">
                                    <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                                </svg>
                            {:else}
                                <span class="select-token-text">Select Token</span>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="chevron">
                                    <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                        </button>
                    </div>
                </div>
            </div>
            <div class="balance-info">
                <button 
                    class="available-balance"
                    on:click={() => handleMaxClick(1)}
                >
                    Available: {token1 ? formatTokenAmount(token1Balance, token1.decimals) : '0.00'} {token1?.symbol || ''}
                </button>
                <div class="flex items-center gap-2">
                    <span class="text-white/50 font-normal tracking-wide">Est Value</span>
                    <span class="pl-1 text-white/50 font-medium tracking-wide">
                        ${formatToNonZeroDecimal($animatedUsdValue1)}
                    </span>
                </div>
            </div>
        </div>

        <button
            class="submit-button"
            disabled={!isValid || loading}
            on:click={handleSubmit}
        >
            {#if loading}
                <div class="loading-state">
                    <span class="loading-spinner"></span>
                    <span>{loadingState}</span>
                </div>
            {:else}
                {buttonText}
            {/if}
        </button>

        {#if token0 && token1}
            {#if pool}
                <div class="pool-info mt-4">
                    <div class="pool-stats-grid">
                        <div class="pool-stat">
                            <span class="stat-value">${formatLargeNumber(pool.balance)}</span>
                            <span class="stat-label">TVL</span>
                        </div>
                        <div class="pool-stat">
                            <span class="stat-value">${formatLargeNumber(pool.rolling_24h_volume)}</span>
                            <span class="stat-label">24h Vol</span>
                        </div>
                        <div class="pool-stat">
                            <span class="stat-value">{formatToNonZeroDecimal(pool.rolling_24h_apy)}%</span>
                            <span class="stat-label">APY</span>
                        </div>
                    </div>
                    <div class="pool-ratio">
                        <span>1 {pool.symbol_0} = {formatToNonZeroDecimal(Number(pool.balance_1) / Number(pool.balance_0))} {pool.symbol_1}</span>
                    </div>
                </div>
            {:else}
                <div class="pool-info mt-4">
                    <div class="no-pool-message">
                        <span>This pool doesn't exist yet.</span>
                    </div>
                </div>
            {/if}
        {/if}
    </div>
</Panel>

<!-- Token Selectors -->
{#if showToken0Selector}
    <Portal target="body">
        <TokenSelectorDropdown
            show={true}
            currentToken={token0}
            otherPanelToken={token1}
            onSelect={(token) => {
                token0 = token;
                showToken0Selector = false;
                onTokenSelect(0);
            }}
            onClose={() => showToken0Selector = false}
        />
    </Portal>
{/if}

{#if showToken1Selector}
    <Portal target="body">
        <TokenSelectorDropdown
            show={true}
            currentToken={token1}
            otherPanelToken={token0}
            onSelect={(token) => {
                token1 = token;
                showToken1Selector = false;
                onTokenSelect(1);
            }}
            onClose={() => showToken1Selector = false}
            restrictToSecondaryTokens={true}
        />
    </Portal>
{/if}

{#if showConfirmation}
    <Portal target="body">
        <AddLiquidityConfirmation
            {token0}
            {token1}
            {amount0}
            {amount1}
            {pool}
            isOpen={showConfirmation}
            onClose={() => {
                showConfirmation = false;
                // Reset form state on close
                amount0 = "0";
                amount1 = "0";
                if (input0Element) input0Element.value = "0";
                if (input1Element) input1Element.value = "0";
            }}
            onConfirm={async () => {
                showConfirmation = false;
                await onSubmit();
            }}
        />
    </Portal>
{/if}

<style lang="postcss">
    .liquidity-panel {
        @apply relative;
    }

    .token-input-container {
        @apply mb-4;
    }

    .token-selector-wrapper {
        @apply min-w-[180px];
    }

    .token-selector-button {
        @apply w-full flex items-center justify-between;
        @apply bg-white/5 hover:bg-white/10;
        @apply rounded-xl px-4 py-3;
        @apply border border-white/10;
        @apply transition-colors duration-150;
    }

    .token-info {
        @apply flex items-center gap-2 min-w-[140px];
    }

    .token-logo {
        @apply w-8 h-8 rounded-full bg-white/5 object-contain;
    }

    .token-symbol {
        @apply text-[15px] text-white font-medium min-w-[80px];
    }

    .select-token-text {
        @apply text-[15px] text-white/70 min-w-[120px] text-left;
    }

    .amount-input {
        @apply flex-1 min-w-0 bg-transparent border-none;
        @apply text-white text-[2.5rem] font-medium tracking-tight;
        @apply w-full relative z-10 p-0;
        @apply opacity-85 focus:outline-none focus:text-white;
        @apply disabled:text-white/65 placeholder:text-white/65;
    }

    .balance-info {
        @apply flex justify-between mt-2;
        @apply text-[clamp(0.8rem,2vw,0.875rem)] text-white/50;
    }

    .plus-icon {
        @apply flex justify-center text-white/50 my-2;
    }

    .submit-button {
        @apply w-full px-6 py-3 rounded-xl;
        @apply bg-blue-600 text-white font-medium;
        @apply disabled:opacity-50 disabled:cursor-not-allowed;
        @apply hover:bg-blue-700 transition-colors duration-200;
        @apply mt-4;
    }

    .loading-state {
        @apply flex items-center justify-center gap-2;
    }

    .loading-spinner {
        @apply w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin;
    }

    .chevron {
        @apply w-5 h-5 text-white/50;
    }

    @media (max-width: 420px) {
        .amount-input {
            @apply text-2xl mt-[-0.15rem];
        }
    }

    .pool-info {
        @apply border-t border-white/10 pt-4;
    }

    .pool-stats-grid {
        @apply grid grid-cols-3 gap-2 bg-white/5 rounded-lg p-3;
    }

    .pool-stat {
        @apply flex flex-col items-center;
    }

    .stat-value {
        @apply text-base font-medium text-white;
    }

    .stat-label {
        @apply text-xs text-white/60;
    }

    .pool-ratio {
        @apply mt-2 text-sm text-white/80 text-center;
    }

    @media (min-width: 640px) {
        .stat-value {
            @apply text-lg;
        }
        
        .stat-label {
            @apply text-sm;
        }
    }

    .no-pool-message {
        @apply flex items-center justify-center p-4 rounded-lg bg-white/5 text-white/80;
        font-size: 0.95rem;
    }

    .available-balance {
        @apply text-white/70 hover:text-yellow-500 transition-colors duration-150;
    }
</style>
