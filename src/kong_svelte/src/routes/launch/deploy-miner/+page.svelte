<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { ArrowLeft, AlertTriangle } from "lucide-svelte";
  import { minerParams } from "$lib/stores/minerParams";
  import { auth } from "$lib/stores/auth";

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
  let errorMessage = "";
  let errorDetails = "";
  let isProcessing = false;

  // Deployment data
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

  const startDeployment = async () => {
    console.log("Starting deployment...");
  };

  // Initialize on mount
  onMount(async () => {
    // Get miner parameters from store or set defaults if not available
    currentMinerParams = $minerParams;

    // Check wallet connection
    if (!auth.pnp?.isWalletConnected()) {
      errorMessage = "Please connect your wallet to continue";
      currentStep = PROCESS_STEPS.ERROR;
      return;
    }
  });
</script>

<div class="max-w-[800px] mx-auto p-8">
  <header class="flex items-center gap-4 mb-8">
    <button class="flex items-center gap-2 p-2 rounded-md text-white/80 bg-transparent hover:bg-white/10 transition-colors" on:click={() => goto("/launch")}>
      <ArrowLeft size={20} />
      <span>Back</span>
    </button>
    <h1 class="text-2xl font-bold">Deploy Miner</h1>
  </header>

  {#if errorMessage && currentStep === PROCESS_STEPS.ERROR}
    <div class="flex gap-4 p-6 bg-red-500/10 rounded-md mb-8">
      <AlertTriangle class="text-red-500" size={24} />
      <div class="flex-1">
        <h3 class="font-bold text-red-500 mb-2">Deployment Error</h3>
        <p class="mb-4">{errorMessage}</p>
        {#if errorDetails}
          <pre class="font-mono text-sm p-4 bg-black/20 rounded whitespace-pre-wrap overflow-x-auto mb-4">{errorDetails}</pre>
        {/if}
      </div>
    </div>
  {/if}

  {#if currentStep === PROCESS_STEPS.PREPARING}
    <button
      class="block w-full p-3 bg-blue-500 text-white rounded-md font-medium cursor-pointer transition-colors duration-200 mt-8 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed"
      on:click={startDeployment}
      disabled={isProcessing || !currentMinerParams}
    >
      Start Deployment
    </button>
  {/if}
</div>
