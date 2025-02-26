<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { Loader2, X, ChevronUp, ChevronDown, GripVertical, CheckCircle, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-svelte';
  import { browser } from '$app/environment';
  import { writable } from 'svelte/store';
  
  // Storage keys (must match those in deploy-token/+page.svelte)
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
  
  // Constants for the token deployment process (must match those in deploy-token/+page.svelte)
  const PROCESS_STEPS = {
    PREPARING: 0,
    SWAP_KONG_TO_ICP: 1,
    CREATE_CANISTER: 2,
    DEPLOY_TOKEN: 3,
    INITIALIZE_TOKEN: 4,
    COMPLETED: 5,
    ERROR: -1
  };
  
  // Step display information (must match those in deploy-token/+page.svelte)
  const stepInfo = [
    { name: "Preparing", description: "Loading token parameters" },
    { name: "Swap KONG to ICP", description: "Convert KONG tokens to ICP" },
    { name: "Create Canister", description: "Create a new canister on the IC" },
    { name: "Deploy Token", description: "Install token code to the canister" },
    { name: "Initialize Token", description: "Initialize token with parameters" },
    { name: "Completed", description: "Token creation successful" }
  ];
  
  let hasActiveDeployment = false;
  let currentStep = -1;
  let tokenName = '';
  let tokenSymbol = '';
  let dismissed = false;
  let minimized = false;
  let checkInterval: any;
  let swapSuccessful = false;
  let actualIcpReceived = '';
  let errorMessage = '';
  let showCancelConfirmation = false;
  let lastCheckedStep = -1; // Track the last checked step to reduce logging
  
  // Position state
  let position = { x: 20, y: 20 }; // Default position in the top-left corner
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let notificationElement: HTMLElement;
  
  // Create stores for the minimized state and position to persist them
  const minimizedStore = writable(false);
  const positionStore = writable({ x: 20, y: 20 });
  const dismissedStore = writable(false);
  
  // Check if there's an active deployment
  function checkForActiveDeployment() {
    if (!browser) return;
    
    try {
      const savedParams = sessionStorage.getItem(STORAGE_KEYS.TOKEN_PARAMS);
      const savedStep = sessionStorage.getItem(STORAGE_KEYS.DEPLOYMENT_STEP);
      const savedSwapStatus = sessionStorage.getItem(STORAGE_KEYS.SWAP_SUCCESSFUL);
      const savedLog = sessionStorage.getItem(STORAGE_KEYS.DEPLOYMENT_LOG);
      const lastSuccessfulStep = sessionStorage.getItem(STORAGE_KEYS.LAST_SUCCESSFUL_STEP);
      
      // Only log if the step has changed or this is the first check
      const step = savedStep ? parseInt(savedStep, 10) : -1;
      if (step !== lastCheckedStep) {
        console.log("[DeploymentNotification] Checking for active deployment:", { savedStep, savedParams });
        lastCheckedStep = step;
      }
      
      // Check if the KONG to ICP swap was successful
      swapSuccessful = savedSwapStatus === 'true' || (lastSuccessfulStep && parseInt(lastSuccessfulStep, 10) >= PROCESS_STEPS.SWAP_KONG_TO_ICP);
      
      // Get actual ICP received if available
      actualIcpReceived = sessionStorage.getItem(STORAGE_KEYS.ACTUAL_ICP) || '';
      
      // If there's no saved step, there's no active deployment
      if (!savedStep) {
        hasActiveDeployment = false;
        return;
      }
      
      // If there's a saved step but no saved params or savedParams is 'null', we still want to show the notification
      // for error states or successful swaps
      
      // Only log if the step has changed
      if (step !== currentStep) {
        console.log("[DeploymentNotification] Active deployment check result:", { step, swapSuccessful });
      }
      
      // Extract error message from logs if in error state
      if (step === PROCESS_STEPS.ERROR && savedLog) {
        try {
          const logs = JSON.parse(savedLog);
          // Find the last error message in the logs
          for (let i = logs.length - 1; i >= 0; i--) {
            if (logs[i].includes('Error:')) {
              errorMessage = logs[i].split('Error:')[1].trim();
              break;
            }
          }
        } catch (e) {
          console.warn("Error parsing deployment logs:", e);
        }
      }
      
      // Show notification for:
      // 1. In-progress deployments
      // 2. Error states (especially if swap was successful)
      // 3. Completed deployments that need user attention
      if ((step > PROCESS_STEPS.PREPARING && step < PROCESS_STEPS.COMPLETED) || 
          (step === PROCESS_STEPS.ERROR)) {
        hasActiveDeployment = true;
        currentStep = step;
        
        // Get token details - with proper null checks
        try {
          if (savedParams && savedParams !== 'null') {
            const params = JSON.parse(savedParams);
            if (params && typeof params === 'object') {
              tokenName = params.name || '';
              tokenSymbol = params.ticker || '';
              
              // Log the parameters for debugging
              console.log("[DeploymentNotification] Parsed token parameters:", {
                name: params.name,
                ticker: params.ticker,
                total_supply: params.total_supply,
                decimals: params.decimals,
                transfer_fee: params.transfer_fee,
                initial_block_reward: params.initial_block_reward,
                block_time_target_seconds: params.block_time_target_seconds,
                halving_interval: params.halving_interval
              });
            }
          } else {
            console.warn("[DeploymentNotification] No token parameters found in session storage");
          }
        } catch (parseError) {
          console.error("[DeploymentNotification] Error parsing token parameters:", parseError);
          // Continue showing notification even if we can't parse token details
        }
      } else if (step === PROCESS_STEPS.COMPLETED) {
        // If deployment is completed, don't show the notification
        hasActiveDeployment = false;
      } else {
        hasActiveDeployment = false;
      }
    } catch (error) {
      console.error("Error checking for active deployment:", error);
      hasActiveDeployment = false;
    }
  }
  
  // Navigate to the deployment page
  function goToDeployment() {
    goto('/launch/deploy-token');
  }
  
  // Dismiss the notification
  function dismissNotification() {
    dismissed = true;
    dismissedStore.set(true);
    
    // Save to localStorage to persist across page loads
    if (browser) {
      localStorage.setItem('kong_deployment_notification_dismissed', 'true');
    }
  }
  
  // Toggle minimized state
  function toggleMinimized() {
    minimized = !minimized;
    minimizedStore.set(minimized);
    
    // Save to localStorage to persist across page loads
    if (browser) {
      localStorage.setItem('kong_deployment_notification_minimized', minimized.toString());
    }
  }
  
  // Show cancel confirmation dialog
  function showCancelConfirmationDialog() {
    showCancelConfirmation = true;
  }
  
  // Hide cancel confirmation dialog
  function hideCancelConfirmationDialog() {
    showCancelConfirmation = false;
  }
  
  // Cancel the deployment
  function cancelDeployment() {
    if (browser) {
      // Clear deployment state from session storage
      Object.values(STORAGE_KEYS).forEach(key => {
        sessionStorage.removeItem(key);
      });
      
      // Update state to reflect cancellation
      hasActiveDeployment = false;
      currentStep = -1;
      
      // Dismiss the notification
      dismissed = true;
      dismissedStore.set(true);
      localStorage.setItem('kong_deployment_notification_dismissed', 'true');
      
      // Hide the confirmation dialog
      showCancelConfirmation = false;
      
      // Redirect to launch page
      goto('/launch');
    }
  }
  
  // Retry the deployment
  function retryDeployment() {
    // Set the flag in sessionStorage to indicate a retry is happening
    if (browser) {
      // We're keeping all the existing state in sessionStorage,
      // just updating the deployment step to the last successful one
      // or to CREATE_CANISTER if swap was successful
      
      // Get last successful step
      const lastSuccessfulStepStr = sessionStorage.getItem(STORAGE_KEYS.LAST_SUCCESSFUL_STEP);
      let lastSuccessStep = PROCESS_STEPS.PREPARING;
      
      if (lastSuccessfulStepStr) {
        lastSuccessStep = parseInt(lastSuccessfulStepStr, 10);
      } else if (swapSuccessful) {
        // If swap was successful but we don't have a last successful step,
        // set it to SWAP_KONG_TO_ICP so we start from the next step
        lastSuccessStep = PROCESS_STEPS.SWAP_KONG_TO_ICP;
        sessionStorage.setItem(STORAGE_KEYS.LAST_SUCCESSFUL_STEP, lastSuccessStep.toString());
      }
      
      // If we're retrying, set the current step to the next one after the last successful one
      const nextStep = lastSuccessStep + 1;
      sessionStorage.setItem(STORAGE_KEYS.DEPLOYMENT_STEP, nextStep.toString());
      
      // Reset error state
      if (nextStep === PROCESS_STEPS.CREATE_CANISTER) {
        // Make sure we clear the error state
        sessionStorage.setItem(STORAGE_KEYS.DEPLOYMENT_STEP, PROCESS_STEPS.CREATE_CANISTER.toString());
      }
      
      // Flag that we're retrying
      sessionStorage.setItem('kong_token_deployment_retrying', 'true');
      
      // Clear the deployment log to avoid accumulating logs from previous attempts
      // We'll keep the error message in the notification but start with a fresh log
      sessionStorage.removeItem(STORAGE_KEYS.DEPLOYMENT_LOG);
      
      // Clear dismissed state when retrying
      dismissed = false;
      dismissedStore.set(false);
      localStorage.removeItem('kong_deployment_notification_dismissed');
    }
    
    // Navigate to the deployment page to retry
    goToDeployment();
  }
  
  // Drag handlers
  function handleDragStart(event: MouseEvent) {
    isDragging = true;
    
    // Calculate the offset from the mouse position to the notification's top-left corner
    const rect = notificationElement.getBoundingClientRect();
    dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    // Prevent text selection during drag
    event.preventDefault();
  }
  
  function handleDragMove(event: MouseEvent) {
    if (!isDragging) return;
    
    // Calculate new position based on mouse position and offset
    position = {
      x: event.clientX - dragOffset.x,
      y: event.clientY - dragOffset.y
    };
    
    // Ensure the notification stays within viewport bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const notificationWidth = notificationElement.offsetWidth;
    const notificationHeight = notificationElement.offsetHeight;
    
    // Keep notification within horizontal bounds
    if (position.x < 0) position.x = 0;
    if (position.x + notificationWidth > viewportWidth) {
      position.x = viewportWidth - notificationWidth;
    }
    
    // Keep notification within vertical bounds
    if (position.y < 0) position.y = 0;
    if (position.y + notificationHeight > viewportHeight) {
      position.y = viewportHeight - notificationHeight;
    }
    
    // Save position to localStorage
    if (browser) {
      localStorage.setItem('kong_deployment_notification_position', JSON.stringify(position));
    }
    
    // Update the position store
    positionStore.set(position);
  }
  
  function handleDragEnd() {
    isDragging = false;
  }
  
  // Set up drag event listeners
  function setupDragListeners() {
    if (browser) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
    return () => {};
  }
  
  onMount(() => {
    console.log("[DeploymentNotification] Starting initialization...");
    
    // Load saved states from localStorage
    if (browser) {
      // Load dismissed state
      const savedDismissed = localStorage.getItem('kong_deployment_notification_dismissed');
      console.log("[DeploymentNotification] Loading dismissed state:", savedDismissed);
      
      // Check if there's an error state in the deployment
      const savedStep = sessionStorage.getItem(STORAGE_KEYS.DEPLOYMENT_STEP);
      const isErrorState = savedStep === PROCESS_STEPS.ERROR.toString();
      
      // Only respect the dismissed state if we're not in an error state
      if (savedDismissed === 'true' && !isErrorState) {
        dismissed = true;
        dismissedStore.set(true);
      } else {
        dismissed = false;
        dismissedStore.set(false);
        
        // If we're in an error state, clear the dismissed flag to ensure visibility
        if (isErrorState) {
          localStorage.removeItem('kong_deployment_notification_dismissed');
        }
      }
      
      // Load minimized state
      const savedMinimized = localStorage.getItem('kong_deployment_notification_minimized');
      if (savedMinimized !== null) {
        minimized = savedMinimized === 'true';
        minimizedStore.set(minimized);
      }
      
      // Load position from localStorage
      const savedPosition = localStorage.getItem('kong_deployment_notification_position');
      if (savedPosition) {
        try {
          position = JSON.parse(savedPosition);
          positionStore.set(position);
        } catch (e) {
          console.warn('Failed to parse saved position', e);
        }
      }
    }
    
    // Check immediately
    checkForActiveDeployment();
    
    // Set up interval to check periodically (every 5 seconds instead of 3)
    checkInterval = setInterval(checkForActiveDeployment, 5000);
    
    // Set up drag event listeners
    const cleanupDragListeners = setupDragListeners();
    
    return () => {
      cleanupDragListeners();
    };
  });
  
  onDestroy(() => {
    if (checkInterval) {
      clearInterval(checkInterval);
    }
  });
  
  // Handle keyboard events for the cancel confirmation dialog
  function handleKeydown(event: KeyboardEvent) {
    if (showCancelConfirmation && event.key === 'Escape') {
      hideCancelConfirmationDialog();
    }
  }
  
  if (browser) {
    window.addEventListener('keydown', handleKeydown);
    onDestroy(() => {
      window.removeEventListener('keydown', handleKeydown);
    });
  }
</script>

{#if hasActiveDeployment && !dismissed && browser}
  <div 
    class="fixed z-50 pointer-events-none"
    style="top: {position.y}px; left: {position.x}px;"
    bind:this={notificationElement}
  >
    <div class="w-full max-w-md pointer-events-auto">
      <div 
        class="transition-all duration-300 border shadow-lg rounded-xl bg-kong-bg-secondary/90 border-kong-border/30 backdrop-blur-sm {minimized ? 'p-2' : 'p-4'} cursor-move"
        on:mousedown={handleDragStart}
      >
        {#if minimized}
          <!-- Minimized view -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <GripVertical size={14} class="text-kong-text-secondary opacity-60" />
              
              {#if currentStep === PROCESS_STEPS.ERROR && swapSuccessful}
                <CheckCircle size={16} class="text-yellow-500" />
                <span class="text-xs font-medium">
                  KONG Swap Successful
                </span>
              {:else if currentStep === PROCESS_STEPS.ERROR}
                <AlertTriangle size={16} class="text-kong-accent-red" />
                <span class="text-xs font-medium">
                  Deployment Failed
                </span>
              {:else}
                <Loader2 size={16} class="text-kong-primary animate-spin" />
                <span class="text-xs font-medium">
                  {stepInfo[currentStep]?.name || "Deployment"} in Progress
                </span>
              {/if}
            </div>
            <div class="flex items-center gap-1">
              <button 
                on:click|stopPropagation={toggleMinimized}
                class="p-1 transition-colors rounded-full cursor-pointer text-kong-text-secondary hover:bg-kong-bg-light/20"
                aria-label="Expand notification"
              >
                <ChevronDown size={14} />
              </button>
              <button 
                on:click|stopPropagation={dismissNotification}
                class="p-1 transition-colors rounded-full cursor-pointer text-kong-text-secondary hover:bg-kong-bg-light/20"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        {:else}
          <!-- Expanded view -->
          <div class="flex items-start gap-3">
            <div class="p-2 rounded-full {currentStep === PROCESS_STEPS.ERROR && swapSuccessful ? 'bg-yellow-500/10' : currentStep === PROCESS_STEPS.ERROR ? 'bg-kong-accent-red/10' : 'bg-kong-primary/10'}">
              {#if currentStep === PROCESS_STEPS.ERROR && swapSuccessful}
                <CheckCircle size={20} class="text-yellow-500" />
              {:else if currentStep === PROCESS_STEPS.ERROR}
                <AlertTriangle size={20} class="text-kong-accent-red" />
              {:else}
                <Loader2 size={20} class="text-kong-primary animate-spin" />
              {/if}
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <h3 class="flex items-center gap-2 text-sm font-medium">
                  <GripVertical size={14} class="text-kong-text-secondary opacity-60" />
                  {#if currentStep === PROCESS_STEPS.ERROR && swapSuccessful}
                    KONG to ICP Swap Successful
                  {:else if currentStep === PROCESS_STEPS.ERROR}
                    Deployment Failed
                  {:else}
                    Token Deployment in Progress
                  {/if}
                </h3>
                <div class="flex items-center gap-1">
                  <button 
                    on:click|stopPropagation={toggleMinimized}
                    class="p-1 transition-colors rounded-full cursor-pointer text-kong-text-secondary hover:bg-kong-bg-light/20"
                    aria-label="Minimize notification"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button 
                    on:click|stopPropagation={dismissNotification}
                    class="p-1 transition-colors rounded-full cursor-pointer text-kong-text-secondary hover:bg-kong-bg-light/20"
                    aria-label="Dismiss notification"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              
              {#if currentStep === PROCESS_STEPS.ERROR && swapSuccessful}
                <div class="p-2 mt-3 text-sm border rounded bg-yellow-500/10 border-yellow-500/20">
                  <div class="flex items-start gap-2">
                    <AlertCircle size={16} class="text-yellow-500 mt-0.5" />
                    <div>
                      <p class="font-medium">KONG to ICP Swap Successful</p>
                      {#if actualIcpReceived}
                        <p class="mt-1 text-xs text-kong-text-secondary">Successfully swapped to {actualIcpReceived} ICP</p>
                      {/if}
                      <p class="mt-1 text-xs text-kong-text-secondary">The swap was successful but there was an error creating the canister. You can retry without losing your swapped ICP.</p>
                      
                      {#if errorMessage}
                        <div class="p-2 mt-2 overflow-auto text-xs border rounded bg-kong-bg-primary/50 border-kong-border/30 max-h-24">
                          <code class="break-all whitespace-pre-wrap text-kong-text-secondary">{errorMessage}</code>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
                
                <div class="flex flex-col gap-2 mt-3">
                  <button 
                    on:click={retryDeployment}
                    class="flex items-center justify-center w-full gap-2 px-3 py-2 text-sm font-medium text-black transition-colors bg-yellow-500 rounded-md hover:bg-yellow-600"
                  >
                    <RefreshCw size={14} />
                    Retry Canister Creation
                  </button>
                  
                  <button
                    on:click={showCancelConfirmationDialog}
                    class="flex items-center justify-center w-full gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-md bg-kong-bg-light/10 hover:bg-kong-bg-light/20 text-kong-text-primary"
                  >
                    Cancel Deployment
                  </button>
                </div>
              {:else if currentStep === PROCESS_STEPS.ERROR}
                <p class="mt-1 text-xs text-kong-text-secondary">
                  {#if tokenName && tokenSymbol}
                    Your "{tokenName}" ({tokenSymbol}) token deployment failed.
                  {:else}
                    Your token deployment failed.
                  {/if}
                  {#if errorMessage}
                    <span class="block mt-1 text-kong-accent-red">{errorMessage}</span>
                  {/if}
                </p>
                
                <div class="flex gap-2 mt-3">
                  <button
                    on:click|stopPropagation={retryDeployment}
                    class="flex items-center justify-center flex-1 gap-1 px-3 py-2 text-xs font-medium text-white transition-colors rounded-lg cursor-pointer bg-kong-primary hover:bg-kong-primary/90"
                  >
                    <RefreshCw size={12} />
                    Retry Deployment
                  </button>
                  <button
                    on:click|stopPropagation={showCancelConfirmationDialog}
                    class="flex-1 px-3 py-2 text-xs font-medium transition-colors rounded-lg cursor-pointer bg-kong-bg-light/10 hover:bg-kong-bg-light/20 text-kong-text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              {:else}
                <p class="mt-1 text-xs text-kong-text-secondary">
                  {#if tokenName && tokenSymbol}
                    Your "{tokenName}" ({tokenSymbol}) token deployment is in progress.
                  {:else}
                    Your token deployment is in progress.
                  {/if}
                </p>
                
                <!-- Progress indicator -->
                <div class="flex items-center gap-2 mt-2">
                  <div class="flex-1 h-1.5 bg-kong-bg-light/20 rounded-full overflow-hidden">
                    <div class="h-full bg-kong-primary" style={`width: ${(currentStep / (PROCESS_STEPS.COMPLETED - 1)) * 100}%`}></div>
                  </div>
                  <span class="text-xs text-kong-text-secondary">
                    {stepInfo[currentStep]?.name || `Step ${currentStep}`} ({currentStep}/{PROCESS_STEPS.COMPLETED - 1})
                  </span>
                </div>
                
                <div class="flex gap-2 mt-3">
                  <button
                    on:click|stopPropagation={goToDeployment}
                    class="flex-1 px-3 py-2 text-xs font-medium text-white transition-colors rounded-lg cursor-pointer bg-kong-primary hover:bg-kong-primary/90"
                  >
                    Continue Deployment
                  </button>
                  <button
                    on:click|stopPropagation={showCancelConfirmationDialog}
                    class="px-3 py-2 text-xs font-medium transition-colors rounded-lg cursor-pointer bg-kong-bg-light/10 hover:bg-kong-bg-light/20 text-kong-text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Cancel Confirmation Dialog -->
{#if showCancelConfirmation && browser}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <div class="w-full max-w-md p-6 border shadow-2xl rounded-xl bg-kong-bg-secondary border-kong-border/30">
      <div class="flex items-start gap-4">
        <div class="p-2 rounded-full bg-kong-accent-red/10">
          <AlertCircle size={24} class="text-kong-accent-red" />
        </div>
        <div class="flex-1">
          <h2 class="text-lg font-bold text-kong-text-primary">Cancel Token Deployment?</h2>
          
          <div class="mt-3 space-y-3 text-sm text-kong-text-secondary">
            <p class="font-medium text-kong-accent-red">
              Warning: Cancelling will reset the entire deployment process.
            </p>
            
            <p>
              If you cancel now:
            </p>
            
            <ul class="pl-5 space-y-2 list-disc">
              <li>All progress will be lost</li>
              <li>You will need to start the token creation process from scratch</li>
              <li>You will need to swap 500 KONG to ICP again</li>
              {#if swapSuccessful && actualIcpReceived}
                <li class="font-medium text-yellow-500">
                  The {actualIcpReceived} ICP you already received from the swap will remain in your wallet
                </li>
              {/if}
            </ul>
            
            <p class="pt-2 mt-2 border-t border-kong-border/30">
              Are you sure you want to cancel this deployment?
            </p>
          </div>
          
          <div class="flex gap-3 mt-6">
            <button
              on:click={cancelDeployment}
              class="px-4 py-2 text-sm font-medium text-white transition-colors rounded-lg bg-kong-accent-red hover:bg-kong-accent-red/90"
            >
              Yes, Cancel Deployment
            </button>
            <button
              on:click={hideCancelConfirmationDialog}
              class="px-4 py-2 text-sm font-medium transition-colors rounded-lg bg-kong-bg-light/10 hover:bg-kong-bg-light/20 text-kong-text-secondary"
            >
              No, Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if} 
