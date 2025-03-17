<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { writable } from "svelte/store";
  import { ArrowLeft, AlertTriangle, Info, Cpu, Zap } from "lucide-svelte";
  import { minerParams } from "$lib/stores/minerParams";
  import { auth } from "$lib/services/auth";
  
  // Import components
  import Panel from "$lib/components/common/Panel.svelte";
  import DeploymentSteps from "../deploy-miner/DeploymentSteps.svelte";
  import TCyclesMinerParameters from "../deploy-miner/TCyclesMinerParameters.svelte";
  import TCyclesDeploymentProcess from "../deploy-miner/TCyclesDeploymentProcess.svelte";
  
  // Create stores
  const deploymentLog = writable<string[]>([]);
  
  // Constants
  const IC_DASHBOARD_BASE_URL = "https://dashboard.internetcomputer.org/canister/";
  
  // Define process steps locally
  const PROCESS_STEPS = {
    PREPARING: 0,
    SWAP_KONG_TO_TCYCLES: 1,
    SWAP_KONG_TO_ICP: 1,
    CREATE_CANISTER: 2,
    DEPLOY_MINER: 3,
    INITIALIZE_MINER: 4,
    COMPLETED: 5,
    ERROR: -1
  };

  // State variables
  let currentMinerParams: any = null;
  let currentStep = PROCESS_STEPS.PREPARING;
  let lastSuccessfulStep = PROCESS_STEPS.PREPARING;
  let errorMessage = "";
  let errorDetails = "";
  let isProcessing = false;
  
  // Deployment data
  let kongAmount = "100"; // Fixed price for all miner types
  let tcyclesAmount = "0"; 
  let canisterId = "";
  let kongTCyclesRate = "0";
  let estimatedTCycles = "0";
  let actualTCyclesReceived = "0";
  
  // Subnet selection
  let selectedSubnetType = "";
  let selectedSubnetId = "";
  
  // Step display information
  const stepInfo = [
    { name: "Preparing", description: "Loading miner parameters" },
    { name: "Swap KONG to TCYCLES", description: "Convert KONG tokens to TCYCLES" },
    { name: "Create Canister", description: "Create and deploy miner canister" },
    { name: "Deploy Miner", description: "Install miner code" },
    { name: "Initialize Miner", description: "Configure miner parameters" },
    { name: "Completed", description: "Miner creation successful" }
  ];
  
  // Component references
  let deploymentProcessComponent: TCyclesDeploymentProcess;
  
  // Function to add a log entry (keeping for compatibility with TCyclesDeploymentProcess)
  function addLog(message: string) {
    // We're not displaying logs, but keeping this function for compatibility
    console.log("Deployment log:", message);
  }
  
  // Function to start deployment
  async function startDeployment() {
    try {
      await deploymentProcessComponent.startDeployment();
    } catch (error) {
      console.error("Error during deployment:", error);
    }
  }
  
  // Function to retry deployment
  async function retryDeployment() {
    try {
      await deploymentProcessComponent.retryDeployment();
    } catch (error) {
      console.error("Error during retry:", error);
    }
  }
  
  // Get miner type name for display
  function getMinerTypeName(type: number): string {
    switch (type) {
      case 0: return "Basic Miner";
      case 1: return "Standard Miner";
      case 2: return "Advanced Miner";
      case 3: return "Professional Miner";
      default: return "Unknown Miner";
    }
  }
  
  // Initialize on mount
  onMount(() => {
    // Get miner parameters from store
    const unsubscribe = minerParams.subscribe((params) => {
      currentMinerParams = params;
      console.log("Miner params loaded:", currentMinerParams);
    });
    
    return () => {
      unsubscribe();
    };
  });
</script>

<div class="max-w-5xl mx-auto px-4 py-8">
  <div class="flex items-center mb-8">
    <button 
      class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200 bg-slate-800/50 px-3 py-2 rounded-lg" 
      on:click={() => goto("/launch")}
    >
      <ArrowLeft size={20} />
      <span>Back to Launch</span>
    </button>
    <div class="ml-auto flex items-center">
      <Cpu class="text-blue-400 mr-2" size={24} />
      <h1 class="text-2xl font-bold">Deploy Miner with TCYCLES</h1>
    </div>
  </div>
  
  <!-- Deployment Progress Panel - Moved to top -->
  <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 mb-6 shadow-lg">
    <DeploymentSteps
      {currentStep}
      steps={stepInfo}
      processSteps={PROCESS_STEPS}
      {isProcessing}
    />
  </div>
  
  {#if errorMessage && currentStep === PROCESS_STEPS.ERROR}
    <div class="bg-red-900/20 border border-red-700/30 rounded-lg p-4 mb-6 shadow-lg">
      <div class="flex gap-4">
        <AlertTriangle class="text-red-500 flex-shrink-0" size={24} />
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-red-400 mb-2">Deployment Error</h3>
          <p class="text-red-200 mb-3">{errorMessage}</p>
          {#if errorDetails}
            <pre class="bg-black/30 p-3 rounded text-sm font-mono text-red-200 overflow-x-auto mb-4">{errorDetails}</pre>
          {/if}
          {#if lastSuccessfulStep > PROCESS_STEPS.PREPARING}
            <button 
              class="px-4 py-2 bg-red-900/50 hover:bg-red-800/50 text-red-200 rounded-lg border border-red-700/30 transition-colors duration-200 flex items-center gap-2"
              on:click={retryDeployment}
            >
              <Zap size={16} />
              Retry from last successful step
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Start Deployment Panel - Only shown in PREPARING state -->
  {#if currentStep === PROCESS_STEPS.PREPARING}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div class="md:col-span-2">
        <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden shadow-lg">
          <div class="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 p-4 border-b border-slate-700/50">
            <div class="flex items-center gap-3">
              <Zap class="text-blue-400" size={24} />
              <h2 class="text-xl font-semibold text-white">Deploy Your {currentMinerParams ? getMinerTypeName(currentMinerParams.minerType) : 'Miner'}</h2>
            </div>
          </div>
          
          <div class="p-5">
            <div class="flex gap-4 mb-5">
              <Info class="text-blue-400 flex-shrink-0 mt-1" size={20} />
              <div>
                <h3 class="text-lg font-semibold text-blue-400 mb-2">Using TCYCLES for Canister Creation</h3>
                <p class="text-gray-300 mb-3">
                  This page uses the TCYCLES ledger for canister creation, which is more efficient than the traditional ICP path.
                  TCYCLES are pre-minted cycles that can be used directly to create and top up canisters.
                </p>
                
                <div class="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 mb-4">
                  <h4 class="font-medium text-blue-300 mb-2">Benefits of using TCYCLES:</h4>
                  <ul class="list-disc pl-5 text-gray-300 space-y-1">
                    <li>Lower cost compared to minting new cycles via ICP</li>
                    <li>Faster canister creation process</li>
                    <li>Simplified deployment workflow</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <button 
              class="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg"
              on:click={startDeployment}
              disabled={isProcessing || !currentMinerParams}
            >
              {#if isProcessing}
                <div class="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                Processing...
              {:else}
                <Zap size={18} />
                Start Deployment with TCYCLES
              {/if}
            </button>
          </div>
        </div>
      </div>
      
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden shadow-lg">
        <div class="bg-gradient-to-r from-slate-800/80 to-slate-900/80 p-4 border-b border-slate-700/50">
          <h2 class="text-lg font-semibold text-white">Deployment Summary</h2>
        </div>
        
        <div class="p-4">
          {#if currentMinerParams}
            <div class="flex justify-between py-2 border-b border-slate-700/30">
              <span class="text-gray-400">Miner Type:</span>
              <span class="font-medium">{getMinerTypeName(currentMinerParams.minerType)}</span>
            </div>
          {/if}
          
          <div class="flex justify-between py-2 border-b border-slate-700/30">
            <span class="text-gray-400">KONG Amount:</span>
            <span class="font-medium text-blue-400">{kongAmount} KONG</span>
          </div>
          
          <div class="flex justify-between py-2 border-b border-slate-700/30">
            <span class="text-gray-400">Estimated T-Cycles:</span>
            <span class="font-medium text-blue-400">{estimatedTCycles} T</span>
          </div>
          
          <div class="flex justify-between py-2">
            <span class="text-gray-400">Subnet:</span>
            <span class="font-medium">{selectedSubnetType || "Auto-selected"}</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Miner Parameters Panel -->
  <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden shadow-lg mb-6">
    <TCyclesMinerParameters
      minerParams={currentMinerParams}
      {kongAmount}
      {tcyclesAmount}
      {canisterId}
      {kongTCyclesRate}
      bind:estimatedTCycles
      {actualTCyclesReceived}
      {IC_DASHBOARD_BASE_URL}
      bind:selectedSubnetType
      bind:selectedSubnetId
    />
  </div>
  
  <!-- Hidden deployment process component -->
  <div class="hidden">
    <TCyclesDeploymentProcess
      bind:this={deploymentProcessComponent}
      minerParams={currentMinerParams}
      {addLog}
      bind:currentStep
      bind:lastSuccessfulStep
      bind:errorMessage
      bind:errorDetails
      bind:isProcessing
      bind:kongAmount
      bind:tcyclesAmount
      bind:canisterId
      bind:actualTCyclesReceived
      bind:estimatedTCycles
      bind:kongTCyclesRate
      {selectedSubnetType}
      {selectedSubnetId}
      processSteps={PROCESS_STEPS}
    />
  </div>
  
  <!-- Completed state -->
  {#if currentStep === PROCESS_STEPS.COMPLETED}
    <div class="bg-green-900/20 border border-green-700/30 rounded-lg p-5 mb-6 shadow-lg">
      <div class="text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/50 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-green-400 mb-2">Miner Deployed Successfully!</h2>
        <p class="text-gray-300 mb-6 max-w-lg mx-auto">
          Your miner has been successfully deployed and is ready to use. You can view it in your canisters list or access it directly via the IC Dashboard.
        </p>
        <div class="flex flex-wrap justify-center gap-4">
          <a 
            href="/my-canisters" 
            class="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <Cpu size={18} />
            View My Canisters
          </a>
          {#if canisterId}
            <a 
              href={`${IC_DASHBOARD_BASE_URL}${canisterId}`}
              target="_blank" 
              rel="noopener noreferrer" 
              class="px-6 py-3 bg-blue-900/50 hover:bg-blue-800/50 text-blue-300 font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on IC Dashboard
            </a>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Add any additional styles here if needed */
  :global(.deployment-steps-container) {
    margin-bottom: 0 !important;
  }
</style>