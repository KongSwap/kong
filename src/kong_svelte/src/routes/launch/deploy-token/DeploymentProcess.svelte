<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { Principal } from "@dfinity/principal";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  import { auth } from "$lib/services/auth";
  import { InstallService } from "$lib/services/canister/install_wasm";
  import type { WasmMetadata } from "$lib/services/canister/install_wasm";
  import { fetchICPtoXDRRates, getMostRecentXDRRate } from "$lib/services/canister/ic-api";

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
    LAST_SUCCESSFUL_STEP: "kong_token_deployment_last_successful_step"
  };

  // Wasm module constants
  const COMPRESSED_WASM_URL = "/wasms/token_backend/token_backend.wasm.gz";
  let wasmModule: ArrayBuffer | null = null;

  // Function to save deployment state
  function saveDeploymentState() {
    if (browser) {
      sessionStorage.setItem(STORAGE_KEYS.DEPLOYMENT_STEP, currentStep.toString());
      sessionStorage.setItem(STORAGE_KEYS.LAST_SUCCESSFUL_STEP, lastSuccessfulStep.toString());
      if (tokenParams) {
        sessionStorage.setItem(STORAGE_KEYS.TOKEN_PARAMS, JSON.stringify(tokenParams));
      }
      sessionStorage.setItem(STORAGE_KEYS.KONG_AMOUNT, kongAmount);
      sessionStorage.setItem(STORAGE_KEYS.ICP_AMOUNT, icpAmount);
      sessionStorage.setItem(STORAGE_KEYS.ACTUAL_ICP, actualIcpReceived);
      if (canisterId) {
        sessionStorage.setItem(STORAGE_KEYS.CANISTER_ID, canisterId);
      }
    }
  }

  // Function to execute KONG to ICP swap
  async function executeKongSwap() {
    addLog("Starting KONG to ICP swap...");
    const principal = await getPrincipal();
    
    // Convert KONG amount to ICP
    const kongE8s = SwapService.toBigInt(kongAmount, 8);
    const icpE8s = await SwapService.getKongToIcpQuote(kongE8s);
    
    // Execute the swap
    addLog(`Swapping ${kongAmount} KONG for approximately ${SwapService.fromBigInt(icpE8s, 8)} ICP`);
    const result = await SwapService.swapKongToIcp(kongE8s);
    
    if (result && typeof result === 'object' && 'Ok' in result) {
      const actualIcp = SwapService.fromBigInt(icpE8s, 8);
      actualIcpReceived = actualIcp;
      addLog(`Successfully swapped KONG to ${actualIcp} ICP`);
      return icpE8s;
    } else {
      const errorMsg = result && typeof result === 'object' && 'Err' in result 
        ? JSON.stringify(result.Err)
        : 'Unknown error';
      throw new Error(`Swap failed: ${errorMsg}`);
    }
  }

  // Function to create canister with ICP
  async function createCanisterWithIcp(icpE8s: bigint) {
    addLog("Creating canister with ICP...");
    const principal = await getPrincipal();
    
    // Get XDR rate for T-cycles calculation
    const xdrRate = await getMostRecentXDRRate(principal.toString());
    if (xdrRate) {
      const icpAmount = SwapService.fromBigInt(icpE8s, 8);
      const tCycles = parseFloat(icpAmount) * (xdrRate.xdrRate / 10000);
      addLog(`Converting ${icpAmount} ICP to approximately ${tCycles.toFixed(2)}T cycles`);
    }
    
    // Send ICP to CMC
    addLog(`Sending ${SwapService.fromBigInt(icpE8s, 8)} ICP to CMC`);
    const result = await IcrcService.transferIcpToCmc(icpE8s, principal);
    
    if (result && typeof result === 'object' && 'Ok' in result) {
      const blockIndex = BigInt(result.Ok.toString());
      addLog(`ICP transfer successful. Block index: ${blockIndex}`);
      
      // Create canister
      const { createCanister, getDefaultCanisterSettings } = await import("$lib/services/canister/create_canister");
      const notifyArgs = {
        blockIndex,
        controller: principal,
        settings: getDefaultCanisterSettings(principal)
      };
      
      const newCanisterId = await createCanister(notifyArgs);
      addLog(`Canister created successfully with ID: ${newCanisterId.toText()}`);
      canisterId = newCanisterId.toText();
      return newCanisterId;
    } else {
      const errorMsg = result && typeof result === 'object' && 'Err' in result 
        ? JSON.stringify(result.Err)
        : 'Unknown error';
      throw new Error(`Failed to transfer ICP: ${errorMsg}`);
    }
  }

  // Function to install token code
  async function installTokenCode(canisterPrincipal: Principal) {
    addLog("Loading WASM module...");
    if (!wasmModule) {
      const response = await fetch(COMPRESSED_WASM_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM module: ${response.status}`);
      }
      wasmModule = await response.arrayBuffer();
    }
    
    addLog("Installing token code...");
    await InstallService.installWasm(canisterPrincipal.toString(), new Uint8Array(wasmModule), tokenParams);
    addLog("Token code installed successfully");
  }

  // Function to get principal
  async function getPrincipal() {
    if (!auth.pnp?.isWalletConnected()) {
      throw new Error("Wallet not connected");
    }
    const principal = auth.pnp.activeWallet.principal;
    if (!principal) {
      throw new Error("Principal not found");
    }
    return principal;
  }

  // Function to start deployment
  export async function startDeployment() {
    isProcessing = true;
    try {
      // Step 1: Swap KONG to ICP
      currentStep = processSteps.SWAP_KONG_TO_ICP;
      addLog("Step 1: Swapping KONG to ICP");
      saveDeploymentState();
      
      const icpE8s = await executeKongSwap();
      lastSuccessfulStep = processSteps.SWAP_KONG_TO_ICP;
      
      // Step 2: Create canister
      currentStep = processSteps.CREATE_CANISTER;
      addLog("Step 2: Creating canister with ICP");
      saveDeploymentState();
      
      const canisterPrincipal = await createCanisterWithIcp(icpE8s);
      lastSuccessfulStep = processSteps.CREATE_CANISTER;
      
      // Step 3: Deploy token
      currentStep = processSteps.DEPLOY_TOKEN;
      addLog("Step 3: Installing token code");
      saveDeploymentState();
      
      await installTokenCode(canisterPrincipal);
      lastSuccessfulStep = processSteps.DEPLOY_TOKEN;
      
      // Step 4: Initialize token
      currentStep = processSteps.INITIALIZE_TOKEN;
      addLog("Step 4: Initializing token");
      saveDeploymentState();
      await new Promise(resolve => setTimeout(resolve, 2000));
      lastSuccessfulStep = processSteps.INITIALIZE_TOKEN;
      
      // Complete
      currentStep = processSteps.COMPLETED;
      addLog("🎉 Token deployment completed successfully!");
      saveDeploymentState();
      
    } catch (error) {
      console.error("Deployment error:", error);
      currentStep = processSteps.ERROR;
      errorMessage = error.message;
      errorDetails = error.stack || "";
      addLog(`❌ Error: ${error.message}`);
      saveDeploymentState();
      throw error;
    } finally {
      isProcessing = false;
    }
  }

  // Function to retry deployment
  export async function retryDeployment() {
    const savedStep = browser ? parseInt(sessionStorage.getItem(STORAGE_KEYS.LAST_SUCCESSFUL_STEP) || "0") : 0;
    currentStep = savedStep;
    await startDeployment();
  }

  // Initialize on mount
  onMount(() => {
    if (browser) {
      // Clear any previous deployment state
      Object.values(STORAGE_KEYS).forEach(key => sessionStorage.removeItem(key));
    }
  });
</script> 
