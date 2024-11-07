// src/lib/services/SwapService.ts

import { getActor } from '$lib/stores/walletStore';
import { walletValidator } from '$lib/validators/walletValidator';
import { tokenStore } from '$lib/features/tokens/tokenStore';
import { toastStore } from '$lib/stores/toastStore';
import { TokenService } from '$lib/features/tokens/TokenService';
import { get } from 'svelte/store';
import type { Principal } from '@dfinity/principal';
import BigNumber from 'bignumber.js';

interface SwapExecuteParams {
    payToken: string;
    payAmount: string;
    receiveToken: string;
    receiveAmount: string;
    slippage: number;
    backendPrincipal: Principal;
}

export class SwapService {
    private static instance: SwapService;
    private tokenService: TokenService;

    private constructor() {
        this.tokenService = TokenService.getInstance();
    }

    public toBigInt(amount: string, decimals: number): bigint {
        if (!amount || isNaN(Number(amount))) return BigInt(0);
        return BigInt(
            new BigNumber(amount)
                .times(new BigNumber(10).pow(decimals))
                .integerValue()
                .toString()
        );
    }

    public fromBigInt(amount: bigint, decimals: number): string {
        try {
            const result = new BigNumber(amount.toString())
                .div(new BigNumber(10).pow(decimals))
                .toString();
            return isNaN(Number(result)) ? "0" : result;
        } catch {
            return "0";
        }
    }

    public static getInstance(): SwapService {
        if (!SwapService.instance) {
            SwapService.instance = new SwapService();
        }
        return SwapService.instance;
    }

    private async getTokenActor(token: FE.Token, type: 'icrc1' | 'icrc2' = 'icrc1') {
        return await getActor(token.canister_id, type);
    }

    /**
     * Gets swap quote from backend
     */
    public async swap_amounts(
        payToken: string,
        payAmount: bigint,
        receiveToken: string
    ): Promise<BE.SwapQuoteResponse> {
        try {
            const actor = await getActor();
            return await actor.swap_amounts(payToken, payAmount, receiveToken);
        } catch (error) {
            console.error('Error getting swap amounts:', error);
            throw error;
        }
    }

    /**
     * Gets quote details including price, fees, etc.
     */
    public async getQuoteDetails(params: {
        payToken: string;
        payAmount: bigint;
        receiveToken: string;
    }): Promise<{
        receiveAmount: string;
        price: string;
        usdValue: string;
        lpFee: string;
        gasFee: string;
        tokenFee?: string;
        slippage: number;
    }> {
        const quote = await this.swap_amounts(
            params.payToken,
            params.payAmount,
            params.receiveToken
        );

        if (!('Ok' in quote)) {
            throw new Error(quote.Err);
        }

        const tokens = get(tokenStore).tokens;
        const receiveToken = tokens.find(t => t.symbol === params.receiveToken);
        if (!receiveToken) throw new Error('Receive token not found');

        const receiveAmount = this.fromBigInt(
            quote.Ok.receive_amount,
            receiveToken.decimals
        );

        let lpFee = '0';
        let gasFee = '0';
        let tokenFee: string | undefined;

        if (quote.Ok.txs.length > 0) {
            const tx = quote.Ok.txs[0];
            lpFee = this.fromBigInt(tx.lp_fee, receiveToken.decimals);
            gasFee = this.fromBigInt(tx.gas_fee, receiveToken.decimals);
            tokenFee = tx.receive_symbol;
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
    public async swap_async(params: {
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
            return await actor.swap_async(params);
        } catch (error) {
            console.error('Error executing swap:', error);
            throw error;
        }
    }

    /**
     * Gets request status
     */
    public async requests(requestIds: bigint[]): Promise<BE.RequestResponse> {
        try {
            const actor = await getActor();
            return await actor.requests(requestIds);
        } catch (error) {
            console.error('Error getting request status:', error);
            throw error;
        }
    }

    /**
     * Handles token approval for non-ICRC tokens
     */
    private async approveToken(
        token: FE.Token,
        amount: bigint,
        gasFee: bigint,
        spender: Principal
    ): Promise<number | false> {
        try {
            const actor = await this.getTokenActor(token, 'icrc2');
            const expires_at = Date.now() * 1000000 + 60000000000;

            const result = await actor.icrc2_approve({
                amount: amount + gasFee,
                spender: { owner: spender, subaccount: [] },
                expires_at: [expires_at],
                fee: [],
                memo: [],
                from_subaccount: [],
                created_at_time: []
            });

            if ('Err' in result) {
                toastStore.error(result.Err);
                return false;
            }

            return result.Ok;
        } catch (error) {
            toastStore.error(error instanceof Error ? error.message : 'Approval failed');
            return false;
        }
    }

    /**
     * Handles direct transfer for ICRC tokens
     */
    private async transferToken(
        token: FE.Token,
        amount: bigint,
        recipient: Principal
    ): Promise<number | false> {
        try {
            const actor = await this.getTokenActor(token, 'icrc1');
            const result = await actor.icrc1_transfer({
                to: { owner: recipient, subaccount: [] },
                fee: [],
                memo: [],
                from_subaccount: [],
                created_at_time: [],
                amount
            });

            if ('Err' in result) {
                toastStore.error(result.Err);
                return false;
            }

            return result.Ok;
        } catch (error) {
            toastStore.error(error instanceof Error ? error.message : 'Transfer failed');
            return false;
        }
    }

    /**
     * Executes complete swap flow
     */
    public async executeSwap(params: SwapExecuteParams): Promise<bigint | false> {
        try {
            console.log('Starting swap execution with params:', params);

            await walletValidator.requireWalletConnection();
            const tokens = get(tokenStore).tokens;
            
            const payToken = tokens.find(t => t.symbol === params.payToken);
            if (!payToken) throw new Error('Pay token not found');

            const payAmount = this.toBigInt(params.payAmount, payToken.decimals);

            const receiveToken = tokens.find(t => t.symbol === params.receiveToken);
            if (!receiveToken) throw new Error('Receive token not found');

            const receiveAmount = this.toBigInt(params.receiveAmount, receiveToken.decimals);

            console.log('Processing transfer/approval for amount:', payAmount.toString());

            let txId: number | false;

            if (payToken.icrc1) {
                console.log('Using ICRC1 transfer');
                txId = await this.transferToken(
                    payToken,
                    payAmount,
                    params.backendPrincipal
                );
            } else if (payToken.icrc2) {
                console.log('Using ICRC2 approval');
                txId = await this.approveToken(
                    payToken,
                    payAmount,
                    payToken.fee,
                    params.backendPrincipal
                );
            } else {
                throw new Error(`Token ${payToken.symbol} does not support ICRC1 or ICRC2`);
            }

            if (!txId) {
                console.error('Transaction failed - no txId returned');
                throw new Error('Transaction failed');
            }

            console.log('Transaction successful, txId:', txId);

            const swapParams = {
                pay_token: params.payToken,
                pay_amount: payAmount,
                receive_token: params.receiveToken,
                receive_amount: [receiveAmount],
                max_slippage: [params.slippage],
                receive_address: [],
                referred_by: [],
                pay_tx_id: payToken.icrc1 ? [{ BlockIndex: txId }] : []
            };

            console.log('Calling swap_async with params:', swapParams);

            const result = await this.swap_async(swapParams);

            if ('Ok' in result) {
                console.log('Swap successful, request ID:', result.Ok.toString());
                return result.Ok;
            }
            
            console.error('Swap failed with error:', result);
            throw new Error('Err' in result ? result.Err : 'Swap failed');
        } catch (error) {
            console.error('Swap execution failed:', error);
            toastStore.error(error instanceof Error ? error.message : 'Swap failed');
            return false;
        }
    }
}

