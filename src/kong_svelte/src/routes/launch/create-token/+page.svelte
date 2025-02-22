<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { ArrowLeft, AlertTriangle, HelpCircle } from "lucide-svelte";
  import type { TokenInitArgs } from "$declarations/token_backend/token_backend.did";
  import type { Principal } from '@dfinity/principal';
  import BasicTokenParams from "$lib/components/launch/token/BasicTokenParams.svelte";
  import MiningCalculator from "$lib/components/launch/token/MiningCalculator.svelte";
  import SocialLinks from "$lib/components/launch/token/SocialLinks.svelte";
  import Tooltip from "$lib/components/common/Tooltip.svelte";
  import type { SocialLink } from "$lib/components/launch/token/SocialLinks.svelte";
  import { writable } from 'svelte/store';

  // Basic token parameters
  let name = "";
  let symbol = "";
  let decimals = 8;
  let totalSupply = 1000000;
  let transferFee = 0;
  let logo = "";

  // Mining parameters
  let initialBlockReward = 100;
  let blockTimeTargetSeconds = 30;
  let difficultyAdjustmentBlocks = 100000;

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

  let currentStep = 1;
  let isSubmitting = false;
  const totalSteps = 4;

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
    if (difficultyAdjustmentBlocks <= 0) errors.push('Halving blocks must be greater than 0');

    // Social links
    socialLinks.forEach(link => {
      if (link.url && !isValidUrl(link.url)) errors.push(`Invalid ${link.platform} URL format`);
    });

    errorStore.set({
      hasErrors: errors.length > 0,
      errors
    });
  }

  function isValidUrl(url: string): boolean {
    if (!url) return true; // Empty URLs are considered valid
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
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
    if (currentStep < 4) currentStep++;
  }

  function prevStep() {
    if (currentStep > 1) currentStep--;
  }

  async function handleSubmit() {
    if ($errorStore.hasErrors) {
      alert("Please fix validation errors before creating the token");
      return;
    }

    if (!confirm("Are you sure you want to create this token? Some parameters cannot be changed after creation.")) {
      return;
    }

    isSubmitting = true;
    try {
      const initArgs = {
        name,
        ticker: symbol,
        decimals: [decimals],
        total_supply: totalSupply,
        transfer_fee: [transferFee],
        logo: logo ? [logo] : [],
        initial_block_reward: initialBlockReward,
        block_time_target_seconds: blockTimeTargetSeconds,
        difficulty_adjustment_blocks: difficultyAdjustmentBlocks
      };
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // TODO: Replace with actual API call
      console.log("Creating token with args:", initArgs);
      goto("/launch");
    } catch (error) {
      console.error("Error creating token:", error);
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto("/launch");
  }

  let circulationDays = 0;
  let totalMined = 0;
  let minedPercentage = "0%";
</script>

<div class="min-h-screen px-4 text-kong-text-primary">
  <div class="flex flex-col md:flex-row gap-8 mx-auto max-w-[1200px]">
    <!-- Sidebar with step indicator -->
    <div class="md:w-64 md:sticky md:top-4 md:h-[calc(100vh-2rem)]">
      <div class="p-6 border bg-kong-bg-secondary rounded-xl border-kong-border/30">
        <h2 class="mb-4 text-lg font-bold">Create Mineable Token</h2>
        <div class="space-y-4">
          {#each Array(totalSteps) as _, i}
            <button 
              class={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors
                ${currentStep === i + 1 ? 'bg-kong-primary/10 border border-kong-primary/20' : 'hover:bg-kong-bg-primary'}
              `}
              on:click={() => currentStep = i + 1}
            >
              <div class={`w-6 h-6 rounded-full flex items-center justify-center 
                ${currentStep >= i + 1 ? 'bg-kong-accent-blue text-white' : 'bg-kong-border text-kong-text-secondary'}`}>
                {i + 1}
              </div>
              <span class="text-sm">{i + 1 === 1 ? 'Token' : i + 1 === 2 ? 'Mining' : i + 1 === 3 ? 'Social' : 'Review'}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Main content area -->
    <div class="flex-1 min-w-0">
      {#if currentStep === 1}
        <Panel>
          <BasicTokenParams
            bind:name
            bind:symbol
            bind:decimals
            bind:totalSupply
            bind:transferFee
            bind:logo
            bind:archiveOptions
            class="grid gap-6 md:grid-cols-2"
          />

          <div class="flex justify-between pt-6 border-t border-kong-border/30">
            <button on:click={handleCancel} class="text-kong-primary hover:opacity-80">
              Cancel
            </button>
            <button on:click={nextStep} class="kong-button">
              Next: Mining Parameters →
            </button>
          </div>
        </Panel>

      {:else if currentStep === 2}
        <Panel>
          <MiningCalculator
            bind:blockReward={initialBlockReward}
            bind:blockTimeSeconds={blockTimeTargetSeconds}
            bind:halvingBlocks={difficultyAdjustmentBlocks}
            bind:maxSupply={totalSupply}
            bind:circulationDays
            bind:totalMined
            bind:minedPercentage
            tokenTicker={symbol}
            tokenLogo={logo}
            name={name}
            decimals={decimals}
            transferFee={transferFee}
            class="grid gap-6 md:grid-cols-2"
          />

          <div class="flex justify-between pt-6 border-t border-kong-border/30">
            <button on:click={prevStep} class="text-kong-primary hover:opacity-80">
              ← Back
            </button>
            <button on:click={nextStep} class="kong-button">
              Next: Social Links →
            </button>
          </div>
        </Panel>

      {:else if currentStep === 3}
        <Panel>
          <SocialLinks bind:socialLinks={socialLinks} />
          
          <div class="flex justify-between mt-6">
            <button
              on:click={prevStep}
              class="px-4 py-2 text-kong-text-primary/60 hover:text-kong-text-primary"
            >
              Back
            </button>
            <button
              on:click={nextStep}
              disabled={getStepValidationState(3) === 'invalid'}
              class="px-4 py-2 text-white transition-colors rounded-lg bg-kong-primary hover:bg-kong-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </Panel>

      {:else}
        <Panel>
          <div class="grid gap-8 md:grid-cols-2">
            <!-- Token Overview -->
            <div class="space-y-4">
              <div class="flex items-center gap-4">
                {#if logo}
                  <img src={logo} alt="Token logo" class="w-12 h-12 rounded-full" />
                {:else}
                  <div class="flex items-center justify-center w-12 h-12 rounded-full bg-kong-bg-primary">
                    {symbol?.[0] || '?'}
                  </div>
                {/if}
                <div>
                  <h3 class="text-xl font-bold">{name}</h3>
                  <div class="flex gap-2 mt-1">
                    <span class="px-2 py-1 text-xs rounded-full bg-kong-bg-primary">{symbol}</span>
                  </div>
                </div>
              </div>
              <!-- Rest of review content -->
            </div>

            <!-- Mining Stats -->
            <div class="space-y-4">
              <h4 class="text-lg font-semibold">Mining Economics</h4>
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <span>Total Mineable</span>
                  <span class="font-mono">{totalMined.toLocaleString()}</span>
                </div>
                <!-- Other stats -->
              </div>
            </div>
          </div>

          <div class="flex justify-between pt-6 border-t border-kong-border/30">
            <button on:click={prevStep} class="text-kong-primary hover:opacity-80">
              ← Back
            </button>
            <button
              on:click={handleSubmit}
              disabled={isSubmitting}
              class="kong-button bg-kong-accent-green hover:bg-kong-accent-green-hover"
            >
              {isSubmitting ? 'Creating...' : 'Launch Token'}
            </button>
          </div>
        </Panel>
      {/if}
    </div>
  </div>
</div>

<style global>
  .kong-button {
    @apply px-5 py-2.5 bg-kong-primary text-white rounded-lg hover:bg-kong-primary/90 
           transition-colors flex items-center gap-2 font-medium;
  }
</style>
