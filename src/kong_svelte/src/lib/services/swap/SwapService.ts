// src/lib/services/swap/SwapService.ts

import { getActor } from '$lib/services/wallet/walletStore';
import { walletValidator } from '$lib/services/wallet/walletValidator';
import { tokenStore } from '$lib/services/tokens/tokenStore';
import { toastStore } from '$lib/stores/toastStore';
import { TokenService } from '$lib/services/tokens/TokenService';
import { get } from 'svelte/store';
import { Principal } from '@dfinity/principal';
import BigNumber from 'bignumber.js';
import { PoolService } from '../pools';
import { walletStore } from '$lib/services/wallet/walletStore';
import { KONG_BACKEND_PRINCIPAL } from '$lib/constants/canisterConstants';
import { IcrcService } from '$lib/services/icrc/IcrcService';

interface SwapExecuteParams {
    payToken: string;
    payAmount: string;
    receiveToken: string;
    receiveAmount: string;
    slippage: number;
    backendPrincipal: Principal;
}

export class SwapService {
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
    public static async getQuoteDetails(params: {
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
        const quote = await SwapService.swap_amounts(
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

        const receiveAmount = SwapService.fromBigInt(
            quote.Ok.receive_amount,
            receiveToken.decimals
        );

        let lpFee = '0';
        let gasFee = '0';
        let tokenFee: string | undefined;

        if (quote.Ok.txs.length > 0) {
            const tx = quote.Ok.txs[0];
            lpFee = SwapService.fromBigInt(tx.lp_fee, receiveToken.decimals);
            gasFee = SwapService.fromBigInt(tx.gas_fee, receiveToken.decimals);
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
            return await actor.swap_async(params);
        } catch (error) {
            console.error('Error executing swap:', error);
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
        try {
            await walletValidator.requireWalletConnection();
            console.log('params', params);
            const tokens = get(tokenStore).tokens;
            await tokenStore.loadBalances();
            const payToken = tokens.find(t => t.symbol === params.payToken);
            if (!payToken) throw new Error('Pay token not found');

            const payAmount = SwapService.toBigInt(params.payAmount, payToken.decimals);
            const receiveToken = tokens.find(t => t.symbol === params.receiveToken);
            if (!receiveToken) throw new Error('Receive token not found');

            const receiveAmount = SwapService.toBigInt(params.receiveAmount, receiveToken.decimals);

            console.log('Processing transfer/approval for amount:', payAmount.toString());

            const feeBigInt = payToken.fee;
            const totalCost = payAmount + feeBigInt;
            const balance = await IcrcService.getIcrc1Balance(payToken, get(walletStore).account.owner);
            let txId: bigint | false;
            
            if (payToken.icrc2) {
                console.log('Using ICRC2 approval');
                
                const requiredAllowance = payAmount + feeBigInt;

                const approval = await SwapService.requestIcrc2Approve(
                    payToken.canister_id,
                    requiredAllowance
                );
                txId = approval ? approval : 0n;
                console.log('Approval:', txId);
            } else if (payToken.icrc1) {
                console.log('Using ICRC1 transfer');
                const result = await IcrcService.icrc1Transfer(
                    payToken,
                    params.backendPrincipal,
                    payAmount,
                    { fee: feeBigInt }
                );
                if (typeof result.Ok === 'number') {
                    txId = result.Ok;
                } else {
                    txId = false;
                }
            } else {
                throw new Error(`Token ${payToken.symbol} does not support ICRC1 or ICRC2`);
            }

            if (txId === false) {
                throw new Error('Transaction failed during transfer/approval');
            }

            const swapParams = {
                pay_token: params.payToken,
                pay_amount: payAmount,
                receive_token: params.receiveToken,
                receive_amount: [receiveAmount],
                max_slippage: [params.slippage],
                receive_address: [],
                referred_by: [],
                pay_tx_id: []
            };

            const result = await SwapService.swap_async(swapParams);

            console.log('Tokens:', result.Ok);
            return result.Ok;
        } catch (error) {
            console.error('Swap execution failed:', error);
            toastStore.error(error instanceof Error ? error.message : 'Swap failed');
            return false;
        }
    }

    public static async requestIcrc2Approve(
        canisterId: string, 
        amount: bigint
    ): Promise<bigint> {
        try {
            const actor = await getActor(canisterId, 'icrc2');

            if (!actor.icrc2_approve) {
                throw new Error('ICRC2 methods not available - wrong IDL loaded');
            }

            const expiresAt = BigInt(Date.now()) * BigInt(1_000_000) + BigInt(60_000_000_000);

            const approveArgs = {
                fee: [],
                memo: [],
                from_subaccount: [],
                created_at_time: [],
                amount,
                expected_allowance: [],
                expires_at: [expiresAt],
                spender: { 
                    owner: Principal.fromText(KONG_BACKEND_PRINCIPAL), 
                    subaccount: [] 
                }
            };

            const result = await actor.icrc2_approve(approveArgs);

            if ('Err' in result) {
                throw new Error(`ICRC2 approve error: ${JSON.stringify(result.Err)}`);
            }
            console.log('Approval:', result.Ok)
            return result.Ok;
        } catch (error) {
            console.error('Error in ICRC2 approve:', error);
            throw error;
        }
    }
}

