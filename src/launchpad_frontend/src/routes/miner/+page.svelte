<script lang="ts">
  import { onMount } from "svelte";
  import { isConnected, backendActor } from '$lib/stores/wallet';
  import type { MinerTier } from '$lib/types';
  import { Principal } from '@dfinity/principal';

  let currentStep = 0;
  let selectedToken = "";
  let selectedTier: MinerTier | null = null;
  let minerCount = 1;
  let isLaunching = false;
  let launchStatus = "";
  let inputError = "";
  let availableTokens: [Principal, string][] = [];
  let searchTerm = "";
  let showCustomInput = false;
  let customTokenInput = "";

  // Enhanced miner tiers with accurate descriptions
  const MINER_TIERS: MinerTier[] = [
    { 
      type: "basic", 
      kong: 100, 
      color: "from-cyan-600 via-blue-500 to-blue-700",
      description: "Basic mining canister - Shared compute",
      benefits: [
        "1x mining speed",
        "Uses available network capacity",
        "Most cost-effective option"
      ],
      technicalDetails: "Mines when network capacity is available. May experience slower mining during high network load."
    },
    { 
      type: "standard", 
      kong: 200, 
      color: "from-emerald-600 via-cyan-500 to-teal-700",
      description: "Enhanced mining canister - 2x speed",
      benefits: [
        "2x mining speed",
        "Higher network priority",
        "Better performance"
      ],
      technicalDetails: "Doubled mining rate with improved network priority. Still uses shared compute resources."
    },
    { 
      type: "premium", 
      kong: 500, 
      color: "from-purple-600 via-cyan-500 to-indigo-700",
      description: "Reserved compute mining canister - 5x speed",
      benefits: [
        "5x mining speed",
        "Reserved compute allocation",
        "Consistent mining performance"
      ],
      technicalDetails: "Uses reserved compute resources for reliable mining performance regardless of network load. Higher operational costs but maximum consistency."
    }
  ];

  const steps = [
    { title: 'START', description: 'Begin miner creation' },
    { title: 'TOKEN', description: 'Select token to mine' },
    { title: 'TIER', description: 'Choose miner tier' },
    { title: 'QUANTITY', description: 'Set miner count' },
    { title: 'CONFIRM', description: 'Review and deploy' }
  ];

  // Demo tokens for PoC
  const DEMO_TOKENS = [
    { 
      principal: "rrkah-fqaaa-aaaaa-aaaaq-cai",
      name: "PepeComputer", 
      ticker: "PEPC",
      chain: "ICP",
      icon: "🐸",
      description: "First ever IC meme token",
      isDemo: true
    },
    { 
      principal: "qjdve-lqaaa-aaaaa-aaaeq-cai",
      name: "MemeCoin3000", 
      ticker: "MEME",
      chain: "ICP",
      icon: "🚀",
      description: "To the moon! (for testing)",
      isDemo: true
    },
    { 
      principal: "jzg5e-giaaa-aaaaa-qaaba-cai",
      name: "InternetDoge", 
      ticker: "IDOG",
      chain: "ICP",
      icon: "🐕",
      description: "Much wow, such IC",
      isDemo: true
    },
    { 
      principal: "k4qsa-4aaaa-aaaaa-qaabq-cai",
      name: "CatDAO", 
      ticker: "MEOW",
      chain: "ICP",
      icon: "😺",
      description: "Decentralized cat pictures",
      isDemo: true
    }
  ];

  // Auto-select first token by default
  selectedToken = DEMO_TOKENS[0].principal;

  // Function to validate Principal ID format
  function isValidPrincipal(input: string): boolean {
    try {
      Principal.fromText(input);
      return true;
    } catch {
      inputError = "Invalid Principal ID format";
      return false;
    }
  }

  // Filter tokens based on search term
  $: filteredTokens = DEMO_TOKENS.filter(token => 
    token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.principal.toLowerCase().includes(searchTerm.toLowerCase())
  );

  onMount(async () => {
    if ($isConnected && $backendActor) {
      try {
        // Fetch available tokens
        availableTokens = await $backendActor.list_token_backends();
      } catch (error) {
        console.error("Failed to fetch tokens:", error);
      }
    }
  });

  function validateCurrentStep(): boolean {
    inputError = "";
    
    switch (currentStep) {
      case 1:
        if (!selectedToken) {
          inputError = "Please select a token to mine";
          return false;
        }
        return true;
      
      case 2:
        if (!selectedTier) {
          inputError = "Please select a miner tier";
          return false;
        }
        return true;
      
      case 3:
        if (!minerCount || minerCount < 1 || minerCount > 10) {
          inputError = "Please enter a valid quantity (1-10)";
          return false;
        }
        return true;
      
      default:
        return true;
    }
  }

  function nextStep() {
    if (validateCurrentStep()) {
      currentStep++;
    }
  }

  function prevStep() {
    currentStep--;
  }

  function startProcess() {
    if ($isConnected) {
      currentStep = 1;
    } else {
      launchStatus = "Please connect your wallet first";
    }
  }

  async function deployMiners() {
    if (!$isConnected || !$backendActor) {
      launchStatus = "Please connect your wallet first";
      return;
    }

    try {
      isLaunching = true;
      launchStatus = "Initializing miner deployment...";
      
      const deployments = Array(minerCount).fill(null).map(() => 
        $backendActor.create_miner_with_kong({
          token_canister: selectedToken,
          amount: BigInt(selectedTier.kong * 1e8),
          slippage: 0.01
        })
      );

      const results = await Promise.all(deployments);
      const successCount = results.filter(r => r.Ok).length;
      
      if (successCount === minerCount) {
        launchStatus = `Successfully deployed ${minerCount} miners!`;
        currentStep = 0; // Reset flow
      } else {
        launchStatus = `Deployed ${successCount}/${minerCount} miners. Some deployments failed.`;
      }
    } catch (error) {
      launchStatus = `Error: ${error.message}`;
    } finally {
      isLaunching = false;
    }
  }
</script>

<div class="space-y-8">
  {#if !$isConnected}
    <div class="flex items-center justify-center h-[80vh]">
      <div class="relative w-full max-w-2xl p-8 overflow-hidden border-2 border-cyan-500 bg-black/90">
        <!-- Cyber grid background -->
        <div class="absolute inset-0 bg-grid-pattern opacity-10"></div>
        
        <!-- Glowing borders -->
        <div class="absolute top-0 left-0 w-32 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent"></div>
        <div class="absolute top-0 right-0 w-32 h-[1px] bg-gradient-to-l from-cyan-500 to-transparent"></div>
        <div class="absolute bottom-0 left-0 w-32 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent"></div>
        <div class="absolute bottom-0 right-0 w-32 h-[1px] bg-gradient-to-l from-cyan-500 to-transparent"></div>
        <div class="absolute top-0 left-0 w-[1px] h-32 bg-gradient-to-b from-cyan-500 to-transparent"></div>
        <div class="absolute top-0 right-0 w-[1px] h-32 bg-gradient-to-b from-cyan-500 to-transparent"></div>
        <div class="absolute bottom-0 left-0 w-[1px] h-32 bg-gradient-to-t from-cyan-500 to-transparent"></div>
        <div class="absolute bottom-0 right-0 w-[1px] h-32 bg-gradient-to-t from-cyan-500 to-transparent"></div>

        <div class="relative space-y-6 text-center">
          <div class="text-4xl font-bold text-white">ACCESS REQUIRED</div>
          <div class="text-xl text-cyan-400">Connect your wallet to deploy miners</div>
          <div class="p-4 mx-auto text-lg border w-fit border-cyan-500/30 bg-cyan-950/50">
            <span class="text-white">Required: </span>
            <span class="font-bold text-cyan-400">100-500 $KONG</span>
          </div>
          <div class="text-sm text-cyan-400/70">
            Initialize secure connection to proceed with miner deployment
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Step Indicator -->
    <div class="flex justify-between px-4 overflow-x-auto md:overflow-visible">
      {#each steps as step, index}
        <div class="flex items-center flex-shrink-0">
          <div class={`w-12 h-12 flex items-center justify-center rounded-full border-2 
            ${currentStep >= index ? 'border-cyan-400 text-cyan-400 bg-cyan-950' : 'border-gray-600 text-gray-600'}`}>
            {index + 1}
          </div>
          <div class="mt-2 text-xs text-center text-white">{step.title}</div>
        </div>
        {#if index < steps.length - 1}
          <div class="hidden md:block w-24 h-0.5 mx-2 ${currentStep > index ? 'bg-cyan-400' : 'bg-gray-600'}"></div>
        {/if}
      {/each}
    </div>

    <!-- Content Area -->
    <div class="p-4 border rounded-sm md:p-8 border-cyan-500/30 bg-black/90">
      {#if currentStep === 0}
        <!-- Start Screen -->
        <div class="space-y-6 text-center md:space-y-8">
          <h2 class="text-3xl font-bold text-white md:text-4xl">CREATE YOUR MINERS</h2>
          <p class="text-xl text-cyan-400">Deploy mining power to your tokens</p>
          <button 
            on:click={startProcess}
            class="block w-64 px-8 py-6 mx-auto text-2xl font-bold text-white transition-all duration-300 border-2 rounded-md border-cyan-400 hover:bg-cyan-500/20"
          >
            START →
          </button>
        </div>

      {:else if currentStep === 1}
        <!-- Token Selection -->
        <div class="max-w-xl mx-auto space-y-4 md:space-y-6">
          <h3 class="text-2xl font-bold text-white md:text-3xl">Select Token to Mine</h3>
          <p class="text-base md:text-lg text-cyan-400">Choose or enter a token contract address</p>
          
          <!-- Search and Custom Input -->
          <div class="space-y-3 md:space-y-4">
            <input
              type="text"
              placeholder="Search tokens by name, ticker, or principal..."
              class="w-full px-3 py-2 text-white bg-black border-2 rounded-lg md:px-4 md:py-3 border-cyan-500/30 focus:border-cyan-400 focus:outline-none"
              bind:value={searchTerm}
            />
            
            <div class="flex items-center space-x-2">
              <span class="text-sm text-cyan-400/70">Can't find your token?</span>
              <button
                on:click={() => showCustomInput = true}
                class="px-3 py-1 text-sm border rounded-full border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400"
              >
                + Add Custom
              </button>
            </div>

            {#if showCustomInput}
              <div class="p-4 border rounded-md border-cyan-500/30 bg-cyan-950/50">
                <input
                  type="text"
                  placeholder="Enter Principal ID (e.g. rrkah-fqaaa-aaaaa-aaaaq-cai)"
                  class="w-full px-4 py-2 font-mono text-sm text-white bg-black border rounded border-cyan-500/30"
                  bind:value={customTokenInput}
                />
                <button
                  on:click={() => {
                    if (isValidPrincipal(customTokenInput)) {
                      selectedToken = customTokenInput;
                      showCustomInput = false;
                    }
                  }}
                  class="px-4 py-2 mt-2 text-sm border rounded text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10"
                >
                  Confirm Custom Token
                </button>
              </div>
            {/if}
          </div>

          <!-- Token List -->
          <div class="grid gap-3 md:gap-4 overflow-y-auto max-h-[300px] md:max-h-[400px]">
            {#each filteredTokens as token}
              <button
                class="w-full p-3 md:p-4 text-left transition-all duration-300 border-2 rounded-md 
                  ${selectedToken === token.principal ? 
                    'border-cyan-400 bg-cyan-500/20' : 
                    'border-cyan-500/30 hover:bg-cyan-500/10'}"
                on:click={() => selectedToken = token.principal}
              >
                <div class="flex flex-col justify-between md:flex-row md:items-center">
                  <div class="flex items-center space-x-3">
                    <span class="text-xl md:text-2xl">{token.icon}</span>
                    <div>
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-white">{token.name}</span>
                        <span class="text-cyan-400">${token.ticker}</span>
                      </div>
                      <p class="mt-1 text-sm text-cyan-400/70">{token.description}</p>
                    </div>
                  </div>
                  <div class="mt-2 text-left md:mt-0 md:text-right">
                    <span class="px-2 py-1 text-xs font-bold text-purple-400 rounded-full bg-purple-900/30">
                      {token.isDemo ? 'DEMO' : 'CUSTOM'}
                    </span>
                    <div class="mt-1 text-xs text-cyan-400/70">Chain: {token.chain}</div>
                  </div>
                </div>
              </button>
            {/each}
          </div>

          {#if inputError}
            <p class="text-sm text-red-400">{inputError}</p>
          {/if}

          <div class="p-4 mt-4 text-sm border rounded-md border-purple-500/30 bg-purple-950/50">
            <p class="text-purple-400">🛠️ Proof of Concept Mode</p>
            <p class="mt-2 text-purple-300/70">These are demo tokens for testing the mining system</p>
          </div>
        </div>

      {:else if currentStep === 2}
        <!-- Tier Selection -->
        <div class="max-w-3xl mx-auto space-y-4 md:space-y-6">
          <h3 class="text-2xl font-bold text-white md:text-3xl">Choose Miner Tier</h3>
          <p class="text-base md:text-lg text-cyan-400">Higher tiers provide more hash power and priority in mining queues</p>
          
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {#each MINER_TIERS as tier}
              <button
                class={`p-4 md:p-6 rounded-xl transition-all duration-300 border-2 relative
                  ${selectedTier?.type === tier.type ? 
                    'border-cyan-400 bg-cyan-500/20' : 
                    'border-cyan-500/30 hover:bg-cyan-500/10'}`}
                on:click={() => selectedTier = tier}
              >
                {#if tier.type === 'premium'}
                  <div class="absolute top-0 right-0 px-2 py-1 text-xs font-bold transform translate-x-2 -translate-y-2 bg-purple-600 rounded-full md:px-3">
                    BEST VALUE
                  </div>
                {/if}
                
                <h3 class="mb-2 text-lg font-bold text-white uppercase md:text-xl">{tier.type}</h3>
                <div class="space-y-2">
                  <p class="text-cyan-400">⚡ {tier.kong} $KONG</p>
                  <div class="pt-3 mt-3 border-t border-cyan-500/30">
                    <p class="text-sm text-cyan-400/80">{tier.description}</p>
                    <ul class="mt-2 space-y-1 text-xs text-cyan-400/60">
                      {#each tier.benefits as benefit}
                        <li class="flex items-center">
                          <svg class="w-4 h-4 mr-1 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                          </svg>
                          {benefit}
                        </li>
                      {/each}
                    </ul>
                  </div>
                </div>
              </button>
            {/each}
          </div>
          
          {#if inputError}
            <p class="text-sm text-red-400">{inputError}</p>
          {/if}
        </div>

      {:else if currentStep === 3}
        <!-- Quantity Selection -->
        <div class="max-w-xl mx-auto space-y-4 md:space-y-6">
          <h3 class="text-2xl font-bold text-white md:text-3xl">Set Miner Quantity</h3>
          <p class="text-base md:text-lg text-cyan-400">How many miners do you want to deploy? (1-10)</p>
          <div class="space-y-2">
            <input
              bind:value={minerCount}
              type="number"
              min="1"
              max="10"
              class="w-full px-4 py-3 text-xl text-white bg-black border-2 rounded-md md:px-6 md:py-4 md:text-2xl"
              placeholder="1"
            />
            {#if inputError}
              <p class="text-sm text-red-400">{inputError}</p>
            {/if}
          </div>
        </div>

      {:else if currentStep === 4}
        <!-- Confirmation Screen -->
        <div class="max-w-xl mx-auto space-y-6">
          <h3 class="text-3xl font-bold text-white">Confirm Your Miners</h3>
          <div class="p-6 space-y-4 border-2 rounded-md border-cyan-500 bg-cyan-950">
            <div class="flex justify-between text-lg">
              <span class="text-cyan-400">Token</span>
              <span class="font-bold text-white">
                {DEMO_TOKENS.find(t => t.principal === selectedToken)?.name || 'Custom Token'}
              </span>
            </div>
            <div class="flex justify-between text-lg">
              <span class="text-cyan-400">Tier</span>
              <span class="font-bold text-white">{selectedTier?.type.toUpperCase()}</span>
            </div>
            <div class="flex justify-between text-lg">
              <span class="text-cyan-400">Quantity</span>
              <span class="font-bold text-white">{minerCount}</span>
            </div>
            <div class="flex justify-between text-lg">
              <span class="text-cyan-400">Total Cost</span>
              <span class="font-bold text-white">{selectedTier?.kong * minerCount} $KONG</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Navigation Buttons -->
      {#if currentStep > 0}
        <div class="flex justify-between mt-6 md:mt-8">
          <button 
            on:click={prevStep}
            class="px-4 py-2 text-base font-bold text-white transition-all duration-300 border-2 rounded-md md:px-8 md:py-4 md:text-lg border-cyan-500"
          >
            ← BACK
          </button>

          {#if currentStep < steps.length - 1}
            <button 
              on:click={nextStep}
              class="px-4 py-2 text-base font-bold text-white transition-all duration-300 border-2 rounded-md md:px-8 md:py-4 md:text-lg border-cyan-400"
            >
              NEXT →
            </button>
          {:else}
            <button 
              on:click={deployMiners}
              disabled={isLaunching}
              class="px-4 py-2 text-base font-bold text-white transition-all duration-300 border-2 rounded-md md:px-8 md:py-4 md:text-lg border-cyan-400"
            >
              {isLaunching ? 'DEPLOYING...' : 'DEPLOY MINERS →'}
            </button>
          {/if}
        </div>
      {/if}

      <!-- Status Message -->
      {#if launchStatus}
        <div class="p-6 mt-8 text-lg border-2 rounded-md border-cyan-500 bg-cyan-950">
          <pre class="font-mono text-white whitespace-pre-wrap">
            {launchStatus}
          </pre>
        </div>
      {/if}
    </div>
  {/if}
</div>
