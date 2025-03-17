<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { spring } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { CheckCircle, Circle, AlertCircle, Clock } from 'lucide-svelte';

  // Convert to runes props syntax with default values for safety
  const { currentStep = 1, steps = [], processSteps, isProcessing = false } = $props<{
    currentStep: number;
    steps: { name: string; description: string }[];
    processSteps: {
      PREPARING: number;
      SWAP_KONG_TO_ICP: number;
      CREATE_CANISTER: number;
      DEPLOY_MINER: number;
      INITIALIZE_MINER: number;
      COMPLETED: number;
      ERROR: number;
    };
    isProcessing: boolean;
  }>();
  
  // Safety check to ensure steps array is valid
  const safeSteps = $derived(steps || []);
  
  // Helper function to determine step status
  function getStepStatus(stepIndex: number): 'pending' | 'active' | 'completed' | 'error' {
    if (!processSteps) return 'pending';
    
    if (currentStep === processSteps.ERROR) {
      return stepIndex === currentStep ? 'error' : 'pending';
    }
    
    if (stepIndex < currentStep) {
      return 'completed';
    }
    
    if (stepIndex === currentStep) {
      return 'active';
    }
    
    return 'pending';
  }

  // Safe access to current step details
  const currentStepInfo = $derived(() => {
    if (!safeSteps.length) return { name: 'Loading...', description: '' };
    
    // Safely calculate index with bounds checking
    const safeIndex = Math.max(0, Math.min(currentStep, safeSteps.length - 1));
    return safeSteps[safeIndex] || { name: 'Unknown Step', description: '' };
  });

  // Progress tracking with safety bounds
  const progressWidth = $derived(() => {
    if (!safeSteps.length) return 0;
    return Math.min(100, Math.max(0, ((currentStep) / Math.max(1, safeSteps.length)) * 100));
  });
  
  // Spring animation for progress
  const progressSpring = spring(0, {
    stiffness: 0.15,
    damping: 0.8
  });

  // Update spring when progressWidth changes
  $effect(() => {
    progressSpring.set(progressWidth());
  });
</script>

<div class="deployment-steps-container">
  <div class="progress-bar-container">
    <div class="progress-bar">
      <div 
        class="progress-fill" 
        class:error={currentStep === processSteps?.ERROR}
        style={`width: ${$progressSpring}%`}
      ></div>
    </div>
    
    <div class="step-indicators">
      {#each safeSteps as step, index}
        <div 
          class="step-dot-container" 
          style={`left: ${index === 0 ? 0 : index === safeSteps.length - 1 ? 100 : (index / (safeSteps.length - 1)) * 100}%`}
        >
          <div 
            class="step-dot {getStepStatus(index)}"
            class:pulse={getStepStatus(index) === 'active' && isProcessing}
          >
            {#if getStepStatus(index) === 'completed'}
              <CheckCircle size={16} />
            {:else if getStepStatus(index) === 'active'}
              {#if isProcessing}
                <div class="spinner"></div>
              {:else}
                <Circle size={16} />
              {/if}
            {:else if getStepStatus(index) === 'error'}
              <AlertCircle size={16} />
            {:else}
              <Clock size={16} />
            {/if}
          </div>
          <div class="step-label">
            <span>{step.name}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>
  
  <div class="current-step-info">
    {#if currentStep === processSteps?.ERROR}
      <div class="error-state" transition:fade={{ duration: 200 }}>
        <AlertCircle size={20} />
        <span>Deployment Error</span>
      </div>
    {:else if currentStep === processSteps?.COMPLETED}
      <div class="completed-state" transition:fade={{ duration: 200 }}>
        <CheckCircle size={20} />
        <span>Deployment Completed</span>
      </div>
    {:else}
      <div class="active-step" transition:fade={{ duration: 200 }}>
        <div class="step-number">Step {Math.min(currentStep + 1, safeSteps.length)}</div>
        <div class="step-name">{currentStepInfo().name}</div>
        {#if currentStepInfo().description}
          <div class="step-description">{currentStepInfo().description}</div>
        {/if}
        {#if isProcessing}
          <div class="processing-indicator">
            <div class="processing-spinner"></div>
            <span>Processing...</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .deployment-steps-container {
    width: 100%;
    margin-bottom: 1.5rem;
  }
  
  .progress-bar-container {
    position: relative;
    margin-bottom: 2.5rem;
  }
  
  .progress-bar {
    height: 4px;
    background-color: rgba(148, 163, 184, 0.2);
    border-radius: 2px;
    overflow: hidden;
    margin: 1.5rem 0;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(to right, #3b82f6, #60a5fa);
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  
  .progress-fill.error {
    background: linear-gradient(to right, #ef4444, #f87171);
  }
  
  .step-indicators {
    position: relative;
    height: 40px;
  }
  
  .step-dot-container {
    position: absolute;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 80px;
  }
  
  .step-dot-container:first-child {
    transform: translateX(0%);
  }
  
  .step-dot-container:last-child {
    transform: translateX(-100%);
  }
  
  .step-dot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(30, 41, 59, 0.8);
    border: 2px solid rgba(148, 163, 184, 0.3);
    color: rgba(148, 163, 184, 0.7);
    margin-bottom: 8px;
    transition: all 0.3s ease;
  }
  
  .step-dot.completed {
    background-color: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    color: #10b981;
  }
  
  .step-dot.active {
    background-color: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: #60a5fa;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
  }
  
  .step-dot.error {
    background-color: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #f87171;
  }
  
  .step-dot.pulse {
    animation: pulse 2s infinite;
  }
  
  .step-label {
    font-size: 0.75rem;
    color: rgba(148, 163, 184, 0.7);
    text-align: center;
    max-width: 80px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .current-step-info {
    background-color: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(71, 85, 105, 0.3);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-top: 1rem;
    min-height: 80px;
  }
  
  .active-step {
    display: flex;
    flex-direction: column;
  }
  
  .step-number {
    font-size: 0.75rem;
    color: rgba(148, 163, 184, 0.7);
    margin-bottom: 0.25rem;
  }
  
  .step-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
    margin-bottom: 0.5rem;
  }
  
  .step-description {
    font-size: 0.875rem;
    color: rgba(148, 163, 184, 0.7);
    margin-bottom: 1rem;
  }
  
  .processing-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #60a5fa;
    margin-top: 0.5rem;
  }
  
  .processing-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(96, 165, 250, 0.3);
    border-top-color: #60a5fa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(96, 165, 250, 0.3);
    border-top-color: #60a5fa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .error-state, .completed-state {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
  }
  
  .error-state {
    color: #f87171;
  }
  
  .completed-state {
    color: #10b981;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
    }
    70% {
      box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
    }
  }
</style> 
