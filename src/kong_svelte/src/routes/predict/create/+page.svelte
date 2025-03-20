<script lang="ts">
  import { createMarket, getAllCategories, isAdmin } from "$lib/api/predictionMarket";
  import { uploadFile } from "$lib/api/upload";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { toastStore } from "$lib/stores/toastStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import { AlertTriangle, Plus, Trash2, ClipboardList, Target, Clock, CheckCircle, HelpCircle, Tag, Gavel, ScrollText, ListChecks, Calendar, TriangleAlert, Coins, Image, Upload } from "lucide-svelte";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { formatCategory } from "$lib/utils/numberFormatUtils";
  import { fade, fly } from 'svelte/transition';
  import { auth } from "$lib/stores/auth";

  // Constants
  const TOTAL_STEPS = 4;
  const DEFAULT_DURATION = 24; // hours
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const MIN_IMAGE_DIMENSION = 200; // pixels
  const DEBOUNCE_DELAY = 300; // ms
  
  // Debounce utility function
  function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timer);
      timer = setTimeout(() => func(...args), delay);
    };
  }

  // Form state
  const formState = {
    question: "",
    category: "Other",
    rules: "",
    outcomes: ["", ""] as string[],
    resolutionMethod: "Admin",
    endTimeType: "Duration",
    duration: DEFAULT_DURATION,
    specificDate: "",
    specificTime: "",
    imageFile: null as File | null,
    imageUrl: null as string | null,
  };
  
  // UI state
  let currentStep = 1;
  let loading = false;
  let uploadingImage = false;
  let loadingCategories = true;
  let isUserAdmin = false;
  let categories: string[] = [];
  let formErrors: Record<string, string> = {};
  let error: string | null = null;
  let imageError: string | null = null;
  let categoryError: string | null = null;
  
  // Create separate variables for radio buttons
  let endTimeType = formState.endTimeType;
  
  // Update formState when endTimeType changes
  $: formState.endTimeType = endTimeType;
  
  // Derived values
  $: questionError = formState.question.length > 200 ? "Question must be less than 200 characters" : "";
  $: validOutcomes = formState.outcomes.filter(o => o.trim());
  
  // URL parameter handling with debouncing
  $: if (browser && currentStep > 1) {
    debouncedUpdateURL();
  }
  
  // Create debounced version of updateURL
  const debouncedUpdateURL = debounce(() => updateURL(), DEBOUNCE_DELAY);
  
  function updateURL() {
    if (!browser) return;
    
    const params = new URLSearchParams();
    params.set('step', currentStep.toString());
    
    // Only add params relevant to current and previous steps
    if (currentStep > 1) {
      params.set('question', formState.question);
      params.set('category', formState.category);
      params.set('rules', formState.rules);
    }
    
    if (currentStep > 2) {
      params.set('outcomes', JSON.stringify(formState.outcomes));
    }
    
    if (currentStep > 3) {
      params.set('resolutionMethod', formState.resolutionMethod);
      params.set('endTimeType', formState.endTimeType);
      params.set('duration', formState.duration.toString());
      if (formState.specificDate) params.set('specificDate', formState.specificDate);
      if (formState.specificTime) params.set('specificTime', formState.specificTime);
    }

    goto(`?${params.toString()}`, { replaceState: true });
  }
  
  // Load state from URL and fetch categories
  onMount(async () => {
    try {
      // Fetch all available categories
      const fetchedCategories = await getAllCategories();
      categories = Array.isArray(fetchedCategories) && fetchedCategories.length > 0 
        ? fetchedCategories 
        : ["Other"];
      
      // Ensure "Other" is always available as a fallback
      if (!categories.includes("Other")) {
        categories.push("Other");
      }
    } catch (e) {
      console.error("Failed to load categories:", e);
      categories = ["Other"]; // Default fallback
      categoryError = "Failed to load categories. Using default.";
    } finally {
      loadingCategories = false;
    }

    // Restore state from URL if parameters exist
    const params = new URLSearchParams(window.location.search);
    if (params.has('step')) {
      currentStep = parseInt(params.get('step') || '1');
      formState.question = params.get('question') || '';
      formState.category = params.get('category') || 'Other';
      formState.rules = params.get('rules') || '';
      
      try {
        const savedOutcomes = params.get('outcomes');
        if (savedOutcomes) {
          formState.outcomes = JSON.parse(savedOutcomes);
        }
      } catch (e) {
        console.error('Failed to parse outcomes from URL:', e);
      }
      
      formState.resolutionMethod = params.get('resolutionMethod') || 'Admin';
      // Set both the form state and the local variable
      const loadedEndTimeType = params.get('endTimeType') || 'Duration';
      formState.endTimeType = loadedEndTimeType;
      endTimeType = loadedEndTimeType;
      
      formState.duration = parseInt(params.get('duration') || String(DEFAULT_DURATION));
      formState.specificDate = params.get('specificDate') || '';
      formState.specificTime = params.get('specificTime') || '';
    }
  });
  
  // Check admin status
  $: if ($auth.isConnected) {
    isAdmin($auth.account.owner).then((admin) => {
      isUserAdmin = admin;
      if (!isUserAdmin) {
        toastStore.add({
          title: "Access Denied",
          message: "Only admins can create prediction markets",
          type: "error",
        });
        goto("/predict");
      }
    });
  }
  
  // Form navigation
  function nextStep() {
    if (validateCurrentStep()) {
      currentStep = Math.min(currentStep + 1, TOTAL_STEPS);
    }
  }
  
  function prevStep() {
    currentStep = Math.max(currentStep - 1, 1);
  }
  
  // Outcome management
  function addOutcome() {
    formState.outcomes = [...formState.outcomes, ""];
  }
  
  function removeOutcome(index: number) {
    if (formState.outcomes.length > 2) {
      formState.outcomes = formState.outcomes.filter((_, i) => i !== index);
    }
  }
  
  // Debounced validation
  const debouncedValidate = debounce(() => {
    validateCurrentStep();
  }, DEBOUNCE_DELAY);
  
  // Validation
  function validateCurrentStep(): boolean {
    formErrors = {};
    
    if (currentStep === 1) {
      if (!formState.question.trim()) {
        formErrors.question = "Question is required";
      }
      if (!formState.rules.trim()) {
        formErrors.rules = "Rules are required";
      }
    } else if (currentStep === 2) {
      if (formState.outcomes.some(outcome => !outcome.trim())) {
        formErrors.outcomes = "All outcomes must be filled";
      }
    } else if (currentStep === 3) {
      if (formState.endTimeType === "Duration") {
        if (!formState.duration || formState.duration < 1) {
          formErrors.duration = "Duration must be at least 1 hour";
        }
      } else {
        if (!formState.specificDate || !formState.specificTime) {
          formErrors.specificDate = "Date and time are required";
        } else {
          const selectedDateTime = new Date(`${formState.specificDate}T${formState.specificTime}`);
          if (selectedDateTime <= new Date()) {
            formErrors.specificDate = "End time must be in the future";
          }
        }
      }
    }

    return Object.keys(formErrors).length === 0;
  }

  // Debounced image processing
  const debouncedImageProcessing = debounce((file: File) => {
    processImageFile(file);
  }, DEBOUNCE_DELAY);

  async function processImageFile(file: File) {
    imageError = null;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      imageError = 'Please upload an image file';
      return;
    }
    
    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      imageError = 'Image size should be less than 5MB';
      return;
    }
    
    formState.imageFile = file;
    
    // Validate dimensions using FileReader
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (!e.target || typeof e.target.result !== 'string') {
          imageError = 'Failed to load image preview';
          return;
        }
        
        const img = document.createElement('img');
        img.onload = () => {
          if (img.width < MIN_IMAGE_DIMENSION || img.height < MIN_IMAGE_DIMENSION) {
            imageError = `Image dimensions should be at least ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION} pixels`;
          }
        };
        img.onerror = () => {
          imageError = 'Failed to process image';
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Image preview error:", err);
      imageError = err instanceof Error ? err.message : 'Failed to process image';
    }
  }

  // Image handling
  async function handleImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (files && files.length > 0) {
      const file = files[0];
      debouncedImageProcessing(file);
    }
  }
  
  function resetImage() {
    formState.imageFile = null;
    formState.imageUrl = null;
    imageError = null;
    document.getElementById('image')?.setAttribute('value', '');
  }

  // Form submission with debouncing to prevent double-clicks
  const debouncedSubmit = debounce(async () => {
    if (!validateCurrentStep()) return;

    loading = true;
    error = null;

    try {
      // Upload image if provided
      let uploadedImageUrl = null;
      if (formState.imageFile) {
        try {
          uploadingImage = true;
          uploadedImageUrl = await uploadFile(formState.imageFile);
          
          if (!uploadedImageUrl) {
            toastStore.add({
              title: "Warning",
              message: "Image upload failed, creating market without image",
              type: "warning"
            });
          }
        } catch (err) {
          console.error("Image upload error:", err);
          toastStore.add({
            title: "Image Upload Failed",
            message: "Creating market without image: " + (err instanceof Error ? err.message : String(err)),
            type: "warning"
          });
        } finally {
          uploadingImage = false;
        }
      }

      // Prepare end time
      const endTimeSpec = formState.endTimeType === "Duration"
        ? { Duration: BigInt(formState.duration * 60 * 60) } // Convert hours to seconds
        : { SpecificDate: BigInt(Math.floor(new Date(`${formState.specificDate}T${formState.specificTime}`).getTime() / 1000)) };

      // Prepare resolution method
      let resolutionMethodSpec;
      switch (formState.resolutionMethod) {
        case "Admin":
          resolutionMethodSpec = { Admin: null };
          break;
        case "Decentralized":
          resolutionMethodSpec = { Decentralized: { quorum: 100n } };
          break;
        case "Oracle":
          resolutionMethodSpec = {
            Oracle: {
              oracle_principals: [],
              required_confirmations: 1n
            }
          };
          break;
      }

      // Create market
      const result = await createMarket({
        question: formState.question,
        category: { [formState.category]: null },
        rules: formState.rules,
        outcomes: validOutcomes,
        resolutionMethod: resolutionMethodSpec,
        endTimeSpec,
        image_url: uploadedImageUrl
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
  }, DEBOUNCE_DELAY);

  async function handleSubmit() {
    debouncedSubmit();
  }
</script>

<svelte:head>
  <title>Create a Prediction Market - KongSwap</title>
  <meta name="description" content="Create a prediction market on KongSwap" />
</svelte:head>

<div class="min-h-screen text-kong-text-primary">
  {#if !$auth.isConnected && !isUserAdmin}
    <div class="max-w-xl mx-auto px-4 py-12 flex items-center justify-center">
      <div class="w-8 h-8 border-2 border-kong-accent-blue border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else}
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
              style="width: calc(({((currentStep - 1) / (TOTAL_STEPS - 1)) * (100 - 1.5)}% - 6px))"
            ></div>
            
            {#each Array(TOTAL_STEPS) as _, i}
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

        {#if currentStep === TOTAL_STEPS}
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
                    bind:value={formState.question}
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

                <!-- Image Upload -->
                <div class="space-y-2">
                  <label for="image" class="block text-xs uppercase font-medium text-kong-text-primary flex items-center gap-2">
                    Market Image <span class="text-xs lowercase normal-case text-kong-text-secondary">(optional)</span>
                    <div class="group relative">
                      <HelpCircle size={16} class="text-kong-text-secondary cursor-help" />
                      <div class="absolute left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-kong-bg-dark border border-kong-border rounded-lg text-sm text-kong-text-primary w-56 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                        Add an image to make your market more engaging. Recommended size 800x400px, max 5MB.
                        <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-kong-bg-dark border-t border-l border-kong-border transform rotate-45"></div>
                      </div>
                    </div>
                  </label>
                  
                  <div class="relative rounded-lg overflow-hidden border border-dashed border-kong-border hover:border-kong-accent-blue transition-colors">
                    <input 
                      type="file"
                      id="image"
                      accept="image/*"
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      on:change={handleImageUpload}
                      disabled={uploadingImage}
                    />
                    
                    {#if formState.imageFile}
                      <div class="relative group">
                        <img 
                          src={URL.createObjectURL(formState.imageFile)} 
                          alt="Preview" 
                          class="w-full h-48 object-cover" 
                        />
                        <div class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            type="button" 
                            class="p-2 bg-kong-bg-dark rounded-lg text-kong-text-primary hover:bg-kong-accent-red hover:text-white transition-colors"
                            on:click|stopPropagation={resetImage}
                            disabled={uploadingImage}
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                        
                        {#if uploadingImage}
                          <div class="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                            <div class="flex flex-col items-center">
                              <div class="w-8 h-8 border-2 border-kong-accent-blue border-t-transparent rounded-full animate-spin"></div>
                              <span class="text-white text-sm mt-2">Uploading...</span>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {:else}
                      <div class="flex flex-col items-center justify-center p-6 min-h-[12rem] text-kong-text-secondary">
                        <div class="w-12 h-12 mb-2 border-2 border-kong-text-secondary/30 rounded-full flex items-center justify-center">
                          <Image size={24} class="text-kong-text-secondary/70" />
                        </div>
                        <p class="text-sm mb-1">Drag & drop an image or click to browse</p>
                        <p class="text-xs text-kong-text-secondary/70">PNG, JPG, WEBP up to 5MB</p>
                      </div>
                    {/if}
                  </div>
                  
                  {#if imageError}
                    <p class="text-sm text-kong-text-accent-red flex items-center gap-2 mt-2">
                      <AlertTriangle size={16} />
                      {imageError}
                    </p>
                  {/if}
                </div>

                <!-- Category -->
                <div class="space-y-2">
                  <label for="category" class="block text-xs uppercase font-medium text-kong-text-primary">
                    Category
                  </label>
                  <div class="relative">
                    {#if loadingCategories}
                      <div class="w-full p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-secondary flex items-center justify-between">
                        <span>Loading categories...</span>
                        <div class="w-5 h-5 border-2 border-kong-text-secondary border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    {:else}
                      <select
                        id="category"
                        bind:value={formState.category}
                        class="w-full p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary appearance-none focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200 pr-10"
                      >
                        {#each categories as cat}
                          <option value={cat}>{cat}</option>
                        {/each}
                      </select>
                      <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-kong-text-secondary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    {/if}
                  </div>
                  {#if categoryError}
                    <p class="text-sm text-kong-text-accent-red flex items-center gap-2 mt-2">
                      <AlertTriangle size={16} />
                      {categoryError}
                    </p>
                  {/if}
                </div>

                <!-- Resolution Method -->
                <div class="space-y-2">
                  <label for="resolutionMethod" class="block text-xs uppercase font-medium text-kong-text-primary">
                    How will this be resolved?
                  </label>
                  <div class="relative">
                    <select
                      id="resolutionMethod"
                      bind:value={formState.resolutionMethod}
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
                    {#if formState.resolutionMethod === "Admin"}
                      Market will be resolved by platform administrators
                    {:else if formState.resolutionMethod === "Decentralized"}
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
                    bind:value={formState.rules}
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
                    {#each formState.outcomes as outcome, i}
                      <div class="flex gap-3 items-center">
                        <input
                          type="text"
                          bind:value={formState.outcomes[i]}
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
                      <label class="flex-1 flex items-center gap-3 p-4 bg-kong-bg-dark rounded-lg border cursor-pointer transition-all duration-200 {formState.endTimeType === 'Duration' ? 'border-kong-accent-blue bg-kong-accent-blue/5' : 'border-kong-border hover:border-kong-border-light'}">
                        <input
                          type="radio"
                          bind:group={endTimeType}
                          value="Duration"
                          class="hidden"
                        />
                        <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {formState.endTimeType === 'Duration' ? 'border-kong-accent-blue' : 'border-kong-text-secondary'}">
                          {#if formState.endTimeType === 'Duration'}
                            <div class="w-3 h-3 rounded-full bg-kong-accent-blue"></div>
                          {/if}
                        </div>
                        <span class="text-lg">Duration</span>
                      </label>
                      <label class="flex-1 flex items-center gap-3 p-4 bg-kong-bg-dark rounded-lg border cursor-pointer transition-all duration-200 {formState.endTimeType === 'SpecificDate' ? 'border-kong-accent-blue bg-kong-accent-blue/5' : 'border-kong-border hover:border-kong-border-light'}">
                        <input
                          type="radio"
                          bind:group={endTimeType}
                          value="SpecificDate"
                          class="hidden"
                        />
                        <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {formState.endTimeType === 'SpecificDate' ? 'border-kong-accent-blue' : 'border-kong-text-secondary'}">
                          {#if formState.endTimeType === 'SpecificDate'}
                            <div class="w-3 h-3 rounded-full bg-kong-accent-blue"></div>
                          {/if}
                        </div>
                        <span class="text-lg">Specific Date</span>
                      </label>
                    </div>

                    {#if formState.endTimeType === "Duration"}
                      <div class="flex items-center gap-3">
                        <input
                          type="number"
                          bind:value={formState.duration}
                          min="1"
                          class="w-32 p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200"
                        />
                        <span class="text-lg text-kong-text-secondary">hours from now</span>
                      </div>
                    {:else}
                      <div class="flex gap-3">
                        <input
                          type="date"
                          bind:value={formState.specificDate}
                          class="flex-1 p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200"
                        />
                        <input
                          type="time"
                          bind:value={formState.specificTime}
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
                <div>
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
                              <span class="block pr-3">{formState.question}</span>
                            </div>
                            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 text-sm">
                              <span class="px-1.5 py-0.5 bg-kong-pm-accent/10 text-kong-pm-accent rounded text-xs font-medium">
                                {formatCategory(formState.category)}
                              </span>
                              <span class="flex items-center gap-1 text-kong-pm-text-secondary text-xs whitespace-nowrap">
                                <Calendar class="w-3 h-3" />
                                {#if formState.endTimeType === "Duration"}
                                  {formState.duration} hours from now
                                {:else}
                                  {new Date(`${formState.specificDate}T${formState.specificTime}`).toLocaleString()}
                                {/if}
                              </span>
                            </div>
                          </div>
                          
                          {#if formState.imageFile}
                            <div class="w-20 h-20 rounded overflow-hidden flex-shrink-0 ml-2">
                              <img 
                                src={URL.createObjectURL(formState.imageFile)} 
                                alt="Market image" 
                                class="w-full h-full object-cover" 
                              />
                            </div>
                          {/if}
                        </div>
                      </div>

                      <!-- Outcomes section -->
                      <div class="flex-1 flex flex-col">
                        <div class="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3">
                          {#each validOutcomes as outcome, i}
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
                {#if currentStep < TOTAL_STEPS}
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
  {/if}
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
