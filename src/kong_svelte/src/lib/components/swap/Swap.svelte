<script lang="ts">
    import { fade } from 'svelte/transition';
    import { onMount } from 'svelte';
    import debounce from 'lodash/debounce';
    import BigNumber from 'bignumber.js';
    import { SwapService } from '$lib/services/SwapService';
    import { tokenStore } from '$lib/stores/tokenStore';
    import SwapPanel from '$lib/components/swap/swap_ui/SwapPanel.svelte';
    import Button from '$lib/components/common/Button.svelte';
    import TokenSelector from '$lib/components/swap/swap_ui/TokenSelectorModal.svelte';
    import SwapConfirmation from '$lib/components/swap/swap_ui/SwapConfirmation.svelte';
    import { formatNumberCustom } from '$lib/utils/formatNumberCustom';
    import { t } from '$lib/locales/translations';

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
    let isArrowFlipped = false;

    // Fees state
    let gasFee = '0';
    let lpFee = '0';
    let lpFeeToken = '';
    let gasFeeToken = '';

    $: isValidInput = payAmount && Number(payAmount) > 0 && !isCalculating;
    $: buttonText = getButtonText(isCalculating, isValidInput, isProcessing, error);

    function getButtonText(isCalculating: boolean, isValidInput: boolean, isProcessing: boolean, error: string | null): string {
        if (isCalculating) return $t('swap.calculating');
        if (isProcessing) return $t('swap.processing');
    if (error) return error;
    if (!isValidInput) return $t('swap.enterAmount');
    return $t('swap.swap');
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

            const quote = await SwapService.swap_amounts(
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
            
            // Get the appropriate ledger canister ID based on the pay token
            const ledgerCanisterId = {
                'ckBTC': 'zeyan-7qaaa-aaaar-qaibq-cai',
                'ckETH': 'zr7ra-6yaaa-aaaar-qaica-cai',
                'ckUSDC': 'zw6xu-taaaa-aaaar-qaicq-cai',
                'ckUSDT': 'zdzgz-siaaa-aaaar-qaiba-cai',
                'ICP': 'nppha-riaaa-aaaal-ajf2q-cai'
            }[payToken];

            // Add approval call here
            const approved = await SwapService.icrc2_approve({
                amount: payAmountBigInt,
                spender: { 
                    owner: 'l4lgk-raaaa-aaaar-qahpq-cai', // kong_backend canister ID
                    subaccount: [] 
                },
                expires_at: [], 
                fee: [], 
                memo: [], 
                from_subaccount: [], 
                created_at_time: [] 
            });

            if ('Err' in approved) {
                throw new Error(`Failed to approve tokens: ${approved.Err}`);
            }

            // Then proceed with swap
            const result = await SwapService.swap_async({
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
                const status = await SwapService.requests([reqId]);
                
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
        // remove anything that isnt a number or a period and get quote
        const cleanedInput = input.replace(/[^0-9.]/g, '');
        event.target.value = cleanedInput;
        if (/^\d*\.?\d*$/.test(cleanedInput) || cleanedInput === '') {
            payAmount = cleanedInput;
            debouncedGetQuote(cleanedInput);
        }
    }

    function handleTokenSwitch() {
        [payToken, receiveToken] = [receiveToken, payToken];
        isArrowFlipped = !isArrowFlipped;
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
        <SwapPanel
            title={$t('swap.pay')}
            token={payToken}
            amount={payAmount}
            balance={$tokenStore.balances[payToken]?.balance || '0'}
            onTokenSelect={() => showPayTokenSelector = true}
            onAmountChange={handleInputChange}
            disabled={isProcessing}
        />

        <!-- Swap Arrow -->
        <button 
            class="switch-button" 
            class:flipped={isArrowFlipped}
            on:click={handleTokenSwitch}
            disabled={isProcessing}
        >
            <img src="/pxcomponents/arrow.svg" alt="swap" />
        </button>

        <!-- Receive Panel -->
        <SwapPanel
            title={$t('swap.receive')}
            token={receiveToken}
            amount={displayReceiveAmount}
            balance={$tokenStore.balances[receiveToken]?.balance || '0'}
            onTokenSelect={() => showReceiveTokenSelector = true}
            onAmountChange={() => {}}
            disabled={true}
            showPrice={true}
            usdValue={usdValue}
            slippage={swapSlippage}
        />

        {#if error}
            <div class="error" transition:fade>{error}</div>
        {/if}

        <div class="swap-footer mt-3">
            <Button 
                variant="yellow"
                disabled={!isValidInput || isProcessing}
                on:click={() => isConfirmationOpen = true}
                width="100%"
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
        font-family: 'Alumni Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
    }

    .swap-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        position: relative;
        gap: 10px;
    }

    .switch-button {
        position: absolute;
        left: 50%;
        top: 43%;
        transform: translate(-50%, -50%);
        width: 50px;
        height: 69px;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: transform 0.3s ease;
        z-index: 10;
    }

    .switch-button.flipped {
        transform: translate(-50%, -50%) rotate(180deg);
    }

    .switch-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .error {
        color: #ff4444;
        padding: 0.5rem;
        border-radius: 0.25rem;
        background: rgba(255, 68, 68, 0.1);
        text-align: center;
    }
</style>
