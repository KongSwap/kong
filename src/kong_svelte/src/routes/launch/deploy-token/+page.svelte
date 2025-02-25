<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import { writable } from "svelte/store";
  import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle, Loader2, ExternalLink } from "lucide-svelte";
  import Tooltip from "$lib/components/common/Tooltip.svelte";
  
  import { Principal } from "@dfinity/principal";
  import { Actor, HttpAgent } from "@dfinity/agent";
  import { idlFactory as swapIdl } from "$lib/constants/swap.did.js";
  import { idlFactory as ledgerIDL } from "$lib/constants/icp_ledger.did.js";
  import { idlFactory as tokenBackendIDL } from "$lib/constants/token_backend.did.js";
  import { SwapService } from "$lib/services/swap/SwapService";
  import { getWalletIdentity } from "$lib/utils/wallet";
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  
  // States for the token deployment process
  const PROCESS_STEPS = {
    PREPARING: 0,
    SWAP_KONG_TO_ICP: 1,
    CREATE_CANISTER: 2,
    DEPLOY_TOKEN: 3,
    COMPLETED: 4,
    ERROR: -1
  };

  // Step display information
  const stepInfo = [
    { name: "Preparing", description: "Loading token parameters" },
    { name: "Swap KONG to ICP", description: "Convert KONG tokens to ICP" },
    { name: "Send ICP to CMC", description: "Send ICP to the Cycles Minting Canister" },
    { name: "Create Canister", description: "Create a new canister on the IC" },
    { name: "Deploy Token", description: "Install token code to the canister" },
    { name: "Starting Ledger", description: "Create a ledger for the token" },
    { name: "Genesis Block", description: "Generate the genesis block for the token" },
    { name: "Completed", description: "Token creation successful" }
  ];

  // Token parameters from URL query
  let tokenParams: any = null;
  let currentStep = PROCESS_STEPS.PREPARING;
  let errorMessage = "";
  let errorDetails = "";
  let processingMessage = "";
  let isProcessing = false;
  
  // Deployment data
  let kongAmount = "200"; // Fixed amount for token deployment - 200 KONG
  let icpAmount = "0"; 
  let canisterId = "";
  let kongIcpRate = "0"; // Rate from KONG to ICP
  let estimatedTCycles = "0"; // Estimated T-cycles for canister creation
  let deploymentLog = writable<string[]>([]);
  let actualIcpReceived = "0"; // Actual ICP received from swap
  
  // Wallet and identity
  let walletIdentity = null;
  let principal = null;
  
  // Constants for the IC mainnet
  const CMC_CANISTER_ID = "rkp4c-7iaaa-aaaaa-aaaca-cai"; // Cycles Minting Canister ID
  const CREATE_CANISTER_MEMO = 1095062083n; // Memo for canister creation
  const KONG_DECIMALS = 8;
  const ICP_DECIMALS = 8;
  const IC_HOST = "https://icp0.io";
  
  // Wasm module constants
  const COMPRESSED_WASM_URL = "/wasms/token_backend/token_backend.wasm.gz";
  let wasmModule: ArrayBuffer | null = null;
  
  // Get wallet identity from auth service
  async function getIdentity() {
    try {
      const auth = await import("$lib/services/auth");
      if (!auth.auth?.pnp?.isWalletConnected()) {
        throw new Error("Wallet not connected");
      }
      
      const identity = getWalletIdentity(auth.auth.pnp);
      if (!identity) {
        throw new Error("Failed to get wallet identity");
      }
      
      principal = identity.getPrincipal();
      return identity;
    } catch (error) {
      console.error("Error getting identity:", error);
      throw new Error("Failed to get identity: " + error.message);
    }
  }
  
  // Load the token_backend wasm module
  async function loadWasmModule() {
    try {
      addLog("Fetching token_backend WASM module");
      const response = await fetch(COMPRESSED_WASM_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM module: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      addLog(`WASM module fetched (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
      return arrayBuffer;
    } catch (error) {
      console.error("Error loading WASM module:", error);
      throw new Error("Failed to load WASM module: " + error.message);
    }
  }
  
  // Get KONG to ICP swap quote
  async function getKongToIcpQuote() {
    try {
      addLog("Getting KONG to ICP swap quote");
      const kongAmountE8s = SwapService.toBigInt(kongAmount, KONG_DECIMALS);
      const quote = await SwapService.getKongToIcpQuote(
        kongAmountE8s,
        KONG_DECIMALS,
        ICP_DECIMALS
      );
      
      // Calculate rate (ICP per KONG)
      kongIcpRate = (Number(quote.receiveAmount) / Number(kongAmount)).toFixed(8);
      // Set estimated ICP amount
      icpAmount = quote.receiveAmount;
      
      // Roughly 1 ICP = 1 T Cycles (XDR rate varies but this is a good approximation)
      estimatedTCycles = (parseFloat(icpAmount)).toFixed(2);
      
      addLog(`Swap quote: ${kongAmount} KONG ≈ ${icpAmount} ICP (rate: 1 KONG = ${kongIcpRate} ICP)`);
      return true;
    } catch (error) {
      console.error("Error getting swap quote:", error);
      throw new Error("Failed to get swap quote: " + error.message);
    }
  }

  // Adapt token parameters to match expected format
  function adaptTokenParameters(params) {
    // Prepare the init arguments based on deploy_token_backend.sh format
    return {
      name: params.name,
      ticker: params.ticker,
      total_supply: BigInt(params.total_supply),
      logo: params.logo ? [params.logo] : [],
      decimals: params.decimals,
      transfer_fee: params.transfer_fee,
      archive_options: null,
      initial_block_reward: BigInt(params.initial_block_reward),
      block_time_target_seconds: params.block_time_target_seconds,
      halving_interval: params.difficulty_adjustment_blocks // Renamed to match expected param name
    };
  }
  
  // Initialization
  onMount(async () => {
    try {
      // Extract token parameters from URL
      const paramsString = $page.url.searchParams.get("params");
      if (!paramsString) {
        throw new Error("No token parameters provided");
      }
      
      // Parse and adapt token parameters
      const rawParams = JSON.parse(decodeURIComponent(paramsString));
      tokenParams = adaptTokenParameters(rawParams);
      console.log("Token parameters:", tokenParams);
      
      // Fixed amount for token deployment - 200 KONG
      kongAmount = "200";
      
      // Connect to wallet and get identity
      walletIdentity = await getIdentity();
      
      // Get swap quote for 200 KONG to ICP
      await getKongToIcpQuote();
      
      // Fetch WASM module in background
      wasmModule = await loadWasmModule();
      
      // Move to swap step
      currentStep = PROCESS_STEPS.SWAP_KONG_TO_ICP;
    } catch (error) {
      console.error("Error initializing token deployment:", error);
      currentStep = PROCESS_STEPS.ERROR;
      errorMessage = "Failed to load token parameters";
      errorDetails = error.message || "Unknown error";
    }
  });
  
  // Add a log entry
  function addLog(message: string) {
    deploymentLog.update(logs => [...logs, message]);
  }
  
  // Execute KONG to ICP swap
  async function executeKongSwap() {
    try {
      processingMessage = "Swapping KONG to ICP...";
      addLog(`Starting KONG to ICP swap (${kongAmount} KONG)`);
      
      // Convert KONG amount to E8s
      const kongAmountE8s = SwapService.toBigInt(kongAmount, KONG_DECIMALS);
      addLog(`KONG amount in E8s: ${kongAmountE8s}`);
      
      // Execute the swap
      const icpE8s = await SwapService.swapKongToIcp(kongAmountE8s, 2.0);
      actualIcpReceived = SwapService.fromBigInt(icpE8s, ICP_DECIMALS);
      
      // Adjust for transfer fee (10000 E8s)
      const transferFee = 10000n;
      const adjustedIcpE8s = icpE8s - transferFee;
      const adjustedIcp = SwapService.fromBigInt(adjustedIcpE8s, ICP_DECIMALS);
      
      addLog(`Swap successful! Received ${actualIcpReceived} ICP`);
      addLog(`Available for canister creation: ${adjustedIcp} ICP (after transfer fee)`);
      
      return adjustedIcpE8s;
    } catch (error) {
      console.error("Error executing KONG swap:", error);
      throw new Error("Failed to swap KONG to ICP: " + error.message);
    }
  }
  
  // Store canister in cache
  function storeCanisterInCache(canisterId, tokenData) {
    try {
      // Get existing deployed canisters from cache or initialize empty array
      const existingCanisters = JSON.parse(localStorage.getItem('deployedTokenCanisters') || '[]');
      
      // Create entry with timestamp and token data
      const canisterEntry = {
        id: canisterId,
        tokenName: tokenData.name,
        tokenSymbol: tokenData.ticker,
        deploymentTimestamp: Date.now(),
        totalSupply: tokenData.total_supply.toString(),
        decimals: tokenData.decimals
      };
      
      // Add to array and store back in localStorage
      existingCanisters.push(canisterEntry);
      localStorage.setItem('deployedTokenCanisters', JSON.stringify(existingCanisters));
      
      addLog(`Canister ${canisterId} stored in cache`);
    } catch (error) {
      console.error("Error storing canister in cache:", error);
      addLog(`Warning: Failed to store canister in cache: ${error.message}`);
      // Non-critical error, don't interrupt the flow
    }
  }
  
  // Create a canister using ICP
  async function createCanister(icpE8s: bigint) {
    try {
      processingMessage = "Creating canister...";
      addLog(`Preparing ICP transfer to CMC (${CMC_CANISTER_ID})`);
      
      if (!walletIdentity) {
        walletIdentity = await getIdentity();
      }
      
      // Get the principal that will control the canister
      const principal = walletIdentity.getPrincipal();
      
      // Send ICP to CMC with the CREATE_CANISTER memo
      addLog(`Sending ${SwapService.fromBigInt(icpE8s, ICP_DECIMALS)} ICP to CMC with memo ${CREATE_CANISTER_MEMO}`);
      const result = await IcrcService.transferIcpToCmc(icpE8s, principal, CREATE_CANISTER_MEMO);
      
      if ("Ok" in result) {
        const blockIndex = BigInt(result.Ok.toString());
        addLog(`ICP transfer successful. Block index: ${blockIndex}`);
        
        // Notify CMC to create canister
        addLog("Notifying CMC to create canister...");
        const { createCanister, getDefaultCanisterSettings } = await import("$lib/services/canister");
        
        // Canister creation settings
        // TODO! force this to be on kong subnet
        // later we will give the user the option to choose subnet
        const notifyArgs: any = {
          blockIndex,
          controller: principal,
          subnet_selection: [], // random subnet
          subnet_type: [],
          settings: getDefaultCanisterSettings(principal)
        };
        
        const auth = await import("$lib/services/auth");
        const newCanisterId = await createCanister(auth.auth.pnp, notifyArgs);
        canisterId = newCanisterId.toText();
        
        addLog(`Canister created successfully with ID: ${canisterId}`);
        
        // Store the new canister in cache
        if (tokenParams) {
          storeCanisterInCache(canisterId, tokenParams);
        }
        
        return newCanisterId;
      } else {
        throw new Error(typeof result.Err === 'object' ? JSON.stringify(result.Err) : String(result.Err));
      }
    } catch (error) {
      console.error("Error creating canister:", error);
      throw new Error("Failed to create canister: " + error.message);
    }
  }
  
  // Install WASM module to a canister
  async function installWasm(canisterIdPrincipal, wasmModule, initArgs) {
    try {
      if (!walletIdentity) {
        walletIdentity = await getIdentity();
      }
      
      const agent = new HttpAgent({
        host: IC_HOST,
        identity: walletIdentity
      });
      
      await agent.fetchRootKey().catch(console.error);
      
      // Create management canister actor
      const managementCanister = Actor.createActor(
        ({ IDL }) => {
          const canisterId = IDL.Principal;
          const definiteCanisterSettings = IDL.Record({
            controllers: IDL.Vec(IDL.Principal),
            compute_allocation: IDL.Nat,
            memory_allocation: IDL.Nat,
            freezing_threshold: IDL.Nat
          });
          const canisterSettings = IDL.Record({
            controllers: IDL.Opt(IDL.Vec(IDL.Principal)),
            compute_allocation: IDL.Opt(IDL.Nat),
            memory_allocation: IDL.Opt(IDL.Nat),
            freezing_threshold: IDL.Opt(IDL.Nat)
          });
          const wasm_module = IDL.Vec(IDL.Nat8);
          
          return IDL.Service({
            canister_status: IDL.Func([IDL.Record({ canister_id: canisterId })], 
              [IDL.Record({
                status: IDL.Variant({
                  running: IDL.Null,
                  stopping: IDL.Null,
                  stopped: IDL.Null
                }),
                memory_size: IDL.Nat,
                cycles: IDL.Nat,
                settings: definiteCanisterSettings,
                module_hash: IDL.Opt(IDL.Vec(IDL.Nat8)),
                idle_cycles_burned_per_day: IDL.Nat
              })], 
              []
            ),
            create_canister: IDL.Func([IDL.Record({ settings: IDL.Opt(canisterSettings) })], 
              [IDL.Record({ canister_id: canisterId })], 
              []
            ),
            delete_canister: IDL.Func([IDL.Record({ canister_id: canisterId })], [], []),
            deposit_cycles: IDL.Func([IDL.Record({ canister_id: canisterId })], [], []),
            install_code: IDL.Func([
              IDL.Record({
                arg: IDL.Vec(IDL.Nat8),
                wasm_module: wasm_module,
                mode: IDL.Variant({
                  install: IDL.Null,
                  reinstall: IDL.Null,
                  upgrade: IDL.Null
                }),
                canister_id: canisterId
              })
            ], [], []),
            provisional_create_canister_with_cycles: IDL.Func([
              IDL.Record({
                settings: IDL.Opt(canisterSettings),
                amount: IDL.Opt(IDL.Nat)
              })
            ], [IDL.Record({ canister_id: canisterId })], []),
            provisional_top_up_canister: IDL.Func([
              IDL.Record({
                canister_id: canisterId,
                amount: IDL.Nat
              })
            ], [], []),
            raw_rand: IDL.Func([], [IDL.Vec(IDL.Nat8)], []),
            start_canister: IDL.Func([IDL.Record({ canister_id: canisterId })], [], []),
            stop_canister: IDL.Func([IDL.Record({ canister_id: canisterId })], [], []),
            uninstall_code: IDL.Func([IDL.Record({ canister_id: canisterId })], [], []),
            update_settings: IDL.Func([
              IDL.Record({
                canister_id: IDL.Principal,
                settings: canisterSettings
              })
            ], [], [])
          });
        },
        {
          agent,
          canisterId: Principal.fromText("aaaaa-aa")
        }
      );
      
      // Serialize init args to Candid
      const { IDL } = await import('@dfinity/candid');
      
      // Create the token initialization arguments
      const initArgsBuffer = await (async () => {
        // Define the token initialization arguments schema
        const TokenInitArgs = IDL.Record({
          name: IDL.Text,
          ticker: IDL.Text,
          total_supply: IDL.Nat,
          logo: IDL.Opt(IDL.Text),
          decimals: IDL.Nat8,
          transfer_fee: IDL.Nat,
          archive_options: IDL.Opt(
            IDL.Record({
              num_blocks_to_archive: IDL.Nat64,
              trigger_threshold: IDL.Nat64,
              controller_id: IDL.Principal
            })
          ),
          initial_block_reward: IDL.Nat,
          block_time_target_seconds: IDL.Nat64,
          halving_interval: IDL.Nat64
        });
        
        // Prepare the arguments
        const args = {
          name: initArgs.name,
          ticker: initArgs.ticker,
          total_supply: initArgs.total_supply,
          logo: initArgs.logo.length > 0 ? [initArgs.logo[0]] : [],
          decimals: initArgs.decimals,
          transfer_fee: initArgs.transfer_fee,
          archive_options: initArgs.archive_options,
          initial_block_reward: initArgs.initial_block_reward,
          block_time_target_seconds: initArgs.block_time_target_seconds,
          halving_interval: initArgs.halving_interval
        };
        
        // Use the proper Candid encoding approach
        return IDL.encode([TokenInitArgs], [args]);
      })();
      
      // Install the code
      addLog(`Installing WASM module to canister ${canisterIdPrincipal.toText()}`);
      await managementCanister.install_code({
        arg: initArgsBuffer,
        wasm_module: new Uint8Array(wasmModule),
        mode: { install: null },
        canister_id: canisterIdPrincipal
      });
      
      addLog("WASM module installed successfully");
      return true;
    } catch (error) {
      console.error("Error installing WASM module:", error);
      throw new Error("Failed to install WASM module: " + error.message);
    }
  }
  
  // Install token code to canister
  async function installTokenCode(canisterIdPrincipal) {
    try {
      processingMessage = "Installing token code...";
      
      if (!wasmModule) {
        addLog("WASM module not loaded, fetching now...");
        wasmModule = await loadWasmModule();
      }
      
      addLog("Preparing token initialization parameters");
      
      const agent = new HttpAgent({
        host: IC_HOST,
        identity: walletIdentity
      });
      
      await agent.fetchRootKey().catch(console.error);
      
      // Install the token_backend wasm to the canister
      addLog(`Installing token code to canister ${canisterIdPrincipal.toText()}`);
    
      // Convert token params for initialization
      const initArgs = {
        name: tokenParams.name,
        ticker: tokenParams.ticker,
        total_supply: tokenParams.total_supply,
        logo: tokenParams.logo,
        decimals: tokenParams.decimals,
        transfer_fee: tokenParams.transfer_fee,
        archive_options: null,
        initial_block_reward: tokenParams.initial_block_reward,
        block_time_target_seconds: tokenParams.block_time_target_seconds,
        halving_interval: tokenParams.halving_interval
      };
      
      // For logging - format nicely
      const formattedArgs = JSON.stringify({
        ...initArgs,
        total_supply: initArgs.total_supply.toString(),
        initial_block_reward: initArgs.initial_block_reward.toString()
      }, null, 2);
      
      addLog(`Initializing token with parameters: ${formattedArgs}`);
      
      // Install the code with the initialization arguments
      await installWasm(canisterIdPrincipal, wasmModule, initArgs);
      
      addLog("Token code installed successfully");
      return true;
    } catch (error) {
      console.error("Error installing token code:", error);
      throw new Error("Failed to install token code: " + error.message);
    }
  }
  
  // Start the token deployment process
  async function startDeployment() {
    try {
      isProcessing = true;
      
      // Step 1: Swap KONG to ICP
      currentStep = PROCESS_STEPS.SWAP_KONG_TO_ICP;
      addLog("Step 1: Swapping KONG to ICP");
      const adjustedIcpE8s = await executeKongSwap();
      
      // Step 2: Create canister via CMC
      currentStep = PROCESS_STEPS.CREATE_CANISTER;
      addLog("Step 2: Creating canister with ICP");
      const canisterIdPrincipal = await createCanister(adjustedIcpE8s);
      
      // Step 3: Install token code
      currentStep = PROCESS_STEPS.DEPLOY_TOKEN;
      addLog("Step 3: Installing token code to canister");
      await installTokenCode(canisterIdPrincipal);
      
      // Success!
      currentStep = PROCESS_STEPS.COMPLETED;
      addLog("🎉 Token creation completed successfully!");
      addLog(`Your token is now available at canister ID: ${canisterId}`);
      addLog(`You can view it on the IC Dashboard: https://dashboard.internetcomputer.org/canister/${canisterId}`);
      
    } catch (error) {
      console.error("Error during token deployment:", error);
      currentStep = PROCESS_STEPS.ERROR;
      errorMessage = "Token deployment failed";
      errorDetails = error.message || "Unknown error";
      addLog(`❌ Error: ${error.message || "Unknown error"}`);
    } finally {
      isProcessing = false;
      processingMessage = "";
    }
  }
  
  // Handle cancellation
  function handleCancel() {
    goto("/launch");
  }
</script>

<div class="grid gap-6 lg:grid-cols-12 max-w-[1200px] mx-auto">
  <!-- Left sidebar with step navigation -->
  <div class="lg:col-span-3">
    <div class="sticky flex flex-col gap-5 top-6">
      <!-- Back button -->
      <button 
        on:click={handleCancel}
        class="flex items-center gap-2 px-3 py-2 transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light/10"
      >
        <ArrowLeft size={18} />
        <span>Back to Launch</span>
      </button>
      
      <!-- Deployment steps navigation -->
      <div class="transition-all duration-200 border rounded-xl bg-kong-bg-secondary/50 border-kong-border/30 backdrop-blur-sm">
        <div class="p-3 space-y-1">
          {#each stepInfo as info, index}
            {@const isActive = currentStep === index}
            {@const isCompleted = currentStep > index}
            {@const isError = currentStep === PROCESS_STEPS.ERROR && index === currentStep - 1}
            
            <div class={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 
              ${isActive ? 'bg-kong-primary/10 text-kong-primary font-medium border border-kong-primary/20' : 
              isCompleted ? 'text-kong-primary/80' : 'text-kong-text-secondary/60'}`}>
              
              <div class={`w-9 h-9 rounded-full flex items-center justify-center
                ${isActive ? 'bg-kong-primary text-white' : 
                isCompleted ? 'bg-kong-accent-green text-white' : 
                isError ? 'bg-kong-accent-red text-white' : 
                'bg-kong-bg-light/10 text-kong-text-secondary'}`}>
                
                {#if isCompleted}
                  <CheckCircle size={18} />
                {:else if isProcessing && isActive}
                  <Loader2 size={18} class="animate-spin" />
                {:else if isError}
                  <AlertTriangle size={18} />
                {:else}
                  {index + 1}
                {/if}
              </div>
              
              <div class="text-left">
                <span class="block text-sm">{info.name}</span>
                <span class="text-xs opacity-70">{info.description}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Deployment info -->
      <div class="p-5 transition-all duration-200 border rounded-xl bg-kong-bg-secondary/30 border-kong-border/30 backdrop-blur-sm">
        <div class="space-y-3">
          <h3 class="text-sm font-medium">Token Deployment Info</h3>
          
          <div class="flex items-center justify-between">
            <span class="text-xs text-kong-text-secondary">KONG Amount:</span>
            <span class="text-xs font-medium">{kongAmount} KONG</span>
          </div>
          
          <div class="flex items-center justify-between">
            <span class="text-xs text-kong-text-secondary">Est. ICP:</span>
            <span class="text-xs font-medium">{icpAmount} ICP</span>
          </div>
          
          {#if actualIcpReceived !== "0" && actualIcpReceived !== icpAmount}
            <div class="flex items-center justify-between">
              <span class="text-xs text-kong-text-secondary">Actual ICP Received:</span>
              <span class="text-xs font-medium text-kong-accent-green">{actualIcpReceived} ICP</span>
            </div>
          {/if}
          
          <div class="flex items-center justify-between">
            <span class="text-xs text-kong-text-secondary">Est. T-Cycles:</span>
            <span class="text-xs font-medium">{estimatedTCycles}T</span>
          </div>
          
          {#if canisterId}
            <div class="pt-2 mt-2 border-t border-kong-border/30">
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Canister ID:</span>
                <div class="flex items-center gap-1">
                  <span class="font-mono text-xs text-kong-primary">{canisterId.slice(0, 8)}...{canisterId.slice(-4)}</span>
                  <a href={`https://dashboard.internetcomputer.org/canister/${canisterId}`} target="_blank" rel="noopener noreferrer"
                     class="text-kong-primary hover:text-kong-primary/80" aria-label="View on IC Dashboard">
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          {/if}
          
          {#if tokenParams}
            <div class="pt-2 mt-2 border-t border-kong-border/30">
              <div class="flex items-center justify-between">
                <span class="text-xs text-kong-text-secondary">Token Name:</span>
                <span class="text-xs font-medium">{tokenParams.name} ({tokenParams.ticker})</span>
              </div>
            </div>
          {/if}
          
          {#if currentStep >= PROCESS_STEPS.SWAP_KONG_TO_ICP && $deploymentLog.length > 0}
            <div class="pt-2 mt-2 border-t border-kong-border/30">
              <div class="text-xs text-kong-text-secondary">Current Process:</div>
              <div class="mt-1 text-xs font-medium">
                {#if isProcessing}
                  <div class="flex items-center gap-1.5">
                    <Loader2 size={10} class="animate-spin text-kong-primary" />
                    <span>{processingMessage || "Processing..."}</span>
                  </div>
                {:else if currentStep === PROCESS_STEPS.COMPLETED}
                  <div class="flex items-center gap-1.5 text-kong-accent-green">
                    <CheckCircle size={10} />
                    <span>Deployment Complete</span>
                  </div>
                {:else if currentStep === PROCESS_STEPS.ERROR}
                  <div class="flex items-center gap-1.5 text-kong-accent-red">
                    <AlertTriangle size={10} />
                    <span>Error Occurred</span>
                  </div>
                {:else}
                  <span>{stepInfo[currentStep]?.name || "Processing..."}</span>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Main content area -->
  <div class="pr-2 overflow-auto lg:col-span-9">
    <div class="w-full">
      <Panel variant="solid" type="main" className="p-6 backdrop-blur-xl">
        <!-- Token deployment content -->
        <div class="space-y-6">
          <div class="flex flex-col px-2">
            <h1 class="text-2xl font-bold">Deploy Your Token</h1>
            <p class="text-kong-text-secondary">
              {#if currentStep === PROCESS_STEPS.PREPARING}
                Loading token parameters...
              {:else if currentStep === PROCESS_STEPS.COMPLETED}
                Your token has been successfully deployed!
              {:else if currentStep === PROCESS_STEPS.ERROR}
                There was an error during the token deployment process.
              {:else}
                Follow the steps to deploy your token to the Internet Computer.
              {/if}
            </p>
          </div>
          
          {#if currentStep === PROCESS_STEPS.ERROR}
            <!-- Error state -->
            <div class="p-4 border rounded-lg bg-kong-accent-red/10 border-kong-accent-red/30">
              <div class="flex items-start gap-3">
                <AlertTriangle class="flex-shrink-0 mt-0.5 text-kong-accent-red" size={20} />
                <div>
                  <h3 class="font-medium text-kong-accent-red">{errorMessage}</h3>
                  <p class="mt-1 text-sm text-kong-text-secondary">{errorDetails}</p>
                  <button 
                    on:click={handleCancel}
                    class="px-4 py-2 mt-3 text-sm font-medium transition-colors rounded-lg bg-kong-accent-red/20 text-kong-accent-red hover:bg-kong-accent-red/30"
                  >
                    Return to Launch Page
                  </button>
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Connection status warning if needed -->
          {#if currentStep === PROCESS_STEPS.SWAP_KONG_TO_ICP && (!walletIdentity || !principal)}
            <div class="p-4 border rounded-lg bg-yellow-500/10 border-yellow-500/30">
              <div class="flex items-start gap-3">
                <AlertTriangle class="flex-shrink-0 mt-0.5 text-yellow-500" size={20} />
                <div>
                  <h3 class="font-medium text-yellow-500">Wallet not connected</h3>
                  <p class="mt-1 text-sm text-kong-text-secondary">Please connect your wallet to continue with token deployment.</p>
                </div>
              </div>
            </div>
          {/if}
          
          {#if currentStep === PROCESS_STEPS.SWAP_KONG_TO_ICP}
            <!-- Step 1: Swap KONG to ICP -->
            <div class="p-5 border rounded-lg bg-kong-bg-light/10 border-kong-border/20">
              <h3 class="text-lg font-medium">Step 1: Swap KONG to ICP</h3>
              <p class="mt-2 text-sm text-kong-text-secondary">
                To create a canister and deploy your token, you need to convert KONG to ICP.
                The ICP will be used to create the canister and provision it with cycles.
              </p>
              
              <div class="grid gap-4 mt-4 md:grid-cols-2">
                <div class="p-4 border rounded-lg bg-kong-bg-dark/40 border-kong-border/30">
                  <h4 class="text-sm font-medium">KONG Amount</h4>
                  <p class="mt-1 text-2xl font-bold text-kong-primary">{kongAmount} <span class="text-xs text-kong-text-secondary">KONG</span></p>
                </div>
                
                <div class="relative p-4 border rounded-lg bg-kong-bg-dark/40 border-kong-border/30">
                  <div class="absolute top-0 right-0 flex items-center mt-2 mr-3">
                    <div class="flex items-center px-2 py-1 text-xs text-blue-500 rounded-full bg-blue-500/20">
                      <span>Rate: 1 KONG = {kongIcpRate} ICP</span>
                    </div>
                  </div>
                  
                  <h4 class="text-sm font-medium">ICP Amount (Estimated)</h4>
                  <p class="mt-1 text-2xl font-bold text-blue-500">{icpAmount} <span class="text-xs text-kong-text-secondary">ICP</span></p>
                </div>
              </div>
              
              <div class="p-4 mt-4 border rounded-lg bg-kong-bg-dark/40 border-kong-border/30">
                <h4 class="mb-3 text-sm font-medium">Deployment Process</h4>
                <ul class="space-y-2 text-sm text-kong-text-secondary">
                  <li class="flex items-start gap-2">
                    <div class="flex items-center justify-center flex-shrink-0 w-5 h-5 mt-0.5 text-xs font-medium rounded-full bg-kong-primary text-white">1</div>
                    <span>Swap {kongAmount} KONG for approximately {icpAmount} ICP</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <div class="flex items-center justify-center flex-shrink-0 w-5 h-5 mt-0.5 text-xs font-medium rounded-full bg-kong-accent-blue text-white">2</div>
                    <span>Send ICP to Cycles Minting Canister to create a new canister</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <div class="flex items-center justify-center flex-shrink-0 w-5 h-5 mt-0.5 text-xs font-medium rounded-full bg-kong-accent-green text-white">3</div>
                    <span>Install token backend code and initialize with your token parameters</span>
                  </li>
                </ul>
              </div>
              
              <div class="flex items-center gap-3 p-3 mt-4 rounded-lg bg-yellow-500/10">
                <AlertTriangle class="flex-shrink-0 text-yellow-500" size={16} />
                <p class="text-xs text-yellow-500">
                  Once started, this process cannot be stopped. The exact ICP amount received 
                  after the swap may vary based on current rates.
                </p>
              </div>
              
              <div class="flex justify-between mt-6">
                <button 
                  on:click={handleCancel}
                  class="px-4 py-2 font-medium transition-colors bg-transparent border rounded-lg border-kong-border hover:bg-kong-bg-light/20"
                >
                  Cancel
                </button>
                
                <button 
                  on:click={startDeployment}
                  class="flex items-center gap-2 px-6 py-2 font-medium text-white transition-colors rounded-lg bg-kong-primary hover:bg-kong-primary/90"
                >
                  Start Deployment
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          {/if}
          
          {#if currentStep > PROCESS_STEPS.SWAP_KONG_TO_ICP && currentStep <= PROCESS_STEPS.COMPLETED}
            <!-- Deployment log -->
            <div class="p-5 border rounded-lg bg-kong-bg-dark/50 border-kong-border/30">
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-medium">Deployment Log</h3>
                {#if isProcessing}
                  <div class="flex items-center gap-2 px-2 py-1 text-xs text-blue-500 rounded-full bg-blue-500/20">
                    <Loader2 size={12} class="animate-spin" />
                    <span>{processingMessage}</span>
                  </div>
                {/if}
              </div>
              
              <div class="overflow-auto font-mono text-xs rounded-lg text-kong-text-secondary bg-black/30 max-h-80">
                <div class="p-4 space-y-1">
                  {#each $deploymentLog as logEntry}
                    <div class="flex">
                      <span class="mr-2 text-gray-500">{new Date().toLocaleTimeString()}</span>
                      <span class={logEntry.includes("Error") ? "text-kong-accent-red" : 
                             logEntry.includes("completed successfully") ? "text-kong-accent-green" : 
                             logEntry.includes("🎉") ? "text-kong-accent-green" : 
                             "text-gray-300"}>{logEntry}</span>
                    </div>
                  {/each}
                  
                  {#if isProcessing}
                    <div class="flex">
                      <span class="mr-2 text-gray-500">{new Date().toLocaleTimeString()}</span>
                      <span class="flex items-center text-blue-400">
                        <Loader2 size={12} class="mr-2 animate-spin" />
                        Processing...
                      </span>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
          
          {#if currentStep === PROCESS_STEPS.COMPLETED}
            <!-- Completion card -->
            <div class="p-5 border rounded-lg bg-kong-accent-green/10 border-kong-accent-green/30">
              <div class="flex items-start gap-3">
                <CheckCircle class="flex-shrink-0 mt-0.5 text-kong-accent-green" size={20} />
                <div>
                  <h3 class="font-medium text-kong-accent-green">Token Deployment Successful!</h3>
                  <p class="mt-1 text-sm text-kong-text-secondary">
                    Your token "{tokenParams?.name}" ({tokenParams?.ticker}) has been successfully deployed to 
                    the Internet Computer with canister ID: <span class="font-mono text-kong-primary">{canisterId}</span>
                  </p>
                  
                  <div class="flex flex-wrap gap-3 mt-4">
                    <a 
                      href={`https://dashboard.internetcomputer.org/canister/${canisterId}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      View on IC Dashboard
                      <ExternalLink size={14} />
                    </a>
                    
                    <button
                      on:click={() => goto("/launch")}
                      class="px-4 py-2 text-sm font-medium transition-colors border rounded-lg border-kong-border bg-kong-bg-light/10 hover:bg-kong-bg-light/20"
                    >
                      Return to Launch Page
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Token Details Summary -->
            <div class="p-5 border rounded-lg bg-kong-bg-light/10 border-kong-border/20">
              <h3 class="mb-3 font-medium">Token Details</h3>
              
              <div class="grid gap-4 md:grid-cols-2">
                <div class="p-3 rounded-lg bg-kong-bg-dark/30">
                  <span class="text-xs text-kong-text-secondary">Name:</span>
                  <div class="text-sm font-medium">{tokenParams?.name}</div>
                </div>
                
                <div class="p-3 rounded-lg bg-kong-bg-dark/30">
                  <span class="text-xs text-kong-text-secondary">Symbol:</span>
                  <div class="text-sm font-medium">{tokenParams?.ticker}</div>
                </div>
                
                <div class="p-3 rounded-lg bg-kong-bg-dark/30">
                  <span class="text-xs text-kong-text-secondary">Total Supply:</span>
                  <div class="text-sm font-medium">{tokenParams?.total_supply.toLocaleString()} {tokenParams?.ticker}</div>
                </div>
                
                <div class="p-3 rounded-lg bg-kong-bg-dark/30">
                  <span class="text-xs text-kong-text-secondary">Decimals:</span>
                  <div class="text-sm font-medium">{tokenParams?.decimals?.[0] || 8}</div>
                </div>
                
                <div class="p-3 rounded-lg bg-kong-bg-dark/30">
                  <span class="text-xs text-kong-text-secondary">Transfer Fee:</span>
                  <div class="text-sm font-medium">
                    {tokenParams?.transfer_fee ? 
                      (tokenParams.transfer_fee[0] / Math.pow(10, tokenParams.decimals[0])).toFixed(tokenParams.decimals[0]) : 
                      "0"} {tokenParams?.ticker}
                  </div>
                </div>
                
                <div class="p-3 rounded-lg bg-kong-bg-dark/30">
                  <span class="text-xs text-kong-text-secondary">Block Reward:</span>
                  <div class="text-sm font-medium">{tokenParams?.initial_block_reward.toLocaleString()} {tokenParams?.ticker}</div>
                </div>
                
                <div class="p-3 rounded-lg bg-kong-bg-dark/30">
                  <span class="text-xs text-kong-text-secondary">Block Time:</span>
                  <div class="text-sm font-medium">{tokenParams?.block_time_target_seconds} seconds</div>
                </div>
                
                <div class="p-3 rounded-lg bg-kong-bg-dark/30">
                  <span class="text-xs text-kong-text-secondary">Difficulty Adjustment:</span>
                  <div class="text-sm font-medium">Every {tokenParams?.difficulty_adjustment_blocks.toLocaleString()} blocks</div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </Panel>
    </div>
  </div>
</div>
