<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { spring } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

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
    const safeIndex = Math.max(0, Math.min(currentStep - 1, safeSteps.length - 1));
    return safeSteps[safeIndex] || { name: 'Unknown Step', description: '' };
  });

  // Progress tracking with safety bounds
  const progressWidth = $derived(() => {
    if (!safeSteps.length) return 0;
    return Math.min(100, Math.max(0, ((currentStep - 1) / Math.max(1, safeSteps.length - 1)) * 100));
  });
  
  // Spring animation for progress
  const progressSpring = spring(0, {
    stiffness: 0.15,
    damping: 0.8
  });

  // Particle control for completed steps
  function createParticles(node: HTMLElement) {
    return {
      destroy() {
        // Cleanup if needed
      }
    };
  }
</script>

<div class="deployment-steps">
  <div class="progress-header">
    <div class="dynamic-title">
      {#if processSteps && currentStep === processSteps.ERROR}
        <span class="error-glow" transition:fade={{ duration: 300 }}>Deployment Hiccup!</span>
      {:else}
        <span class="step-counter" transition:fade={{ duration: 300 }}>
          Step {Math.min(currentStep, safeSteps.length || 1)}
        </span>
        <span class="title-glow" transition:fade={{ duration: 300 }}>
          {currentStepInfo.name}
        </span>
      {/if}
    </div>
    <div class="progress-track">
      <div 
        class="progress-fill" 
        style={`width: ${$progressSpring}%`}
      />
    </div>
  </div>

  {#if safeSteps.length === 0}
    <div class="loading-placeholder">
      <div class="pulse-loader"></div>
      <p>Loading deployment steps...</p>
    </div>
  {:else}
    <div class="steps-container">
      {#each safeSteps as step, index}
        {#if index < safeSteps.length - 1}
          <div class="step-item" transition:fly={{ y: 20, delay: index * 50, duration: 400 }}>
            <div class="step-indicator-container">
              <div class="step-indicator {getStepStatus(index)}">
                {#if getStepStatus(index) === 'completed'}
                  <div class="particle-container" use:createParticles>
                    {#each Array(3) as _, i}
                      <div class="particle" style={`--index: ${i}`}/>
                    {/each}
                  </div>
                  <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12" class="check-path"></polyline>
                  </svg>
                {:else if getStepStatus(index) === 'error'}
                  <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" class="error-line"></line>
                    <line x1="6" y1="6" x2="18" y2="18" class="error-line"></line>
                  </svg>
                {:else if getStepStatus(index) === 'active' && isProcessing}
                  <div class="quantum-spinner">
                    {#each Array(4) as _, i}
                      <div class="quantum-dot" style={`--index: ${i}`}/>
                    {/each}
                  </div>
                {:else}
                  <div class="step-number">{index + 1}</div>
                {/if}
              </div>
              
              {#if index < safeSteps.length - 2}
                <div class="step-connector {getStepStatus(index) === 'completed' ? 'completed' : ''}">
                  <div class="connector-pulse"></div>
                </div>
              {/if}
            </div>
            
            <div class="step-content">
              <h4 class="step-name">{step.name || 'Unnamed Step'}</h4>
              <p class="step-description">{step.description || ''}</p>
            </div>
          </div>
        {/if}
      {/each}
      
      <!-- Final completion step -->
      {#if safeSteps.length > 0}
        <div class="step-item final-step" transition:fly={{ y: 20, delay: safeSteps.length * 50, duration: 400 }}>
          <div class="step-indicator-container">
            <div class="step-indicator {getStepStatus(safeSteps.length - 1)}">
              {#if getStepStatus(safeSteps.length - 1) === 'completed'}
                <div class="success-ripple"></div>
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" class="check-path final"></polyline>
                </svg>
              {:else if getStepStatus(safeSteps.length - 1) === 'active' && isProcessing}
                <div class="quantum-spinner">
                  {#each Array(4) as _, i}
                    <div class="quantum-dot" style={`--index: ${i}`}/>
                  {/each}
                </div>
              {:else}
                <svg class="flag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                  <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
              {/if}
            </div>
          </div>
          
          <div class="step-content">
            <h4 class="step-name">{safeSteps[safeSteps.length - 1]?.name || 'Completion'}</h4>
            <p class="step-description">{safeSteps[safeSteps.length - 1]?.description || ''}</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  :global(.deployment-steps) {
    --hue-primary: 210;
    --color-success: hsl(142, 76%, 50%);
    --color-error: hsl(0, 84%, 60%);
    --color-progress: hsl(var(--hue-primary), 90%, 55%);
    --glow-intensity: 0.4;
    width: 100%;
  }

  .loading-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
  }

  .pulse-loader {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: var(--color-progress);
    margin-bottom: 1rem;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .progress-header {
    margin-bottom: 2rem;
    position: relative;
  }

  .dynamic-title {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    margin-bottom: 1rem;
    font-size: 1.25rem;
    font-weight: bold;
  }

  .step-counter {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }

  .title-glow {
    background: linear-gradient(
      to right,
      hsl(var(--hue-primary), 100%, 70%),
      hsl(var(--hue-primary), 100%, 50%)
    );
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    animation: text-pulse 2s ease infinite;
  }

  .error-glow {
    background: linear-gradient(
      to right,
      hsl(0, 100%, 70%),
      hsl(0, 100%, 50%)
    );
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    animation: error-text-pulse 1.5s ease infinite;
  }

  .progress-track {
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(
      to right,
      var(--color-progress),
      hsl(var(--hue-primary), 100%, 60%)
    );
    border-radius: 3px;
    box-shadow: 0 0 10px 0 hsla(var(--hue-primary), 100%, 50%, 0.5);
  }

  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  
  .step-item {
    display: flex;
    gap: 1rem;
    padding: 0.75rem 0;
  }
  
  .step-indicator-container {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .step-indicator {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    background-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    position: relative;
    font-size: 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    overflow: hidden;
  }
  
  .step-indicator.active {
    background-color: var(--color-progress);
    color: white;
    box-shadow: 0 0 0 4px hsla(var(--hue-primary), 70%, 50%, 0.2),
                0 0 15px hsla(var(--hue-primary), 70%, 50%, 0.3);
  }
  
  .step-indicator.completed {
    background-color: var(--color-success);
    color: white;
    box-shadow: 0 0 0 2px hsla(142, 76%, 50%, 0.2),
                0 0 15px hsla(142, 76%, 50%, 0.3);
  }
  
  .step-indicator.error {
    background-color: var(--color-error);
    color: white;
    animation: error-pulse 1.5s ease infinite;
  }

  .particle-container {
    position: absolute;
    inset: 0;
    z-index: 5;
  }

  .particle {
    position: absolute;
    width: 4px;
    height: 4px;
    background: var(--color-success);
    border-radius: 50%;
    left: 50%;
    top: 50%;
    animation: particle-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .quantum-spinner {
    position: relative;
    width: 24px;
    height: 24px;
  }

  .quantum-dot {
    position: absolute;
    width: 6px;
    height: 6px;
    background: currentColor;
    border-radius: 50%;
    top: calc(50% - 3px);
    left: calc(50% - 3px);
    animation: quantum-bounce 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    animation-delay: calc(var(--index) * 0.15s);
  }

  .step-number {
    font-size: 1.1rem;
  }

  .step-connector {
    width: 2px;
    height: 1.75rem;
    background-color: rgba(255, 255, 255, 0.1);
    margin: 0.25rem 0;
    transition: background-color 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  .step-connector.completed {
    background-color: var(--color-success);
  }

  .connector-pulse {
    position: absolute;
    width: 100%;
    height: 15px;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--color-success),
      transparent
    );
    top: -15px;
    animation: connector-pulse 2s linear infinite;
    opacity: 0;
  }

  .step-connector.completed .connector-pulse {
    opacity: 1;
  }

  .step-content {
    flex: 1;
    padding: 0.25rem 0;
  }
  
  .step-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
    font-size: 1rem;
  }
  
  .step-description {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.4;
  }
  
  .check-icon, .error-icon, .flag-icon {
    width: 1.25rem;
    height: 1.25rem;
    z-index: 10;
  }

  .check-path {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: dash 0.6s cubic-bezier(0.65, 0, 0.35, 1) forwards;
    animation-delay: 0.2s;
  }

  .check-path.final {
    animation-delay: 0.3s;
  }

  .error-line {
    animation: error-line 0.4s cubic-bezier(0.65, 0, 0.35, 1) forwards;
  }

  .success-ripple {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--color-success);
    opacity: 0;
    transform: scale(0);
    animation: success-ripple 1.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
  }
  
  .final-step {
    margin-top: 0.5rem;
  }

  @keyframes dash {
    from { stroke-dashoffset: 1; }
    to { stroke-dashoffset: 0; }
  }

  @keyframes error-line {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  @keyframes quantum-bounce {
    0% { transform: translate(0, 0); }
    33% { transform: translate(10px, -10px); }
    66% { transform: translate(-10px, 10px); }
    100% { transform: translate(0, 0); }
  }

  @keyframes particle-pop {
    0% { transform: translate(0, 0); opacity: 1; }
    100% { 
      transform: translate(
        calc(var(--index) * 8px - 12px), 
        calc(var(--index) * -6px - 12px)
      ); 
      opacity: 0; 
    }
  }

  @keyframes connector-pulse {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(300%); }
  }

  @keyframes text-pulse {
    0%, 100% { filter: drop-shadow(0 0 8px hsla(var(--hue-primary), 100%, 50%, var(--glow-intensity))); }
    50% { filter: drop-shadow(0 0 12px hsla(var(--hue-primary), 100%, 50%, calc(var(--glow-intensity) * 1.5))); }
  }

  @keyframes error-text-pulse {
    0%, 100% { filter: drop-shadow(0 0 8px hsla(0, 100%, 50%, var(--glow-intensity))); }
    50% { filter: drop-shadow(0 0 12px hsla(0, 100%, 50%, calc(var(--glow-intensity) * 1.5))); }
  }

  @keyframes error-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  }

  @keyframes success-ripple {
    0% { transform: scale(0.8); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  @keyframes pulse {
    0%, 100% { transform: scale(0.8); opacity: 0.8; }
    50% { transform: scale(1); opacity: 1; }
  }
</style> 
