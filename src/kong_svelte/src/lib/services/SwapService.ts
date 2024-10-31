// services/SwapService.ts
import { getActor } from '$lib/stores/walletStore';
import { walletValidator } from '$lib/validators/walletValidator';
import type { Principal } from '@dfinity/principal';

export class SwapService {
  protected static instance: SwapService;

  public static getInstance(): SwapService {
    if (!SwapService.instance) {
      SwapService.instance = new SwapService();
    }
    return SwapService.instance;
  }

  // Swap Related Methods
  public async swap_amounts(payToken: string, payAmount: bigint, receiveToken: string): Promise<BE.SwapQuoteResponse> {
    try {
      const actor = await getActor();
      return await actor.swap_amounts(payToken, payAmount, receiveToken);
    } catch (error) {
      console.error('Error getting swap amounts:', error);
      throw error;
    }
  }

  public async swap_async(params: {
    pay_token: string;
    pay_amount: bigint;
    receive_token: string;
    receive_amount: bigint[];
    max_slippage: number[];
    receive_address?: string[];
    referred_by?: string[];
    pay_tx_id?: string[];
  }): Promise<BE.SwapAsyncResponse> {
    try {
      const actor = await getActor();
      return await actor.swap_async(params);
    } catch (error) {
      console.error('Error executing swap:', error);
      throw error;
    }
  }

  public async requests(requestIds: bigint[]): Promise<BE.RequestResponse> {
    try {
      const actor = await getActor();
      return await actor.requests(requestIds);
    } catch (error) {
      console.error('Error getting request status:', error);
      throw error;
    }
  }

  // Transaction Related Methods
  public async getTransactionHistory(principal: Principal): Promise<any[]> {
    try {
      const actor = await getActor();
      const result = await actor.txs([true]);
      return result.Ok || [];
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  }

  public async getTransactionStatus(requestId: string): Promise<any> {
    try {
      const actor = await getActor();
      const result = await actor.requests([requestId]);
      return result.Ok?.[0];
    } catch (error) {
      console.error('Error getting transaction status:', error);
      throw error;
    }
  }

  // Token Approval Methods
  public async approveToken(params: {
    token: string;
    amount: bigint;
    spender: Principal;
  }): Promise<boolean> {
    await walletValidator.requireWalletConnection();
    try {
      const actor = await getActor();
      const result = await actor.icrc2_approve({
        amount: params.amount,
        spender: { owner: params.spender, subaccount: [] },
        expires_at: [BigInt(Date.now() * 1000000 + 60000000000)],
        expected_allowance: [],
        memo: [],
        fee: [],
        created_at_time: []
      });
      return !!result.Ok;
    } catch (error) {
      console.error('Error approving token:', error);
      throw error;
    }
  }

  public async getIcrc1TokenMetadata(canisterId: string): Promise<any> {
    try {
      const actor = await getActor(canisterId, 'icrc1');
      return await actor.icrc1_metadata();
    } catch (error) {
      console.error('Error getting icrc1 token metadata:', error);
      throw error;
    }
  }

  public async getTokenLogo(canisterId: any): Promise<any> {
    try {
      const actor = await getActor(canisterId, 'icrc1');
      const res = await actor.icrc1_metadata();
      const filtered = res.filter((arr: any[]) => {
        if (arr[0] === 'icrc1:logo' || arr[0] === 'icrc1_logo') {
          return arr[1];
        }
      });
      return filtered[0][1].Text
    } catch (error) {
      console.error('Error getting icrc1 token metadata:', error);
      throw error;
    }
  }
}