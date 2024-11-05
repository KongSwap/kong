<script lang="ts">
    import { TokenService } from '$lib/services/TokenService';
    import { PoolService } from '$lib/services/PoolService';
    import { onMount } from 'svelte';
    import { tokenStore, formattedTokens } from '$lib/stores/tokenStore';
    import { get } from 'svelte/store';
    import AddLiquidityForm from '$lib/components/liquidity/AddLiquidityForm.svelte';
    import TokenSelectionModal from '$lib/components/liquidity/TokenSelectionModal.svelte';
    import { debounce } from 'lodash-es';
    import { parseTokenAmount } from '$lib/utils/numberFormatUtils';
    
    let token0: FE.Token | null = null;
    let token1: FE.Token | null = null;
    let amount0: string = '';
    let amount1: string = '';
    let loading = false;
    let previewMode = false;
    let error: string | null = null;
    let poolShare: string = '0';
    let token0Balance: string = '0';
    let token1Balance: string = '0';
    let isProcessingOutput = false;

    // Initialize modal state to false explicitly
    let showTokenModal = false;
    let activeTokenIndex: 0 | 1 = 0;
    let searchQuery = '';
    let tokens: FE.Token[] = [];
    
    // Track which input was last modified
    let activeInput: 0 | 1 | null = null;

    onMount(async () => {
        await tokenStore.loadTokens(); // Load tokens
        await tokenStore.reloadTokensAndBalances(); // Load balances
        tokens = get(formattedTokens).tokens;
    });
    
    function handleTokenSelect(index: 0 | 1) {
        activeTokenIndex = index;
        searchQuery = ''; // Reset search query
        showTokenModal = true;
    }
    
    function closeModal() {
        showTokenModal = false;
        searchQuery = ''; // Reset search query when closing
    }
    
    function selectToken(token: FE.Token) {
        if (activeTokenIndex === 0) {
            token0 = token;
        } else {
            token1 = token;
        }
        closeModal();
        error = null;
    }
    
    // Debounced calculation to prevent excessive API calls
    const debouncedCalculate = debounce(async (amount: string, index: 0 | 1) => {
        if (!amount || isNaN(parseFloat(amount))) {
            if (index === 0) amount1 = '';
            else amount0 = '';
            return;
        }
        await calculateLiquidityAmount(amount, index);
    }, 300);
    
    function handleInput(index: 0 | 1, value: string) {
        if (index === 0) {
            amount0 = value;
        } else {
            amount1 = value;
        }
        activeInput = index;
        debouncedCalculate(value, index);
    }
    
    async function calculateLiquidityAmount(amount: string, index: 0 | 1) {
        if (!token0 || !token1) {
            error = 'Please select both tokens.';
            return;
        }

        try {
            loading = true;
            error = null;   
            console.log('calculateLiquidityAmount', token0);
            
            // Fetch the required amount using PoolService
            const requiredAmount = await PoolService.addLiquidityAmounts(
                token0.token,
                parseTokenAmount(amount, token0.decimals),
                token1.token
            );

            console.log('requiredAmount', requiredAmount);

            if (index === 0) {
                // Ensure amount1 is a string
                amount1 = requiredAmount.Ok.amount_1;
            } else {
                // Ensure amount0 is a string
                amount0 = requiredAmount.Ok.amount_0;
            }
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    }
    
    async function handlePreview() {
        previewMode = true;
        // Additional preview logic if necessary
    }
    
    async function handleSubmit() {
        loading = true;
        error = null;

        try {
            console.log('handleSubmit', token0)
            const params = {
                token_0: token0.token,
                amount_0: parseTokenAmount(amount0, token0.decimals),
                token_1: token1.token,
                amount_1: parseTokenAmount(amount1, token1.decimals),
            };

            const requestId = await PoolService.addLiquidity(params);
            
            // Poll for request status
            const interval = setInterval(async () => {
                const status = await PoolService.pollRequestStatus(requestId);
               
                if (status.status === 'completed') {
                    clearInterval(interval);
                    // Handle success - maybe redirect or show success message
                } else if (status.status === 'failed') {
                    clearInterval(interval);
                    throw new Error(status.error || 'Transaction failed');
                }
            }, 2000);
            
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    }
    
    async function updateBalances() {
        if (!token0 || !token1) return;
        
        try {
            const balances = await TokenService.fetchBalances([token0, token1]);
            if (token0) {
                token0Balance = balances[token0.canister_id]?.in_tokens.toString() || '0';
            }
            if (token1) {
                token1Balance = balances[token1.canister_id]?.in_tokens.toString() || '0';
            }
        } catch (err) {
            console.error('Error fetching balances:', err);
        }
    }
    
    $: if (token0 || token1) {
        updateBalances();
    }
</script>

<div class="mx-auto p-4 max-w-3xl w-full">
    <div class="min-w-3xl w-full flex flex-col justify-center p-4 md:p-6 space-y-8 mt-32">
        <div class="bg-white dark:bg-emerald-900/70 dark:bg-opacity-80 dark:backdrop-blur-md rounded-2xl shadow-lg p-6 w-full">
            <AddLiquidityForm
                {token0}
                {token1}
                {amount0}
                {amount1}
                {loading}
                {previewMode}
                {error}
                {poolShare}
                onTokenSelect={handleTokenSelect}
                onInput={handleInput}
                onPreview={handlePreview}
                onSubmit={handleSubmit}
                isProcessingOutput={isProcessingOutput}
            />
        </div>
    </div>
</div>

<TokenSelectionModal
    show={showTokenModal}
    tokens={tokens}
    helperText={activeTokenIndex === 1 ? "Only ICP and ckUSDT pairs are supported" : ""}
    bind:searchQuery
    onClose={closeModal}
    onSelect={selectToken}
/>