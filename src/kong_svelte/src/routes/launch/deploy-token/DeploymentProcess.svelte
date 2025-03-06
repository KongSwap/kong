<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { Principal } from "@dfinity/principal";
  import { IDL } from "@dfinity/candid";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { auth } from "$lib/services/auth";
  import { InstallService } from "$lib/services/canister/install_wasm";
  import type { WasmMetadata } from "$lib/services/canister/install_wasm";
  import { fetchICPtoXDRRates } from "$lib/services/canister/ic-api";
  import { createCanister } from "$lib/services/canister/create_canister";
import { registerCanister } from "$lib/api/canisters";
  import { idlFactory } from "$declarations/token_backend/token_backend.did.js";
  import { canisterStore } from "$lib/stores/canisters";
  import { deploymentHistoryStore, type DeploymentHistoryEntry as StoreDeploymentHistoryEntry } from "$lib/stores/deploymentHistory";
  import { automaticMode } from "$lib/stores/deploymentMode";

  // Extend WasmMetadata type to include the properties we need
  interface TokenWasmMetadata {
    wasmModule: Uint8Array;
    initArgs: any;
    initArgsType: any;
    path: string;
    description: string;
  }

  // Receive process steps from parent
  export let processSteps: {
    PREPARING: number;
    SWAP_KONG_TO_ICP: number;
    CREATE_CANISTER: number;
    DEPLOY_TOKEN: number;
    INITIALIZE_TOKEN: number;
    COMPLETED: number;
    ERROR: number;
  };

  // Props
  export let tokenParams: any;
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
  
  // Props for manual mode
  export let onStepComplete = (step: number) => {};
  export let deploymentId: string | null = null;

  // Track last log message to avoid duplicates
  let lastLogMessage = "";
  
  // Flag to track if we've already calculated T-Cycles
  let hasCalculatedTCycles = false;

  // Storage keys
  const STORAGE_KEYS = {
    TOKEN_PARAMS: "kong_token_deployment_params",
    DEPLOYMENT_STEP: "kong_token_deployment_step",
    DEPLOYMENT_LOG: "kong_token_deployment_log",
    KONG_AMOUNT: "kong_token_deployment_kong_amount",
    ICP_AMOUNT: "kong_token_deployment_icp_amount",
    CANISTER_ID: "kong_token_deployment_canister_id",
    ACTUAL_ICP: "kong_token_deployment_actual_icp",
    SWAP_SUCCESSFUL: "kong_token_deployment_swap_successful",
    ADJUSTED_ICP_E8S: "kong_token_deployment_adjusted_icp_e8s",
    LAST_SUCCESSFUL_STEP: "kong_token_deployment_last_successful_step",
    DEPLOYMENT_HISTORY: "kong_token_deployment_history" // Add storage for deployment history
  };

  // Generate a unique deployment ID
  function generateDeploymentId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  // Wasm module constants
  const COMPRESSED_WASM_URL = "/wasms/token_backend/token_backend.wasm.gz";
  let wasmModule: ArrayBuffer | null = null;

  // Constants for conversion
  const KONG_DECIMALS = 8;
  const ICP_DECIMALS = 8;

  // Create a store for the token actor
  let tokenActor: any = null;

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

  // Define a structure for recording step completion
  interface DeploymentHistoryEntry {
    step: number;
    stepName: string;
    timestamp: number;
    success: boolean;
    data?: any;
    error?: string;
  }
  
  // Get step name from step number
  function getStepName(step: number): string {
    const stepMap = {
      [processSteps.PREPARING]: "Preparing",
      [processSteps.SWAP_KONG_TO_ICP]: "Swap KONG to ICP",
      [processSteps.CREATE_CANISTER]: "Create Canister",
      [processSteps.DEPLOY_TOKEN]: "Deploy Token",
      [processSteps.INITIALIZE_TOKEN]: "Initialize Token",
      [processSteps.COMPLETED]: "Completed",
      [processSteps.ERROR]: "Error"
    };
    return stepMap[step] || "Unknown";
  }
  
  // Add entry to deployment history
  function addToDeploymentHistory(step: number, success: boolean, data?: any, error?: string) {
    // Create new entry
    const entry: DeploymentHistoryEntry = {
      step,
      stepName: getStepName(step),
      timestamp: Date.now(),
      success,
      data,
      error
    };
    
    // Add to store if we have a deployment ID
    if (deploymentId) {
      deploymentHistoryStore.addStep(deploymentId, entry);
    }
    
    // Also maintain backward compatibility with session storage
    if (browser) {
      // Get existing history
      const historyStr = sessionStorage.getItem(STORAGE_KEYS.DEPLOYMENT_HISTORY) || "[]";
      let history: DeploymentHistoryEntry[] = [];
      
      try {
        history = JSON.parse(historyStr);
      } catch (err) {
        console.error("Error parsing deployment history:", err);
        history = [];
      }
      
      // Add to history
      history.push(entry);
      
      // Save updated history
      const safeStringify = (obj: any) => {
        return JSON.stringify(obj, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        );
      };
      
      sessionStorage.setItem(STORAGE_KEYS.DEPLOYMENT_HISTORY, safeStringify(history));
    }
  }
  
  // Function to save deployment state
  function saveDeploymentState() {
    if (browser) {
      sessionStorage.setItem(STORAGE_KEYS.DEPLOYMENT_STEP, currentStep.toString());
      sessionStorage.setItem(STORAGE_KEYS.LAST_SUCCESSFUL_STEP, lastSuccessfulStep.toString());
      if (tokenParams) {
        // Create a safe serializer for tokenParams to handle BigInt values
        const safeStringify = (obj: any) => {
          return JSON.stringify(obj, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value
          );
        };
        
        try {
          sessionStorage.setItem(STORAGE_KEYS.TOKEN_PARAMS, safeStringify(tokenParams));
        } catch (error) {
          console.error("Error serializing token params:", error);
          // Attempt to create a safer copy of the object without BigInt values
          const safeTokenParams = { ...tokenParams };
          // Convert specific known BigInt properties
          Object.keys(safeTokenParams).forEach(key => {
            if (typeof safeTokenParams[key] === 'bigint') {
              safeTokenParams[key] = safeTokenParams[key].toString();
            }
          });
          sessionStorage.setItem(STORAGE_KEYS.TOKEN_PARAMS, JSON.stringify(safeTokenParams));
        }
      }
      sessionStorage.setItem(STORAGE_KEYS.KONG_AMOUNT, kongAmount);
      sessionStorage.setItem(STORAGE_KEYS.ICP_AMOUNT, icpAmount);
      sessionStorage.setItem(STORAGE_KEYS.ACTUAL_ICP, actualIcpReceived);
      if (canisterId) {
        sessionStorage.setItem(STORAGE_KEYS.CANISTER_ID, canisterId);
      }
    }
  }

  // Function to calculate estimated T-Cycles from KONG amount
  async function calculateEstimatedTCycles() {
    // Skip if we've already calculated and have a value
    if (hasCalculatedTCycles && estimatedTCycles && estimatedTCycles !== "0" && estimatedTCycles !== "...") {
      console.log("Skipping T-Cycles calculation, already have value:", estimatedTCycles);
      return parseFloat(estimatedTCycles);
    }
    
    const logMessage = "Calculating estimated T-Cycles...";
    if (lastLogMessage !== logMessage) {
      addLog(logMessage);
      lastLogMessage = logMessage;
    }
    console.log("Starting T-Cycles calculation, current value:", estimatedTCycles);
    
    try {
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
      
      // Calculate the XDR amount
      const icpValue = parseFloat(icpAmount);
      const xdrAmount = icpValue * xdrPerIcp;
      
      // Step 3: XDR to T-Cycles (1 XDR = 1T cycles)
      const tCycles = xdrAmount;
      
      // Ensure we're setting a string value with 2 decimal places
      const formattedTCycles = tCycles.toFixed(2);
      console.log(`Calculated T-Cycles: ${formattedTCycles}`);
      
      // Directly set the value without setTimeout
      estimatedTCycles = formattedTCycles;
      console.log("Updated estimatedTCycles to:", estimatedTCycles);
      
      // Set the KONG to ICP rate for reference
      kongIcpRate = (icpValue / parseFloat(kongAmount)).toFixed(6);
      
      // Mark as calculated
      hasCalculatedTCycles = true;
      
      const conversionMessage = `Estimated conversion: ${kongAmount} KONG → ${icpAmount} ICP → ${xdrAmount.toFixed(4)} XDR → ${formattedTCycles}T cycles`;
      if (lastLogMessage !== conversionMessage) {
        addLog(conversionMessage);
        lastLogMessage = conversionMessage;
      }
      return tCycles;
    } catch (error) {
      console.error("Error calculating T-Cycles:", error);
      const errorMessage = `Error calculating T-Cycles: ${error.message}`;
      if (lastLogMessage !== errorMessage) {
        addLog(errorMessage);
        lastLogMessage = errorMessage;
      }
      
      // Set a non-zero value even on error to avoid showing 0T
      estimatedTCycles = "...";
      console.log("Set estimatedTCycles to loading state due to error");
      
      throw error;
    }
  }

  // Function to execute KONG to ICP swap
  async function executeKongSwap() {
    const startMessage = "Starting KONG to ICP swap...";
    if (lastLogMessage !== startMessage) {
      addLog(startMessage);
      lastLogMessage = startMessage;
    }
    
    try {
      // Step 1: KONG to ICP conversion
      const convertMessage = `Converting ${kongAmount} KONG to ICP`;
      if (lastLogMessage !== convertMessage) {
        addLog(convertMessage);
        lastLogMessage = convertMessage;
      }
      
      const kongE8s = SwapService.toBigInt(kongAmount, KONG_DECIMALS);
      
      // Get quote first
      const quoteResult = await SwapService.getKongToIcpQuote(kongE8s, KONG_DECIMALS, ICP_DECIMALS);
      const icpEstimate = quoteResult.receiveAmount;
      
      // Execute the swap
      const swapMessage = `Swapping ${kongAmount} KONG for approximately ${icpEstimate} ICP`;
      if (lastLogMessage !== swapMessage) {
        addLog(swapMessage);
        lastLogMessage = swapMessage;
      }
      
      const swapResult = await SwapService.swapKongToIcp(kongE8s);
        // const swapResult = 12000000 // 0.12 icp test fast
      
      // Handle different result formats - ensure we're working with a bigint
      let actualIcpE8s;
      if (!swapResult) {
        throw new Error("Swap failed: received null or undefined result");
      }

      // At this point, swapResult is definitely not null
      const nonNullSwapResult = swapResult as any;

      if (typeof nonNullSwapResult === 'object' && 'Ok' in nonNullSwapResult) {
        // Result is a variant type with Ok/Err
        const okValue = nonNullSwapResult.Ok;
        actualIcpE8s = typeof okValue === 'bigint' ? okValue : BigInt(okValue.toString());
      } else if (typeof nonNullSwapResult === 'bigint') {
        // Result is already a bigint
        actualIcpE8s = nonNullSwapResult;
      } else if (typeof nonNullSwapResult === 'string') {
        // Result is a string that we need to convert to bigint
        actualIcpE8s = BigInt(nonNullSwapResult);
      } else if (typeof nonNullSwapResult === 'number') {
        // Result is a number that we need to convert to bigint
        actualIcpE8s = BigInt(Math.floor(nonNullSwapResult));
      } else {
        throw new Error(`Swap failed or returned unexpected format: ${JSON.stringify(nonNullSwapResult, (_, v) => 
          typeof v === 'bigint' ? v.toString() : v)}`);
      }
      
      const actualIcp = SwapService.fromBigInt(actualIcpE8s, ICP_DECIMALS);
      actualIcpReceived = actualIcp;
      
      const successMessage = `Successfully received ${actualIcp} ICP`;
      if (lastLogMessage !== successMessage) {
        addLog(successMessage);
        lastLogMessage = successMessage;
      }
      
      // Step 2: ICP to XDR conversion
      const xdrRatesResponse = await fetchICPtoXDRRates();
      
      // Extract the rate value from the response
      const xdrRateValue = getXDRRate(xdrRatesResponse.icp_xdr_conversion_rates);
      
      // XDR rate is in 10,000ths, so divide by 10,000 to get the actual rate
      const xdrPerIcp = xdrRateValue / 10000;
      
      const rateMessage = `Current XDR rate: 1 ICP = ${xdrPerIcp.toFixed(4)} XDR`;
      if (lastLogMessage !== rateMessage) {
        addLog(rateMessage);
        lastLogMessage = rateMessage;
      }
      
      // Calculate XDR amount
      const icpValue = parseFloat(actualIcp);
      const xdrAmount = icpValue * xdrPerIcp;
      
      // Step 3: XDR to T-Cycles (1 XDR = 1T cycles)
      const tCycles = xdrAmount;
      estimatedTCycles = tCycles.toFixed(2);
      
      const conversionMessage = `Conversion complete: ${kongAmount} KONG → ${actualIcp} ICP → ${xdrAmount.toFixed(4)} XDR → ${estimatedTCycles}T cycles`;
      if (lastLogMessage !== conversionMessage) {
        addLog(conversionMessage);
        lastLogMessage = conversionMessage;
      }
      
      return actualIcpE8s;
    } catch (error) {
      console.error("Error executing KONG to ICP swap:", error);
      
      const errorMessage = `Error executing swap: ${error.message}`;
      if (lastLogMessage !== errorMessage) {
        addLog(errorMessage);
        lastLogMessage = errorMessage;
      }
      
      throw error;
    }
  }

  // Function to create canister with ICP
  async function createCanisterWithIcp(icpE8s: bigint) {
    const startMessage = "Creating canister with ICP...";
    if (lastLogMessage !== startMessage) {
      addLog(startMessage);
      lastLogMessage = startMessage;
    }
    
    const principal = await getPrincipal();
    
    // Send ICP to CMC and create canister in one step
    const sendMessage = `Creating canister with ${SwapService.fromBigInt(icpE8s, ICP_DECIMALS)} ICP (${estimatedTCycles}T cycles)`;
    if (lastLogMessage !== sendMessage) {
      addLog(sendMessage);
      lastLogMessage = sendMessage;
    }
    
    // Get default canister settings - format according to CMC's expected format
    // Include all required fields from the CanisterSettings record
    const settings = {
      controllers: [principal], // Array of principals (not nested array)
      freezing_threshold: [],
      memory_allocation: [],
      compute_allocation: [],
      wasm_memory_threshold: [],
      reserved_cycles_limit: [],
      log_visibility: [],
      wasm_memory_limit: []
    };
    
    // Create args for canister creation
    const createArgs = {
      amount: icpE8s,
      controller: principal,
      settings,
      // Specify the subnet ID for token deployment
      // subnet_id: "pzp6e-ekpqk-3c5x7-2h6so-njoeq-mt45d-h3h6c-q3mxf-vpeq5-fk5o7-yae"
      subnet_id: "4ecnw-byqwz-dtgss-ua2mh-pfvs7-c3lct-gtf4e-hnu75-j7eek-iifqm-sqe"
    };
    
    try {
      // Create the canister directly using the imported function
      const newCanisterId = await createCanister(createArgs);
      
      const successMessage = `Canister created successfully with ID: ${newCanisterId.toText()}`;
      if (lastLogMessage !== successMessage) {
        addLog(successMessage);
        lastLogMessage = successMessage;
      }
      
      canisterId = newCanisterId.toText();
      
      return newCanisterId;
    } catch (error) {
      const errorMsg = `Failed to create canister: ${error.message}`;
      addLog(errorMsg);
      lastLogMessage = errorMsg;
      throw error;
    }
  }

  // Function to process tokenParams for BigInt values
  function processTokenParamsForBigInt(tokenParams: any) {
    // Create a deep copy to avoid modifying the original
    const processedParams = JSON.parse(JSON.stringify(tokenParams, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    ));
    
    // Convert string numbers back to BigInt for fields that need to be BigInt
    const bigIntFields = ['initial_block_reward', 'block_time_target_seconds', 'halving_interval', 'total_supply'];
    
    bigIntFields.forEach(field => {
      if (processedParams[field] && typeof processedParams[field] === 'string') {
        processedParams[field] = BigInt(processedParams[field]);
      }
    });
    
    // Handle optional fields that might be arrays containing BigInt
    if (processedParams.transfer_fee && processedParams.transfer_fee.length > 0 && 
        typeof processedParams.transfer_fee[0] === 'string') {
      processedParams.transfer_fee[0] = BigInt(processedParams.transfer_fee[0]);
    }
    
    return processedParams;
  }

  // Function to check if canister is installed and ready
  async function verifyCanisterStatus(canisterPrincipal: Principal): Promise<boolean> {
    try {
      const verifyMessage = "Verifying canister status...";
      if (lastLogMessage !== verifyMessage) {
        addLog(verifyMessage);
        lastLogMessage = verifyMessage;
      }
      
      // Create an actor to communicate with the canister
      tokenActor = await createTokenActor(canisterPrincipal);
      
      // Check if the get_info method exists
      if (typeof tokenActor.get_info !== 'function') {
        throw new Error('Token canister does not implement the expected get_info method');
      }
      
      // Call get_info method to verify the canister is responsive
      const infoResult = await tokenActor.get_info();
      
      // Handle the Result_2 variant appropriately
      if (!infoResult || !('Ok' in infoResult)) {
        throw new Error(`Failed to get token info: ${infoResult?.Err || 'Unknown error'}`);
      }
      
      const tokenInfo = infoResult.Ok;
      
      // Log success with some token details
      const verifySuccessMessage = `Verified token canister is active: ${tokenInfo.name || 'Unknown'} (${tokenInfo.ticker || 'Unknown'})`;
      if (lastLogMessage !== verifySuccessMessage) {
        addLog(verifySuccessMessage);
        lastLogMessage = verifySuccessMessage;
      }
      
      return true;
    } catch (error) {
      console.error("Canister verification error:", error);
      const errorMsg = `Canister verification failed: ${error.message}`;
      if (lastLogMessage !== errorMsg) {
        addLog(errorMsg);
        lastLogMessage = errorMsg;
      }
      return false;
    }
  }

  // Function to create token actor
  async function createTokenActor(canisterPrincipal: Principal) {
    try {
      const createActorMsg = "Creating token actor for interaction...";
      if (lastLogMessage !== createActorMsg) {
        addLog(createActorMsg);
        lastLogMessage = createActorMsg;
      }
      
      return await auth.getActor(
        canisterPrincipal.toString(),
        idlFactory,
        { requiresSigning: true }
      );
    } catch (error) {
      console.error("Error creating token actor:", error);
      const errorMsg = `Error creating token actor: ${error.message}`;
      if (lastLogMessage !== errorMsg) {
        addLog(errorMsg);
        lastLogMessage = errorMsg;
      }
      throw error;
    }
  }

  // Function to install token code
  async function installTokenCode(canisterPrincipal: Principal) {
    const loadingMessage = "Loading WASM module...";
    if (lastLogMessage !== loadingMessage) {
      addLog(loadingMessage);
      lastLogMessage = loadingMessage;
    }
    
    if (!wasmModule) {
      const response = await fetch(COMPRESSED_WASM_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM module: ${response.status}`);
      }
      wasmModule = await response.arrayBuffer();
    }
    
    const installMessage = "Installing token code...";
    if (lastLogMessage !== installMessage) {
      addLog(installMessage);
      lastLogMessage = installMessage;
    }
    
    // Process tokenParams to handle BigInt values
    const safeTokenParams = processTokenParamsForBigInt(tokenParams);
    
    // Fix linter error by creating proper init args
    // Use correct IDL structure for init args
    const metadata: TokenWasmMetadata = {
      wasmModule: new Uint8Array(wasmModule),
      initArgs: safeTokenParams,
      initArgsType: IDL.Record({
        name: IDL.Text,
        ticker: IDL.Text,
        decimals: IDL.Opt(IDL.Nat8),
        total_supply: IDL.Nat64,
        transfer_fee: IDL.Opt(IDL.Nat64),
        logo: IDL.Opt(IDL.Text),
        initial_block_reward: IDL.Nat64,
        block_time_target_seconds: IDL.Nat64,
        halving_interval: IDL.Nat64,
        social_links: IDL.Opt(IDL.Vec(IDL.Record({ platform: IDL.Text, url: IDL.Text }))),
        archive_options: IDL.Opt(IDL.Record({}))
      }),
      path: "wasms/token_backend.wasm.gz",
      description: "Token Backend"
    };
    
    await InstallService.installWasm(canisterPrincipal.toString(), metadata as WasmMetadata);
    
    const successMessage = "Token code installed successfully";
    if (lastLogMessage !== successMessage) {
      addLog(successMessage);
      lastLogMessage = successMessage;
    }
  }

  // Function to get principal
  async function getPrincipal() {
    if (!auth.pnp?.isWalletConnected()) {
      throw new Error("Wallet not connected");
    }
    
    // Try to get principal from account.owner (primary method used in IdentityPanel)
    if (auth.pnp.account?.owner) {
      const principal = typeof auth.pnp.account.owner === 'string' 
        ? Principal.fromText(auth.pnp.account.owner) 
        : auth.pnp.account.owner;
      
      console.log("Got principal from account.owner:", principal.toText());
      return principal;
    }
    
    // Fallback methods
    let principal = null;
    
    // Try from activeWallet.principal
    if (auth.pnp.activeWallet?.principal) {
      principal = auth.pnp.activeWallet.principal;
      console.log("Got principal from activeWallet.principal:", principal);
    } 
    // Try from getIdentity
    else if (auth.pnp.getIdentity) {
      try {
        const identity = await auth.pnp.getIdentity();
        principal = identity.getPrincipal();
        console.log("Got principal from getIdentity:", principal);
      } catch (e) {
        console.error("Error getting principal from identity:", e);
      }
    }
    
    if (!principal) {
      // Add debug info
      console.error("Principal not found. Auth state:", {
        isConnected: auth.pnp?.isWalletConnected(),
        hasActiveWallet: !!auth.pnp?.activeWallet,
        hasAccount: !!auth.pnp?.account,
        hasAccountOwner: !!auth.pnp?.account?.owner,
        accountOwnerType: auth.pnp?.account?.owner ? typeof auth.pnp.account.owner : null,
        activeWalletKeys: auth.pnp?.activeWallet ? Object.keys(auth.pnp.activeWallet) : []
      });
      throw new Error("Principal not found");
    }
    
    return principal;
  }

  // Get deployment history
  export function getDeploymentHistory(): DeploymentHistoryEntry[] {
    if (browser) {
      const historyStr = sessionStorage.getItem(STORAGE_KEYS.DEPLOYMENT_HISTORY);
      if (historyStr) {
        try {
          return JSON.parse(historyStr);
        } catch (e) {
          console.error("Error parsing deployment history:", e);
        }
      }
    }
    return [];
  }
  
  // Get the last successful step from history
  export function getLastSuccessfulStepFromHistory(): number {
    const history = getDeploymentHistory();
    let lastSuccessfulStep = processSteps.PREPARING;
    
    // Go through history in reverse to find the most recent successful step
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (entry.success && entry.step > lastSuccessfulStep) {
        lastSuccessfulStep = entry.step;
      }
    }
    
    return lastSuccessfulStep;
  }
  
  // Function to retry deployment
  export async function retryDeployment() {
    isProcessing = true;
    try {
      // Get the last successful step - prefer using our history-based method
      // Fall back to session storage for backward compatibility
      let savedStep = getLastSuccessfulStepFromHistory();
      
      // If no history is available, use the session storage value
      if (savedStep === processSteps.PREPARING && browser) {
        savedStep = parseInt(sessionStorage.getItem(STORAGE_KEYS.LAST_SUCCESSFUL_STEP) || "0");
      }
      
      // Set current step to the next step after the last successful one
      currentStep = savedStep + 1;
      
      // Log the retry attempt
      const retryMessage = `Retrying deployment from step ${currentStep} (${getStepName(currentStep)})`;
      if (lastLogMessage !== retryMessage) {
        addLog(retryMessage);
        lastLogMessage = retryMessage;
      }
      
      // Restore saved data if available
      if (browser) {
        // Restore canister ID if we're past the CREATE_CANISTER step
        if (savedStep >= processSteps.CREATE_CANISTER) {
          // First try to get from history
          const history = getDeploymentHistory();
          const createCanisterEntry = history.find(entry => 
            entry.step === processSteps.CREATE_CANISTER && entry.success && entry.data?.canisterId);
          
          if (createCanisterEntry?.data?.canisterId) {
            canisterId = createCanisterEntry.data.canisterId;
            addLog(`Restored canister ID from history: ${canisterId}`);
          } else {
            // Fall back to session storage
            const savedCanisterId = sessionStorage.getItem(STORAGE_KEYS.CANISTER_ID);
            if (savedCanisterId) {
              canisterId = savedCanisterId;
              addLog(`Restored canister ID: ${canisterId}`);
            }
          }
        }
        
        // Restore ICP amount if we're past the SWAP_KONG_TO_ICP step
        if (savedStep >= processSteps.SWAP_KONG_TO_ICP) {
          // First try to get from history
          const history = getDeploymentHistory();
          const swapEntry = history.find(entry => 
            entry.step === processSteps.SWAP_KONG_TO_ICP && entry.success && entry.data?.actualIcpReceived);
          
          if (swapEntry?.data?.actualIcpReceived) {
            actualIcpReceived = swapEntry.data.actualIcpReceived;
            addLog(`Restored ICP amount from history: ${actualIcpReceived}`);
          } else {
            // Fall back to session storage
            const savedIcpAmount = sessionStorage.getItem(STORAGE_KEYS.ACTUAL_ICP);
            if (savedIcpAmount) {
              actualIcpReceived = savedIcpAmount;
              addLog(`Restored ICP amount: ${actualIcpReceived}`);
            }
          }
        }
      }
      
      // Execute the appropriate step based on the current step
      switch (currentStep) {
        case processSteps.SWAP_KONG_TO_ICP:
          await executeSwapAndContinue();
          break;
        case processSteps.CREATE_CANISTER:
          await createCanisterAndContinue();
          break;
        case processSteps.DEPLOY_TOKEN:
          await deployTokenAndContinue();
          break;
        case processSteps.INITIALIZE_TOKEN:
          await initializeTokenAndContinue();
          break;
        default:
          // If we don't know which step to retry, start from the beginning
          const unknownStepError = `Unknown step to retry: ${currentStep}. Restarting from the beginning.`;
          addLog(unknownStepError);
          lastLogMessage = unknownStepError;
          await startDeployment();
      }
    } catch (error) {
      console.error("Retry error:", error);
      currentStep = processSteps.ERROR;
      errorMessage = error.message;
      errorDetails = error.stack || "";
      const errorMsg = `❌ Error during retry: ${error.message}`;
      if (lastLogMessage !== errorMsg) {
        addLog(errorMsg);
        lastLogMessage = errorMsg;
      }
      
      // Record error in history
      addToDeploymentHistory(currentStep, false, null, error.message);
      saveDeploymentState();
    } finally {
      isProcessing = false;
    }
  }
  
  // Load a previous deployment
  export function loadDeployment(deployment: StoreDeploymentHistoryEntry) {
    // Set deployment ID
    deploymentId = deployment.id;
    
    // Set token parameters if available
    if (deployment.tokenName) tokenParams.name = deployment.tokenName;
    if (deployment.tokenSymbol) tokenParams.ticker = deployment.tokenSymbol;
    
    // Set canister ID if available
    if (deployment.canisterId) {
      canisterId = deployment.canisterId;
      addLog(`Loaded canister ID: ${canisterId}`);
    }
    
    // Find the last successful step
    const steps = deploymentHistoryStore.getSteps(deployment.id);
    const successfulSteps = steps.filter(step => step.success);
    
    if (successfulSteps.length > 0) {
      const lastStep = Math.max(...successfulSteps.map(s => s.step));
      lastSuccessfulStep = lastStep;
      currentStep = lastStep + 1;
      
      // If the last step was INITIALIZE_TOKEN, set to COMPLETED
      if (lastStep === processSteps.INITIALIZE_TOKEN) {
        currentStep = processSteps.COMPLETED;
      }
    } else {
      // Start from the beginning
      lastSuccessfulStep = processSteps.PREPARING;
      currentStep = processSteps.SWAP_KONG_TO_ICP;
    }
    
    // If deployment is already completed, set to completed step
    if (deployment.completed) {
      currentStep = processSteps.COMPLETED;
      lastSuccessfulStep = processSteps.INITIALIZE_TOKEN;
    }
    
    // If there was an error, set error state
    if (deployment.error) {
      errorMessage = deployment.error;
      currentStep = processSteps.ERROR;
    }
    
    // Log the loaded deployment
    addLog(`Loaded deployment: ${deployment.tokenName} (${deployment.tokenSymbol})`);
    addLog(`Current step: ${getStepName(currentStep)}`);
  }
  
  // Execute the current step manually
  export async function executeCurrentStep() {
    if (isProcessing) return;
    
    isProcessing = true;
    try {
      switch (currentStep) {
        case processSteps.SWAP_KONG_TO_ICP:
          await executeSwapAndContinue();
          break;
        case processSteps.CREATE_CANISTER:
          await createCanisterAndContinue();
          break;
        case processSteps.DEPLOY_TOKEN:
          await deployTokenAndContinue();
          break;
        case processSteps.INITIALIZE_TOKEN:
          await initializeTokenAndContinue();
          break;
        default:
          throw new Error(`Unknown step to execute: ${currentStep}`);
      }
    } catch (error) {
      console.error("Step execution error:", error);
      currentStep = processSteps.ERROR;
      errorMessage = error.message;
      errorDetails = error.stack || "";
      const errorMsg = `❌ Error: ${error.message}`;
      if (lastLogMessage !== errorMsg) {
        addLog(errorMsg);
        lastLogMessage = errorMsg;
      }
      
      // Record error in history
      addToDeploymentHistory(currentStep, false, null, error.message);
      
      // Update deployment in store with error
      if (deploymentId) {
        deploymentHistoryStore.updateDeployment(deploymentId, {
          error: error.message,
          completed: false
        });
      }
    } finally {
      isProcessing = false;
    }
  }
  
  // Helper functions for each step of the deployment process
  async function executeSwapAndContinue() {
    currentStep = processSteps.SWAP_KONG_TO_ICP;
    const step1Message = "Step 1: Swapping KONG to ICP";
    if (lastLogMessage !== step1Message) {
      addLog(step1Message);
      lastLogMessage = step1Message;
    }
    saveDeploymentState();
    
    try {
      const icpE8s = await executeKongSwap();
      lastSuccessfulStep = processSteps.SWAP_KONG_TO_ICP;
      
      // Record successful step completion
      addToDeploymentHistory(processSteps.SWAP_KONG_TO_ICP, true, {
        icpE8s: icpE8s.toString(),
        kongAmount,
        actualIcpReceived
      });
      
      saveDeploymentState();
      
      // Notify parent component that step is complete
      onStepComplete(processSteps.SWAP_KONG_TO_ICP);
      
      // Only continue to next step if in automatic mode
      if ($automaticMode) {
        // Continue with next step
        await createCanisterAndContinue(icpE8s);
      }
    } catch (error) {
      // Record failed step
      addToDeploymentHistory(processSteps.SWAP_KONG_TO_ICP, false, null, error.message);
      throw error;
    }
  }
  
  async function createCanisterAndContinue(icpE8s?: bigint) {
    currentStep = processSteps.CREATE_CANISTER;
    const step2Message = "Step 2: Creating canister with ICP";
    if (lastLogMessage !== step2Message) {
      addLog(step2Message);
      lastLogMessage = step2Message;
    }
    saveDeploymentState();
    
    try {
      // If icpE8s is not provided, try to calculate it from actualIcpReceived
      if (!icpE8s && actualIcpReceived) {
        icpE8s = SwapService.toBigInt(actualIcpReceived, ICP_DECIMALS);
      }
      
      if (!icpE8s) {
        throw new Error("ICP amount not available for canister creation");
      }
      
      const canisterPrincipal = await createCanisterWithIcp(icpE8s);
      lastSuccessfulStep = processSteps.CREATE_CANISTER;
      
      // Record successful step completion
      addToDeploymentHistory(processSteps.CREATE_CANISTER, true, {
        canisterId: canisterPrincipal.toString(),
        icpAmount: actualIcpReceived
      });
      
      saveDeploymentState();
      
      // Notify parent component that step is complete
      onStepComplete(processSteps.CREATE_CANISTER);
      
      // Only continue to next step if in automatic mode
      if ($automaticMode) {
        // Continue with next step
        await deployTokenAndContinue(canisterPrincipal);
      }
    } catch (error) {
      // Record failed step
      addToDeploymentHistory(processSteps.CREATE_CANISTER, false, null, error.message);
      throw error;
    }
  }
  
  async function deployTokenAndContinue(canisterPrincipal?: Principal) {
    currentStep = processSteps.DEPLOY_TOKEN;
    const step3Message = "Step 3: Installing token code";
    if (lastLogMessage !== step3Message) {
      addLog(step3Message);
      lastLogMessage = step3Message;
    }
    saveDeploymentState();
    
    try {
      // If canisterPrincipal is not provided, try to get it from canisterId
      if (!canisterPrincipal && canisterId) {
        canisterPrincipal = Principal.fromText(canisterId);
      }
      
      if (!canisterPrincipal) {
        throw new Error("Canister ID not available for token deployment");
      }
      
      await installTokenCode(canisterPrincipal);
      lastSuccessfulStep = processSteps.DEPLOY_TOKEN;
      
      // Record successful step completion
      addToDeploymentHistory(processSteps.DEPLOY_TOKEN, true, {
        canisterId: canisterPrincipal.toString()
      });
      
      saveDeploymentState();
      
      // Notify parent component that step is complete
      onStepComplete(processSteps.DEPLOY_TOKEN);
      
      // Only continue to next step if in automatic mode
      if ($automaticMode) {
        // Continue with next step
        await initializeTokenAndContinue(canisterPrincipal);
      }
    } catch (error) {
      // Record failed step
      addToDeploymentHistory(processSteps.DEPLOY_TOKEN, false, null, error.message);
      throw error;
    }
  }
  
  async function initializeTokenAndContinue(canisterPrincipal?: Principal) {
    currentStep = processSteps.INITIALIZE_TOKEN;
    const step4Message = "Step 4: Initializing token";
    if (lastLogMessage !== step4Message) {
      addLog(step4Message);
      lastLogMessage = step4Message;
    }
    saveDeploymentState();
    
    try {
      // If canisterPrincipal is not provided, try to get it from canisterId
      if (!canisterPrincipal && canisterId) {
        canisterPrincipal = Principal.fromText(canisterId);
      }
      
      if (!canisterPrincipal) {
        throw new Error("Canister ID not available for token initialization");
      }
      
      // Give the canister a few seconds to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify canister is working properly
      const isVerified = await verifyCanisterStatus(canisterPrincipal);
      if (!isVerified) {
        throw new Error("Token canister verification failed. The deployment might not be fully successful.");
      }
      
      // Register the canister with the API after successful initialization
      try {
        const registerMessage = "Registering token canister with API...";
        if (lastLogMessage !== registerMessage) {
          addLog(registerMessage);
          lastLogMessage = registerMessage;
        }
        
        const principal = await getPrincipal();
        const registerResult = await registerCanister(
          principal,
          canisterPrincipal.toString(),
          'token_backend'
        );
        
        if (registerResult.success) {
          const apiSuccessMessage = "Successfully registered token canister with API";
          if (lastLogMessage !== apiSuccessMessage) {
            addLog(apiSuccessMessage);
            lastLogMessage = apiSuccessMessage;
          }
        } else {
          const apiWarningMessage = `Warning: Failed to register token canister with API: ${registerResult.error}`;
          if (lastLogMessage !== apiWarningMessage) {
            addLog(apiWarningMessage);
            lastLogMessage = apiWarningMessage;
          }
        }
      } catch (apiError) {
        const apiErrorMessage = `Warning: Error registering token canister with API: ${apiError.message}`;
        if (lastLogMessage !== apiErrorMessage) {
          addLog(apiErrorMessage);
          lastLogMessage = apiErrorMessage;
        }
      }
      
      lastSuccessfulStep = processSteps.INITIALIZE_TOKEN;
      
      // Record successful step completion
      addToDeploymentHistory(processSteps.INITIALIZE_TOKEN, true, {
        canisterId: canisterPrincipal.toString()
      });
      
      // Complete
      currentStep = processSteps.COMPLETED;
      const completedMessage = "🎉 Token deployment completed successfully!";
      if (lastLogMessage !== completedMessage) {
        addLog(completedMessage);
        lastLogMessage = completedMessage;
      }
      
      // Record completion
      addToDeploymentHistory(processSteps.COMPLETED, true, {
        canisterId: canisterPrincipal.toString(),
        tokenName: tokenParams.name,
        tokenSymbol: tokenParams.ticker
      });
      
      // Update the deployment in the store with completion status and canister ID
      if (deploymentId) {
        deploymentHistoryStore.updateDeployment(deploymentId, {
          canisterId: canisterPrincipal.toString(),
          completed: true
        });
      }
      
      saveDeploymentState();

      // Add the deployed canister to the user's cache
      canisterStore.addCanister({
        id: canisterPrincipal.toString(),
        name: tokenParams.name,
        tags: ["token", tokenParams.ticker],
        createdAt: Date.now(),
        wasmType: "token_backend"
      });
      
      // Inform the user that the canister has been added to their "My Canisters" page
      const addedToMyCanisters = "Token canister has been added to your 'My Canisters' page.";
      if (lastLogMessage !== addedToMyCanisters) {
        addLog(addedToMyCanisters);
        lastLogMessage = addedToMyCanisters;
      }
      
      // Notify parent component that step is complete
      onStepComplete(processSteps.INITIALIZE_TOKEN);
    } catch (error) {
      // Record failed step
      addToDeploymentHistory(processSteps.INITIALIZE_TOKEN, false, null, error.message);
      throw error;
    }
  }

  // Function to start deployment
  export async function startDeployment() {
    isProcessing = true;
    
    // Generate a new deployment ID if not provided
    if (!deploymentId) {
      deploymentId = generateDeploymentId();
    }
    
    // Create a new deployment entry in the store
    deploymentHistoryStore.addDeployment({
      id: deploymentId,
      tokenName: tokenParams.name,
      tokenSymbol: tokenParams.ticker,
      timestamp: Date.now(),
      steps: [],
      completed: false
    });
    
    try {
      // Clear existing deployment history when starting fresh (for backward compatibility)
      if (browser) {
        sessionStorage.setItem(STORAGE_KEYS.DEPLOYMENT_HISTORY, JSON.stringify([]));
      }
      
      // Step 0: Calculate estimated T-Cycles
      currentStep = processSteps.PREPARING;
      const preparingMessage = "Preparing deployment...";
      if (lastLogMessage !== preparingMessage) {
        addLog(preparingMessage);
        lastLogMessage = preparingMessage;
      }
      
      // Record starting state
      addToDeploymentHistory(processSteps.PREPARING, true, {
        startTime: Date.now(),
        tokenName: tokenParams.name,
        tokenSymbol: tokenParams.ticker
      });
      
      saveDeploymentState();
      
      await calculateEstimatedTCycles();
      lastSuccessfulStep = processSteps.PREPARING;
      
      // Start from the beginning
      await executeSwapAndContinue();
    } catch (error) {
      console.error("Deployment error:", error);
      currentStep = processSteps.ERROR;
      errorMessage = error.message;
      errorDetails = error.stack || "";
      const errorMsg = `❌ Error: ${error.message}`;
      if (lastLogMessage !== errorMsg) {
        addLog(errorMsg);
        lastLogMessage = errorMsg;
      }
      
      // Record error in history
      addToDeploymentHistory(currentStep, false, null, error.message);
      
      // Update deployment in store with error
      if (deploymentId) {
        deploymentHistoryStore.updateDeployment(deploymentId, {
          error: error.message,
          completed: false
        });
      }
      
      saveDeploymentState();
      throw error;
    } finally {
      isProcessing = false;
    }
  }

  // Initialize on mount
  onMount(() => {
    const cleanup = async () => {
      if (browser) {
        // Clear any previous deployment state
        Object.values(STORAGE_KEYS).forEach(key => sessionStorage.removeItem(key));
      }
      
      // Set initial values to avoid showing zero
      if (!estimatedTCycles || estimatedTCycles === "0") {
        estimatedTCycles = "...";
        console.log("Initial estimatedTCycles set to:", estimatedTCycles);
      }
      
      // Calculate estimated T-Cycles on load (only once)
      if (!hasCalculatedTCycles) {
        try {
          await calculateEstimatedTCycles();
          hasCalculatedTCycles = true;
          console.log("After calculation, estimatedTCycles is:", estimatedTCycles);
        } catch (error) {
          console.error("Error calculating estimated T-Cycles:", error);
        }
      }
    };
    
    cleanup();
    
    // Prevent multiple calculations by setting up a cleanup function
    return () => {
      hasCalculatedTCycles = true; // Ensure we don't recalculate if component remounts
    };
  });
</script> 
