<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { writable } from "svelte/store";
  import { ArrowLeft, AlertTriangle } from "lucide-svelte";
  import { minerParams } from "$lib/stores/minerParams";
  import { auth } from "$lib/stores/auth";
  import { TCyclesService } from "$lib/services/canister/tcycles-service";
  import { SwapService } from "$lib/services/swap/SwapService";
  
  // Import components
  import DeploymentSteps from "./DeploymentSteps.svelte";
  import DeploymentLog from "./DeploymentLog.svelte";
  import MinerParameters from "./MinerParameters.svelte";
  import DeploymentProcess from "./DeploymentProcess.svelte";
  
  // Create stores
  const deploymentLog = writable<string[]>([]);
  
  // Constants
  const IC_DASHBOARD_BASE_URL = "https://dashboard.internetcomputer.org/canister/";
  
  // Define process steps locally
  const PROCESS_STEPS = {
    PREPARING: 0,
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
  let icpAmount = "0"; 
  let canisterId = "";
  let kongIcpRate = "0"; // Don't set a default rate, let the calculation handle it
  let estimatedTCycles = "0";
  let actualIcpReceived = "0";
  
  // Subnet selection
  let selectedSubnetType = "";
  let selectedSubnetId = "";
  
  // Step display information
  const stepInfo = [
    { name: "Preparing", description: "Loading miner parameters" },
    { name: "Swap KONG to CYCLES", description: "Convert KONG tokens to ICP" },
    { name: "Create Canister", description: "Create and deploy miner canister" },
    { name: "Deploy Miner", description: "Install miner code" },
    { name: "Initialize Miner", description: "Configure miner parameters" },
    { name: "Completed", description: "Miner creation successful" }
  ];
  
  // Component references
  let deploymentLogComponent: DeploymentLog;
  let deploymentProcessComponent: DeploymentProcess;
  
  // Add a new variable to store the fee
  let tcyclesFee = "0";
  const TCYCLES_DECIMALS = 12;
  
  // Function to add a log entry
  function addLog(message: string) {
    deploymentLogComponent?.addLog(message);
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
  onMount(async () => {
    // Get miner parameters from store or set defaults if not available
    currentMinerParams = $minerParams;
    if (!currentMinerParams) {
      // Define MinerType locally to fix linter errors
      type MinerType = { Lite: null } | { Normal: null } | { Premium: null };
      
      // Set default miner parameters
      const defaultParams = {
        owner: null, // Will be set by the backend
        minerType: { Normal: null } as MinerType,
        tokenCanisterId: undefined // No token by default
      };
      
      // Update the store
      minerParams.set(defaultParams);
      currentMinerParams = defaultParams;
    }
      
    // Check wallet connection
    if (!auth.pnp?.isWalletConnected()) {
      errorMessage = "Please connect your wallet to continue";
      currentStep = PROCESS_STEPS.ERROR;
      return;
    }
    
    // Get the fee for canister creation
    try {
      const fee = await TCyclesService.getFee();
      tcyclesFee = SwapService.fromBigInt(fee, TCYCLES_DECIMALS);
    } catch (error) {
      console.error("Error fetching TCycles fee:", error);
    }
  });
  
  // Watch for changes in minerParams
  $: if (currentMinerParams && deploymentProcessComponent) {
    deploymentProcessComponent.setKongAmountForMinerType();
  }
</script>

<div class="deployment-container">
  <header class="deployment-header">
    <button class="back-button" on:click={() => goto("/launch")}>
      <ArrowLeft size={20} />
      <span>Back</span>
    </button>
    <h1 class="text-2xl font-bold">Deploy Miner</h1>
  </header>
  
  {#if errorMessage && currentStep === PROCESS_STEPS.ERROR}
    <div class="error-panel">
      <AlertTriangle class="text-red-500" size={24} />
      <div class="error-content">
        <h3 class="error-title">Deployment Error</h3>
        <p class="error-message">{errorMessage}</p>
        {#if errorDetails}
          <pre class="error-details">{errorDetails}</pre>
        {/if}
        {#if lastSuccessfulStep > PROCESS_STEPS.PREPARING}
          <button class="retry-button" on:click={retryDeployment}>
            Retry from last successful step
          </button>
        {/if}
      </div>
    </div>
  {/if}
          
  <MinerParameters
    minerParams={currentMinerParams}
    {kongAmount}
    {icpAmount}
    {canisterId}
    {kongIcpRate}
    bind:estimatedTCycles
    {actualIcpReceived}
    {IC_DASHBOARD_BASE_URL}
    bind:selectedSubnetType
    bind:selectedSubnetId
  />
  
  <DeploymentSteps
    {currentStep}
    steps={stepInfo}
    processSteps={PROCESS_STEPS}
    {isProcessing}
  />

  
  <DeploymentProcess
    bind:this={deploymentProcessComponent}
    minerParams={currentMinerParams}
    {addLog}
    bind:currentStep
    bind:lastSuccessfulStep
    bind:errorMessage
    bind:errorDetails
    bind:isProcessing
    bind:kongAmount
    bind:icpAmount
    bind:canisterId
    bind:actualIcpReceived
    bind:estimatedTCycles
    bind:kongIcpRate
    {selectedSubnetType}
    {selectedSubnetId}
    processSteps={PROCESS_STEPS}
    on:complete={() => goto("/launch/my-canisters")}
  />
  
  {#if currentStep === PROCESS_STEPS.PREPARING}
    <button 
      class="start-button"
      on:click={startDeployment}
      disabled={isProcessing || !currentMinerParams}
    >
      Start Deployment
    </button>
  {/if}
</div>
              
<style>
  .deployment-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .deployment-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.5rem;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .back-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .error-panel {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: 0.5rem;
    margin-bottom: 2rem;
  }
  
  .error-content {
    flex: 1;
  }
  
  .error-title {
    font-weight: bold;
    color: rgb(239, 68, 68);
    margin-bottom: 0.5rem;
  }
  
  .error-message {
    margin-bottom: 1rem;
  }
  
  .error-details {
    font-family: monospace;
    font-size: 0.875rem;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 0.25rem;
    white-space: pre-wrap;
    overflow-x: auto;
    margin-bottom: 1rem;
  }
  
  .retry-button {
    padding: 0.5rem 1rem;
    background-color: rgba(239, 68, 68, 0.2);
    color: rgb(239, 68, 68);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .retry-button:hover {
    background-color: rgba(239, 68, 68, 0.3);
  }
  
  .start-button {
    display: block;
    width: 100%;
    padding: 0.75rem;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-top: 2rem;
  }
  
  .start-button:hover {
    background-color: #2563eb;
  }
  
  .start-button:disabled {
    background-color: rgba(59, 130, 246, 0.5);
    cursor: not-allowed;
  }
</style> 
