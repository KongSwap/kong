<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { writable } from "svelte/store";
  import { ArrowLeft, AlertTriangle, Info } from "lucide-svelte";
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

<div class="max-w-4xl mx-auto px-4 py-8">
  <div class="flex items-center mb-6">
    <button 
      class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200" 
      on:click={() => goto("/launch")}
    >
      <ArrowLeft size={20} />
      <span>Back to Launch</span>
    </button>
    <h1 class="text-2xl font-bold ml-auto">Deploy Miner with TCYCLES</h1>
  </div>
  
  {#if errorMessage && currentStep === PROCESS_STEPS.ERROR}
    <Panel variant="solid" className="mb-6 border-red-500/30 bg-red-950/20">
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
              class="px-4 py-2 bg-red-900/50 hover:bg-red-800/50 text-red-200 rounded-lg border border-red-700/30 transition-colors duration-200"
              on:click={retryDeployment}
            >
              Retry from last successful step
            </button>
          {/if}
        </div>
      </div>
    </Panel>
  {/if}
  
  <!-- Deployment Progress Panel - Moved to top -->
  <Panel variant="solid" className="mb-6">
    <DeploymentSteps
      {currentStep}
      steps={stepInfo}
      processSteps={PROCESS_STEPS}
      {isProcessing}
    />
  </Panel>
  
  <!-- Start Deployment Panel - Only shown in PREPARING state -->
  {#if currentStep === PROCESS_STEPS.PREPARING}
    <Panel variant="solid" className="mb-6 border-blue-500/30 bg-blue-950/20">
      <div class="flex gap-4">
        <Info class="text-blue-400 flex-shrink-0" size={24} />
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-blue-400 mb-2">Using TCYCLES for Canister Creation</h3>
          <p class="text-gray-300 mb-3">
            This page uses the TCYCLES ledger for canister creation, which can be more efficient than the traditional ICP path.
            TCYCLES are pre-minted cycles that can be used directly to create and top up canisters.
          </p>
          <p class="text-gray-300 mb-2">
            Benefits of using TCYCLES:
          </p>
          <ul class="list-disc pl-5 mb-4 text-gray-300 space-y-1">
            <li>Potentially lower cost compared to minting new cycles via ICP</li>
            <li>Faster canister creation process</li>
          </ul>
          
          <button 
            class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            on:click={startDeployment}
            disabled={isProcessing || !currentMinerParams}
          >
            {#if isProcessing}
              <div class="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
            {/if}
            Start Deployment with TCYCLES
          </button>
        </div>
      </div>
    </Panel>
  {/if}
  
  <!-- Miner Parameters Panel -->
  <Panel variant="solid" className="mb-6">
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
  </Panel>
  
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