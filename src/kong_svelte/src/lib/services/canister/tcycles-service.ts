import { Principal } from '@dfinity/principal';
import { auth } from '$lib/stores/auth';
import { toastStore } from '$lib/stores/toastStore';
import { SwapService } from '$lib/services/swap/SwapService';
import { fetchICPtoXDRRates } from '$lib/services/canister/ic-api';
import type { CreateCanisterArgs, _SERVICE } from './tcycles';
import { idlFactory } from './tcycles';  

// Cycles ledger canister ID (mainnet)
export const TCYCLES_LEDGER_CANISTER_ID = 'um5iw-rqaaa-aaaaq-qaaba-cai';

// Constants for conversion
const KONG_DECIMALS = 8;
const ICP_DECIMALS = 8;

/**
 * Service for interacting with the TCYCLES ledger
 */
export class TCyclesService {
  /**
   * Creates a new canister using cycles from the TCYCLES ledger
   * @param cyclesAmount The amount of cycles to allocate to the new canister
   * @param options Optional settings for the canister creation
   * @returns The newly created canister's Principal ID
   */
  public static async createCanister(
    cyclesAmount: bigint,
    options: {
      controllers?: Principal[],
      subnetId?: string,
      subnetType?: string,
      fromSubaccount?: Uint8Array
    } = {}
  ): Promise<Principal> {
    try {
      const cyclesActor = await auth.getActor(
        TCYCLES_LEDGER_CANISTER_ID,
        idlFactory,  // Use the imported IDL factory instead of undefined
        { anon: false, requiresSigning: true }
      );

      // Build arguments using Candid types
      const createArgs: CreateCanisterArgs = {
        amount: cyclesAmount,
        from_subaccount: options.fromSubaccount ? [options.fromSubaccount] : [],
        created_at_time: [],
        creation_args: options.controllers || options.subnetId || options.subnetType ? [{
          settings: options.controllers ? [{
            controllers: [options.controllers],
            compute_allocation: [],
            memory_allocation: [],
            freezing_threshold: [],
            reserved_cycles_limit: []
          }] : [],
          subnet_selection: options.subnetId
            ? [{ Subnet: { subnet: Principal.fromText(options.subnetId) } }]
            : options.subnetType ? [{ Filter: { subnet_type: [options.subnetType] } }] : []
        }] : []
      };

      console.log('TCycles create_canister args:', JSON.stringify(createArgs, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v));

      const result = await cyclesActor.create_canister(createArgs);
      
      if (result.Ok) {
        const canisterId = result.Ok.canister_id;
        console.log("Canister created with ID:", canisterId.toText(), " (ledger block:", result.Ok.block_id.toString(), ")");
        toastStore.success(`Successfully created canister: ${canisterId.toText()}`);
        return canisterId;
      } else {
        // Extract error information
        const error = result.Err;
        console.error("Failed to create canister via TCycles ledger:", error);
        
        // Create a user-friendly error message
        let errorMessage = "Failed to create canister";
        if (error.InsufficientFunds) {
          errorMessage = `Insufficient cycles balance. Available: ${error.InsufficientFunds.balance.toString()} cycles`;
        } else if (error.FailedToCreate) {
          errorMessage = `Failed to create canister: ${error.FailedToCreate.error}`;
        } else if (error.GenericError) {
          errorMessage = error.GenericError.message;
        }
        
        toastStore.error(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Error in TCyclesService.createCanister:", error);
      toastStore.error(`Error creating canister: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Top up an existing canister with cycles from the TCYCLES ledger
   * @param canisterId The Principal ID of the canister to top up
   * @param cyclesAmount The amount of cycles to send to the canister
   * @returns The ledger transaction block index
   */
  public static async topUpCanister(
    canisterId: string | Principal,
    cyclesAmount: bigint
  ): Promise<bigint> {
    try {
      // Get an actor for the cycles ledger
      const cyclesActor = await auth.getActor(
        TCYCLES_LEDGER_CANISTER_ID,
        idlFactory,  // Use the imported IDL factory instead of undefined
        { anon: false, requiresSigning: true }
      );
      
      // Convert canisterId to Principal if it's a string
      const canisterPrincipal = typeof canisterId === 'string' 
        ? Principal.fromText(canisterId) 
        : canisterId;
      
      // Get the current balance and fee
      const currentBalance = await TCyclesService.getBalance();
      const fee = await TCyclesService.getFee();
      
      // Check if there's enough balance for the top-up including fee
      if (currentBalance < cyclesAmount + fee) {
        const formattedBalance = SwapService.fromBigInt(currentBalance, 12); // 12 decimals for TCycles
        const formattedFee = SwapService.fromBigInt(fee, 12);
        const formattedTotal = SwapService.fromBigInt(cyclesAmount + fee, 12);
        
        const errorMessage = `Insufficient cycles balance. Available: ${formattedBalance} T-Cycles. Required: ${formattedTotal} T-Cycles (${SwapService.fromBigInt(cyclesAmount, 12)} + ${formattedFee} fee)`;
        console.error(errorMessage);
        toastStore.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      // Prepare the withdraw arguments
      const withdrawArgs = {
        to: canisterPrincipal,
        amount: cyclesAmount,
        from_subaccount: [], // Add the required from_subaccount field as an empty optional array
        created_at_time: [] // Add the optional created_at_time field as an empty optional array
      };
      
      // Log the arguments for debugging
      console.log('TCycles withdraw args:', JSON.stringify(withdrawArgs, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value));
      
      // Call the withdraw method
      const result = await cyclesActor.withdraw(withdrawArgs);
      
      if (result.Ok !== undefined) {
        const blockIndex = result.Ok;
        console.log(`Successfully topped up canister ${canisterPrincipal.toText()} with ${cyclesAmount.toString()} cycles. Ledger block:`, blockIndex.toString());
        toastStore.success(`Successfully topped up canister with ${formatCycles(cyclesAmount)} cycles`);
        return blockIndex;
      } else {
        // Extract error information
        const error = result.Err;
        console.error("Failed to top up canister:", error);
        
        // Create a user-friendly error message
        let errorMessage = "Failed to top up canister";
        if (error.InsufficientFunds) {
          errorMessage = `Insufficient cycles balance. Available: ${formatCycles(error.InsufficientFunds.balance)}`;
        } else if (error.BadFee) {
          errorMessage = `Bad fee - expected fee: ${formatCycles(error.BadFee.expected_fee)}`;
        } else if (error.InvalidReceiver) {
          errorMessage = `Invalid target canister: ${error.InvalidReceiver.receiver.toText()}`;
        } else if (error.FailedToWithdraw) {
          errorMessage = `Canister rejected the deposit: ${error.FailedToWithdraw.rejection_reason}`;
        } else if (error.GenericError) {
          errorMessage = error.GenericError.message;
        }
        
        toastStore.error(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Error in TCyclesService.topUpCanister:", error);
      toastStore.error(`Error topping up canister: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Get the balance of cycles in the user's TCYCLES ledger account
   * @returns The balance in cycles
   */
  public static async getBalance(): Promise<bigint> {
    try {
      // Get an actor for the cycles ledger
      const cyclesActor = await auth.getActor(
        TCYCLES_LEDGER_CANISTER_ID,
        idlFactory,
        { anon: true, requiresSigning: false }
      );
      
      // Get the principal from the auth store
      const principal = auth.pnp?.account?.owner;
      if (!principal) {
        throw new Error("No principal available. Please connect your wallet.");
      }
      
      // Call the icrc1_balance_of method
      const balance = await cyclesActor.icrc1_balance_of({
        owner: principal,
        subaccount: []
      });
      
      return balance;
    } catch (error) {
      console.error("Error in TCyclesService.getBalance:", error);
      return BigInt(0);
    }
  }
  
  /**
   * Get the fee for transactions on the TCYCLES ledger
   * @returns The fee in cycles
   */
  public static async getFee(): Promise<bigint> {
    try {
      // Get an actor for the cycles ledger
      const cyclesActor = await auth.getActor(
        TCYCLES_LEDGER_CANISTER_ID,
        idlFactory,
        { anon: true, requiresSigning: false }
      );
      
      // Call the icrc1_fee method
      const fee = await cyclesActor.icrc1_fee();
      return fee;
    } catch (error) {
      console.error("Error in TCyclesService.getFee:", error);
      // Default fee is 100 billion cycles (0.1 TCycles)
      return BigInt(100_000_000_000);
    }
  }
  
  /**
   * Calculate how much KONG is needed to create a canister with 1T cycles
   * This compares direct KONG->TCYCLES vs KONG->ICP->TCYCLES paths
   * @returns An object with the amount of KONG needed for each path and the difference
   */
  public static async calculateKongForCanister(): Promise<{
    kongViaIcp: string;
    kongViaTCycles: string;
    difference: string;
    differencePercent: string;
    cheaperPath: 'icp' | 'tcycles';
  }> {
    try {
      // 1. Calculate KONG needed via ICP path (KONG -> ICP -> XDR -> TCycles)
      // First get the KONG to ICP rate
      const kongAmount = "100"; // Start with 100 KONG as a reference
      const kongE8s = SwapService.toBigInt(kongAmount, KONG_DECIMALS);
      const quoteResult = await SwapService.getKongToIcpQuote(kongE8s, KONG_DECIMALS, ICP_DECIMALS);
      const icpAmount = quoteResult.receiveAmount;
      
      // Then get the ICP to XDR rate
      const xdrRatesResponse = await fetchICPtoXDRRates();
      const xdrRates = xdrRatesResponse.icp_xdr_conversion_rates;
      const sortedRates = [...xdrRates].sort((a, b) => b[0] - a[0]);
      const xdrRateValue = sortedRates[0][1];
      const xdrPerIcp = xdrRateValue / 10000;
      
      // Calculate the XDR amount
      const icpValue = parseFloat(icpAmount);
      const xdrAmount = icpValue * xdrPerIcp;
      
      // 1 XDR = 1T cycles, so calculate how much KONG is needed for 1T cycles
      const kongPerTCycle = parseFloat(kongAmount) / xdrAmount;
      const kongForOneTCycle = kongPerTCycle.toFixed(4);
      
      // 2. Calculate KONG needed via direct TCycles path
      // Get the actual rate from SwapService
      const tcyclesQuote = await SwapService.getKongToTCyclesQuote(kongE8s, KONG_DECIMALS, 12);
      const tcyclesAmount = parseFloat(tcyclesQuote.receiveAmount);
      const kongPerTCycleDirect = parseFloat(kongAmount) / tcyclesAmount;
      const kongForOneTCycleDirect = kongPerTCycleDirect.toFixed(4);
      
      // 3. Calculate the difference
      const difference = (kongPerTCycle - kongPerTCycleDirect).toFixed(4);
      const differencePercent = ((1 - kongPerTCycleDirect / kongPerTCycle) * 100).toFixed(2);
      
      return {
        kongViaIcp: kongForOneTCycle,
        kongViaTCycles: kongForOneTCycleDirect,
        difference,
        differencePercent,
        cheaperPath: kongPerTCycleDirect < kongPerTCycle ? 'tcycles' : 'icp'
      };
    } catch (error) {
      console.error("Error calculating KONG for canister:", error);
      // Return default values if calculation fails
      return {
        kongViaIcp: "100",
        kongViaTCycles: "95",
        difference: "5",
        differencePercent: "5.00",
        cheaperPath: 'tcycles'
      };
    }
  }
}

/**
 * Format cycles amount for display
 * @param cycles The amount of cycles
 * @returns Formatted string with appropriate unit (T, B, M)
 */
function formatCycles(cycles: bigint): string {
  const cyclesNumber = Number(cycles);
  
  if (cyclesNumber >= 1_000_000_000_000) {
    return `${(cyclesNumber / 1_000_000_000_000).toFixed(2)}T`;
  } else if (cyclesNumber >= 1_000_000_000) {
    return `${(cyclesNumber / 1_000_000_000).toFixed(2)}B`;
  } else if (cyclesNumber >= 1_000_000) {
    return `${(cyclesNumber / 1_000_000).toFixed(2)}M`;
  } else {
    return cyclesNumber.toString();
  }
} 