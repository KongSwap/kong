<script lang="ts">
  import {
    createMarket,
    getAllCategories,
    getSupportedTokens,
  } from "$lib/api/predictionMarket";
  import { uploadFile } from "$lib/api/upload";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { toastStore } from "$lib/stores/toastStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import {
    AlertTriangle,
    Trash2,
    Image,
    Plus,
    Coins,
    Calendar,
    DiamondPercent,
  } from "lucide-svelte";
  import { formatCategory } from "$lib/utils/numberFormatUtils";
  import { auth } from "$lib/stores/auth";
  import Dropdown from "$lib/components/common/Dropdown.svelte";
  import { fetchTokensByCanisterId } from "$lib/api";
  import LoadingWrapper from "$lib/components/common/LoadingWrapper.svelte";
  import { debounce } from "$lib/utils/debounce";
  import type { MarketFormState } from "$lib/utils/validators/marketValidators";
  import { validateAndReadImageFile } from "$lib/utils/imageUtils";
  import { buildCreateMarketInput } from "$lib/utils/marketUtils";
  import FormField from "$lib/components/common/FormField.svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import { DEFAULT_TOKENS } from "$lib/constants/canisterConstants";

  // Constants
  const DEFAULT_DURATION = 24; // hours
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const MIN_IMAGE_DIMENSION = 200; // pixels
  const DEBOUNCE_DELAY = 300; // ms

  // Form state using $state
  const formState = $state<
    MarketFormState & {
      imageFile: File | null;
      imageUrl: string | null;
      uses_time_weighting: boolean;
      token_id: string;
    }
  >({
    question: "",
    category: "Crypto",
    rules: "",
    outcomes: ["", ""] as string[],
    resolutionMethod: "Admin",
    endTimeType: "Duration",
    duration: DEFAULT_DURATION,
    specificDate: "",
    specificTime: "",
    imageFile: null as File | null,
    imageUrl: null as string | null,
    uses_time_weighting: true,
    token_id: DEFAULT_TOKENS.kong,
  });

  // UI state using $state
  let loading = $state(false);
  let uploadingImage = $state(false);
  let loadingCategories = $state(true);
  let isUserAdmin = $state(false);
  let categories = $state<string[]>([]);
  let formErrors = $state<Record<string, string>>({});
  let error = $state<string | null>(null);
  let imageError = $state<string | null>(null);
  let categoryError = $state<string | null>(null);
  let supportedTokens = $state<any[]>([]);
  let loadingTokens = $state(true);
  let showConfirmationModal = $state(false);
  let tokenDropdownOpen = $state(false);

  // Derived values using $derived
  const questionError = $derived(
    formState.question.length > 200
      ? "Question must be less than 200 characters"
      : "",
  );
  const validOutcomes = $derived(formState.outcomes.filter((o) => o.trim()));

  // Load state and fetch categories
  onMount(async () => {
    try {
      // Fetch all available categories
      const fetchedCategories = await getAllCategories();
      categories =
        Array.isArray(fetchedCategories) && fetchedCategories.length > 0
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

    // Fetch supported tokens
    try {
      const supportedTokensRes = await getSupportedTokens();
      supportedTokens = await fetchTokensByCanisterId(
        supportedTokensRes.map((token) => token.id),
      );
      // Only set the default if not already set or if the current value is not in the list
      if (
        !formState.token_id ||
        !supportedTokens.some((t) => t.address === formState.token_id)
      ) {
        // Try to set to KONG if available, else fallback to first token
        const kongToken = supportedTokens.find((t) => t.address === DEFAULT_TOKENS.kong);
        formState.token_id = kongToken
          ? kongToken.address
          : supportedTokens[0]?.address;
      }
    } catch (e) {
      supportedTokens = [];
    } finally {
      loadingTokens = false;
    }

    // Restore state from URL
    const params = new URLSearchParams(window.location.search);
    formState.question = params.get("question") || "";
    formState.category = params.get("category") || "Other";
    formState.rules = params.get("rules") || "";

    try {
      const savedOutcomes = params.get("outcomes");
      if (savedOutcomes) {
        formState.outcomes = JSON.parse(savedOutcomes);
      }
    } catch (e) {
      console.error("Failed to parse outcomes from URL:", e);
    }

    formState.resolutionMethod = params.get("resolutionMethod") || "Admin";
    formState.endTimeType = (params.get("endTimeType") ||
      "Duration") as MarketFormState["endTimeType"];
    formState.duration = parseInt(
      params.get("duration") || String(DEFAULT_DURATION),
    );
    formState.specificDate = params.get("specificDate") || "";
    formState.specificTime = params.get("specificTime") || "";
  });

  // Outcome management
  function addOutcome() {
    formState.outcomes = [...formState.outcomes, ""];
  }

  function removeOutcome(index: number) {
    if (formState.outcomes.length > 2) {
      formState.outcomes = formState.outcomes.filter((_, i) => i !== index);
    }
  }

  // Validation
  function validateForm(): boolean {
    formErrors = {}; // Reset errors
    if (!formState.question.trim())
      formErrors.question = "Question is required.";
    if (validOutcomes.length < 2)
      formErrors.outcomes = "At least two valid outcomes are required.";
    if (!formState.rules.trim()) formErrors.rules = "Rules are required.";
    if (
      formState.endTimeType === "SpecificDate" &&
      (!formState.specificDate || !formState.specificTime)
    ) {
      formErrors.specificDate = "Specific date and time are required.";
    } else if (
      formState.endTimeType === "Duration" &&
      formState.duration <= 0
    ) {
      formErrors.duration = "Duration must be positive.";
    }

    return Object.keys(formErrors).length === 0;
  }

  // Debounced image processing
  const debouncedImageProcessing = debounce((file: File) => {
    processImageFile(file);
  }, DEBOUNCE_DELAY);

  async function processImageFile(file: File) {
    imageError = null;
    const { error, dataUrl } = await validateAndReadImageFile(
      file,
      MAX_IMAGE_SIZE,
      MIN_IMAGE_DIMENSION,
    );
    if (error) {
      imageError = error;
      formState.imageFile = null;
      formState.imageUrl = null;
      return;
    }
    formState.imageFile = file;
    formState.imageUrl = dataUrl!;
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
    const imageInput = document.getElementById(
      "image",
    ) as HTMLInputElement | null;
    if (imageInput) {
      imageInput.value = "";
    }
  }

  // Final submission logic
  const confirmAndSubmit = debounce(async () => {
    if (!validateForm()) return;

    loading = true;
    error = null;
    showConfirmationModal = false;

    try {
      let uploadedImageUrl = null;
      if (formState.imageFile) {
        try {
          uploadingImage = true;
          uploadedImageUrl = await uploadFile(formState.imageFile);

          if (!uploadedImageUrl) {
            toastStore.add({
              title: "Warning",
              message: "Image upload failed, creating market without image",
              type: "warning",
            });
          }
        } catch (err) {
          console.error("Image upload error:", err);
          toastStore.add({
            title: "Image Upload Failed",
            message:
              "Creating market without image: " +
              (err instanceof Error ? err.message : String(err)),
            type: "warning",
          });
        } finally {
          uploadingImage = false;
        }
      }

      const payload = buildCreateMarketInput({
        ...formState,
        imageUrl: uploadedImageUrl,
      });
      const result = await createMarket(payload);

      if ("Ok" in result) {
        toastStore.add({
          title: "Market Created",
          message: "Your prediction market has been created successfully",
          type: "success",
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

  // Handles the initial form submission click
  async function handleSubmit() {
    if (validateForm()) {
      showConfirmationModal = true;
      error = null;
    } else {
      const firstErrorElement = document.querySelector('[aria-invalid="true"]');
      firstErrorElement?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      toastStore.add({
        title: "Validation Errors",
        message: "Please fix the errors highlighted in the form.",
        type: "error",
      });
    }
  }
</script>

<svelte:head>
  <title>Create a Prediction Market - KongSwap</title>
  <meta name="description" content="Create a prediction market on KongSwap" />
</svelte:head>

<div class="min-h-screen text-kong-text-primary">
  {#if !$auth.isConnected && !isUserAdmin}
    <div class="max-w-xl mx-auto px-4 py-12 flex items-center justify-center">
      <div
        class="w-8 h-8 border-2 border-kong-accent-blue border-t-transparent rounded-full animate-spin"
      ></div>
    </div>
  {:else}
    <PageHeader
      title="New Prediction Market"
      description="Fill out the form below to create a new prediction market"
      icon={DiamondPercent}
    />
    <div class="max-w-7xl mx-auto px-4 mt-4">
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div class="grid lg:grid-cols-2 gap-8 mb-8">
          <!-- Left Column: Details & Timeline in one Panel -->
          <Panel variant="solid">
            <div class="space-y-8">
              <!-- Section 1: Details (Question, Image, Category, Token, Resolution, Rules) -->
              <div class="space-y-4">
                <h2
                  class="text-2xl font-semibold text-kong-text-primary border-b border-kong-border pb-2 mb-2"
                >
                  Market Details
                </h2>
                <FormField
                  id="question"
                  label="What's your question?"
                  helpText="Keep your question clear and specific"
                  error={formErrors.question}
                >
                  <input
                    type="text"
                    id="question"
                    bind:value={formState.question}
                    class="w-full p-4 bg-kong-bg-dark rounded-lg border {questionError
                      ? 'border-kong-accent-red'
                      : 'border-kong-border'} text-lg text-kong-text-primary placeholder:text-kong-text-secondary/50 focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200"
                    placeholder="e.g., Will Bitcoin reach $100,000 by the end of 2024?"
                  />
                </FormField>

                <!-- Image Upload -->
                <FormField
                  id="image"
                  label="Market Image (optional)"
                  helpText="Add an image to make your market more engaging. Recommended size 800x400px, max 5MB."
                  error={imageError}
                >
                  <div
                    class="relative rounded-lg overflow-hidden border border-dashed border-kong-border hover:border-kong-accent-blue transition-colors"
                  >
                    <input
                      type="file"
                      id="image"
                      accept="image/*"
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      on:change={handleImageUpload}
                      disabled={uploadingImage}
                    />

                    {#if formState.imageFile && formState.imageUrl}
                      <div class="relative group">
                        <img
                          src={formState.imageUrl}
                          alt="Preview"
                          class="w-full h-48 object-cover"
                        />
                        <div
                          class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
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
                          <div
                            class="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center"
                          >
                            <div class="flex flex-col items-center">
                              <div
                                class="w-8 h-8 border-2 border-kong-accent-blue border-t-transparent rounded-full animate-spin"
                              ></div>
                              <span class="text-white text-sm mt-2"
                                >Uploading...</span
                              >
                            </div>
                          </div>
                        {/if}
                      </div>
                    {:else}
                      <div
                        class="flex flex-col items-center justify-center p-6 min-h-[12rem] text-kong-text-secondary"
                      >
                        <div
                          class="w-12 h-12 mb-2 border-2 border-kong-text-secondary/30 rounded-full flex items-center justify-center"
                        >
                          <Image
                            size={24}
                            class="text-kong-text-secondary/70"
                          />
                        </div>
                        <p class="text-sm mb-1">
                          Drag & drop an image or click to browse
                        </p>
                        <p class="text-xs text-kong-text-secondary/70">
                          PNG, JPG, WEBP up to 5MB
                        </p>
                      </div>
                    {/if}
                  </div>
                </FormField>

                <!-- Category -->
                <FormField
                  id="category"
                  label="Category"
                  error={categoryError || formErrors.category}
                >
                  <LoadingWrapper
                    loading={loadingCategories}
                    text="Loading categories..."
                  >
                    <div class="relative">
                      <select
                        id="category"
                        bind:value={formState.category}
                        class="w-full p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary appearance-none focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200 pr-10"
                      >
                        {#each categories as cat}
                          <option value={cat}>{cat}</option>
                        {/each}
                      </select>
                      <div
                        class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-kong-text-secondary"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg
                        >
                      </div>
                    </div>
                  </LoadingWrapper>
                </FormField>

                <!-- Token Selection -->
                <FormField
                  id="token"
                  label="Token"
                  helpText="Token to be used to make predictions on the market"
                >
                  <LoadingWrapper
                    loading={loadingTokens}
                    text="Loading tokens..."
                  >
                    <Dropdown width="w-full" bind:open={tokenDropdownOpen}>
                      <div
                        slot="trigger"
                        class="flex items-center gap-2 p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary cursor-pointer min-h-[3rem]"
                      >
                        {#if formState.token_id}
                          {#if supportedTokens.find((t) => t.address === formState.token_id)?.logo_url}
                            <img
                              src={supportedTokens.find(
                                (t) => t.address === formState.token_id,
                              )?.logo_url}
                              alt="logo"
                              class="w-6 h-6 rounded-full object-cover"
                            />
                          {/if}
                          <span>
                            {supportedTokens.find(
                              (t) => t.address === formState.token_id,
                            )?.symbol
                              ? `${supportedTokens.find((t) => t.address === formState.token_id)?.symbol} - `
                              : ""}
                            {supportedTokens.find(
                              (t) => t.address === formState.token_id,
                            )?.name}
                          </span>
                        {:else}
                          Select a token...
                        {/if}
                        <svg
                          class="ml-auto w-4 h-4 text-kong-text-secondary"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          viewBox="0 0 24 24"
                          ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m6 9 6 6 6-6"
                          /></svg
                        >
                      </div>
                      <div>
                        {#each supportedTokens as token}
                          <div
                            class="px-4 py-3 text-left hover:bg-kong-bg-secondary/20 hover:text-kong-primary group flex items-center gap-2 transition-colors cursor-pointer"
                            on:click={() => {
                              formState.token_id = token.address;
                              tokenDropdownOpen = false;
                            }}
                          >
                            {#if token.logo_url}
                              <img
                                src={token.logo_url}
                                alt="logo"
                                class="w-6 h-6 rounded-full object-cover mr-2"
                              />
                            {/if}
                            <span
                              >{token.symbol
                                ? `${token.symbol} - `
                                : ""}{token.name}</span
                            >
                          </div>
                        {/each}
                      </div>
                    </Dropdown>
                  </LoadingWrapper>
                </FormField>

                <!-- Resolution Method -->
                <FormField
                  id="resolutionMethod"
                  label="How will this be resolved?"
                >
                  <div class="relative">
                    <select
                      id="resolutionMethod"
                      bind:value={formState.resolutionMethod}
                      class="w-full p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary appearance-none focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none transition-all duration-200 pr-10"
                    >
                      <option value="Admin">Admin Resolution</option>
                    </select>
                    <div
                      class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-kong-text-secondary"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg
                      >
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
                </FormField>

                <!-- Rules -->
                <FormField
                  id="rules"
                  label="Resolution Rules"
                  helpText="Specify rules for how this market will be settled. Be specific and clear."
                  error={formErrors.rules}
                >
                  <textarea
                    id="rules"
                    bind:value={formState.rules}
                    rows="4"
                    class="w-full p-4 bg-kong-bg-dark rounded-lg border border-kong-border text-lg text-kong-text-primary placeholder:text-kong-text-secondary/50 focus:border-kong-accent-blue focus:ring-2 focus:ring-kong-accent-blue/20 focus:outline-none resize-none transition-all duration-200"
                    placeholder="Specify clear rules for how this market will be resolved..."
                  />
                </FormField>
              </div>
            </div>
          </Panel>

          <!-- Right Column: Outcomes in its own Panel -->
          <Panel variant="solid">
            <div class="space-y-4">
              <h2
                class="text-2xl font-semibold text-kong-text-primary border-b border-kong-border pb-2 mb-2"
              >
                Outcomes
              </h2>
              <FormField
                id="outcomes"
                label="What are the possible outcomes?"
                error={formErrors.outcomes}
              >
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
                    <Plus
                      size={20}
                      class="group-hover:scale-110 transition-transform duration-200"
                    />
                    Add Another Outcome
                  </button>
                </div>
              </FormField>

              <h2
                class="text-2xl font-semibold text-kong-text-primary border-b border-kong-border pb-2"
              >
                Timeline
              </h2>
              <FormField
                id="endTimeType"
                label="When will the market end?"
                error={formErrors.duration ||
                  formErrors.specificDate ||
                  formErrors.specificTime}
              >
                <div class="space-y-4">
                  <div class="flex gap-4">
                    <label
                      class="flex-1 flex items-center gap-3 p-4 bg-kong-bg-dark rounded-lg border cursor-pointer transition-all duration-200 {formState.endTimeType ===
                      'Duration'
                        ? 'border-kong-accent-blue bg-kong-accent-blue/5'
                        : 'border-kong-border hover:border-kong-border-light'}"
                    >
                      <input
                        type="radio"
                        bind:group={formState.endTimeType}
                        value="Duration"
                        class="hidden"
                      />
                      <div
                        class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {formState.endTimeType ===
                        'Duration'
                          ? 'border-kong-accent-blue'
                          : 'border-kong-text-secondary'}"
                      >
                        {#if formState.endTimeType === "Duration"}
                          <div
                            class="w-3 h-3 rounded-full bg-kong-accent-blue"
                          ></div>
                        {/if}
                      </div>
                      <span class="text-lg">Duration</span>
                    </label>
                    <label
                      class="flex-1 flex items-center gap-3 p-4 bg-kong-bg-dark rounded-lg border cursor-pointer transition-all duration-200 {formState.endTimeType ===
                      'SpecificDate'
                        ? 'border-kong-accent-blue bg-kong-accent-blue/5'
                        : 'border-kong-border hover:border-kong-border-light'}"
                    >
                      <input
                        type="radio"
                        bind:group={formState.endTimeType}
                        value="SpecificDate"
                        class="hidden"
                      />
                      <div
                        class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {formState.endTimeType ===
                        'SpecificDate'
                          ? 'border-kong-accent-blue'
                          : 'border-kong-text-secondary'}"
                      >
                        {#if formState.endTimeType === "SpecificDate"}
                          <div
                            class="w-3 h-3 rounded-full bg-kong-accent-blue"
                          ></div>
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
                      <span class="text-lg text-kong-text-secondary"
                        >hours from now</span
                      >
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
              </FormField>
            </div>
          </Panel>
        </div>
        <!-- Error display area -->
        {#if error}
          <div
            class="mt-6 p-4 rounded-lg border border-kong-accent-red/20 bg-kong-accent-red/5 text-kong-text-accent-red flex items-center gap-3"
          >
            <AlertTriangle size={20} />
            <p>{error}</p>
          </div>
        {/if}

        <!-- Form action buttons -->
        <div class="mt-4 flex justify-end gap-2">
          <div>
            <button
              type="button"
              on:click={() => goto("/predict")}
              class="px-6 py-3 bg-kong-bg-dark text-kong-text-primary rounded-lg font-medium hover:bg-kong-surface-light transition-all duration-200"
            >
              Cancel
            </button>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              class="px-8 py-3 bg-kong-accent-blue text-white rounded-lg font-medium hover:bg-kong-accent-blue-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 min-w-[140px]"
            >
              {#if loading}
                <div
                  class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                ></div>
                Processing...
              {:else}
                Review & Submit
              {/if}
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Confirmation Modal -->
    <Modal
      bind:isOpen={showConfirmationModal}
      title="Confirm Market Creation"
      onClose={() => (showConfirmationModal = false)}
      width="500px"
    >
      <div class="space-y-4">
        <p class="text-kong-text-secondary">
          Please review your market details carefully. Once created, it cannot
          be modified.
        </p>
        <!-- Market Preview Panel (moved here) -->
        <Panel
          variant="transparent"
          className="relative !rounded flex flex-col min-h-[200px] sm:min-h-[220px] border border-kong-border"
        >
          <!-- Header section -->
          <div class="flex-initial">
            <div class="flex justify-between items-start mb-2 sm:mb-3">
              <div class="flex-1">
                <div
                  class="text-sm sm:text-base line-clamp-2 font-medium mb-1 sm:mb-1.5 text-kong-text-primary text-left relative min-h-[2.5rem] sm:min-h-[3rem] w-full"
                >
                  <span class="block pr-3"
                    >{formState.question || "Your Question Here"}</span
                  >
                </div>
                <div
                  class="flex flex-wrap items-center gap-1.5 sm:gap-2 text-sm"
                >
                  <span
                    class="px-1.5 py-0.5 bg-kong-pm-accent/10 text-kong-pm-accent rounded text-xs font-medium"
                  >
                    {formatCategory(formState.category)}
                  </span>
                  <span
                    class="flex items-center gap-1 text-kong-pm-text-secondary text-xs whitespace-nowrap"
                  >
                    <Calendar class="w-3 h-3" />
                    {#if formState.endTimeType === "Duration"}
                      {formState.duration > 0
                        ? `${formState.duration} hours from now`
                        : "Set duration"}
                    {:else if formState.specificDate && formState.specificTime}
                      {new Date(
                        `${formState.specificDate}T${formState.specificTime}`,
                      ).toLocaleString()}
                    {:else}
                      Set date & time
                    {/if}
                  </span>
                </div>
              </div>

              {#if formState.imageUrl}
                <div
                  class="w-20 h-20 rounded overflow-hidden flex-shrink-0 ml-2"
                >
                  <img
                    src={formState.imageUrl}
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
              {#if validOutcomes.length > 0}
                {#each validOutcomes as outcome, i}
                  <div class="relative group/outcome rounded">
                    <div
                      class="h-8 sm:h-10 bg-kong-bg-dark/10 rounded p-1.5 transition-colors relative w-full"
                    >
                      <div
                        class="relative flex justify-between items-center h-full gap-2"
                      >
                        <div class="flex items-center gap-2 min-w-0">
                          <span
                            class="font-medium text-kong-text-primary text-xs sm:text-sm truncate"
                          >
                            {outcome}
                          </span>
                        </div>
                        <div
                          class="text-right flex items-center gap-1 sm:gap-2 flex-shrink-0"
                        >
                          <div
                            class="text-kong-pm-accent font-bold text-xs sm:text-sm whitespace-nowrap"
                          >
                            {(100 / validOutcomes.length).toFixed(1)}%
                          </div>
                          <div
                            class="text-xs text-kong-pm-text-secondary hidden sm:block"
                          >
                            $0.00
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              {:else}
                <p class="text-kong-text-secondary text-sm text-center py-4">
                  Add outcomes above
                </p>
              {/if}
            </div>

            <!-- Push footer to bottom -->
            <div class="flex-1"></div>

            <!-- Card Footer -->
            <div class="pt-1.5 sm:pt-2 border-t border-kong-pm-border">
              <div class="flex items-center justify-center">
                <div
                  class="w-full flex items-center justify-center py-1.5 sm:py-2 border shadow-sm border-kong-accent-green/50 text-kong-text-accent-green rounded font-medium text-xs sm:text-sm"
                >
                  <Coins class="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5" />
                  Place Bet
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <!-- Modal action buttons -->
        <div class="mt-6 flex justify-end gap-4">
          <button
            type="button"
            on:click={() => (showConfirmationModal = false)}
            class="px-6 py-3 bg-kong-bg-dark text-kong-text-primary rounded-lg font-medium hover:bg-kong-surface-light transition-all duration-200"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            on:click={confirmAndSubmit}
            disabled={loading}
            class="px-8 py-3 bg-kong-accent-blue text-white rounded-lg font-medium hover:bg-kong-accent-blue-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 min-w-[180px]"
          >
            {#if loading}
              <div
                class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
              ></div>
              Creating...
            {:else}
              Confirm & Create Market
            {/if}
          </button>
        </div>
      </div>
    </Modal>
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
