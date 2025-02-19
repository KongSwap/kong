<script lang="ts">
  import { createMarket, getAllCategories } from "$lib/api/predictionMarket";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { toastStore } from "$lib/stores/toastStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import { AlertTriangle, Plus, Trash2, ClipboardList, Target, Clock, CheckCircle, HelpCircle, Tag, Gavel, ScrollText, ListChecks, Calendar, TriangleAlert, Coins } from "lucide-svelte";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { formatCategory } from "$lib/utils/numberFormatUtils";
  import { fade, fly } from 'svelte/transition';

  let loading = false;
  let error: string | null = null;
  let categories: string[] = [];

  // Form data
  let question = "";
  let category = "Other";
  let rules = "";
  let outcomes: string[] = ["", ""];
  let resolutionMethod = "Admin";
  let endTimeType = "Duration";
  let duration = 24; // Default 24 hours
  let specificDate: string = "";
  let specificTime: string = "";

  // Validation
  let formErrors: Record<string, string> = {};

  // Add these to the script section
  let currentStep = 1;
  const totalSteps = 4;

  // URL parameter handling
  $: if (browser && currentStep > 1) {
    const params = new URLSearchParams();
    params.set('step', currentStep.toString());
    
    if (question) params.set('question', question);
    if (category) params.set('category', category);
    if (rules) params.set('rules', rules);
    if (outcomes.length > 0) params.set('outcomes', JSON.stringify(outcomes));
    if (resolutionMethod) params.set('resolutionMethod', resolutionMethod);
    if (endTimeType) params.set('endTimeType', endTimeType);
    if (duration) params.set('duration', duration.toString());
    if (specificDate) params.set('specificDate', specificDate);
    if (specificTime) params.set('specificTime', specificTime);

    const url = new URL(window.location.href);
    url.search = params.toString();
    history.replaceState(null, '', url.toString());
  }

  // Load state from URL on mount
  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Only restore state if we have parameters
    if (params.has('step')) {
      currentStep = parseInt(params.get('step') || '1');
      question = params.get('question') || '';
      category = params.get('category') || 'Other';
      rules = params.get('rules') || '';
      
      try {
        const savedOutcomes = params.get('outcomes');
        if (savedOutcomes) {
          outcomes = JSON.parse(savedOutcomes);
        }
      } catch (e) {
        console.error('Failed to parse outcomes from URL:', e);
      }
      
      resolutionMethod = params.get('resolutionMethod') || 'Admin';
      endTimeType = params.get('endTimeType') || 'Duration';
      duration = parseInt(params.get('duration') || '24');
      specificDate = params.get('specificDate') || '';
      specificTime = params.get('specificTime') || '';
    }
  });

  onMount(async () => {
    try {
      categories = await getAllCategories();
    } catch (e) {
      console.error("Failed to load categories:", e);
      error = "Failed to load categories";
    }
  });

  function addOutcome() {
    outcomes = [...outcomes, ""];
  }

  function removeOutcome(index: number) {
    if (outcomes.length > 2) {
      outcomes = outcomes.filter((_, i) => i !== index);
    }
  }

  function nextStep() {
    if (validateCurrentStep()) {
      currentStep = Math.min(currentStep + 1, totalSteps);
      updateURL();
    }
  }

  function prevStep() {
    currentStep = Math.max(currentStep - 1, 1);
    updateURL();
  }

  function validateCurrentStep(): boolean {
    formErrors = {};
    
    if (currentStep === 1) {
      if (!question.trim()) {
        formErrors.question = "Question is required";
      }
      if (!rules.trim()) {
        formErrors.rules = "Rules are required";
      }
    } else if (currentStep === 2) {
      if (outcomes.some(outcome => !outcome.trim())) {
        formErrors.outcomes = "All outcomes must be filled";
      }
    } else if (currentStep === 3) {
      if (endTimeType === "Duration") {
        if (!duration || duration < 1) {
          formErrors.duration = "Duration must be at least 1 hour";
        }
      } else {
        if (!specificDate || !specificTime) {
          formErrors.specificDate = "Date and time are required";
        } else {
          const selectedDateTime = new Date(`${specificDate}T${specificTime}`);
          if (selectedDateTime <= new Date()) {
            formErrors.specificDate = "End time must be in the future";
          }
        }
      }
    }

    return Object.keys(formErrors).length === 0;
  }

  function updateURL() {
    if (!browser) return;
    
    const params = new URLSearchParams();
    params.set('step', currentStep.toString());
    
    if (currentStep > 1) {
      if (question) params.set('question', question);
      if (category) params.set('category', category);
      if (rules) params.set('rules', rules);
    }
    
    if (currentStep > 2) {
      if (outcomes.length > 0) params.set('outcomes', JSON.stringify(outcomes));
    }
    
    if (currentStep > 3) {
      if (resolutionMethod) params.set('resolutionMethod', resolutionMethod);
      if (endTimeType) params.set('endTimeType', endTimeType);
      if (duration) params.set('duration', duration.toString());
      if (specificDate) params.set('specificDate', specificDate);
      if (specificTime) params.set('specificTime', specificTime);
    }

    goto(`?${params.toString()}`, { replaceState: true });
  }

  async function handleSubmit() {
    if (!validateCurrentStep()) return;

    loading = true;
    error = null;

    try {
      // Prepare end time
      let endTimeSpec;
      if (endTimeType === "Duration") {
        // Convert hours to seconds only
        const durationInSeconds = duration * 60 * 60; // Convert hours to seconds
        endTimeSpec = { Duration: BigInt(durationInSeconds) };
      } else {
        const endDate = new Date(`${specificDate}T${specificTime}`);
        // Convert to nanoseconds
        endTimeSpec = { SpecificDate: BigInt(endDate.getTime() * 1_000_000) };
      }

      // Prepare resolution method
      let resolutionMethodSpec;
      switch (resolutionMethod) {
        case "Admin":
          resolutionMethodSpec = { Admin: null };
          break;
        case "Decentralized":
          resolutionMethodSpec = { Decentralized: { quorum: 100n } }; // Default quorum
          break;
        case "Oracle":
          resolutionMethodSpec = {
            Oracle: {
              oracle_principals: [], // Would need to be configured
              required_confirmations: 1n
            }
          };
          break;
      }

      // Create market
      const result = await createMarket({
        question,
        category: { [category]: null },
        rules,
        outcomes: outcomes.filter(o => o.trim()),
        resolutionMethod: resolutionMethodSpec,
        endTimeSpec
      });

      if ('Ok' in result) {
        toastStore.add({
          title: "Market Created",
          message: "Your prediction market has been created successfully",
          type: "success"
        });
        goto("/predict");
      } else {
        error = result.Err;
      }
    } catch (e) {
      console.error("Failed to create market:", e);
      error = e instanceof Error ? e.message : "Failed to create market";
    } finally {
      loading = false;
    }
  }

  // Add this to the script section
  $: questionError = question.length > 200 ? "Question must be less than 200 characters" : "";
</script>

<div class="min-h-screen text-kong-text-primary">
  <div class="max-w-xl mx-auto px-4">
    <div class="mb-6 text-center">
      <h1 class="text-4xl font-bold text-kong-text-primary mb-2">
        Create a Market
      </h1>
      <p class="text-kong-text-secondary">
        Ask the community what they think will happen
      </p>
    </div>

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <!-- Progress Steps -->
      <div class="max-w-lg mx-auto mb-12">
        <div class="relative flex justify-between items-center">
          <!-- Connector Line Background -->
          <div class="absolute top-[11px] left-3 right-3 h-0.5 bg-kong-border/30"></div>
          <!-- Active Connector Line -->
          <div 
            class="absolute top-[11px] left-3 h-0.5 bg-gradient-to-r from-kong-accent-blue to-kong-accent-green transition-all duration-300"
            style="width: calc(({((currentStep - 1) / (totalSteps - 1)) * (100 - 1.5)}% - 6px))"
          ></div>
          
          {#each Array(totalSteps) as _, i}
            <div class="flex flex-col items-center relative z-10">
              <div 
                class="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 {i + 1 <= currentStep ? 'bg-kong-accent-blue ring-4 ring-kong-accent-blue/20' : 'bg-kong-surface-dark border-2 border-kong-border'}"
              >
                <span class="text-xs font-medium {i + 1 <= currentStep ? 'text-white' : 'text-kong-text-secondary'}">
                  {i + 1}
                </span>
              </div>
              <span class="absolute top-8 text-xs uppercase font-medium whitespace-nowrap {i + 1 <= currentStep ? 'text-kong-text-primary' : 'text-kong-text-secondary'}">
                {i + 1 === 1 ? 'Details' : i + 1 === 2 ? 'Outcomes' : i + 1 === 3 ? 'Timeline' : 'Review'}
              </span>
            </div>
          {/each}
        </div>
      </div>

      {#if currentStep === 4}
      <div class="p-3 mx-0.5 rounded-lg border border-kong-accent-yellow/30 backdrop-blur-sm bg-kong-accent-yellow/20 text-kong-text-primary flex gap-4">
        <div class="flex items-center self-start mt-1">
          <div class="flex items-center justify-center gap-2 p-2 rounded-lg bg-kong-accent-yellow/10">
            <TriangleAlert size={24} class="text-kong-accent-yellow" />
          </div>
        </div>
        <div class="flex flex-col">
          <h3 class="font-bold text-kong-accent-yellow">Review your market!</h3>
          <p class="text-sm text-kong-text-primary/90">Please review all details carefully. Markets cannot be modified after creation.</p>
        </div>
      </div>
      {/if}

      {#key currentStep}
        <Panel 
          variant="solid"
          transition="slide"
        >
          {#if currentStep === 1}
            <div class="space-y-6">
              <!-- Question -->
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <label for="question" class="block text-xs uppercase font-medium text-kong-text-primary">
                    What's your question?
                  </label>
                  <div class="group relative">
                    <HelpCircle size={18} class="text-kong-text-secondary cursor-help" />
                    <div class="absolute left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-kong-bg-dark border border-kong-border rounded-lg text-sm text-kong-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      Keep your question clear and specific
                      <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-kong-bg-dark border-t border-l border-kong-border transform rotate-45"></div>
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  id="question"
                  bind:value={question}
                  class="w-full p-4 bg-kong-bg-dark rounded-lg border {questionError ? 'border-kong-accent-red' : 'border-kong-border'} text-lg text-kong-text-primary placeholder:text-kong-text-secondary/50 focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200"
                  placeholder="e.g., Will Bitcoin reach $100,000 by the end of 2024?"
                />

                {#if formErrors.question}
                  <p class="text-sm text-kong-text-accent-red flex items-center gap-2 mt-2">
                    <AlertTriangle size={16} />
                    {formErrors.question}
                  </p>
                {/if}
              </div>

              <!-- Category -->
              <div class="space-y-2">
                <label for="category" class="block text-xs uppercase font-medium text-kong-text-primary">
                  Category
                </label>
                <div class="relative">
                  <select
                    id="category"
                    bind:value={category}
                    class="w-full p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary appearance-none focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200 pr-10"
                  >
                    {#each categories as cat}
                      <option value={cat}>{cat}</option>
                    {/each}
                  </select>
                  <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-kong-text-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>

              <!-- Resolution Method -->
              <div class="space-y-2">
                <label for="resolutionMethod" class="block text-xs uppercase font-medium text-kong-text-primary">
                  How will this be resolved?
                </label>
                <div class="relative">
                  <select
                    id="resolutionMethod"
                    bind:value={resolutionMethod}
                    class="w-full p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary appearance-none focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200 pr-10"
                  >
                    <option value="Admin">Admin Resolution</option>
                    <option value="Decentralized">Community Resolution</option>
                    <option value="Oracle">Oracle Resolution</option>
                  </select>
                  <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-kong-text-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
                <p class="text-sm text-kong-text-secondary">
                  {#if resolutionMethod === "Admin"}
                    Market will be resolved by platform administrators
                  {:else if resolutionMethod === "Decentralized"}
                    Market will be resolved through community consensus
                  {:else}
                    Market will be resolved through trusted oracle providers
                  {/if}
                </p>
              </div>

              <!-- Rules -->
              <div class="space-y-2">
                <label for="rules" class="block text-xs uppercase font-medium text-kong-text-primary">
                  Resolution Rules
                </label>
                <textarea
                  id="rules"
                  bind:value={rules}
                  rows="4"
                  class="w-full p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary placeholder:text-kong-text-secondary/50 focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none resize-none transition-all duration-200"
                  placeholder="Specify clear rules for how this market will be resolved..."
                />
                {#if formErrors.rules}
                  <p class="text-sm text-kong-text-accent-red flex items-center gap-2 mt-2">
                    <AlertTriangle size={16} />
                    {formErrors.rules}
                  </p>
                {/if}
              </div>
            </div>
          {:else if currentStep === 2}
            <div class="space-y-6">
              <div class="space-y-2">
                <label class="block text-xs uppercase font-medium text-kong-text-primary">
                  What are the possible outcomes?
                </label>
                <div class="space-y-3">
                  {#each outcomes as outcome, i}
                    <div class="flex gap-3 items-center">
                      <input
                        type="text"
                        bind:value={outcomes[i]}
                        placeholder={`Outcome ${i + 1}`}
                        class="flex-1 p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary placeholder:text-kong-text-secondary/50 focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200"
                      />
                      {#if i >= 2}
                        <button
                          type="button"
                          on:click={() => removeOutcome(i)}
                          class="p-3 text-kong-text-accent-red hover:bg-kong-accent-red/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      {/if}
                    </div>
                  {/each}
                  <button
                    type="button"
                    on:click={addOutcome}
                    class="w-full p-4 bg-kong-bg-dark rounded-lg border border-kong-border hover:border-kong-accent-blue hover:text-kong-accent-blue flex items-center justify-center gap-2 transition-all duration-200 text-kong-text-secondary group"
                  >
                    <Plus size={20} class="group-hover:scale-110 transition-transform duration-200" />
                    Add Another Outcome
                  </button>
                </div>
                {#if formErrors.outcomes}
                  <p class="text-sm text-kong-text-accent-red flex items-center gap-2 mt-2">
                    <AlertTriangle size={16} />
                    {formErrors.outcomes}
                  </p>
                {/if}
              </div>
            </div>
          {:else if currentStep === 3}
            <div class="space-y-6">
              <div class="space-y-2">
                <label class="block text-xs uppercase font-medium text-kong-text-primary">
                  When will the market end?
                </label>
                
                <div class="space-y-4">
                  <div class="flex gap-4">
                    <label class="flex-1 flex items-center gap-3 p-4 bg-kong-bg-dark rounded-lg border cursor-pointer transition-all duration-200 {endTimeType === 'Duration' ? 'border-kong-accent-blue bg-kong-accent-blue/5' : 'border-kong-border hover:border-kong-border-light'}">
                      <input
                        type="radio"
                        bind:group={endTimeType}
                        value="Duration"
                        class="hidden"
                      />
                      <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {endTimeType === 'Duration' ? 'border-kong-accent-blue' : 'border-kong-text-secondary'}">
                        {#if endTimeType === 'Duration'}
                          <div class="w-3 h-3 rounded-full bg-kong-accent-blue"></div>
                        {/if}
                      </div>
                      <span class="text-lg">Duration</span>
                    </label>
                    <label class="flex-1 flex items-center gap-3 p-4 bg-kong-bg-dark rounded-lg border cursor-pointer transition-all duration-200 {endTimeType === 'SpecificDate' ? 'border-kong-accent-blue bg-kong-accent-blue/5' : 'border-kong-border hover:border-kong-border-light'}">
                      <input
                        type="radio"
                        bind:group={endTimeType}
                        value="SpecificDate"
                        class="hidden"
                      />
                      <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {endTimeType === 'SpecificDate' ? 'border-kong-accent-blue' : 'border-kong-text-secondary'}">
                        {#if endTimeType === 'SpecificDate'}
                          <div class="w-3 h-3 rounded-full bg-kong-accent-blue"></div>
                        {/if}
                      </div>
                      <span class="text-lg">Specific Date</span>
                    </label>
                  </div>

                  {#if endTimeType === "Duration"}
                    <div class="flex items-center gap-3">
                      <input
                        type="number"
                        bind:value={duration}
                        min="1"
                        class="w-32 p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200"
                      />
                      <span class="text-lg text-kong-text-secondary">hours from now</span>
                    </div>
                  {:else}
                    <div class="flex gap-3">
                      <input
                        type="date"
                        bind:value={specificDate}
                        class="flex-1 p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200"
                      />
                      <input
                        type="time"
                        bind:value={specificTime}
                        class="flex-1 p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200"
                      />
                    </div>
                  {/if}
                </div>
                {#if formErrors.duration || formErrors.specificDate}
                  <p class="text-sm text-kong-text-accent-red flex items-center gap-2 mt-2">
                    <AlertTriangle size={16} />
                    {formErrors.duration || formErrors.specificDate}
                  </p>
                {/if}
              </div>
            </div>
          {:else if currentStep === 4}
            <div class="space-y-6">
              <div class="">
                <h3 class="text-xl font-bold mb-4">Market Preview</h3>
                <div class="space-y-4">
                  <Panel
                    variant="transparent"
                    className="relative !rounded flex flex-col min-h-[200px] sm:min-h-[220px]"
                  >
                    <!-- Header section -->
                    <div class="flex-initial">
                      <div class="flex justify-between items-start mb-2 sm:mb-3">
                        <div class="flex-1">
                          <div class="text-sm sm:text-base line-clamp-2 font-medium mb-1 sm:mb-1.5 text-kong-text-primary text-left relative min-h-[2.5rem] sm:min-h-[3rem] w-full">
                            <span class="block pr-3">{question}</span>
                          </div>
                          <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 text-sm">
                            <span class="px-1.5 py-0.5 bg-kong-pm-accent/10 text-kong-pm-accent rounded text-xs font-medium">
                              {formatCategory(category)}
                            </span>
                            <span class="flex items-center gap-1 text-kong-pm-text-secondary text-xs whitespace-nowrap">
                              <Calendar class="w-3 h-3" />
                              {#if endTimeType === "Duration"}
                                {duration} hours from now
                              {:else}
                                {new Date(`${specificDate}T${specificTime}`).toLocaleString()}
                              {/if}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Outcomes section -->
                    <div class="flex-1 flex flex-col">
                      <div class="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
                        {#each outcomes.filter(o => o.trim()) as outcome, i}
                          <div class="relative group/outcome rounded">
                            <div class="h-8 sm:h-10 bg-kong-bg-dark/10 rounded p-1.5 transition-colors relative w-full">
                              <div class="relative flex justify-between items-center h-full gap-2">
                                <div class="flex items-center gap-2 min-w-0">
                                  <span class="font-medium text-kong-text-primary text-xs sm:text-sm truncate">
                                    {outcome}
                                  </span>
                                </div>
                                <div class="text-right flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                  <div class="text-kong-pm-accent font-bold text-xs sm:text-sm whitespace-nowrap">
                                    50.0%
                                  </div>
                                  <div class="text-xs text-kong-pm-text-secondary hidden sm:block">
                                    $0.00
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        {/each}
                      </div>

                      <!-- Push footer to bottom -->
                      <div class="flex-1"></div>

                      <!-- Card Footer -->
                      <div class="pt-1.5 sm:pt-2 border-t border-kong-pm-border">
                        <div class="flex items-center justify-center">
                          <div class="w-full flex items-center justify-center py-1.5 sm:py-2 border shadow-sm border-kong-accent-green/50 text-kong-text-accent-green rounded font-medium text-xs sm:text-sm">
                            <Coins class="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5" />
                            Place Bet
                          </div>
                        </div>
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            </div>
          {/if}

          {#if error}
            <div class="mt-6 p-4 rounded-lg border border-kong-accent-red/20 bg-kong-accent-red/5 text-kong-text-accent-red flex items-center gap-3">
              <AlertTriangle size={20} />
              <p>{error}</p>
            </div>
          {/if}

          <div class="mt-8 flex justify-between gap-4 pt-6 border-t border-kong-border">
            <div>
              {#if currentStep > 1}
                <button
                  type="button"
                  on:click={prevStep}
                  class="px-6 py-3 bg-kong-bg-dark text-kong-text-primary rounded-lg font-medium hover:bg-kong-surface-light transition-all duration-200"
                >
                  Back
                </button>
              {:else}
                <button
                  type="button"
                  on:click={() => goto("/predict")}
                  class="px-6 py-3 bg-kong-bg-dark text-kong-text-primary rounded-lg font-medium hover:bg-kong-surface-light transition-all duration-200"
                >
                  Cancel
                </button>
              {/if}
            </div>
            <div>
              {#if currentStep < totalSteps}
                <button
                  type="button"
                  on:click={nextStep}
                  class="px-8 py-3 bg-kong-accent-blue text-white rounded-lg font-medium hover:bg-kong-accent-blue-hover transition-all duration-200"
                >
                  Continue
                </button>
              {:else}
                <button
                  type="submit"
                  disabled={loading}
                  class="px-8 py-3 bg-kong-accent-blue text-white rounded-lg font-medium hover:bg-kong-accent-blue-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 min-w-[140px]"
                >
                  {#if loading}
                    <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  {:else}
                    Create Market
                  {/if}
                </button>
              {/if}
            </div>
          </div>
        </Panel>
      {/key}
    </form>
  </div>
</div>

<style>
  /* Hide default radio button styles */
  input[type="radio"] {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }

  /* Custom styles for date and time inputs */
  input[type="date"],
  input[type="time"] {
    min-height: 48px;
  }

  /* Remove calendar icon from date input */
  input[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(0.7);
    cursor: pointer;
  }

  /* Remove spinner from number input */
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] {
    -moz-appearance: textfield;
  }
</style>
