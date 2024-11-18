import { getActor, type CanisterType } from '$lib/services/wallet/walletStore';
import { Principal } from '@dfinity/principal';
import { canisterId as kongBackendCanisterId, idlFactory as kongBackendIdl } from '../../../../../declarations/kong_backend';
import { idlFactory as icrcIdl } from '../../../../../declarations/ckusdt_ledger';
import { Actor } from '@dfinity/agent';
import { get } from 'svelte/store';
import { walletStore } from '$lib/services/wallet/walletStore';

export class IcrcService {
  private static async getActorWithCheck(canister_id: string, interfaceName: CanisterType, signed = true) {
    try {
      const store = get(walletStore);
      if (signed && !store.isConnected) {
        throw new Error('Wallet connection required for this operation');
      }

      const actor = await getActor(canister_id, interfaceName, signed);
      if (!actor) {
        throw new Error(`Actor for ${interfaceName} not available`);
      }
      return actor;
    } catch (error) {
      console.error(`Error getting actor for ${interfaceName}:`, error);
      throw new Error(`Failed to initialize actor for ${interfaceName}. Please ensure your wallet is connected.`);
    }
  }

  private static handleError(methodName: string, error: any) {
    console.error(`Error in ${methodName}:`, error);
    if (error?.message?.includes('body') || error?.message?.includes('Wallet connection required')) {
      throw new Error('Please connect your wallet to proceed with this operation.');
    }
    throw error;
  }

  public static async getIcrc1Balance(
    token: FE.Token,
    principal: Principal,
  ): Promise<bigint> {
    try {
      // Use unsigned actor for balance checks
      const actor = await this.getActorWithCheck(token.canister_id, "icrc1", false);
      const balance = await actor.icrc1_balance_of({
        owner: principal,
        subaccount: [],
      });
      return balance;
    } catch (error) {
      console.error(`Error getting ICRC1 balance for ${token.symbol}:`, error);
      return BigInt(0);
    }
  }

  public static async getIcrc1TokenMetadata(canister_id: string): Promise<any> {
    try {
      const actor = await this.getActorWithCheck(canister_id, 'icrc1', false);
      return await actor.icrc1_metadata();
    } catch (error) {
      this.handleError('getIcrc1TokenMetadata', error);
    }
  }

  public static async checkAndRequestIcrc2Allowances(
    token: FE.Token, 
    payAmount: bigint,
  ): Promise<bigint> {
    if (!token?.canister_id) {
      throw new Error('Invalid token: missing canister_id');
    }

    try {
      const store = get(walletStore);
      if (!store.isConnected || !store.signerAgent) {
        throw new Error('Please connect your wallet to proceed with this operation.');
      }

      // Create actor with signing capabilities using the standard ICRC2 interface
      const actor = await getActor(token.canister_id, 'icrc2', true);

      const expiresAt = BigInt(Date.now()) * BigInt(1_000_000) + BigInt(60_000_000_000);
      const totalAmount = payAmount + (token.fee || BigInt(0));
      
      const approveArgs = {
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: totalAmount,
        expected_allowance: [],
        expires_at: [expiresAt],
        spender: { 
          owner: Principal.fromText(kongBackendCanisterId), 
          subaccount: [] 
        }
      };

      console.log('Sending ICRC2 approve request with args:', approveArgs);
      const result = await actor.icrc2_approve(approveArgs);
      console.log('ICRC2 approve result:', result);

      if (!result) {
        throw new Error('ICRC2 approve call returned undefined');
      }
      
      if ('Err' in result) {
        throw new Error(`ICRC2 approve error: ${JSON.stringify(result.Err)}`);
      }
      
      if (!('Ok' in result)) {
        throw new Error('ICRC2 approve response missing Ok field');
      }
      
      return result.Ok;
    } catch (error: any) {
      if (error?.message?.includes('wallet')) {
        throw error; // Pass through wallet connection errors directly
      }
      console.error('ICRC2 approve error:', error);
      this.handleError('checkAndRequestIcrc2Allowances', error);
      throw error;
    }
  }

  public static async checkIcrc2Allowance(
    token: FE.Token,
    owner: Principal,
    spender: Principal
  ): Promise<bigint> {
    try {
      const actor = await this.getActorWithCheck(token.canister_id, 'icrc2', false);
      const result = await actor.icrc2_allowance({
        account: { owner, subaccount: [] },
        spender: { 
          owner: spender, 
          subaccount: [] 
        }
      });
      return BigInt(result.allowance);
    } catch (error) {
      this.handleError('checkIcrc2Allowance', error);
    }
  }

  public static async icrc1Transfer(
    token: FE.Token,
    to: string | Principal,
    amount: bigint,
    opts: {
      memo?: number[];
      fee?: bigint;
      fromSubaccount?: number[];
      createdAtTime?: bigint;
    } = {}
  ): Promise<Result<bigint>> {
    try {
      const actor = await this.getActorWithCheck(token.canister_id, 'icrc1');
      const toPrincipal = typeof to === 'string' ? Principal.fromText(to) : to;

      const transferArgs = {
        to: {
          owner: toPrincipal,
          subaccount: [],
        },
        amount,
        memo: opts.memo ? opts.memo : [],
        fee: opts.fee ? [opts.fee] : [],
        from_subaccount: opts.fromSubaccount ? [opts.fromSubaccount] : [],
        created_at_time: opts.createdAtTime ? [opts.createdAtTime] : [],
      };

      const result = await actor.icrc1_transfer(transferArgs);
      if ('Err' in result) {
        return { Err: result.Err };
      }
      return { Ok: result.Ok };
    } catch (error) {
      this.handleError('icrc1Transfer', error);
    }
  }

  public static async icrc2TransferFrom(
    canister_id: string,
    from: Principal,
    to: Principal,
    amount: bigint,
    opts: {
      memo?: number[];
      fee?: bigint;
      fromSubaccount?: number[];
      createdAtTime?: bigint;
    } = {}
  ): Promise<{ Ok?: bigint; Err?: any }> {
    try {
      const actor = await this.getActorWithCheck(canister_id, 'icrc2');
      const transferArgs = {
        from: {
          owner: from,
          subaccount: [],
        },
        to: {
          owner: to,
          subaccount: [],
        },
        amount,
        memo: opts.memo ? opts.memo : [],
        fee: opts.fee ? [opts.fee] : [],
        created_at_time: opts.createdAtTime ? [opts.createdAtTime] : [],
      };

      const result = await actor.icrc2_transfer_from(transferArgs);
      if ('Err' in result) {
        throw new Error(`ICRC2 transfer_from error: ${JSON.stringify(result.Err)}`);
      }
      return result;
    } catch (error) {
      this.handleError('icrc2TransferFrom', error);
    }
  }
}
