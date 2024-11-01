<script lang="ts">
    import { fade, fly, crossfade } from 'svelte/transition';
    import { flip } from 'svelte/animate';
    import { quintOut } from 'svelte/easing';
    import { onMount, onDestroy } from 'svelte';
    import debounce from 'lodash/debounce';
    import BigNumber from 'bignumber.js';
    import { SwapService } from '$lib/services/SwapService';
    import { tokenStore } from '$lib/stores/tokenStore';
    import { walletStore } from '$lib/stores/walletStore';
    import SwapPanel from '$lib/components/swap/swap_ui/SwapPanel.svelte';
    import Button from '$lib/components/common/Button.svelte';
    import TokenSelector from '$lib/components/swap/swap_ui/TokenSelectorModal.svelte';
    import SwapConfirmation from '$lib/components/swap/swap_ui/SwapConfirmation.svelte';
    import { formatNumberCustom } from '$lib/utils/formatNumberCustom';
    import { t } from '$lib/locales/translations';
    import { tweened } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';
    import { toastStore } from '$lib/stores/toastStore';
    export let slippage = 2;
    export let initialPool: string | null = null;

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
    let isAnimating = false;
    let intervalId: NodeJS.Timer;

    let panels = [
        { id: 'pay', type: 'pay', title: $t('swap.pay') },
        { id: 'receive', type: 'receive', title: $t('swap.receive') }
    ];

    let gasFee = '0';
    let lpFee = '0';
    let lpFeeToken = '';
    let gasFeeToken = '';

    const swapService = SwapService.getInstance();

    let tweenedReceiveAmount = tweened(0, {
        duration: 400,
        easing: cubicOut
    });

    onMount(async () => {
        if ($walletStore.isConnected) {
            await tokenStore.loadTokens();
            await tokenStore.loadBalances();
        }

        intervalId = setInterval(async () => {
            if ($walletStore.isConnected) {
                await tokenStore.loadBalances();
            }
        }, 10000);
    });

    onDestroy(() => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    });

    $: if ($walletStore.isConnected) {
        tokenStore.loadBalances();
    }

    $: isValidInput = payAmount && Number(payAmount) > 0 && !isCalculating;
    $: buttonText = getButtonText(isCalculating, isValidInput, isProcessing, error);
    
    $: panelData = {
        pay: {
            token: payToken,
            amount: payAmount,
            balance: (() => {
                const token = $tokenStore.tokens?.find(t => t.symbol === payToken);
                if (!token?.canister_id) return '0';
                const balance = $tokenStore.balances[token.canister_id];
                return balance?.amount?.toString() || '0';
            })(),
            onTokenSelect: () => showPayTokenSelector = true,
            onAmountChange: handleInputChange,
            disabled: isProcessing,
            showPrice: false
        },
        receive: {
            token: receiveToken,
            amount: $tweenedReceiveAmount.toFixed(6),
            balance: (() => {
                const token = $tokenStore.tokens?.find(t => t.symbol === receiveToken);
                if (!token?.canister_id) return '0';
                const balance = $tokenStore.balances[token.canister_id];
                return balance?.amount?.toString() || '0';
            })(),
            onTokenSelect: () => showReceiveTokenSelector = true,
            onAmountChange: () => {},
            disabled: isProcessing,
            showPrice: true,
            usdValue,
            slippage: swapSlippage,
            maxSlippage: slippage
        }
    };

    function getButtonText(isCalculating: boolean, isValidInput: boolean, isProcessing: boolean, error: string | null): string {
        if (isCalculating) return $t('swap.calculating');
        if (isProcessing) return $t('swap.processing');
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
        try {
            const result = new BigNumber(amount.toString())
                .div(new BigNumber(10).pow(decimals))
                .toString();
            return isNaN(Number(result)) ? '0' : result;
        } catch {
            return '0';
        }
    }

    async function getSwapQuote(amount: string) {
        if (!amount || Number(amount) <= 0 || isNaN(Number(amount))) {
            setReceiveAmount('0');
            return;
        }

        isCalculating = true;
        error = null;

        try {
            const payDecimals = getTokenDecimals(payToken);
            const payAmountBigInt = toBigInt(amount, payDecimals);

            const quote = await swapService.swap_amounts(
                payToken,
                payAmountBigInt,
                receiveToken
            );

            if ('Ok' in quote) {
                const receiveDecimals = getTokenDecimals(receiveToken);
                const receivedAmount = fromBigInt(quote.Ok.receive_amount, receiveDecimals);
                
                if (isNaN(Number(receivedAmount))) {
                    throw new Error('Invalid received amount');
                }
                
                setReceiveAmount(receivedAmount);
                setDisplayAmount(formatNumberCustom(receivedAmount, 6));
                
                const priceNum = Number(quote.Ok.price);
                price = !isNaN(priceNum) ? priceNum.toString() : '0';
                swapSlippage = !isNaN(quote.Ok.slippage) ? quote.Ok.slippage : 0;
                
                const usdValueNum = new BigNumber(receivedAmount).times(quote.Ok.price);
                usdValue = !usdValueNum.isNaN() ? usdValueNum.toFormat(2) : '0';

                if (quote.Ok.txs.length > 0) {
                    const firstTx = quote.Ok.txs[0];
                    lpFee = fromBigInt(firstTx.lp_fee, receiveDecimals);
                    gasFee = fromBigInt(firstTx.gas_fee, receiveDecimals);
                    lpFeeToken = firstTx.receive_symbol;
                    gasFeeToken = firstTx.receive_symbol;
                }
            } else if ('Err' in quote) {
                toastStore.error(quote.Err);
                setReceiveAmount('0');
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'An error occurred';
            toastStore.error(errorMsg);
            setReceiveAmount('0');
        } finally {
            isCalculating = false;
        }
    }

    const debouncedGetQuote = debounce(getSwapQuote, 500);

    function setReceiveAmount(amount: string) {
        receiveAmount = amount;
        tweenedReceiveAmount.set(Number(amount));
    }

    function setDisplayAmount(amount: string) {
        const numAmount = Number(amount);
        tweenedReceiveAmount.set(numAmount);
        displayReceiveAmount = amount;
    }

    async function handleTokenSwitch() {
        if (isAnimating) return;
        
        isAnimating = true;
        
        panels = panels.map((panel, i) => ({
            ...panel,
            direction: i === 0 ? 'topLeft' : 'bottomRight'
        })).reverse();
        
        const oldPayToken = payToken;
        const oldDisplayAmount = displayReceiveAmount;
        
        payToken = receiveToken;
        receiveToken = oldPayToken;
        
        payAmount = '';
        receiveAmount = '0';
        displayReceiveAmount = '0';
        
        if (oldDisplayAmount !== '0') {
            payAmount = oldDisplayAmount;
            await debouncedGetQuote(oldDisplayAmount);
        }
        
        setTimeout(() => {
            isAnimating = false;
            panels = panels.reverse();
        }, 200);
    }

    function handleInputChange(event: Event | CustomEvent) {
        let input: string;
        
        if ('detail' in event && event.detail?.value) {
            // Handle custom event from max button
            input = event.detail.value;
        } else {
            // Handle normal input event
            input = (event.target as HTMLInputElement).value;
        }
        
        const cleanedInput = input.replace(/[^0-9.]/g, '');
        if (/^\d*\.?\d*$/.test(cleanedInput) || cleanedInput === '') {
            payAmount = cleanedInput;
            debouncedGetQuote(cleanedInput);
        }
    }

    function handleSelectToken(type: 'pay' | 'receive', token: string) {
        // Don't allow selecting the same token that's already selected on the other side
        if ((type === 'pay' && token === receiveToken) || 
            (type === 'receive' && token === payToken)) {
            toastStore.error("Cannot select the same token for both sides");
            return;
        }

        if (type === 'pay') {
            payToken = token;
            showPayTokenSelector = false;
        } else {
            receiveToken = token;
            showReceiveTokenSelector = false;
        }
        if (payAmount) debouncedGetQuote(payAmount);
    }

    async function handleSwap() {
        if (!isValidInput || isProcessing) return;

        isProcessing = true;
        error = null;
        
        try {
            const payDecimals = getTokenDecimals(payToken);
            const receiveDecimals = getTokenDecimals(receiveToken);
            const payAmountBigInt = toBigInt(payAmount, payDecimals);
            const receiveAmountBigInt = toBigInt(receiveAmount, receiveDecimals);
            
            const approved = await swapService.approve({
                amount: payAmountBigInt,
                spender: { 
                    owner: 'l4lgk-raaaa-aaaar-qahpq-cai',
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

            const result = await swapService.swap_async({
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
                toastStore.error(result.Err);
                isConfirmationOpen = false;
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Swap failed';
            toastStore.showError(errorMsg);
            isConfirmationOpen = false;
        } finally {
            if (error) isProcessing = false;
        }
    }

    function startPolling(reqId: bigint) {
        let pollInterval: NodeJS.Timer;
        let timeout: NodeJS.Timeout;

        pollInterval = setInterval(async () => {
            try {
                const status = await swapService.requests([reqId]);
                
                if ('Ok' in status && status.Ok.length > 0) {
                    const request = status.Ok[0];
                    if (request.reply && 'Swap' in request.reply) {
                        const swapReply = request.reply.Swap;
                        
                        if (swapReply.status === 'Success') {
                            clearInterval(pollInterval);
                            clearTimeout(timeout);
                            handleSwapSuccess(swapReply);
                        } else if (swapReply.status === 'Failed') {
                            clearInterval(pollInterval);
                            clearTimeout(timeout);
                            handleSwapFailure(swapReply);
                        }
                    }
                }
            } catch (err) {
                clearInterval(pollInterval);
                clearTimeout(timeout);
                toastStore.error('Failed to check swap status');
                isProcessing = false;
            }
        }, 1000);

        timeout = setTimeout(() => {
            clearInterval(pollInterval);
            toastStore.error('Swap timed out');
            isProcessing = false;
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
        toastStore.error('Swap failed');
    }
</script>

<div class="swap-wrapper">
    <div class="swap-container" in:fade={{ duration: 420 }}>
        <div class="panels-container">
            {#each panels as panel (panel.id)}
                <div 
                    animate:flip={{
                        duration: 169,
                        easing: quintOut
                    }}
                    class="panel-wrapper"
                >
                    <div 
                        class="panel-content"
                    >
                        <SwapPanel
                            title={panel.title}
                            {...panelData[panel.type]}
                        />
                    </div>
                </div>
            {/each}

            <button 
                class="switch-button {isAnimating ? 'rotating' : ''}"
                on:click={handleTokenSwitch}
                disabled={isProcessing || isAnimating} 
            >
                <img 
                    src="/pxcomponents/arrow.svg"
                    alt="swap"
                    class="swap-arrow"
                />
            </button>
        </div>

        <div class="swap-footer mt-3">
            <Button 
                variant="yellow"
                disabled={!isValidInput || isProcessing || isAnimating}
                on:click={() => isConfirmationOpen = true}
                width="100%"
            >
                {buttonText}
            </Button>
        </div>
    </div>
</div>

{#if showPayTokenSelector}
    <div class="modal-overlay" transition:fade={{ duration: 100 }} on:click|self={() => showPayTokenSelector = false}>
        <div class="modal-content" on:click|stopPropagation>
            <TokenSelector 
                show={true}
                onSelect={(token) => handleSelectToken('pay', token)}
                onClose={() => showPayTokenSelector = false}
                currentToken={receiveToken}
            />
        </div>
    </div>
{/if}

{#if showReceiveTokenSelector}
    <div class="modal-overlay" transition:fade={{ duration: 100 }} on:click|self={() => showReceiveTokenSelector = false}>
        <div class="modal-content" on:click|stopPropagation>
            <TokenSelector 
                show={true}
                onSelect={(token) => handleSelectToken('receive', token)}
                onClose={() => showReceiveTokenSelector = false}
                currentToken={payToken}
            />
        </div>
    </div>
{/if}

{#if isConfirmationOpen}
    <div class="modal-overlay" transition:fade on:click|self={() => isConfirmationOpen = false}>
        <div class="modal-content" on:click|stopPropagation>
            <SwapConfirmation 
                payToken={payToken}
                payAmount={payAmount}
                receiveToken={receiveToken}
                receiveAmount={receiveAmount}
                onConfirm={handleSwap}
                onClose={() => isConfirmationOpen = false}
            />
        </div>
    </div>
{/if}

<style>
    .swap-container {
        display: flex;
        flex-direction: column;
    }

    .panels-container {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .panel-wrapper {
        position: relative;
        transition: all 0.15s ease;
        transform-style: preserve-3d;
    }

    .panel-content {
        transform-origin: center center;
        backface-visibility: hidden;
    }

    .switch-button {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 50px;
        height: 50px;
        background: #FFCD1F;
        border: 2px solid #368D00;
        border-radius: 50%;
        cursor: pointer;
        z-index: 1;
        padding: 6px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .switch-button:hover:not(:disabled) {
        background: #FFE077;
        transform: translate(-50%, -50%) scale(1.05);
    }

    .switch-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .swap-arrow {
        width: 100%;
        height: 100%;
    }

    @media (max-width: 480px) {
        .swap-container {
            padding: 0.5rem;
        }

        .switch-button {
            width: 32px;
            height: 32px;
            padding: 6px;
        }
    }
</style>
