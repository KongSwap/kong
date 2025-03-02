<script lang="ts">
  // Props
  export let currentStep: number;
  export let steps: { name: string; description: string }[];
  export let processSteps: {
    PREPARING: number;
    SWAP_KONG_TO_ICP: number;
    CREATE_CANISTER: number;
    DEPLOY_MINER: number;
    INITIALIZE_MINER: number;
    COMPLETED: number;
    ERROR: number;
  };
  export let isProcessing: boolean;
  
  // Helper function to determine step status
  function getStepStatus(stepIndex: number): 'pending' | 'active' | 'completed' | 'error' {
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
</script>

<div class="deployment-steps">
  <h3 class="steps-title">Deployment Progress</h3>
  
  <div class="steps-container">
    {#each steps as step, index}
      {#if index < steps.length - 1}
        <div class="step-item">
          <div class="step-indicator-container">
            <div class="step-indicator {getStepStatus(index)}">
              {#if getStepStatus(index) === 'completed'}
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              {:else if getStepStatus(index) === 'error'}
                <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              {:else if getStepStatus(index) === 'active' && isProcessing}
                <div class="spinner"></div>
              {:else}
                {index + 1}
              {/if}
            </div>
            
            {#if index < steps.length - 2}
              <div class="step-connector {getStepStatus(index) === 'completed' ? 'completed' : ''}"></div>
            {/if}
          </div>
          
          <div class="step-content">
            <h4 class="step-name">{step.name}</h4>
            <p class="step-description">{step.description}</p>
          </div>
        </div>
      {/if}
    {/each}
    
    <!-- Final completion step -->
    <div class="step-item final-step">
      <div class="step-indicator-container">
        <div class="step-indicator {getStepStatus(steps.length - 1)}">
          {#if getStepStatus(steps.length - 1) === 'completed'}
            <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          {:else if getStepStatus(steps.length - 1) === 'active' && isProcessing}
            <div class="spinner"></div>
          {:else}
            <svg class="flag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
              <line x1="4" y1="22" x2="4" y2="15"></line>
            </svg>
          {/if}
        </div>
      </div>
      
      <div class="step-content">
        <h4 class="step-name">{steps[steps.length - 1].name}</h4>
        <p class="step-description">{steps[steps.length - 1].description}</p>
      </div>
    </div>
  </div>
</div>

<style>
  .deployment-steps {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .steps-title {
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 1.5rem;
  }
  
  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .step-item {
    display: flex;
    gap: 1rem;
    padding: 0.5rem 0;
  }
  
  .step-indicator-container {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .step-indicator {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    background-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    position: relative;
  }
  
  .step-indicator.active {
    background-color: #3b82f6;
    color: white;
  }
  
  .step-indicator.completed {
    background-color: #10b981;
    color: white;
  }
  
  .step-indicator.error {
    background-color: #ef4444;
    color: white;
  }
  
  .step-connector {
    width: 2px;
    height: 1.5rem;
    background-color: rgba(255, 255, 255, 0.1);
    margin: 0.25rem 0;
  }
  
  .step-connector.completed {
    background-color: #10b981;
  }
  
  .step-content {
    flex: 1;
  }
  
  .step-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  .step-description {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
  }
  
  .check-icon, .error-icon, .flag-icon {
    width: 1rem;
    height: 1rem;
  }
  
  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  .final-step {
    margin-top: 0.5rem;
  }
</style> 
