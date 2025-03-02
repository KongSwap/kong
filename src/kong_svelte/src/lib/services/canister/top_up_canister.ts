import { Principal } from '@dfinity/principal';
import { auth } from '$lib/services/auth';
import { IcrcService } from '../icrc/IcrcService';
import { idlFactory as cmcIdlFactory } from '$lib/services/canister/cmc.idl';
import { get } from 'svelte/store';
import { toastStore } from '$lib/stores/toastStore';

// Constants
const CMC_CANISTER_ID = "rkp4c-7iaaa-aaaaa-aaaca-cai"; // Cycles Minting Canister ID
const TOP_UP_CANISTER_MEMO = 1347768404n; // Memo for canister top-up (0x50555054 == 'TPUP')

/**
 * Tops up an existing canister with cycles by converting ICP
 * 
 * @param args Object containing canister_id and amount
 * @returns Promise with the result of the top-up operation
 */
export async function topUpCanister(args: {
  canister_id: string | Principal;
  amount: bigint;
}) {
  try {
    console.log('Topping up canister with CMC...');
    
    // Ensure canister_id is a Principal object
    const canisterPrincipal = typeof args.canister_id === 'string' 
      ? Principal.fromText(args.canister_id) 
      : args.canister_id;
    
    console.log('Canister ID:', canisterPrincipal.toText());
    
    // Get the current user's principal to use for the transfer
    const authState = get(auth);
    if (!authState.isConnected || !authState.account) {
      throw new Error('User is not authenticated');
    }
    
    // Get the owner principal from the account
    const ownerPrincipal = authState.account.owner;
    if (!ownerPrincipal) {
      throw new Error('User principal not found');
    }
    
    // Convert to Principal object if it's a string
    const userPrincipal = typeof ownerPrincipal === 'string' 
      ? Principal.fromText(ownerPrincipal) 
      : ownerPrincipal;
    
    // IMPORTANT: For top-up operations, we need to use the CANISTER principal
    // for the subaccount derivation, not the user principal
    // Transfer ICP to CMC with the TOP_UP_CANISTER memo
    const transferResult = await IcrcService.transferIcpToCmc(
      args.amount,
      canisterPrincipal, // Use canister principal for subaccount derivation
      TOP_UP_CANISTER_MEMO
    );
    
    if ('Err' in transferResult) {
      throw new Error(`Failed to transfer ICP to CMC: ${JSON.stringify(transferResult.Err, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value)}`);
    }
    
    // Get the block index from the successful transfer
    const blockIndex = transferResult.Ok;
    console.log('Transfer successful, block index:', blockIndex.toString());
    
    // Use the correct auth pattern to get the CMC actor
    const cmcActor = await auth.getActor(
      CMC_CANISTER_ID,
      cmcIdlFactory,
      { requiresSigning: true }
    );
    
    // Call notify_top_up with the block index and canister ID
    const notifyArgs = {
      block_index: blockIndex,
      canister_id: canisterPrincipal
    };
    
    console.log('Notifying CMC of top-up with args:', JSON.stringify(notifyArgs, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value));
    
    const result = await cmcActor.notify_top_up(notifyArgs);
    
    if ('Ok' in result) {
      console.log('Top-up successful, cycles added:', result.Ok.toString());
      toastStore.success('Canister topped up successfully');
      return result.Ok;
    } else {
      throw new Error(`CMC error: ${JSON.stringify(result.Err, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value)}`);
    }
  } catch (error) {
    console.error('Error topping up canister:', error);
    toastStore.error(`Failed to top up canister: ${error.message || 'Unknown error'}`);
    throw error;
  }
}

/**
 * Calculates the approximate cycles that would be minted for a given ICP amount
 * This is a simplified calculation and may not be exact
 * 
 * @param icpAmount Amount of ICP in e8s (1 ICP = 10^8 e8s)
 * @returns Approximate cycles that would be minted
 */
export async function calculateCyclesFromIcp(icpAmount: bigint): Promise<bigint> {
  try {
    // Get the CMC actor to fetch the current conversion rate
    const cmcActor = await auth.getActor(
      CMC_CANISTER_ID,
      cmcIdlFactory,
      { anon: true }
    );
    
    // Get the current ICP to XDR conversion rate
    const rateResponse = await cmcActor.get_icp_xdr_conversion_rate();
    const rate = rateResponse.data.xdr_permyriad_per_icp;
    
    // The CMC uses a conversion rate of 1 trillion cycles per XDR
    // So we calculate: ICP amount * (XDR rate / 10000) * 1 trillion
    const xdrValue = (icpAmount * rate) / 10000n;
    const cyclesPerXdr = 1_000_000_000_000n; // 1 trillion cycles per XDR
    
    return xdrValue * cyclesPerXdr;
  } catch (error) {
    console.error('Error calculating cycles from ICP:', error);
    toastStore.error(`Failed to calculate cycles: ${error.message || 'Unknown error'}`);
    // Return a fallback estimate if the calculation fails
    // Roughly 1 ICP ≈ 1 trillion cycles as a fallback
    return icpAmount * 10_000_000_000n;
  }
} 
