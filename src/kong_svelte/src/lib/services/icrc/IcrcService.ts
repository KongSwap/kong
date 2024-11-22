import { auth, type CanisterType } from '$lib/services/auth';
import { canisterIDLs } from '$lib/services/pnp/PnpInitializer';
import { Principal } from '@dfinity/principal';
import { canisterId as kongBackendCanisterId } from '../../../../../declarations/kong_backend';
import { get } from 'svelte/store';

export class IcrcService {

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
      // Use ICRC-2 actor since it's a superset of ICRC-1
      const wallet = get(auth);
      const actor = await auth.getActor(token.canister_id, canisterIDLs['icrc2'], {anon: true});
      return await actor.icrc1_balance_of({
        owner: principal,
        subaccount: [],
      });
    } catch (error) {
      console.error(`Error getting ICRC1 balance for ${token.symbol}:`, error);
      return BigInt(0);
    }
  }

  public static async getIcrc1TokenMetadata(canister_id: string): Promise<any> {
    try {
      const wallet = get(auth);
      const actor = await auth.getActor(canister_id, canisterIDLs['icrc1']);
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

      console.log("[ICRC Debug] Checking allowances:", {
        token: token.symbol,
        payAmount: payAmount.toString()
      });
  
      const wallet = get(auth);
      const principal = await wallet.account.owner
      
      console.log("[ICRC Debug] Current principal:", principal.toString());
      
      // Create actor with retries
      let actor;
      let retries = 3;
      while (retries > 0) {
        try {
          actor = await auth.getActor(token.canister_id, canisterIDLs.icrc2, {
            anon: false,
          });
          console.log("[ICRC Debug] WALLET", wallet);
          console.log("[ICRC Debug] Got actor for allowance check");

          break;
        } catch (error) {
          console.warn(`Actor creation attempt failed, ${retries - 1} retries left:`, error);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
        }
      }
      
      const expiresAt = BigInt(Date.now()) * BigInt(1_000_000) + BigInt(60_000_000_000);
      const totalAmount = payAmount + token.fee;

      // First check if we already have sufficient allowance
      console.log('Checking allowance for', wallet.account.owner.toString());
      const currentAllowance = await this.checkIcrc2Allowance(
        token,
        wallet.account.owner,
        Principal.fromText(kongBackendCanisterId)
      );

      if (currentAllowance >= totalAmount) {
        console.log('Sufficient allowance already exists:', currentAllowance.toString());
        return currentAllowance;
      }

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

      // Fetch balance with retries
      let balance;
      retries = 3;
      while (retries > 0) {
        try {
          balance = await actor.icrc1_balance_of({
            owner: wallet.account.owner,
            subaccount: [],
          });
          break;
        } catch (error) {
          console.warn(`Balance check attempt failed, ${retries - 1} retries left:`, error);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log("BALANCE", balance);

      // Approve with retries
      let result;
      retries = 3;
      while (retries > 0) {
        try {
          actor = await auth.getActor(token.canister_id, canisterIDLs.icrc2, {
            anon: false,
          });
          result = await actor.icrc2_approve(approveArgs);
          break;
        } catch (error) {
          console.warn(`Approve attempt failed, ${retries - 1} retries left:`, error);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if ('Err' in result) {
        // Convert BigInt to string in the error object
        const serializedError = JSON.stringify(result.Err, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value
        , 2);
        
        console.error('ICRC2 approve error:', serializedError);
        throw new Error(`ICRC2 approve error: ${serializedError}`);
    }
    
      
      console.log('ICRC2 approve success:', result.Ok.toString());
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
      console.log('Checking allowance for', owner.toString());
      console.log('Spender:', spender.toString());
      console.log('Token:', token.canister_id);
      const wallet = get(auth);
      const walletId = wallet.account?.owner?.toString() || "anonymous";
      const actor = await auth.getActor(token.canister_id, canisterIDLs['icrc2']);
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
      const actor = await auth.getActor(token.canister_id, 'icrc1');
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
      const actor = await auth.getActor(canister_id, 'icrc2');
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
