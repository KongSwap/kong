import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { SwapService } from '$lib/services/SwapService';
import { tokenStore } from '$lib/stores/tokenStore';
import { toastStore } from '$lib/stores/toastStore';
import { t } from '$lib/locales/translations';
import debounce from 'lodash/debounce';
import BigNumber from 'bignumber.js';
import { tweened } from 'svelte/motion';
import { cubicOut } from 'svelte/easing';

interface SwapState {
    payToken: string;
    receiveToken: string;
    payAmount: string;
    receiveAmount: string;
    displayReceiveAmount: string;
    isCalculating: boolean;
    isProcessing: boolean;
    isAnimating: boolean;
    error: string | null;
    usdValue: string;
    swapSlippage: number;
    maxSlippage: number;
    showPayTokenSelector: boolean;
    showReceiveTokenSelector: boolean;
    showConfirmation: boolean;
    price: string;
    gasFee: string;
    lpFee: string;
    lpFeeToken: string;
    gasFeeToken: string;
}

export function createSwapStore(slippage: number, initialPool: string | null) {
    const swapService = SwapService.getInstance();
    
    const initialState: SwapState = {
        payToken: initialPool?.split('_')[0] || 'ICP',
        receiveToken: initialPool?.split('_')[1] || 'ckBTC',
        payAmount: '',
        receiveAmount: '0',
        displayReceiveAmount: '0',
        isCalculating: false,
        isProcessing: false,
        isAnimating: false,
        error: null,
        usdValue: '0',
        swapSlippage: 0,
        maxSlippage: slippage,
        showPayTokenSelector: false,
        showReceiveTokenSelector: false,
        showConfirmation: false,
        price: '0',
        gasFee: '0',
        lpFee: '0',
        lpFeeToken: '',
        gasFeeToken: ''
    };

    const store = writable(initialState);
    
    const tweenedReceiveAmount = tweened(0, {
        duration: 400,
        easing: cubicOut
    });

    // Helper functions
    function getTokenDecimals(symbol: string): number {
        const tokens = get(tokenStore).tokens;
        const token = tokens.find(t => t.symbol === symbol);
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

    // Core functions
    async function getSwapQuote(amount: string) {
        if (!amount || Number(amount) <= 0 || isNaN(Number(amount))) {
            setReceiveAmount('0');
            return;
        }

        store.update(s => ({ ...s, isCalculating: true, error: null }));

        try {
            const state = get(store);
            const payDecimals = getTokenDecimals(state.payToken);
            const payAmountBigInt = toBigInt(amount, payDecimals);

            const quote = await swapService.swap_amounts(
                state.payToken,
                payAmountBigInt,
                state.receiveToken
            );

            if ('Ok' in quote) {
                const receiveDecimals = getTokenDecimals(state.receiveToken);
                const receivedAmount = fromBigInt(quote.Ok.receive_amount, receiveDecimals);
                
                store.update(s => ({
                    ...s,
                    receiveAmount: receivedAmount,
                    displayReceiveAmount: receivedAmount,
                    price: quote.Ok.price.toString(),
                    swapSlippage: quote.Ok.slippage,
                    usdValue: new BigNumber(receivedAmount).times(quote.Ok.price).toFormat(2)
                }));

                tweenedReceiveAmount.set(Number(receivedAmount));

                if (quote.Ok.txs.length > 0) {
                    const firstTx = quote.Ok.txs[0];
                    store.update(s => ({
                        ...s,
                        lpFee: fromBigInt(firstTx.lp_fee, receiveDecimals),
                        gasFee: fromBigInt(firstTx.gas_fee, receiveDecimals),
                        lpFeeToken: firstTx.receive_symbol,
                        gasFeeToken: firstTx.receive_symbol
                    }));
                }
            } else {
                toastStore.error(quote.Err);
                setReceiveAmount('0');
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'An error occurred';
            toastStore.error(errorMsg);
            setReceiveAmount('0');
        } finally {
            store.update(s => ({ ...s, isCalculating: false }));
        }
    }

    const debouncedGetQuote = debounce(getSwapQuote, 500);

    function setReceiveAmount(amount: string) {
        store.update(s => ({ ...s, receiveAmount: amount }));
        tweenedReceiveAmount.set(Number(amount));
    }

    function handleInputChange(event: Event | CustomEvent) {
        let input: string;
        
        if ('detail' in event && event.detail?.value) {
            input = event.detail.value;
        } else {
            input = (event.target as HTMLInputElement).value;
        }
        
        const cleanedInput = input.replace(/[^0-9.]/g, '');
        if (/^\d*\.?\d*$/.test(cleanedInput) || cleanedInput === '') {
            store.update(s => ({ ...s, payAmount: cleanedInput }));
            debouncedGetQuote(cleanedInput);
        }
    }

    function handleTokenSwitch() {
        const state = get(store);
        if (state.isAnimating) return;
        
        store.update(s => ({
            ...s,
            isAnimating: true,
            payToken: s.receiveToken,
            receiveToken: s.payToken,
            payAmount: '',
            receiveAmount: '0',
            displayReceiveAmount: '0'
        }));
        
        setTimeout(() => {
            store.update(s => ({ ...s, isAnimating: false }));
        }, 200);
    }

    // Modal controls
    function showPayTokenSelector() {
        store.update(s => ({ ...s, showPayTokenSelector: true }));
    }

    function showReceiveTokenSelector() {
        store.update(s => ({ ...s, showReceiveTokenSelector: true }));
    }

    function showConfirmation() {
        store.update(s => ({ ...s, showConfirmation: true }));
    }

    function closeModals() {
        store.update(s => ({
            ...s,
            showPayTokenSelector: false,
            showReceiveTokenSelector: false,
            showConfirmation: false
        }));
    }

    // Derived stores
    const isValidInput = derived(
        store,
        $store => $store.payAmount && Number($store.payAmount) > 0 && !$store.isCalculating
    );

    const buttonText = derived(
        [store, isValidInput],
        ([$store, $isValidInput]) => {
            if ($store.isCalculating) return t('swap.calculating');
            if ($store.isProcessing) return t('swap.processing');
            if (!$isValidInput) return t('swap.enterAmount');
            return t('swap.swap');
        }
    );

    return {
        subscribe: store.subscribe,
        tweenedReceiveAmount: tweenedReceiveAmount,
        handleInputChange,
        handleTokenSwitch,
        showPayTokenSelector,
        showReceiveTokenSelector,
        showConfirmation,
        closeModals,
        isValidInput,
        buttonText
    };
}

export type SwapStore = ReturnType<typeof createSwapStore>;
