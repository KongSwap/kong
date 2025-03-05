<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/services/auth";
  import { canisterStore } from "$lib/stores/canisters";
  import { Principal } from "@dfinity/principal";
  import { IDL } from "@dfinity/candid";
  import { InstallService, type WasmMetadata } from "$lib/services/canister/install_wasm";
  // import { kongSwapService } from "$lib/services/kong_swap";
  import { createEventDispatcher } from "svelte";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { fetchICPtoXDRRates } from "$lib/services/canister/ic-api";
  import { get } from "svelte/store";
  import { createCanister } from "$lib/services/canister/create_canister";
import { registerCanister } from "$lib/api/canisters";
  
  // Props
  export let minerParams: any;
  export let addLog: (message: string) => void;
  export let currentStep: number;
  export let lastSuccessfulStep: number;
  export let errorMessage: string;
  export let errorDetails: string;
  export let isProcessing: boolean;
  export let kongAmount: string;
  export let icpAmount: string;
  export let canisterId: string;
  export let actualIcpReceived: string;
  export let estimatedTCycles: string;
  export let kongIcpRate: string;
  export let processSteps: {
    PREPARING: number;
    SWAP_KONG_TO_ICP: number;
    CREATE_CANISTER: number;
    DEPLOY_MINER: number;
    INITIALIZE_MINER: number;
    COMPLETED: number;
    ERROR: number;
  };
  
  // Constants
  const MINER_WASM_PATH = "/wasms/miner/miner.wasm";
  const MINER_WASM_METADATA: WasmMetadata = {
    path: MINER_WASM_PATH,
    description: "Miner canister",
    initArgsType: IDL.Record({})
  };
  
  // Constants for conversion
  const KONG_DECIMALS = 8;
  const ICP_DECIMALS = 8;
  
  // Local state
  let principal: Principal | null = null;
  let retryStep: number = processSteps.PREPARING;
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Initialize on mount
  onMount(() => {
    if (auth.pnp?.isWalletConnected()) {
      // Get the account from the auth store instead of using getConnectedAccount
      const authState = get(auth);
      if (authState.account?.owner) {
        principal = Principal.fromText(authState.account.owner.toText());
      }
    }
    
    // Set initial KONG amount based on miner type
    setTimeout(() => {
      setKongAmountForMinerType();
    }, 0);
  });
  
  // Watch for changes in minerParams
  $: if (minerParams) {
    setKongAmountForMinerType();
  }
  
  // Add a reactive statement to recalculate T-Cycles when kongAmount changes
  $: {
    kongAmount;
    if (kongAmount && parseFloat(kongAmount) > 0) {
      calculateEstimatedTCycles();
    }
  }
  
  // Function to calculate estimated T-Cycles from KONG amount
  async function calculateEstimatedTCycles() {
    try {
      console.log("Calculating estimated T-Cycles from KONG amount:", kongAmount);
      
      // Step 1: KONG to ICP calculation (no actual swap yet)
      const kongE8s = SwapService.toBigInt(kongAmount, KONG_DECIMALS);
      const quoteResult = await SwapService.getKongToIcpQuote(kongE8s, KONG_DECIMALS, ICP_DECIMALS);
      icpAmount = quoteResult.receiveAmount;
      console.log("ICP amount calculated:", icpAmount);
      
      // Step 2: ICP to XDR conversion
      const xdrRatesResponse = await fetchICPtoXDRRates();
      console.log("XDR rates response:", xdrRatesResponse);
      
      // Extract the rate value from the response
      const xdrRateValue = getXDRRate(xdrRatesResponse.icp_xdr_conversion_rates);
      
      // XDR rate is in 10,000ths, so divide by 10,000 to get the actual rate
      const xdrPerIcp = xdrRateValue / 10000;
      console.log(`XDR rate: 1 ICP = ${xdrPerIcp} XDR`);
      
      // Calculate the XDR amount - ensure we're using proper number conversion
      const icpValue = parseFloat(icpAmount);
      const xdrAmount = icpValue * xdrPerIcp;
      
      // Step 3: XDR to T-Cycles (1 XDR = 1T cycles)
      const tCycles = xdrAmount;
      
      // Ensure we're setting a string value with 2 decimal places
      const formattedTCycles = tCycles.toFixed(2);
      console.log(`Calculated T-Cycles: ${formattedTCycles}`);
      
      // Set the values
      estimatedTCycles = formattedTCycles;
      
      // Set the KONG to ICP rate for reference
      kongIcpRate = (icpValue / parseFloat(kongAmount)).toFixed(6);
      
      return tCycles;
    } catch (error) {
      console.error("Error calculating T-Cycles:", error);
      return 0;
    }
  }
  
  // Start deployment process
  export async function startDeployment() {
    if (!principal) {
      errorMessage = "Please connect your wallet to continue";
      currentStep = processSteps.ERROR;
      return;
    }
    
    if (!minerParams) {
      errorMessage = "Miner parameters not found";
      currentStep = processSteps.ERROR;
      return;
    }
    
    // Start the deployment process
    addLog("Starting miner deployment process...");
    isProcessing = true;
    
    try {
      // Step 1: Swap KONG to ICP
      await swapKongToIcpAndContinue();
    } catch (error) {
      handleError("Failed to start deployment", error);
    }
  }
  
  // Retry deployment from last successful step
  export async function retryDeployment() {
    errorMessage = "";
    errorDetails = "";
    isProcessing = true;
    
    try {
      // Determine which step to retry from
      switch (lastSuccessfulStep) {
        case processSteps.PREPARING:
          await swapKongToIcpAndContinue();
          break;
        case processSteps.SWAP_KONG_TO_ICP:
          await createCanisterAndContinue();
          break;
        case processSteps.CREATE_CANISTER:
          await deployMinerAndContinue();
          break;
        case processSteps.DEPLOY_MINER:
          await initializeMinerAndContinue();
          break;
        default:
          addLog("Cannot retry from current state");
          isProcessing = false;
      }
    } catch (error) {
      handleError("Failed to retry deployment", error);
    }
  }
  
  // Helper function to get the most recent XDR rate from the API response
  function getXDRRate(ratesArray: [number, number][]): number {
    if (!ratesArray || !Array.isArray(ratesArray) || ratesArray.length === 0) {
      console.error("Invalid XDR rates array:", ratesArray);
      throw new Error("Invalid XDR rates data");
    }
    
    // Sort by timestamp (first element in inner array) to get most recent
    const sortedRates = [...ratesArray].sort((a, b) => b[0] - a[0]);
    
    // The rate is the second element in the inner array
    const latestRate = sortedRates[0][1];
    console.log("Latest XDR rate value:", latestRate);
    
    return latestRate;
  }
  
  // Step 1: Swap KONG to ICP
  async function swapKongToIcpAndContinue() {
    currentStep = processSteps.SWAP_KONG_TO_ICP;
    addLog(`Swapping ${kongAmount} KONG to ICP...`);
    
    try {
      // Recalculate if needed to get the latest rates
      if (!estimatedTCycles || estimatedTCycles === "0") {
        await calculateEstimatedTCycles();
      }
      
      // Perform the actual KONG to ICP swap
      const kongE8s = SwapService.toBigInt(kongAmount, KONG_DECIMALS);
      
      addLog(`Initiating swap of ${kongAmount} KONG to ICP...`);
      const swapResult = await SwapService.swapKongToIcp(
        kongE8s,
        2.0 // Default max slippage of 2%
      );
      
      // Update with actual received ICP amount
      actualIcpReceived = SwapService.fromBigInt(swapResult, ICP_DECIMALS);
      icpAmount = actualIcpReceived;
      
      addLog(`Successfully swapped ${kongAmount} KONG to ${actualIcpReceived} ICP`);
      addLog(`Estimated T-Cycles: ${parseFloat(estimatedTCycles).toFixed(4)}`);
      
      // Save progress
      lastSuccessfulStep = processSteps.SWAP_KONG_TO_ICP;
      
      // Continue to next step
      await createCanisterAndContinue();
    } catch (error) {
      handleError("Failed to swap KONG to ICP", error);
    }
  }
  
  // Step 2: Create Canister
  async function createCanisterAndContinue() {
    currentStep = processSteps.CREATE_CANISTER;
    addLog("Creating miner canister...");
    
    try {
      // Ensure icpAmount is properly converted to BigInt
      const icpE8s = SwapService.toBigInt(icpAmount, ICP_DECIMALS);
      addLog(`Creating canister with ${icpAmount} ICP (${estimatedTCycles}T cycles)`);
      
      // Get principal
      if (!principal) {
        throw new Error("Principal not available for canister creation");
      }
      
      // Create a new canister using the createCanister service
      const createArgs = {
        amount: icpE8s,
        controller: principal,
        settings: {
          controllers: [principal]
        }
      };
      
      addLog("Sending ICP to Cycles Minting Canister...");
      const createCanisterResponse = await createCanister(createArgs);
      
      // Check if the response is valid before using it
      if (!createCanisterResponse) {
        throw new Error("Failed to create canister: No canister ID returned");
      }
      
      // Extract the canister ID from the response
      canisterId = createCanisterResponse.toText();
      
      addLog(`Successfully created canister with ID: ${canisterId}`);
      
      // Register the canister with the API
      try {
        addLog("Registering canister with API...");
        const registerResult = await registerCanister(
          principal,
          canisterId,
          'miner'
        );
        
        if (registerResult.success) {
          addLog("Successfully registered canister with API");
        } else {
          addLog(`Warning: Failed to register canister with API: ${registerResult.error}`);
          // Continue anyway since this is not critical
        }
      } catch (apiError) {
        addLog(`Warning: Error registering canister with API: ${apiError.message}`);
        // Continue anyway since this is not critical
      }
      
      // Save progress
      lastSuccessfulStep = processSteps.CREATE_CANISTER;
      
      // Continue to next step
      await deployMinerAndContinue();
    } catch (error) {
      console.error("Create canister error details:", error);
      handleError("Failed to create canister", error);
    }
  }
  
  // Step 3: Deploy Miner
  async function deployMinerAndContinue() {
    currentStep = processSteps.DEPLOY_MINER;
    addLog("Installing miner code...");
    
    try {
      // Prepare init args for WASM installation - empty object to match the empty MinerInitArgs struct
      const initArgs = {};
      
      // Install the WASM code using the InstallService
      await InstallService.installWasm(
        canisterId,
        MINER_WASM_METADATA,
        initArgs,
        1024 * 1024 // 1MB chunk size
      );
      
      addLog("Successfully installed miner code");
      
      // Save progress
      lastSuccessfulStep = processSteps.DEPLOY_MINER;
      
      // Continue to next step
      await initializeMinerAndContinue();
    } catch (error) {
      handleError("Failed to install miner code", error);
    }
  }
  
  // Step 4: Initialize Miner
  async function initializeMinerAndContinue() {
    currentStep = processSteps.INITIALIZE_MINER;
    addLog("Initializing miner with parameters...");
    
    try {
      // Import the miner IDL factory
      const { idlFactory } = await import("$declarations/miner/miner.did.js");
      
      
      // Add canister to user's cache
      const minerType = getMinerTypeName(minerParams.minerType);
      canisterStore.addCanister({
        id: canisterId,
        createdAt: Date.now(),
        wasmType: "miner",
        wasmVersion: 1,
        name: `${minerType} (${new Date().toLocaleDateString()})`,
        tags: ["miner"]
      });

      // TODO ADD TO REGISTRY CANISTER
      // get actor IDL from registry canister, staging or production
      // staging is mine, prod is Gor/Jon
      
      addLog("Successfully initialized miner");
      addLog("Miner deployment completed successfully!");
      
      // Complete the process
      currentStep = processSteps.COMPLETED;
      isProcessing = false;
      
      // Notify parent component that deployment is complete
      dispatch("complete", { canisterId });
    } catch (error) {
      handleError("Failed to initialize miner", error);
    }
  }
  
  // Helper function to get miner type name
  function getMinerTypeName(minerType: any): string {
    if (!minerType) return "Unknown";
    if ("Lite" in minerType) return "Lite Miner";
    if ("Normal" in minerType) return "Normal Miner";
    if ("Premium" in minerType) return "Premium Miner";
    return "Unknown Miner";
  }
  
  // Set KONG amount based on miner type
  export function setKongAmountForMinerType() {
    if (!minerParams || !minerParams.minerType) return;
    
    // Set KONG amount based on miner type
    if ("Lite" in minerParams.minerType) {
      kongAmount = "150";
    } else if ("Normal" in minerParams.minerType) {
      kongAmount = "420";
    } else if ("Premium" in minerParams.minerType) {
      kongAmount = "42069";
    }
    
    console.log(`Miner type set: ${JSON.stringify(minerParams.minerType)}`);
    console.log(`KONG amount: ${kongAmount}`);
  }
  
  // Error handling
  function handleError(message: string, error: any) {
    console.error(message, error);
    
    // Extract more detailed error information
    let detailedError = "";
    if (error instanceof Error) {
      detailedError = error.message;
      // Check for nested error objects
      if (error.cause) {
        detailedError += ` - Cause: ${JSON.stringify(error.cause)}`;
      }
    } else if (typeof error === 'object') {
      try {
        detailedError = JSON.stringify(error, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        );
      } catch (e) {
        detailedError = String(error);
      }
    } else {
      detailedError = String(error);
    }
    
    errorMessage = message;
    errorDetails = detailedError;
    currentStep = processSteps.ERROR;
    isProcessing = false;
    addLog(`ERROR: ${message} - ${detailedError}`);
  }
</script>

<!-- This component has no visible UI, it handles the deployment process logic --> 
