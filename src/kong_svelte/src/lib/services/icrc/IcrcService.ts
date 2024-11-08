import { getActor } from '$lib/services/wallet/walletStore';
import { Principal } from '@dfinity/principal';
import { canisterId as kongBackendCanisterId } from '../../../../../declarations/kong_backend';

export class IcrcService {
  public static async getIcrc1Balance(token: FE.Token, principal: Principal): Promise<bigint> {
    const actor = await getActor(token.canister_id, 'icrc1');
    return actor.icrc1_balance_of({
      owner: principal,
      subaccount: [],
    });
  }

  public static async getIcrc1TokenMetadata(canisterId: string): Promise<any> {
    try {
      const actor = await getActor(canisterId, 'icrc1');
      return await actor.icrc1_metadata();
    } catch (error) {
      console.error('Error getting icrc1 token metadata:', error);
      throw error;
    }
  }

  public static async requestIcrc2Approve(
    canisterId: string, 
    payAmount: bigint,
    gasAmount: bigint = BigInt(0)
  ): Promise<bigint> {
    try {
      const actor = await getActor(canisterId, 'icrc2');

      if (!actor.icrc2_approve) {
        throw new Error('ICRC2 methods not available - wrong IDL loaded');
      }

      const expiresAt = BigInt(Date.now()) * BigInt(1_000_000) + BigInt(60_000_000_000);
      
      const totalAmount = payAmount + gasAmount;
      
      const approveArgs = {
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: BigInt(totalAmount),
        expected_allowance: [],
        expires_at: [expiresAt],
        spender: { 
          owner: Principal.fromText(kongBackendCanisterId), 
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

  public static async checkIcrc2Allowance(
    canisterId: string,
    owner: Principal,
    spender: Principal
  ): Promise<bigint> {
    try {
      const actor = await getActor(canisterId, 'icrc2');

      if (!actor.icrc2_allowance) {
        throw new Error('ICRC2 methods not available - wrong IDL loaded');
      }

      const result = await actor.icrc2_allowance({
        account: { owner, subaccount: [] },
        spender: { 
          owner: spender, 
          subaccount: [] 
        }
      });

      return BigInt(result.allowance);
    } catch (error) {
      console.error('Error checking ICRC2 allowance:', error);
      throw error;
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
  ): Promise<{ Ok?: bigint; Err?: any }> {
    try {
      const actor = await getActor(token.canister_id, 'icrc1');
      
      // Convert string principal to Principal if necessary
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
        console.error('Transfer failed:', result.Err);
        throw new Error(`Transfer failed: ${JSON.stringify(result.Err)}`);
      }

      return result;
    } catch (error) {
      console.error('Error transferring token:', error);
      throw error;
    }
  }

  public static async icrc2TransferFrom(
    canisterId: string,
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
      const actor = await getActor(canisterId, 'icrc2');

      if (!actor.icrc2_transfer_from) {
        throw new Error('ICRC2 transfer_from method not available');
      }

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
      console.error('Error in ICRC2 transfer_from:', error);
      throw error;
    }
  }
}
