<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import { formatTokenAmount, parseTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
    import { poolStore } from "$lib/services/pools/poolStore";
    import Portal from 'svelte-portal';
    import TokenSelectorDropdown from '$lib/components/swap/swap_ui/TokenSelectorDropdown.svelte';
    import { PoolService } from '$lib/services/pools/PoolService';
    import Panel from '$lib/components/common/Panel.svelte';

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
    export let onSubmit: () => void;
    export let previewMode: boolean = false;
    export let pool: BE.Pool | null = null;

    let showToken0Selector = false;
    let showToken1Selector = false;

    $: {
        if ($poolStore.userPoolBalances) {
            console.log('Pool balances updated:', $poolStore.userPoolBalances);
        }
    }

    async function handleInput(index: 0 | 1, event: Event) {
        const input = (event.target as HTMLInputElement).value;
        if (!(/^\d*\.?\d*$/.test(input) || input === '')) return;
        
        // Update the input value immediately
        if (index === 0) {
            amount0 = input;
        } else {
            amount1 = input;
        }

        onInput(index, input);
    }

    function getUsdValue(amount: string, token: FE.Token | null): string {
        if (!amount || !token) return "0.00";
        const price = token.price;
        return (price * Number(amount)).toFixed(2);
    }

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
        const parsedAmount0 = parseTokenAmount(amount0, token0.decimals) - token0.fee;
        const parsedAmount1 = parseTokenAmount(amount1, token1.decimals) - token1.fee;
        const parsedBalance0 = BigInt(token0Balance);
        const parsedBalance1 = BigInt(token1Balance);
        return parsedAmount0 > parsedBalance0 || parsedAmount1 > parsedBalance1;
    };

    $: buttonText = hasInsufficientBalance()
        ? "Insufficient Balance"
        : !token0 || !token1
        ? "Select Tokens"
        : !amount0 || !amount1
        ? "Enter Amounts"
        : loading
        ? "Loading..."
        : "Review Transaction";

    $: isValid = token0 && token1 && amount0 && amount1 && !error && !hasInsufficientBalance();

    // Helper function to format large numbers with commas and fixed decimals
    function formatLargeNumber(value: string | number | bigint, decimals: number = 2): string {
        const num = Number(value) / 1e6; // Convert from microdollars to dollars
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    }

    // Helper function to format ratio with 6 decimal places
    function formatRatio(value: number): string {
        return formatToNonZeroDecimal(value);
    }
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
                            type="text"
                            placeholder="0.00"
                            value={amount0}
                            on:input={(e) => handleInput(0, e)}
                            class="amount-input"
                        />
                    </div>
                    <div class="token-selector-wrapper">
                        <button 
                            class="token-selector-button" 
                            on:click={() => openTokenSelector(0)}
                        >
                            {#if token0}
                                <div class="token-info">
                                    <img src={token0.logo} alt={token0.symbol} class="token-logo" />
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
                <span>Available: {token0 ? formatTokenAmount(token0Balance, token0.decimals) : '0.00'} {token0?.symbol || ''}</span>
                <div class="flex items-center gap-2">
                    <span class="text-white/50 font-normal tracking-wide">Est Value</span>
                    <span class="pl-1 text-white/50 font-medium tracking-wide">
                        ${getUsdValue(amount0, token0)}
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
                            type="text"
                            placeholder="0.00"
                            value={amount1}
                            on:input={(e) => handleInput(1, e)}
                            class="amount-input"
                        />
                    </div>
                    <div class="token-selector-wrapper">
                        <button 
                            class="token-selector-button" 
                            on:click={() => openTokenSelector(1)}
                        >
                            {#if token1}
                                <div class="token-info">
                                    <img src={token1.logo} alt={token1.symbol} class="token-logo" />
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
                <span>Available: {token1 ? formatTokenAmount(token1Balance, token1.decimals) : '0.00'} {token1?.symbol || ''}</span>
                <div class="flex items-center gap-2">
                    <span class="text-white/50 font-normal tracking-wide">Est Value</span>
                    <span class="pl-1 text-white/50 font-medium tracking-wide">
                        ${getUsdValue(amount1, token1)}
                    </span>
                </div>
            </div>
        </div>

        <button
            class="submit-button"
            disabled={!isValid || loading}
            on:click={onSubmit}
        >
            {buttonText}
        </button>

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
        @apply text-[clamp(0.75rem,2vw,0.875rem)] text-white/50;
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
</style>
