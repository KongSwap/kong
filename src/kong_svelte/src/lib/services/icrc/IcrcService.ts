import { getActor, type CanisterType } from '$lib/services/wallet/walletStore';
import { Principal } from '@dfinity/principal';
import { canisterId as kongBackendCanisterId } from '../../../../../declarations/kong_backend';

export class IcrcService {
  private static async getActorWithCheck(canister_id: string, interfaceName: CanisterType) {
    const actor = await getActor(canister_id, interfaceName);
    if (!actor) {
      throw new Error(`Actor for ${interfaceName} not available`);
    }
    return actor;
  }

  private static handleError(methodName: string, error: any) {
    console.error(`Error in ${methodName}:`, error);
    throw error;
  }

  public static async getIcrc1Balance(token: FE.Token, principal: Principal): Promise<bigint> {
    if (!token?.canister_id) {
      return BigInt(0);
    }
    try {
      const actor = await getActor(token.canister_id, 'icrc1');
      return actor.icrc1_balance_of({
        owner: principal,
        subaccount: [],
      });
    } catch (error) {
      this.handleError('getIcrc1Balance', error);
    }
  }

  public static async getIcrc1TokenMetadata(canister_id: string): Promise<any> {
    try {
      const actor = await getActor(canister_id, 'icrc1');
      return await actor.icrc1_metadata();
    } catch (error) {
      this.handleError('getIcrc1TokenMetadata', error);
    }
  }

  public static async checkAndRequestIcrc2Allowances(
    token: FE.Token, 
    payAmount: bigint,
  ): Promise<bigint> {
    try {
      const actor = await this.getActorWithCheck(token.canister_id, 'icrc2');
      const expiresAt = BigInt(Date.now()) * BigInt(1_000_000) + BigInt(60_000_000_000);
      const totalAmount = payAmount + token.fee;
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
      const result = await actor.icrc2_approve(approveArgs);
      if ('Err' in result) {
        throw new Error(`ICRC2 approve error: ${JSON.stringify(result.Err)}`);
      }
      return result.Ok;
    } catch (error) {
      this.handleError('checkAndRequestIcrc2Allowances', error);
    }
  }

  public static async checkIcrc2Allowance(
    token: FE.Token,
    owner: Principal,
    spender: Principal
  ): Promise<bigint> {
    try {
      const actor = await this.getActorWithCheck(token.canister_id, 'icrc2');
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
