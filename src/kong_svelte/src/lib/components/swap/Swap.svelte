<script lang="ts">
    import { fade } from 'svelte/transition';
    import { onMount } from 'svelte';
    import debounce from 'lodash/debounce';
    import BigNumber from 'bignumber.js';
    import { backendService } from '$lib/services/backendService';
    import { tokenStore } from '$lib/stores/tokenStore';
    import Panel from '$lib/components/common/Panel.svelte';
    import Button from '$lib/components/common/Button.svelte';
    import TokenSelector from '$lib/components/swap/swap_ui/TokenSelector.svelte';
    import SwapConfirmation from '$lib/components/swap/swap_ui/SwapConfirmation.svelte';
    import { formatNumberCustom } from '$lib/utils/formatNumberCustom';

    // Props
    export let slippage = 2;
    export let initialPool: string | null = null;

    // State
    let payToken = initialPool?.split('_')[0] || 'ICP';
    let receiveToken = initialPool?.split('_')[1] || 'ckBTC';
    let payAmount = '';
    let receiveAmount = '0';
    let displayReceiveAmount = '0';
    let isCalculating = false;
    let error: string | null = null;
    let showPayTokenSelector = false;
    let showReceiveTokenSelector = false;
    let isProcessing = false;
    let isConfirmationOpen = false;
    let price = '0';
    let usdValue = '0';
    let swapSlippage = 0;
    let requestId: bigint | null = null;

    // Fees state
    let gasFee = '0';
    let lpFee = '0';
    let lpFeeToken = '';
    let gasFeeToken = '';

    $: isValidInput = payAmount && Number(payAmount) > 0 && !isCalculating;
    $: buttonText = getButtonText(isCalculating, isValidInput, isProcessing, error);

    function getButtonText(isCalculating: boolean, isValidInput: boolean, isProcessing: boolean, error: string | null): string {
        if (isCalculating) return 'Calculating...';
        if (isProcessing) return 'Processing...';
        if (error) return error;
        if (!isValidInput) return 'Enter Amount';
        return 'Swap';
    }

    function getTokenDecimals(symbol: string): number {
        const token = $tokenStore.tokens.find(t => t.symbol === symbol);
        return token?.decimals || 8;
    }

    function toBigInt(amount: string, decimals: number): bigint {
        if (!amount || isNaN(Number(amount))) return BigInt(0);
        return BigInt(
            new BigNumber(amount)
                .times(new BigNumber(10).pow(decimals))
                .integerValue()
                .toString()
        );
    }

    function fromBigInt(amount: bigint, decimals: number): string {
        return new BigNumber(amount.toString())
            .div(new BigNumber(10).pow(decimals))
            .toString();
    }

    async function getSwapQuote(amount: string) {
        if (!amount || Number(amount) <= 0) {
            setReceiveAmount('0');
            return;
        }

        isCalculating = true;
        error = null;

        try {
            const payDecimals = getTokenDecimals(payToken);
            const payAmountBigInt = toBigInt(amount, payDecimals);

            const quote = await backendService.swap_amounts(
                payToken,
                payAmountBigInt,
                receiveToken
            );

            if ('Ok' in quote) {
                const receiveDecimals = getTokenDecimals(receiveToken);
                const receivedAmount = fromBigInt(quote.Ok.receive_amount, receiveDecimals);
                
                setReceiveAmount(receivedAmount);
                setDisplayAmount(formatNumberCustom(receivedAmount, 6));
                
                price = quote.Ok.price.toString();
                swapSlippage = quote.Ok.slippage;
                
                usdValue = new BigNumber(receivedAmount)
                    .times(quote.Ok.price)
                    .toFormat(2);

                if (quote.Ok.txs.length > 0) {
                    const firstTx = quote.Ok.txs[0];
                    lpFee = fromBigInt(firstTx.lp_fee, receiveDecimals);
                    gasFee = fromBigInt(firstTx.gas_fee, receiveDecimals);
                    lpFeeToken = firstTx.receive_symbol;
                    gasFeeToken = firstTx.receive_symbol;
                }
            } else if ('Err' in quote) {
                error = quote.Err;
                setReceiveAmount('0');
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'An error occurred';
            setReceiveAmount('0');
        } finally {
            isCalculating = false;
        }
    }

    const debouncedGetQuote = debounce(getSwapQuote, 500);

    function setReceiveAmount(amount: string) {
        receiveAmount = amount;
    }

    function setDisplayAmount(amount: string) {
        displayReceiveAmount = amount;
    }

    async function handleSwap() {
        if (!isValidInput || isProcessing) return;

        isProcessing = true;
        try {
            const payDecimals = getTokenDecimals(payToken);
            const receiveDecimals = getTokenDecimals(receiveToken);
            
            const payAmountBigInt = toBigInt(payAmount, payDecimals);
            const receiveAmountBigInt = toBigInt(receiveAmount, receiveDecimals);

            const result = await backendService.swap_async({
                pay_token: payToken,
                pay_amount: payAmountBigInt,
                receive_token: receiveToken,
                receive_amount: [receiveAmountBigInt],
                max_slippage: [slippage],
                receive_address: [],
                referred_by: [],
                pay_tx_id: []
            });

            if ('Ok' in result) {
                requestId = result.Ok;
                startPolling(result.Ok);
            } else {
                error = result.Err;
                isConfirmationOpen = false;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Swap failed';
            isConfirmationOpen = false;
        } finally {
            if (error) isProcessing = false;
        }
    }

    function startPolling(reqId: bigint) {
        const interval = setInterval(async () => {
            try {
                const status = await backendService.requests([reqId]);
                
                if ('Ok' in status && status.Ok.length > 0) {
                    const request = status.Ok[0];
                    if (request.reply && 'Swap' in request.reply) {
                        const swapReply = request.reply.Swap;
                        
                        if (swapReply.status === 'Success') {
                            clearInterval(interval);
                            handleSwapSuccess(swapReply);
                        } else if (swapReply.status === 'Failed') {
                            clearInterval(interval);
                            handleSwapFailure(swapReply);
                        }
                    }
                }
            } catch (err) {
                clearInterval(interval);
                error = 'Failed to check swap status';
                isProcessing = false;
            }
        }, 1000);

        // Set timeout for polling
        setTimeout(() => {
            clearInterval(interval);
        }, 60000);
    }

    function handleSwapSuccess(reply: any) {
        isProcessing = false;
        isConfirmationOpen = false;
        payAmount = '';
        setReceiveAmount('0');
        setDisplayAmount('0');
    }

    function handleSwapFailure(reply: any) {
        isProcessing = false;
        isConfirmationOpen = false;
        error = 'Swap failed';
    }

    function handleInputChange(event: Event) {
        const input = (event.target as HTMLInputElement).value;
        if (/^\d*\.?\d*$/.test(input) || input === '') {
            payAmount = input;
            debouncedGetQuote(input);
        }
    }

    function handleTokenSwitch() {
        [payToken, receiveToken] = [receiveToken, payToken];
        if (payAmount) debouncedGetQuote(payAmount);
    }

    onMount(() => {
        if (!$tokenStore.tokens.length) {
            tokenStore.loadTokens();
        }
    });
</script>

<div class="swap-wrapper">
    <div class="swap-container" in:fade>
        <!-- Pay Panel -->
        <Panel variant="green" width="100%" height="180">
            <div class="panel-content">
                <div class="panel-header">
                    <h2>You Pay</h2>
                    <div class="balance">
                        Balance: {formatNumberCustom($tokenStore.balances[payToken]?.balance || '0', 6)} {payToken}
                    </div>
                </div>
                <div class="input-container">
                    <input 
                        type="text" 
                        value={payAmount}
                        on:input={handleInputChange}
                        placeholder="0.00"
                        class="input-amount"
                        disabled={isProcessing}
                    />
                    <Button 
                        variant="yellow" 
                        on:click={() => showPayTokenSelector = true}
                    >
                        {payToken}
                    </Button>
                </div>
            </div>
        </Panel>

        <!-- Swap Arrow -->
        <button 
            class="switch-button" 
            on:click={handleTokenSwitch}
            disabled={isProcessing}
        >
            ↓
        </button>

        <!-- Receive Panel -->
        <Panel variant="green" width="100%" height="180">
            <div class="panel-content">
                <div class="panel-header">
                    <h2>You Receive</h2>
                    <div class="balance">
                        Balance: {formatNumberCustom($tokenStore.balances[receiveToken]?.balance || '0', 6)} {receiveToken}
                    </div>
                </div>
                <div class="input-container">
                    <input 
                        type="text" 
                        value={displayReceiveAmount}
                        disabled
                        placeholder="0.00"
                        class="input-amount"
                    />
                    <Button 
                        variant="yellow"
                        on:click={() => showReceiveTokenSelector = true}
                    >
                        {receiveToken}
                    </Button>
                </div>
                {#if payAmount && payAmount !== '0'}
                    <div class="price-info">
                        ~${usdValue} (Slippage: {swapSlippage}%)
                    </div>
                {/if}
            </div>
        </Panel>

        {#if error}
            <div class="error" transition:fade>{error}</div>
        {/if}

        <div class="swap-footer">
            <Button 
                variant="yellow"
                disabled={!isValidInput || isProcessing}
                on:click={() => isConfirmationOpen = true}
            >
                {buttonText}
            </Button>
        </div>

        <!-- Token Selectors -->
        {#if showPayTokenSelector}
            <TokenSelector 
                selectedToken={payToken}
                onSelect={(token) => {
                    payToken = token;
                    showPayTokenSelector = false;
                    if (payAmount) debouncedGetQuote(payAmount);
                }}
                onClose={() => showPayTokenSelector = false}
            />
        {/if}

        {#if showReceiveTokenSelector}
            <TokenSelector 
                selectedToken={receiveToken}
                onSelect={(token) => {
                    receiveToken = token;
                    showReceiveTokenSelector = false;
                    if (payAmount) debouncedGetQuote(payAmount);
                }}
                onClose={() => showReceiveTokenSelector = false}
            />
        {/if}

        <!-- Confirmation Modal -->
        {#if isConfirmationOpen}
            <SwapConfirmation 
                {payToken}
                {payAmount}
                {receiveToken}
                {receiveAmount}
                {lpFee}
                {gasFee}
                {lpFeeToken}
                {gasFeeToken}
                onConfirm={handleSwap}
                onClose={() => isConfirmationOpen = false}
            />
        {/if}
    </div>
</div>

<style>
    .swap-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 2rem;
    }

    .swap-container {
        width: 100%;
        max-width: 480px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .input-amount {
        width: 100%;
        background: transparent;
        border: none;
        font-size: 1.5rem;
        color: white;
        padding: 0.5rem;
    }

    .price-info {
        font-size: 0.9rem;
        color: #aaa;
        margin-top: 0.5rem;
    }

    .error {
        color: #ff4444;
        padding: 0.5rem;
        border-radius: 0.25rem;
        background: rgba(255, 68, 68, 0.1);
        text-align: center;
    }

    .switch-button {
        align-self: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid white;
        color: white;
        cursor: pointer;
        transition: transform 0.3s ease;
    }

    .switch-button:hover:not(:disabled) {
        transform: rotate(180deg);
    }

    .switch-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .panel-content {
        padding: 1rem;
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .balance {
        font-size: 0.9rem;
        opacity: 0.7;
    }

    .input-container {
        display: flex;
        gap: 1rem;
        align-items: center;
    }
</style>
