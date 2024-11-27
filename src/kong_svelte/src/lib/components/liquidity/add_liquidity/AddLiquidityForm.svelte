<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { fade } from "svelte/transition";
    import { formatTokenAmount, parseTokenAmount } from "$lib/utils/numberFormatUtils";
    import { poolStore } from "$lib/services/pools/poolStore";
    import Portal from 'svelte-portal';
    import TokenSelectorDropdown from '$lib/components/swap/swap_ui/TokenSelectorDropdown.svelte';
    import { PoolService } from '$lib/services/pools/PoolService';

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

    let liquidityMode: 'full' | 'custom' = 'full';
    let isTransitioning = false;
    let previousMode: 'full' | 'custom' = 'full';
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

        if (token0 && token1) {
            const inputValue = input === '' ? '0' : input;
            
            try {
                console.log('Calculating liquidity amounts...');
                if (index === 0) {
                    const parsedAmount = parseTokenAmount(inputValue, token0.decimals);
                    console.log('Token0 parsed amount:', parsedAmount);
                    const result = await PoolService.addLiquidityAmounts(
                        token0.token,
                        parsedAmount,
                        token1.token
                    );
                    
                    if (result.Ok) {
                        amount1 = formatTokenAmount(result.Ok.amount_1, token1.decimals);
                        console.log('Set amount1 to:', amount1);
                    }
                } else {
                    const parsedAmount = parseTokenAmount(inputValue, token1.decimals);
                    const result = await PoolService.addLiquidityAmounts(
                        token1.token,
                        parsedAmount,
                        token0.token
                    );
                    
                    if (result.Ok) {
                        amount0 = formatTokenAmount(result.Ok.amount_0, token0.decimals);
                        console.log('Set amount0 to:', amount0);
                    }
                }
            } catch (err) {
                console.error("Error calculating liquidity amounts:", err);
                error = err.message;
            }
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

    function handleModeChange(mode: 'full' | 'custom') {
        if (mode === liquidityMode) return;
        previousMode = liquidityMode;
        isTransitioning = true;
        liquidityMode = mode;
        setTimeout(() => {
            isTransitioning = false;
        }, 300);
    }
</script>

<div class="mode-selector">
    <div class="mode-buttons">
        <button
            class="mode-button {liquidityMode === 'full' ? 'active' : ''}"
            on:click={() => handleModeChange('full')}
        >
            Full Range
        </button>
        <button
            class="mode-button {liquidityMode === 'custom' ? 'active' : ''}"
            on:click={() => handleModeChange('custom')}
        >
            Custom Range
        </button>
    </div>
</div>

<div class="form-container">
    <div class="token-input-container">
        <div class="token-input">
            <button 
                class="token-selector-button" 
                on:click={() => openTokenSelector(0)}
            >
                {#if token0}
                    <img src={token0.logo} alt={token0.symbol} class="token-logo" />
                    <span>{token0.symbol}</span>
                {:else}
                    <span>Select Token</span>
                {/if}
            </button>
            <input
                type="text"
                placeholder="0.0"
                value={amount0}
                on:input={(e) => handleInput(0, e)}
                class="amount-input"
            />
        </div>
        <div class="balance-info">
            <span>Balance: {token0 ? formatTokenAmount(token0Balance, token0.decimals) : '0.00'}</span>
            <span>${getUsdValue(amount0, token0)}</span>
        </div>
    </div>

    <div class="plus-icon">
        <Plus size={24} />
    </div>

    <div class="token-input-container">
        <div class="token-input">
            <button 
                class="token-selector-button" 
                on:click={() => openTokenSelector(1)}
            >
                {#if token1}
                    <img src={token1.logo} alt={token1.symbol} class="token-logo" />
                    <span>{token1.symbol}</span>
                {:else}
                    <span>Select Token</span>
                {/if}
            </button>
            <input
                type="text"
                placeholder="0.0"
                value={amount1}
                on:input={(e) => handleInput(1, e)}
                class="amount-input"
            />
        </div>
        <div class="balance-info">
            <span>Balance: {token1 ? formatTokenAmount(token1Balance, token1.decimals) : '0.00'}</span>
            <span>${getUsdValue(amount1, token1)}</span>
        </div>
    </div>

    <button
        class="submit-button"
        disabled={!isValid || loading}
        on:click={onSubmit}
    >
        {buttonText}
    </button>
</div>

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
    .mode-selector {
        @apply flex flex-col gap-2 mb-4;
    }

    .mode-buttons {
        @apply flex gap-2;
    }

    .mode-button {
        @apply px-4 py-2 rounded-lg bg-gray-800 text-white/60 hover:text-white
               transition-colors duration-200;
    }

    .mode-button.active {
        @apply bg-blue-600 text-white;
    }

    .form-container {
        @apply flex flex-col gap-4;
    }

    .token-input-container {
        @apply bg-gray-800 rounded-lg p-4;
    }

    .token-input {
        @apply flex items-center gap-4;
    }

    .token-selector-button {
        @apply flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700
               hover:bg-gray-600 transition-colors duration-200;
    }

    .token-logo {
        @apply w-6 h-6 rounded-full;
    }

    .amount-input {
        @apply flex-1 bg-transparent text-right text-xl font-medium
               focus:outline-none;
    }

    .balance-info {
        @apply flex justify-between mt-2 text-sm text-white/60;
    }

    .plus-icon {
        @apply flex justify-center text-white/60;
    }

    .submit-button {
        @apply w-full px-6 py-3 rounded-lg bg-blue-600 text-white font-medium
               disabled:opacity-50 disabled:cursor-not-allowed
               hover:bg-blue-700 transition-colors duration-200;
    }

    .token-selector-overlay {
        @apply fixed inset-0 flex items-center justify-center bg-black/50 z-50;
    }

    :global(.token-selector-overlay .token-selector) {
        @apply bg-gray-900 rounded-lg p-4 w-full max-w-md mx-4;
    }
</style>
