<script lang="ts">
  import { CheckCircle, Loader2, Play } from "lucide-svelte";
  import { automaticMode } from "$lib/stores/deploymentMode";
  
  // Props
  export let currentStep: number;
  export let steps: { name: string; description: string }[];
  export let processSteps: Record<string, number>;
  export let isProcessing: boolean;
  export let onExecuteStep: (step: number) => void = () => {};
</script>

<div class="steps-container">
  {#each steps as step, index}
    <div class="step" class:active={currentStep === index} class:completed={currentStep > index}>
      <div class="step-indicator">
        {#if currentStep > index}
          <CheckCircle class="text-green-500" size={24} />
        {:else if currentStep === index && isProcessing}
          <Loader2 class="text-blue-500 animate-spin" size={24} />
        {:else}
          <div class="step-number">{index + 1}</div>
        {/if}
      </div>
      <div class="step-content">
        <h3 class="step-title">{step.name}</h3>
        <p class="step-description">{step.description}</p>
      </div>
      
      {#if !$automaticMode && currentStep === index && !isProcessing}
        <button 
          class="execute-button" 
          on:click={() => onExecuteStep(index)}
          title="Execute this step"
        >
          <Play size={16} />
          Execute
        </button>
      {/if}
    </div>
    {#if index < steps.length - 1}
      <div class="step-connector" class:active={currentStep > index}></div>
    {/if}
  {/each}
</div>

<style>
  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    margin-bottom: 2rem;
  }
  
  .step {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    border-radius: 0.5rem;
    background-color: rgba(255, 255, 255, 0.05);
    transition: all 0.3s ease;
    position: relative;
  }
  
  .step.active {
    background-color: rgba(59, 130, 246, 0.1);
    border-left: 4px solid rgb(59, 130, 246);
  }
  
  .step.completed {
    background-color: rgba(34, 197, 94, 0.1);
    border-left: 4px solid rgb(34, 197, 94);
  }
  
  .step-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }
  
  .step-number {
    font-weight: bold;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .step-content {
    flex: 1;
  }
  
  .step-title {
    font-weight: bold;
    margin-bottom: 0.25rem;
  }
  
  .step-description {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .step-connector {
    width: 2px;
    height: 1.5rem;
    background-color: rgba(255, 255, 255, 0.1);
    margin-left: 16px;
  }
  
  .step-connector.active {
    background-color: rgb(34, 197, 94);
  }
  
  .execute-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: rgb(59, 130, 246);
    color: white;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
  }
  
  .execute-button:hover {
    background-color: rgb(37, 99, 235);
  }
</style> 
