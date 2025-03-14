<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/services/auth";
  import { canisterStore } from "$lib/stores/canisters";
  import { Principal } from "@dfinity/principal";
  import { IDL } from "@dfinity/candid";
  import { InstallService, type WasmMetadata } from "$lib/services/canister/install_wasm";
  import { createEventDispatcher } from "svelte";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { TCyclesService } from "$lib/services/canister/tcycles-service";
  import { get } from "svelte/store";
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
  export let tcyclesAmount: string;
  export let canisterId: string;
  export let actualTCyclesReceived: string;
  export let estimatedTCycles: string;
  export let kongTCyclesRate: string;
  export let selectedSubnetType: string;
  export let selectedSubnetId: string;
  export let processSteps: {
    PREPARING: number;
    SWAP_KONG_TO_TCYCLES: number;
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
  const TCYCLES_DECIMALS = 12; // 1 TCycle = 1e12 cycles
  
  // Local state
  let principal: Principal | null = null;
  let retryStep: number = processSteps.PREPARING;
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Initialize on mount
  onMount(() => {
    if (auth.pnp?.isWalletConnected()) {
      // Get the account from the auth store
      const authState = get(auth);
      if (authState.account?.owner) {
        principal = Principal.fromText(authState.account.owner.toText());
      }
    }
    
    // Set initial KONG amount based on miner type
    setTimeout(async () => {
      await setKongAmountForMinerType();
    }, 0);
  });
  
  // Watch for changes in minerParams
  $: if (minerParams) {
    (async () => {
      await setKongAmountForMinerType();
    })();
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
      
      if (!kongAmount || parseFloat(kongAmount) <= 0) {
        console.warn("Invalid KONG amount for T-Cycles calculation:", kongAmount);
        return 0;
      }
      
      // Get KONG to TCYCLES quote
      const kongE8s = SwapService.toBigInt(kongAmount, KONG_DECIMALS);
      console.log("KONG amount in E8s:", kongE8s.toString());
      
      const quoteResult = await SwapService.getKongToTCyclesQuote(kongE8s, KONG_DECIMALS, TCYCLES_DECIMALS);
      console.log("TCYCLES quote result:", quoteResult);
      
      // The receiveAmount is already in T-Cycles format (not raw cycles)
      tcyclesAmount = quoteResult.receiveAmount;
      console.log("TCYCLES amount calculated:", tcyclesAmount);
      
      // Parse the T-Cycles value directly (no need to divide by 1e12 again)
      const tcyclesValue = parseFloat(tcyclesAmount);
      console.log("T-Cycles value:", tcyclesValue);
      
      // Ensure we're setting a string value with 2 decimal places
      const formattedTCycles = tcyclesValue.toFixed(2);
      console.log(`Calculated T-Cycles (formatted): ${formattedTCycles}`);
      
      // Set the values
      estimatedTCycles = formattedTCycles;
      
      // Set the KONG to TCYCLES rate for reference (T-Cycles per KONG)
      const rate = tcyclesValue / parseFloat(kongAmount);
      console.log("T-Cycles per KONG rate:", rate);
      
      // Format with 6 decimal places
      kongTCyclesRate = rate.toFixed(6);
      console.log("Formatted T-Cycles rate:", kongTCyclesRate);
      
      return tcyclesValue;
    } catch (error) {
      console.error("Error calculating T-Cycles:", error);
      // Set default values in case of error
      estimatedTCycles = "0";
      kongTCyclesRate = "0";
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
    addLog("Starting miner deployment process using TCYCLES...");
    isProcessing = true;
    
    try {
      // Step 1: Swap KONG to TCYCLES
      await swapKongToTCyclesAndContinue();
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
          await swapKongToTCyclesAndContinue();
          break;
        case processSteps.SWAP_KONG_TO_TCYCLES:
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
  
  // Step 1: Swap KONG to TCYCLES
  async function swapKongToTCyclesAndContinue() {
    currentStep = processSteps.SWAP_KONG_TO_TCYCLES;
    addLog(`Swapping ${kongAmount} KONG to TCYCLES...`);
    
    try {
      // Recalculate if needed to get the latest rates
      if (!estimatedTCycles || estimatedTCycles === "0") {
        await calculateEstimatedTCycles();
      }
      
      // Perform the actual KONG to TCYCLES swap
      const kongE8s = SwapService.toBigInt(kongAmount, KONG_DECIMALS);
      
      addLog(`Initiating swap of ${kongAmount} KONG to TCYCLES...`);
      const swapResult = await SwapService.swapKongToTCycles(
        kongE8s,
        2.0 // Default max slippage of 2%
      );
      
      // Update with actual received TCYCLES amount
      // SwapService.fromBigInt converts from raw cycles to T-Cycles format
      actualTCyclesReceived = SwapService.fromBigInt(swapResult, TCYCLES_DECIMALS);
      tcyclesAmount = actualTCyclesReceived;
      
      // The value is already in T-Cycles format, no need to divide by 1e12 again
      const tcyclesValue = parseFloat(actualTCyclesReceived);
      const formattedTCycles = tcyclesValue.toFixed(2);
      
      addLog(`Successfully swapped ${kongAmount} KONG to ${formattedTCycles} T-Cycles`);
      
      // Save progress
      lastSuccessfulStep = processSteps.SWAP_KONG_TO_TCYCLES;
      
      // Continue to next step
      await createCanisterAndContinue();
    } catch (error) {
      handleError("Failed to swap KONG to TCYCLES", error);
    }
  }
  
  // Step 2: Create Canister using TCYCLES
  async function createCanisterAndContinue() {
    currentStep = processSteps.CREATE_CANISTER;
    addLog("Creating miner canister using TCYCLES...");
    
    try {
      // Convert tcyclesAmount to bigint (in cycles)
      // Since tcyclesAmount is in T-Cycles format, we need to convert it to raw cycles
      // This means multiplying by 1e12 (which SwapService.toBigInt does with TCYCLES_DECIMALS)
      const cyclesAmount = SwapService.toBigInt(tcyclesAmount, TCYCLES_DECIMALS);
      console.log("Converting T-Cycles to raw cycles for canister creation:", {
        tcyclesAmount,
        rawCycles: cyclesAmount.toString()
      });
      
      // Log subnet selection if available
      if (selectedSubnetId) {
        addLog(`Creating canister on subnet ${selectedSubnetId} (${selectedSubnetType || 'Unknown type'})`);
      }
      
      // Format T-Cycles for display (already in T-Cycles format)
      const tcyclesValue = parseFloat(tcyclesAmount);
      const formattedTCycles = tcyclesValue.toFixed(2);
      
      addLog(`Creating canister with ${formattedTCycles} T-Cycles`);
      
      // Get principal
      if (!principal) {
        throw new Error("Principal not available for canister creation");
      }
      
      // Create options object for TCyclesService.createCanister
      const options: any = {
        controllers: [principal]
      };
      
      // Add subnet selection if available
      if (selectedSubnetId) {
        console.log(`Using subnet ID for deployment: ${selectedSubnetId}`);
        options.subnetId = selectedSubnetId;
      } else if (selectedSubnetType) {
        console.log(`Using subnet type for deployment: ${selectedSubnetType}`);
        options.subnetType = selectedSubnetType;
      }
      
      // Create a new canister using the TCyclesService
      addLog("Sending TCYCLES to create canister...");
      const canisterPrincipal = await TCyclesService.createCanister(cyclesAmount, options);
      
      // Extract the canister ID from the response
      canisterId = canisterPrincipal.toText();
      
      addLog(`Successfully created canister with ID: ${canisterId}`);
      
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

      // Register the canister with the API after successful initialization
      try {
        addLog("Registering miner canister with API...");
        const registerResult = await registerCanister(
          principal,
          canisterId,
          'miner'
        );
        
        if (registerResult.success) {
          addLog("Successfully registered miner canister with API");
        } else {
          addLog(`Warning: Failed to register miner canister with API: ${registerResult.error}`);
          // Continue anyway since this is not critical
        }
      } catch (apiError) {
        addLog(`Warning: Error registering miner canister with API: ${apiError.message}`);
        // Continue anyway since this is not critical
      }
      
      // If a token ID was provided, try to connect the miner to it
      if (minerParams.tokenCanisterId) {
        try {
          addLog(`Connecting miner to token ${minerParams.tokenCanisterId}...`);
          
          // Create an actor for the miner
          const minerActor = await auth.getActor(canisterId, idlFactory, { requiresSigning: true });
          
          // Convert the token canister ID to a Principal
          const tokenPrincipal = Principal.fromText(minerParams.tokenCanisterId);
          
          // Connect the miner to the token
          const connectResult = await minerActor.connect_token(tokenPrincipal);
          
          if ('Ok' in connectResult) {
            addLog("Successfully connected miner to token");
          } else {
            addLog(`Warning: Failed to connect miner to token: ${connectResult.Err}`);
            // Continue anyway since this is not critical
          }
        } catch (connectError) {
          addLog(`Warning: Error connecting miner to token: ${connectError.message}`);
          // Continue anyway since this is not critical
        }
      }
      
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
  export async function setKongAmountForMinerType() {
    if (!minerParams || !minerParams.minerType) return;
    
    try {
      // Calculate how much KONG is needed for 1T cycles
      const comparisonData = await TCyclesService.calculateKongForCanister();
      
      // Set KONG amount to the amount needed for 1T cycles via TCYCLES path
      // This ensures the user will get approximately 1T cycles
      kongAmount = comparisonData.kongViaTCycles;
      
      console.log(`Miner type set: ${JSON.stringify(minerParams.minerType)}`);
      console.log(`KONG amount set to get 1T cycles: ${kongAmount}`);
      
      // Recalculate the estimated T-Cycles based on the new KONG amount
      await calculateEstimatedTCycles();
    } catch (error) {
      console.error("Error setting KONG amount:", error);
      // Fallback to default amount
      kongAmount = "100";
    }
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