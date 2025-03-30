<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { writable } from "svelte/store";
  import { ArrowLeft, AlertTriangle } from "lucide-svelte";
  import { tokenParams } from "$lib/stores/tokenParams";
  import { auth } from "$lib/stores/auth";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  
  // Import our new components
  import DeploymentSteps from "./DeploymentSteps.svelte";
  import DeploymentLog from "./DeploymentLog.svelte";
  import TokenParameters from "./TokenParameters.svelte";
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
    DEPLOY_TOKEN: 3,
    INITIALIZE_TOKEN: 4,
    COMPLETED: 5,
    ERROR: -1
  };

  // State variables
  let currentTokenParams: any = null;
  let currentStep = PROCESS_STEPS.PREPARING;
  let lastSuccessfulStep = PROCESS_STEPS.PREPARING;
  let errorMessage = "";
  let errorDetails = "";
  let isProcessing = false;
  
  // Deployment data
  let kongAmount = "250"; // Fixed amount for token deployment - 500 KONG TODO: configure based on subnet
  let icpAmount = "0"; 
  let canisterId = "";
  let kongIcpRate = "0";
  let estimatedTCycles = "0";
  let actualIcpReceived = "0";
  
  // Step display information
  const stepInfo = [
    { name: "Preparing", description: "Loading token parameters" },
    { name: "Swap KONG to CYCLES", description: "Convert KONG tokens to ICP" },
    { name: "Create Canister", description: "Create and deploy token canister" },
    { name: "Deploy Token", description: "Install token code" },
    { name: "Initialize Token", description: "Configure token parameters" },
    { name: "Completed", description: "Token creation successful" }
  ];
  
  // Component references
  let deploymentLogComponent: DeploymentLog;
  let deploymentProcessComponent: DeploymentProcess;
  
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
    // Get token parameters from store
    currentTokenParams = $tokenParams;
    if (!currentTokenParams) {
      goto("/launch/create-token");
        return;
      }
      
    // Hide sidebar during deployment
    sidebarStore.collapse();
    
    // Check wallet connection
    if (!auth.pnp?.isWalletConnected()) {
      errorMessage = "Please connect your wallet to continue";
      currentStep = PROCESS_STEPS.ERROR;
          return;
    }
    
    // Set initial value for estimatedTCycles to prevent showing "0"
    if (estimatedTCycles === "0") {
      estimatedTCycles = "...";
    }
  });
</script>

<div class="deployment-container">
  <header class="deployment-header">
    <button class="back-button" on:click={() => goto("/launch/create-token")}>
      <ArrowLeft size={20} />
      <span>Back</span>
      </button>
    <h1 class="text-2xl font-bold">Deploy Token</h1>
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
          
  <TokenParameters
    tokenParams={currentTokenParams}
    {kongAmount}
    {icpAmount}
    {canisterId}
    {kongIcpRate}
    bind:estimatedTCycles
    {actualIcpReceived}
    {IC_DASHBOARD_BASE_URL}
  />
  
  <DeploymentSteps
    {currentStep}
    steps={stepInfo}
    processSteps={PROCESS_STEPS}
    {isProcessing}
  />
  
  <DeploymentLog
    bind:this={deploymentLogComponent}
    logStore={deploymentLog}
  />
  
  <DeploymentProcess
    bind:this={deploymentProcessComponent}
    tokenParams={currentTokenParams}
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
    processSteps={PROCESS_STEPS}
  />
  
  {#if currentStep === PROCESS_STEPS.PREPARING}
                <button 
      class="start-button"
                  on:click={startDeployment}
      disabled={isProcessing || !currentTokenParams}
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
    margin-bottom: 1rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .retry-button {
    padding: 0.5rem 1rem;
    background-color: rgb(239, 68, 68);
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .retry-button:hover {
    background-color: rgb(220, 38, 38);
  }
  
  .start-button {
    width: 100%;
    padding: 1rem;
    background-color: rgb(59, 130, 246);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 2rem;
  }
  
  .start-button:hover:not(:disabled) {
    background-color: rgb(37, 99, 235);
  }
  
  .start-button:disabled {
    background-color: rgba(59, 130, 246, 0.5);
    cursor: not-allowed;
  }
</style>
