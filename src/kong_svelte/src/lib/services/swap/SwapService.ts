// src/lib/services/swap/SwapService.ts

import { getActor } from '$lib/services/wallet/walletStore';
import { walletValidator } from '$lib/services/wallet/walletValidator';
import { tokenStore, getTokenDecimals, getTokenPrice } from '$lib/services/tokens/tokenStore';
import { toastStore } from '$lib/stores/toastStore';
import { get } from 'svelte/store';
import { Principal } from '@dfinity/principal';
import BigNumber from 'bignumber.js';
import { IcrcService } from '$lib/services/icrc/IcrcService';
import { swapStatusStore } from './swapStore';
import { walletStore } from '$lib/services/wallet/walletStore';

interface SwapExecuteParams {
    swapId: string;
    payToken: FE.Token;
    payAmount: string;
    receiveToken: FE.Token;
    receiveAmount: string;
    userMaxSlippage: number;
    backendPrincipal: Principal;
    lpFees: any[];
}

// Base BigNumber configuration for internal calculations
// Set this high enough to handle intermediate calculations without loss of precision
BigNumber.config({
    DECIMAL_PLACES: 36, // High enough for internal calculations
    ROUNDING_MODE: BigNumber.ROUND_DOWN,
    EXPONENTIAL_AT: [-50, 50]
  });

export class SwapService {
    private static pollingInterval: ReturnType<typeof setInterval> | null = null;
    private static readonly POLLING_INTERVAL = 500; // 1 second
    private static readonly MAX_ATTEMPTS = 30; // 1 minute maximum

    public static toBigInt(amount: string, decimals: number): bigint {
        if (!amount || isNaN(Number(amount))) return BigInt(0);
        return BigInt(
            new BigNumber(amount)
                .times(new BigNumber(10).pow(decimals))
                .toString()
        );
    }

    public static fromBigInt(amount: bigint, decimals: number): string {
        try {
            const result = new BigNumber(amount.toString())
                .div(new BigNumber(10).pow(decimals))
                .toString();
            return isNaN(Number(result)) ? "0" : result;
        } catch {
            return "0";
        }
    }

    /**
     * Gets swap quote from backend
     */
    public static async swap_amounts(
        payToken: FE.Token,
        payAmount: bigint,
        receiveToken: FE.Token
    ): Promise<BE.SwapQuoteResponse> {
        try {
            const actor = await getActor();
            return await actor.swap_amounts(payToken.symbol, payAmount, receiveToken.symbol);
        } catch (error) {
            console.error('Error getting swap amounts:', error);
            throw error;
        }
    }

    /**
     * Gets quote details including price, fees, etc.
     */
    public static async getQuoteDetails(params: {
        payToken: FE.Token;
        payAmount: bigint;
        receiveToken: FE.Token;
    }): Promise<{
        receiveAmount: string;
        price: string;
        usdValue: string;
        lpFee: String;
        gasFee: String;
        tokenFee?: String;
        slippage: number;
    }> {
        const quote = await SwapService.swap_amounts(
            params.payToken,
            params.payAmount,
            params.receiveToken
        );

        if (!('Ok' in quote)) {
            throw new Error(quote.Err);
        }

        const tokens = get(tokenStore).tokens;
        const receiveToken = tokens.find(t => t.canister_id === params.receiveToken.canister_id);
        const payToken = tokens.find(t => t.canister_id === params.payToken.canister_id);
        if (!receiveToken) throw new Error('Receive token not found');

        const receiveAmount = SwapService.fromBigInt(
            quote.Ok.receive_amount,
            receiveToken.decimals
        );

        let lpFee = '0';
        let gasFee = '0';
        let tokenFee= '0';

        if (quote.Ok.txs.length > 0) {
            const tx = quote.Ok.txs[0];
            lpFee = SwapService.fromBigInt(tx.lp_fee, receiveToken.decimals);
            gasFee = SwapService.fromBigInt(tx.gas_fee, receiveToken.decimals);
            tokenFee = payToken.fee.toString();
        }

        return {
            receiveAmount,
            price: quote.Ok.price.toString(),
            usdValue: new BigNumber(receiveAmount)
                .times(quote.Ok.price)
                .toFormat(2),
            lpFee,
            gasFee,
            tokenFee,
            slippage: quote.Ok.slippage
        };
    }

    /**
     * Executes swap asynchronously
     */
    public static async swap_async(params: {
        pay_token: string;
        pay_amount: bigint;
        receive_token: string;
        receive_amount: bigint[];
        max_slippage: number[];
        receive_address?: string[];
        referred_by?: string[];
        pay_tx_id?: { BlockIndex: number }[];
    }): Promise<BE.SwapAsyncResponse> {
        try {
            const actor = await getActor();
            console.log('Sending swap_async params:', JSON.stringify(params, (_, v) => 
                typeof v === 'bigint' ? v.toString() : v));
            const result = await actor.swap_async(params);
            console.log('swap_async response:', result);
            return result;
        } catch (error) {
            console.error('Error in swap_async:', error);
            throw error;
        }
    }

    /**
     * Gets request status
     */
    public static async requests(requestIds: bigint[]): Promise<BE.RequestResponse> {
        try {
            const actor = await getActor();
            return await actor.requests(requestIds);
        } catch (error) {
            console.error('Error getting request status:', error);
            throw error;
        }
    }

    /**
     * Executes complete swap flow
     */
    public static async executeSwap(params: SwapExecuteParams): Promise<bigint | false> {
        const swapId = params.swapId;
        try {
            const wallet = get(walletStore);
            await Promise.allSettled([
                walletValidator.requireWalletConnection(),
                tokenStore.loadBalances(get(tokenStore).tokens, wallet.account.owner.toString())
            ]);
            const tokens = get(tokenStore).tokens;
            const payToken = tokens.find(t => t.canister_id === params.payToken.canister_id);
            if (!payToken) throw new Error('Pay token not found');

            const payAmount = SwapService.toBigInt(params.payAmount, payToken.decimals);
            const receiveToken = tokens.find(t => t.canister_id === params.receiveToken.canister_id);
            if (!receiveToken) throw new Error('Receive token not found');

            const receiveAmount = SwapService.toBigInt(params.receiveAmount, receiveToken.decimals);

            console.log('Processing transfer/approval for amount:', payAmount.toString());
            const toastId = toastStore.info(`Swapping ${params.payAmount} ${params.payToken.symbol} to ${params.receiveAmount} ${params.receiveToken.symbol}...`, 0);

            let txId: bigint | false;
            let approvalId: bigint | false;
            
            if (payToken.icrc2) {                
                const requiredAllowance = payAmount;
                approvalId = await IcrcService.checkAndRequestIcrc2Allowances(
                    payToken,
                    requiredAllowance
                );
            } else if (payToken.icrc1) {
                const result = await IcrcService.icrc1Transfer(
                    payToken,
                    params.backendPrincipal,
                    payAmount,
                    { fee: BigInt(payToken.fee) }
                );

                if (result?.Ok) {
                    txId = result.Ok;
                } else {
                    txId = false;
                }
            } else {
                throw new Error(`Token ${payToken.symbol} does not support ICRC1 or ICRC2`);
            }

            if (txId === false || approvalId === false) {
                swapStatusStore.updateSwap(swapId, {
                    status: 'Failed',
                    isProcessing: false,
                    error: 'Transaction failed during transfer/approval'
                });
                toastStore.error('Transaction failed during transfer/approval');
                toastStore.dismiss(toastId);
                return false;
            }

            const swapParams = {
                pay_token: params.payToken.symbol,
                pay_amount: payAmount,
                receive_token: params.receiveToken.symbol,
                receive_amount: [receiveAmount],
                max_slippage: [params.userMaxSlippage],
                receive_address: [],
                referred_by: [],
                pay_tx_id: txId ? [{ BlockIndex: Number(txId) }] : []
            };
            const result = await SwapService.swap_async(swapParams);
            this.monitorTransaction(result?.Ok, swapId);
            toastStore.dismiss(toastId);
            await Promise.allSettled([
                tokenStore.loadBalance(tokens.find(t => t.canister_id === params.receiveToken.canister_id), wallet.account.owner.toString(), true),
                tokenStore.loadBalance(tokens.find(t => t.canister_id === params.payToken.canister_id), wallet.account.owner.toString(), true)
            ]);
            return result.Ok;
        } catch (error) {
            swapStatusStore.updateSwap(swapId, {
                status: 'Failed',
                isProcessing: false,
                error: error instanceof Error ? error.message : 'Swap failed'
            });
            console.error('Swap execution failed:', error);
            toastStore.error(error instanceof Error ? error.message : 'Swap failed');
            return false;
        }
    }

    public static async monitorTransaction(requestId: bigint, swapId: string) {
        this.stopPolling();
        
        let attempts = 0;
        let swapStatus = swapStatusStore.getSwap(swapId);
        const toastId = toastStore.info(`Confirming swap of ${swapStatus?.lastPayAmount} ${swapStatus?.payToken.symbol} to ${swapStatus?.expectedReceiveAmount} ${swapStatus?.receiveToken.symbol}...`, 0);
        
        this.pollingInterval = setInterval(async () => {
            try {
                const status = await this.requests([requestId]);

                if (status.Ok?.[0]?.reply) {
                    const res = status.Ok[0];


                if(res.statuses.find(s => s.includes('Failed'))) {
                    this.stopPolling();
                    swapStatusStore.updateSwap(swapId, {
                        status: 'Error',
                        isProcessing: false,
                        error: res.statuses.find(s => s.includes('Failed'))
                    });
                    toastStore.error(res.statuses.find(s => s.includes('Failed')));
                    toastStore.dismiss(toastId);
                }
                
                    
                    if ('Swap' in res.reply) {
                        const swapStatus = res.reply.Swap;
                        console.log('swapStatus', swapStatus);
                        
                        swapStatusStore.updateSwap(swapId, {
                            status: swapStatus.status,
                            isProcessing: true,
                            error: null
                        });

                        if (swapStatus.status === "Success") {
                            swapStatusStore.updateSwap(swapId, {
                                status: 'Success',
                                isProcessing: false,
                                shouldRefreshQuote: true,
                                lastQuote: null
                            });
                            this.stopPolling();
                            
                            const formattedPayAmount = SwapService.fromBigInt(
                                swapStatus.pay_amount, 
                                getTokenDecimals(swapStatus.pay_symbol)
                            );
                            const formattedReceiveAmount = SwapService.fromBigInt(
                                swapStatus.receive_amount, 
                                getTokenDecimals(swapStatus.receive_symbol)
                            );
                            toastStore.success(`Successfully swaped ${formattedPayAmount} ${swapStatus.pay_symbol} to ${formattedReceiveAmount} ${swapStatus.receive_symbol}!`);
                            // Dispatch custom event with swap details
                            window.dispatchEvent(new CustomEvent('swapSuccess', {
                                detail: {
                                    payAmount: formattedPayAmount,
                                    payToken: swapStatus.pay_symbol,
                                    receiveAmount: formattedReceiveAmount,
                                    receiveToken: swapStatus.receive_symbol
                                }
                            }));
                            
                            toastStore.dismiss(toastId);
                        } else if (swapStatus.status === "Failed") {
                            this.stopPolling();
                            swapStatusStore.updateSwap(swapId, {
                                status: 'Failed',
                                isProcessing: false,
                                error: 'Swap failed'
                            });
                            toastStore.error('Swap failed');
                            toastStore.dismiss(toastId);
                        }
                    }
                }

                if (attempts >= this.MAX_ATTEMPTS) {
                    this.stopPolling();
                    swapStatusStore.updateSwap(swapId, {
                        status: 'Timeout',
                        isProcessing: false,
                        error: 'Swap timed out'
                    });
                    toastStore.error('Swap timed out');
                    toastStore.dismiss(toastId);
                }

                attempts++;
            } catch (error) {
                console.error('Error monitoring swap:', error);
                this.stopPolling();
                swapStatusStore.updateSwap(swapId, {
                    status: 'Error',
                    isProcessing: false,
                    error: 'Failed to monitor swap status'
                });
                toastStore.error('Failed to monitor swap status');
                toastStore.dismiss(toastId);
            }
        }, this.POLLING_INTERVAL);
    }

    private static stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval as any);
            this.pollingInterval = null;
        }
    }

    // Clean up method to be called when component unmounts
    public static cleanup() {
        this.stopPolling();
    }

    /**
     * Fetches the swap quote based on the provided amount and tokens.
     */
    public static async getSwapQuote(
        payToken: FE.Token,
        receiveToken: FE.Token,
        amount: string
    ): Promise<{
        receiveAmount: string;
        slippage: number;
        usdValue: string;
    }> {
        if (!amount || Number(amount) <= 0 || isNaN(Number(amount))) {
            return {
                receiveAmount: "0",
                slippage: 0,
                usdValue: "0",
            };
        }

        try {
            const payDecimals = getTokenDecimals(payToken.canister_id);
            const payAmountBigInt = this.toBigInt(amount, payDecimals);

            const quote = await this.swap_amounts(
                payToken,
                payAmountBigInt,
                receiveToken,
            );

            if ("Ok" in quote) {
                const receiveDecimals = getTokenDecimals(receiveToken.canister_id);
                const receivedAmount = this.fromBigInt(
                    quote.Ok.receive_amount,
                    receiveDecimals,
                );

                // Assuming you have a method to get the price
                const store = get(tokenStore);
                const price = await tokenStore.refetchPrice(store.tokens.find(t => t.canister_id === receiveToken.canister_id));
                const usdValueNumber = parseFloat(receivedAmount) * parseFloat(price.toString());

                return {
                    receiveAmount: receivedAmount,
                    slippage: quote.Ok.slippage,
                    usdValue: usdValueNumber.toString(),
                };
            } else if ("Err" in quote) {
                throw new Error(quote.Err);
            }
        } catch (err) {
            console.error("Error fetching swap quote:", err);
            throw err;
        }
    }

    /**
     * Calculates the maximum transferable amount of a token, considering fees.
     *
     * @param tokenInfo - Information about the token, including fees and canister ID.
     * @param formattedBalance - The user's available balance of the token as a string.
     * @param decimals - Number of decimal places the token supports.
     * @param isIcrc1 - Boolean indicating if the token follows the ICRC1 standard.
     * @returns A BigNumber representing the maximum transferable amount.
     */
    public static calculateMaxAmount(
        tokenInfo: {
        canister_id: string;
        fee?: bigint;
        icrc1?: boolean;
        icrc2?: boolean;
        // Add other relevant properties if needed
        },
        formattedBalance: string,
        decimals: number = 8,
        isIcrc1: boolean = false
    ): BigNumber {
        const SCALE_FACTOR = new BigNumber(10).pow(decimals);
        const balance = new BigNumber(formattedBalance);
        
        // Calculate base fee. If fee is undefined, default to 0.
        const baseFee = tokenInfo.fee
        ? new BigNumber(tokenInfo.fee.toString()).dividedBy(SCALE_FACTOR)
        : new BigNumber(0);
        
        // Calculate gas fee based on token standard
        const gasFee = isIcrc1 ? baseFee : baseFee.multipliedBy(2);
        
        // Ensure that the max amount is not negative
        const maxAmount = balance.minus(gasFee);
        return BigNumber.maximum(maxAmount, new BigNumber(0));
  }
}

