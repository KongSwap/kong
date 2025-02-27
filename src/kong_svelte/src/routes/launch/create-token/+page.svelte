<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { ArrowLeft, AlertTriangle, HelpCircle, Rocket, Users, CreditCard, Zap, Link, Twitter, Github, Coffee } from "lucide-svelte";
  import type { TokenInitArgs } from "$declarations/token_backend/token_backend.did";
  import type { Principal } from '@dfinity/principal';
  import TokenIdentity from "$lib/components/launch/token/TokenIdentity.svelte";
  import TokenEconomics from "$lib/components/launch/token/TokenEconomics.svelte";
  import MiningCalculator from "$lib/components/launch/token/MiningCalculator.svelte";
  import SocialLinks from "$lib/components/launch/token/SocialLinks.svelte";
  import Tooltip from "$lib/components/common/Tooltip.svelte";
  import { writable } from 'svelte/store';
  import { tokenParams } from "$lib/stores/tokenParams";

  // Basic token parameters
  let name = "";
  let symbol = "";
  let decimals = 8;
  let totalSupply = 21000000;
  let transferFee = 10000; // Standard ICRC transfer fee (10,000 base units with 8 decimals)
  let logo = "";

  // Mining parameters
  let initialBlockReward = 50;
  let blockTimeTargetSeconds = 60;
  let halvingInterval = 210000;

  // Archive options
  let archiveOptions = {
    num_blocks_to_archive: 1000000n,
    max_transactions_per_response: [] as [] | [bigint],
    trigger_threshold: 2000n,
    more_controller_ids: [] as [] | [Principal[]],
    max_message_size_bytes: [] as [] | [bigint],
    cycles_for_archive_creation: [] as [] | [bigint],
    node_max_memory_size_bytes: [] as [] | [bigint],
    controller_id: null as any
  };

  // Social links
  let socialLinks = [];
  
  // Mining calculation results 
  let circulationDays = 0;
  let totalMined = 0;
  let minedPercentage = "0%";
  let miningComplete = false;

  let currentStep = 1;
  let tokenSubStep = 1; // 1 for Identity, 2 for Economics
  let isSubmitting = false;
  const totalSteps = 4;
  
  // Define the number of sub-steps for each step
  const subSteps = {
    1: 2, // Token Basics now has 2 sub-steps (Identity and Economics)
    2: 1, // Mining Schedule has 1 sub-step (removed substeps)
    3: 1, // Community has no sub-steps
    4: 1  // Review has no sub-steps
  };

  // Replace validation states with unified error store
  const errorStore = writable({
    hasErrors: false,
    errors: [] as string[]
  });
  
  // Update validation logic
  $: {
    const errors = [];
    
    // Basic params
    if (!name) errors.push('Token name is required');
    if (!symbol) errors.push('Token symbol is required');
    if (symbol.length > 10) errors.push('Symbol must be 10 characters or less');
    if (decimals < 0 || decimals > 18) errors.push('Decimals must be between 0 and 18');
    if (totalSupply <= 0) errors.push('Total supply must be greater than 0');

    // Mining params
    if (initialBlockReward <= 0) errors.push('Block reward must be greater than 0');
    if (blockTimeTargetSeconds <= 0) errors.push('Block time target must be greater than 0');
    if (halvingInterval <= 0) errors.push('Halving interval must be greater than 0');

    errorStore.set({
      hasErrors: errors.length > 0,
      errors
    });
  }

  function getStepValidationState(step: number): 'valid' | 'invalid' | 'pending' {
    switch (step) {
      case 1:
        return $errorStore.hasErrors ? 'invalid' : 'valid';
      case 2:
        return $errorStore.hasErrors ? 'invalid' : 'valid';
      case 3:
        return $errorStore.hasErrors ? 'invalid' : 'valid';
      case 4:
        return $errorStore.hasErrors ? 'invalid' : 'valid';
      default:
        return 'pending';
    }
  }

  function nextStep() {
    if (currentStep === 1) {
      // First check if we need to move to the next token sub-step
      if (tokenSubStep < subSteps[currentStep]) {
        tokenSubStep++;
      } else {
        // Move to the mining step
        currentStep++;
      }
    }
    else if (currentStep < 4) {
      // For other steps, just move to the next step
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep === 1) {
      // For token sub-steps
      if (tokenSubStep > 1) {
        tokenSubStep--;
      }
    }
    else if (currentStep === 2) {
      // Go back to token step (economics)
      currentStep--;
      tokenSubStep = 2; // Set to economics sub-step
    }
    else if (currentStep === 3) {
      // Go back to mining step
      currentStep--;
    }
    else if (currentStep > 1) {
      // For review, go back to community
      currentStep--;
    }
  }

  async function handleSubmit() {
    if ($errorStore.hasErrors) {
      alert("Please fix validation errors before creating the token");
      return;
    }

    isSubmitting = true;
    try {
      // Format token parameters
      const tokenParameters = {
        name,
        ticker: symbol,
        decimals: decimals !== null && decimals !== undefined ? ([decimals] as [number]) : ([] as []),
        total_supply: BigInt(totalSupply),
        transfer_fee: transferFee !== null && transferFee !== undefined ? ([BigInt(transferFee)] as [bigint]) : ([] as []),
        logo: logo ? ([logo] as [string]) : ([] as []),
        initial_block_reward: BigInt(initialBlockReward),
        block_time_target_seconds: BigInt(blockTimeTargetSeconds),
        halving_interval: BigInt(halvingInterval),
        social_links: socialLinks.length > 0 ? ([socialLinks.map(link => ({ platform: link.platform, url: link.url }))] as [Array<{platform: string, url: string}>]) : ([] as []),
        archive_options: [] as []
      };

      // Update the token parameters store
      tokenParams.set(tokenParameters);
      
      // Navigate to the token deployment page with parameters
      goto(`/launch/deploy-token`);
    } catch (error) {
      console.error("Error creating token:", error);
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto("/launch");
  }

  // Navigate between token sub-steps
  function setTokenSubStep(step: number) {
    tokenSubStep = step;
  }
</script>

<div class="grid gap-6 lg:grid-cols-12 max-w-[1200px] mx-auto">
  <!-- Left sidebar with navigation -->
  <div class="lg:col-span-3">
    <div class="sticky flex flex-col gap-5 top-6">
      <!-- Back button -->
      <button 
        on:click={handleCancel}
        class="flex items-center gap-2 px-3 py-2 transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light/10"
      >
        <ArrowLeft size={18} />
        <span>Back to Launch</span>
      </button>
      
      <!-- Form navigation -->
      <div class="transition-all duration-200 border rounded-xl bg-kong-bg-secondary/50 border-kong-border/30 backdrop-blur-sm">
        <div class="space-y-3">
          <button 
            class={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${currentStep === 1 ? 'bg-kong-primary/10 text-kong-primary font-medium border border-kong-primary/20' : 'hover:bg-kong-bg-light/10 text-kong-text-secondary'}`}
            on:click={() => currentStep = 1}
          >
            <div class={`w-9 h-9 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-kong-primary text-white' : 'bg-kong-bg-light/10 text-kong-text-secondary'}`}>
              1
            </div>
            <div class="text-left">
              <span class="block text-sm">Token Basics</span>
              <span class="text-xs opacity-70">Name, symbol, supply</span>
            </div>
          </button>
          
          <button 
            class={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${currentStep === 2 ? 'bg-kong-primary/10 text-kong-primary font-medium border border-kong-primary/20' : 'hover:bg-kong-bg-light/10 text-kong-text-secondary'}`}
            on:click={() => currentStep = 2}
          >
            <div class={`w-9 h-9 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-kong-accent-blue text-white' : 'bg-kong-bg-light/10 text-kong-text-secondary'}`}>
              2
            </div>
            <div class="text-left">
              <span class="block text-sm">Mining Schedule</span>
              <span class="text-xs opacity-70">Block rewards, timing</span>
            </div>
          </button>
          
          <button 
            class={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${currentStep === 3 ? 'bg-kong-primary/10 text-kong-primary font-medium border border-kong-primary/20' : 'hover:bg-kong-bg-light/10 text-kong-text-secondary'}`}
            on:click={() => currentStep = 3}
          >
            <div class={`w-9 h-9 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-kong-accent-green text-white' : 'bg-kong-bg-light/10 text-kong-text-secondary'}`}>
              3
            </div>
            <div class="text-left">
              <span class="block text-sm">Community</span>
              <span class="text-xs opacity-70">Social links, channels</span>
            </div>
          </button>
          
          <button 
            class={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${currentStep === 4 ? 'bg-kong-primary/10 text-kong-primary font-medium border border-kong-primary/20' : 'hover:bg-kong-bg-light/10 text-kong-text-secondary'}`}
            on:click={() => currentStep = 4}
          >
            <div class={`w-9 h-9 rounded-full flex items-center justify-center ${currentStep >= 4 ? 'bg-gradient-to-br from-kong-accent-green to-kong-accent-blue text-white' : 'bg-kong-bg-light/10 text-kong-text-secondary'}`}>
              4
            </div>
            <div class="text-left">
              <span class="block text-sm">Review & Launch</span>
              <span class="text-xs opacity-70">Final verification</span>
            </div>
          </button>
        </div>
      </div>
      
      <!-- Help card -->
      <div class="p-5 transition-all duration-200 border rounded-xl bg-kong-bg-secondary/30 border-kong-border/30 backdrop-blur-sm">
        <div class="flex items-start gap-3">
          <div class="p-2 rounded-lg bg-kong-bg-light/10 text-kong-primary">
            <HelpCircle size={18} />
          </div>
          <div>
            <h3 class="mb-1 text-sm font-medium">Need Help?</h3>
            <p class="text-xs text-kong-text-secondary">
              Creating a token with the right parameters is important. Contact support for guidance.
            </p>
            <a href="https://www.youtube.com/watch?v=l60MnDJklnM" target="_blank" rel="noopener" class="inline-flex items-center gap-1 mt-3 text-xs text-kong-primary hover:underline">
              <span>Read the docs</span>
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main content area -->
  <div class="pr-2 overflow-auto lg:col-span-9">
    <div class="w-full">
      <!-- Step 1: Token Basics -->
      {#if currentStep === 1}
        <div class="flex flex-col">

          <!-- Reduced padding to match the mining section -->
          <Panel variant="solid" type="main" className="p-4 backdrop-blur-xl">
            {#if tokenSubStep === 1}
              <!-- Token Identity Component -->
              <TokenIdentity
                bind:name
                bind:symbol
                bind:logo
              />
            {:else}
              <!-- Token Economics Component -->
              <TokenEconomics
                bind:decimals
                bind:transferFee
                symbol={symbol}
              />
            {/if}
          </Panel>
          
          <div class="flex justify-between mt-6">
            <button on:click={handleCancel} class="px-6 py-2.5 font-medium text-white transition-colors rounded-lg bg-kong-gray-500 hover:bg-kong-gray-600 flex items-center gap-2">
              <ArrowLeft size="20" />
              Cancel
            </button>
            
            <div class="flex gap-3">
              {#if tokenSubStep > 1}
                <button on:click={prevStep} class="px-6 py-2.5 font-medium transition-colors rounded-lg border border-kong-border bg-transparent hover:bg-kong-bg-light/20 flex items-center gap-2">
                  <ArrowLeft size="20" />
                  Back to Identity
                </button>
              {/if}
              
              <button on:click={nextStep} class="px-6 py-2.5 font-medium text-white transition-colors rounded-lg bg-kong-primary hover:bg-kong-primary/90 flex items-center gap-2">
                {#if tokenSubStep < subSteps[currentStep]}
                  Continue to Economics
                {:else}
                  Continue to Mining
                {/if}
              </button>
            </div>
          </div>
        </div>
        
      <!-- Step 2: Mining Schedule -->
      {:else if currentStep === 2}
        <div class="flex flex-col">
          <div class="flex flex-col px-6 mb-2">
            <!-- Mining mini-step indicator removed -->
          </div>
          
          <!-- Removed additional padding from the Panel component -->
          <Panel variant="solid" type="main" className="p-4 backdrop-blur-xl">
            <MiningCalculator
              bind:blockReward={initialBlockReward}
              bind:blockTimeSeconds={blockTimeTargetSeconds}
              bind:halvingBlocks={halvingInterval}
              bind:maxSupply={totalSupply}
              bind:circulationDays
              bind:totalMined
              bind:minedPercentage
              bind:miningComplete
              tokenTicker={symbol}
              tokenLogo={logo}
              transferFee={transferFee}
              decimals={decimals}
              name={name}
            />
          </Panel>
          
          <div class="flex justify-between mt-6">
            <button on:click={prevStep} class="px-6 py-2.5 font-medium transition-colors rounded-lg border border-kong-border bg-transparent hover:bg-kong-bg-light/20 flex items-center gap-2">
              <ArrowLeft size="20" />
              Back to Token Economics
            </button>
            
            <button on:click={nextStep} class="px-6 py-2.5 font-medium text-white transition-colors rounded-lg bg-kong-primary hover:bg-kong-primary/90 flex items-center gap-2">
              Continue to Community Links
            </button>
          </div>
        </div>

      <!-- Step 3: Community -->
      {:else if currentStep === 3}
        <div class="flex flex-col">

          <Panel variant="solid" type="main" className="p-4 backdrop-blur-xl">
            <SocialLinks 
              bind:links={socialLinks}
              tokenName={name}
              tokenSymbol={symbol}
            />
          </Panel>
          
          <div class="flex justify-between mt-6">
            <button on:click={prevStep} class="px-6 py-2.5 font-medium transition-colors rounded-lg border border-kong-border bg-transparent hover:bg-kong-bg-light/20 flex items-center gap-2">
              <ArrowLeft size="20" />
              Back to Mining
            </button>
            
            <button on:click={nextStep} class="px-6 py-2.5 font-medium text-white transition-colors rounded-lg bg-kong-primary hover:bg-kong-primary/90 flex items-center gap-2">
              Review & Complete
            </button>
          </div>
        </div>

      <!-- Step 4: Review -->
      {:else if currentStep === 4}
        <div class="flex flex-col">
          
          <Panel variant="solid" type="main" className="p-4 backdrop-blur-xl">
            <div class="space-y-6">
              <div class="mb-6">
                <h2 class="mb-4 text-lg font-semibold">Token Summary</h2>
                <div class="grid grid-cols-2 gap-6">
                  <!-- Token details -->
                  <div class="p-4 border rounded-lg bg-kong-bg-light/10 border-kong-border/20">
                    <h3 class="mb-3 text-base font-medium text-kong-text-primary">Token Identity</h3>
                    <div class="space-y-2">
                      <div class="flex justify-between">
                        <span class="text-kong-text-secondary">Name:</span>
                        <span class="font-medium">{name || "Not set"}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-kong-text-secondary">Symbol:</span>
                        <span class="font-medium">{symbol || "Not set"}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-kong-text-secondary">Logo:</span>
                        <span class="font-medium">{logo ? "✓ Uploaded" : "✗ Not uploaded"}</span>
                      </div>
                    </div>
                    <button on:click={() => { currentStep = 1; tokenSubStep = 1; }} class="mt-4 text-sm text-kong-accent-blue hover:underline">Edit Token Identity</button>
                  </div>
                  
                  <!-- Economics details -->
                  <div class="p-4 border rounded-lg bg-kong-bg-light/10 border-kong-border/20">
                    <h3 class="mb-3 text-base font-medium text-kong-text-primary">Token Economics</h3>
                    <div class="space-y-2">
                      <div class="flex justify-between">
                        <span class="text-kong-text-secondary">Decimals:</span>
                        <span class="font-medium">{decimals}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-kong-text-secondary">Transfer Fee:</span>
                        <span class="font-medium">{transferFee} {symbol}</span>
                      </div>
                    </div>
                    <button on:click={() => { currentStep = 1; tokenSubStep = 2; }} class="mt-4 text-sm text-kong-accent-blue hover:underline">Edit Token Economics</button>
                  </div>
                  
                  <!-- Mining details -->
                  <div class="p-4 border rounded-lg bg-kong-bg-light/10 border-kong-border/20">
                    <h3 class="mb-3 text-base font-medium text-kong-text-primary">Mining Schedule</h3>
                    <div class="space-y-2">
                      <div class="flex justify-between">
                        <span class="text-kong-text-secondary">Initial Block Reward:</span>
                        <span class="font-medium">{initialBlockReward} {symbol}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-kong-text-secondary">Block Time Target:</span>
                        <span class="font-medium">{blockTimeTargetSeconds} seconds</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-kong-text-secondary">Halving Interval:</span>
                        <span class="font-medium">Every {halvingInterval} blocks</span>
                      </div>
                    </div>
                    <button on:click={() => { currentStep = 2; }} class="mt-4 text-sm text-kong-accent-blue hover:underline">Edit Mining Schedule</button>
                  </div>
                  
                  <!-- Social Links -->
                  <div class="p-4 border rounded-lg bg-kong-bg-light/10 border-kong-border/20">
                    <h3 class="mb-3 text-base font-medium text-kong-text-primary">Community Links</h3>
                    <div class="space-y-2">
                      {#if socialLinks.length > 0}
                        {#each socialLinks as link}
                          <div class="flex justify-between">
                            <span class="text-kong-text-secondary">{link.platform}:</span>
                            <span class="font-medium truncate max-w-[150px]">{link.url}</span>
                          </div>
                        {/each}
                      {:else}
                        <div class="py-2 text-center text-kong-text-secondary">No social links added</div>
                      {/if}
                    </div>
                    <button on:click={() => currentStep = 3} class="mt-4 text-sm text-kong-accent-blue hover:underline">Edit Community Links</button>
                  </div>
                </div>
              </div>
              
              <!-- User Agreement -->
              <div class="p-4 border rounded-lg bg-kong-bg-light/10 border-kong-border/20">
                <h3 class="mb-3 text-base font-medium text-kong-text-primary">Terms & Conditions</h3>
                <div class="space-y-4">
                  <div class="flex items-start gap-2">
                    <input type="checkbox" id="agreement" class="mt-1" />
                    <label for="agreement" class="text-sm text-kong-text-secondary">
                      I understand that I am creating a new token on the Internet Computer blockchain. I have the right to create this token and understand that once created, certain parameters cannot be changed.
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
          
          <div class="flex justify-between mt-6">
            <button on:click={prevStep} class="px-6 py-2.5 font-medium transition-colors rounded-lg border border-kong-border bg-transparent hover:bg-kong-bg-light/20 flex items-center gap-2">
              <ArrowLeft size="20" />
              Back to Community
            </button>
            
            <button 
              on:click={handleSubmit} 
              class="px-6 py-2.5 font-medium text-white transition-colors rounded-lg bg-kong-primary hover:bg-kong-primary/90 flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              disabled={isSubmitting || $errorStore.hasErrors}
            >
              {#if isSubmitting}
                Creating...
              {:else}
                Create Token
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .shadow-glow {
    box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.15);
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-in-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-pulse-slow {
    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  /* Make scrollbar thin and styled */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  
  ::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: rgba(100, 100, 100, 0.2);
    border-radius: 10px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(100, 100, 100, 0.4);
  }
</style>
