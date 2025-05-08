<script lang="ts">
  // Core stores & utils
  import { auth } from "$lib/stores/auth";
  import { toastStore } from "$lib/stores/toastStore";
  import { Principal } from "@dfinity/principal";
  import { goto } from "$app/navigation";

  // UI Components
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import ChainSelector from "$lib/components/launch/token/ChainSelector.svelte";
  
  // Launch-specific reusable components
  import TokenIdentity from "$lib/components/launch/token/TokenIdentity.svelte";
  import TokenEconomics from "$lib/components/launch/token/TokenEconomics.svelte";
  import MiningCalculator from "$lib/components/launch/token/MiningCalculator.svelte";
  import SocialLinks from "$lib/components/launch/token/SocialLinks.svelte";

  // Canister plumbing
  import { canisters } from "$lib/config/auth.config";
  import * as launchpadAPI from "$lib/api/launchpad";
  import type { ChainType } from "../../../../declarations/launchpad/launchpad.did.js";
  import type { _SERVICE as LedgerService } from "../../../../declarations/kong_ledger/kong_ledger.did.js";
  import type { ActorSubclass } from "@dfinity/agent";
  import { onDestroy } from "svelte";

  // ────────────────────────────────────────────────────────────────────────────
  // Constants & Types
  // ────────────────────────────────────────────────────────────────────────────
  const LAUNCHPAD_CANISTER_ID = canisters.launchpad.canisterId!;
  const KONG_LEDGER_CANISTER_ID = "o7oak-iyaaa-aaaaq-aadzq-cai";
  const TOKEN_CREATION_FEE = 500n * 10n ** 8n; // 500 KONG, 8 decimals

  type SocialLink = { platform: string; url: string };

  // ────────────────────────────────────────────────────────────────────────────
  // Wizard navigation
  // ────────────────────────────────────────────────────────────────────────────
  const steps = ["Chain Selection", "Token Basics", "Mining Schedule", "Community", "Review"] as const;
  let currentStep = $state(0); // Start with chain selection
  let tokenSubStep = $state(1); // Sub-step for Token Basics (1 for Identity, 2 for Economics)

  // Define the number of sub-steps for each step
  const subSteps = {
    0: 1, // Chain selection has no sub-steps
    1: 2, // Token Basics now has 2 sub-steps (Identity and Economics)
    2: 1, // Mining Schedule has 1 sub-step
    3: 1, // Community has no sub-steps
    4: 1  // Review has no sub-steps
  };
  
  let progress = $derived(() => {
    // Calculate step progress percentage
    const basicStepProgress = currentStep / (steps.length - 1);
    // Adjust for sub-steps within the Token Basics step
    if (currentStep === 1) {
      return (basicStepProgress + (tokenSubStep - 1) / (subSteps[1] * (steps.length - 1))) * 100;
    }
    return basicStepProgress * 100;
  });

  function nextStep() {
    if (currentStep === 0) {
      // Chain selection - always move to token basics
      if (!identity.chain || identity.chain !== "icp") {
        // Make sure ICP is selected as it's the only available option currently
        identity.chain = "icp";  
        toastStore.info("Only ICP chain is currently available.");
      }
      currentStep = 1;
    }
    else if (currentStep === 1) {
      // Token Basics - has sub-steps
      if (tokenSubStep === 1) {
        // Identity validation
        if (!identity.name || !identity.ticker) {
          toastStore.error("Please fill in Name and Ticker.");
          return;
        }
        // Go to economics sub-step
        tokenSubStep = 2;
      } else {
        // Economics validation
        if (economics.decimals < 0 || economics.decimals > 18 || economics.transferFee < 0) {
          toastStore.error("Invalid Decimals or Transfer Fee.");
          return;
        }
        // Move to Mining step
        currentStep = 2;
        tokenSubStep = 1; // Reset sub-step
      }
    }
    else if (currentStep === 2) {
      // Mining validation
      if (!identity.totalSupply) {
        toastStore.error("Please provide a Total Supply value.");
        return;
      }
      
      try {
        BigInt(identity.totalSupply);
        BigInt(advanced.blockTimeTargetSeconds);
        BigInt(advanced.halvingInterval);
        BigInt(advanced.initialBlockReward);
      } catch (e) {
        toastStore.error("Numeric fields must be valid numbers.");
        return;
      }
      
      if (advanced.ownerPrincipal && !isValidPrincipal(advanced.ownerPrincipal)) {
        toastStore.error("Invalid Optional Owner Principal.");
        return;
      }
      
      // Move to Socials step
      currentStep = 3;
    }
    else if (currentStep === 3) {
      // No validation needed for socials, they're optional
      currentStep = 4; // Move to review
    }
  }
  
  function prevStep() {
    if (currentStep === 1) {
      // For token sub-steps
      if (tokenSubStep > 1) {
        tokenSubStep--;
      } else {
        // Go back to chain selection
        currentStep = 0;
      }
    }
    else if (currentStep > 1) {
      // For other steps, just go back
      currentStep--;
      
      // If going back to token basics, go to economics sub-step
      if (currentStep === 1) {
        tokenSubStep = 2; // Set to economics sub-step
      }
    }
  }
  
  function goToStep(index: number) {
    // Allow jumping to any step
    if (index >= 0 && index < steps.length) {
      currentStep = index;
      if (index === 1) tokenSubStep = 1;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Form State (Grouped by Step)
  // ────────────────────────────────────────────────────────────────────────────

  // Step 0: Identity
  let identity = $state({
    name: "",
    ticker: "",
    logo: "", // base64 data URL or empty string
    totalSupply: "", // string -> bigint later
    chain: "icp" // Only ICP supported for now
  });

  // Chain selection
  const chainOptions = [
    { 
      id: "icp", 
      name: "Internet Computer", 
      symbol: "ICP", 
      color: "#29ABE2",
      gradient: "from-[#29ABE2] to-[#522785]",
      available: true, 
      priority: 1,
      description: "The Internet Computer blockchain allows canister smart contracts to serve web content directly to end users." 
    },
    { 
      id: "btc", 
      name: "Bitcoin", 
      symbol: "BTC", 
      color: "#F7931A",
      gradient: "from-[#F7931A] to-[#FF7A00]",
      available: false, 
      priority: 3,
      description: "Bitcoin (BTC) lets you use Bitcoin natively on the Internet Computer blockchain." 
    },
    { 
      id: "eth", 
      name: "Ethereum", 
      symbol: "ETH", 
      color: "#627EEA",
      gradient: "from-[#627EEA] to-[#3C46D3]",
      available: false, 
      priority: 2,
      description: "Ethereum (ETH) enables ETH to be used natively on Internet Computer canisters." 
    },
    { 
      id: "sol", 
      name: "Solana", 
      symbol: "SOL", 
      color: "#14F195",
      gradient: "from-[#14F195] to-[#00C2FF]",
      available: false, 
      priority: 0,
      description: "Solana (SOL) integration is currently in active development. Our team is working to enable direct SOL usage on Internet Computer canisters without wrapping." 
    }
  ];

  // Step 1: Economics
  let economics = $state({
    decimals: 8,
    transferFee: 10000, // nat64 (base units, e.g., 10000 for 0.0001 if 8 decimals)
  });

  // Step 2: Advanced
  let advanced = $state({
    blockTimeTargetSeconds: "60",
    halvingInterval: "210000",
    initialBlockReward: "5000000000", // nat64 (base units)
    ownerPrincipal: "", // Optional Principal text
  });

  // Step 3: Socials
  let socialLinks = $state<SocialLink[]>([]);

  // Step 4: Review (No direct state, just display)

  // ────────────────────────────────────────────────────────────────────────────
  // Network actors & fees
  // ────────────────────────────────────────────────────────────────────────────
  let launchpadActor = $state<ActorSubclass<LaunchpadService> | null>(null);
  let kongLedgerActor = $state<ActorSubclass<LedgerService> | null>(null);
  let kongTransferFee = $state(0n);
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);

  let initActorController: AbortController | null = null;
  
  async function initActors() {
    if (!$auth.isConnected || !$auth.account?.owner) return;
    
    // Cancel any previous initialization
    if (initActorController) {
      initActorController.abort();
    }
    
    // Create new abort controller for this initialization
    initActorController = new AbortController();
    const signal = initActorController.signal;
    
    try {
      isLoading = true;
      
      // We only need to initialize the kong ledger actor directly since we use the API for launchpad
      kongLedgerActor = auth.pnp.getActor({
        canisterId: KONG_LEDGER_CANISTER_ID,
        idl: canisters.icrc2.idl, // Use ICRC2 for fee + approve
        anon: false,
        requiresSigning: false
      });
      
      // Check if aborted before continuing
      if (signal.aborted) return;
      
      // Fetch fee using the authenticated actor now
      kongTransferFee = await kongLedgerActor.icrc1_fee();
      
      // Check if aborted after fee fetch
      if (signal.aborted) return;
      
      console.log("KONG Transfer Fee:", kongTransferFee);
    } catch (e) {
      // Only handle errors if not aborted
      if (!signal.aborted) {
        console.error("Actor/Fee init error:", e);
        errorMessage = "Failed to initialize network actors or fetch fee.";
        toastStore.error(errorMessage);
        kongLedgerActor = null;
      }
    } finally {
      // Only update loading state if not aborted
      if (!signal.aborted) {
        isLoading = false;
      }
    }
  }

  // Re-initialize if auth state changes
  $effect(() => {
    if ($auth.isConnected && $auth.account?.owner) {
      initActors();
    } else {
      // Clean up previous initialization
      if (initActorController) {
        initActorController.abort();
        initActorController = null;
      }
      kongLedgerActor = null;
      kongTransferFee = 0n;
    }
    
    // Cleanup on effect destruction
    return () => {
      if (initActorController) {
        initActorController.abort();
        initActorController = null;
      }
    };
  });
  
  // Additional cleanup when component is destroyed
  onDestroy(() => {
    if (initActorController) {
      initActorController.abort();
      initActorController = null;
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Validation Helper
  // ────────────────────────────────────────────────────────────────────────────
  function isValidPrincipal(text: string): boolean {
      try {
          Principal.fromText(text);
          return true;
      } catch (e) {
          return false;
      }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Submission
  // ────────────────────────────────────────────────────────────────────────────
  async function handleCreateToken() {
    errorMessage = null;
    // Final comprehensive validation
    if (!identity.name || !identity.ticker || !identity.totalSupply) {
        errorMessage = "Missing required identity fields.";
        toastStore.error(errorMessage); goToStep(0); return;
    }
    if (economics.decimals < 0 || economics.decimals > 18 || economics.transferFee < 0) {
        errorMessage = "Invalid economic values.";
        toastStore.error(errorMessage); goToStep(1); return;
    }
    try {
        BigInt(identity.totalSupply);
        BigInt(advanced.blockTimeTargetSeconds);
        BigInt(advanced.halvingInterval);
        BigInt(advanced.initialBlockReward);
        if (advanced.ownerPrincipal && !isValidPrincipal(advanced.ownerPrincipal)) throw new Error("Invalid Owner Principal");
    } catch (e: any) {
        errorMessage = `Invalid advanced/numeric fields: ${e.message}`;
        toastStore.error(errorMessage); goToStep(2); return;
    }

    if (!$auth.isConnected || !$auth.account?.owner || !kongLedgerActor) {
      errorMessage = "Please connect your wallet first.";
      toastStore.error(errorMessage);
      return;
    }
    if (kongTransferFee === 0n) {
      toastStore.info("Fetching KONG transfer fee...");
      await initActors(); // Try fetching fee again
      if (kongTransferFee === 0n) {
        errorMessage = "Could not determine KONG transfer fee. Cannot proceed.";
        toastStore.error(errorMessage);
        return;
      }
    }

    isLoading = true;
    const loadingToastId = toastStore.info("Processing token creation...", { duration: 0 });

    try {
      let callerPrincipal: Principal;
      try {
        callerPrincipal = ($auth.account.owner instanceof Principal)
          ? $auth.account.owner
          : Principal.fromText($auth.account.owner);
      } catch (e) {
        toastStore.error("Invalid user principal: " + $auth.account.owner);
        isLoading = false;
        toastStore.dismiss(loadingToastId);
        return;
      }
      const approvalAmount = TOKEN_CREATION_FEE + kongTransferFee;

      // 1. Ensure sufficient allowance
      const authenticatedKongLedgerActor = auth.pnp.getActor({
        canisterId: KONG_LEDGER_CANISTER_ID,
        idl: canisters.icrc2.idl,
        anon: false,
        requiresSigning: false
      });
      // Check current allowance
      const allowanceArgs = {
        account: { owner: callerPrincipal, subaccount: [] as [] }, // Explicitly type as empty tuple
        spender: { owner: Principal.fromText(LAUNCHPAD_CANISTER_ID), subaccount: [] as [] } // Explicitly type as empty tuple
      };

      const allowanceRes = await authenticatedKongLedgerActor.icrc2_allowance(allowanceArgs);
      if (allowanceRes.allowance < approvalAmount) {
        toastStore.info(`Approving ${(approvalAmount) / 10n**8n} KONG...`);
        const approveArgs = {
          fee: [] as [],
          memo: [] as [],
          from_subaccount: [] as [],
          created_at_time: [] as [],
          amount: approvalAmount,
          expected_allowance: [] as [],
          expires_at: [] as [],
          spender: {
            owner: Principal.fromText(LAUNCHPAD_CANISTER_ID),
            subaccount: [] as [],
          },
        };
        // We need the authenticated kongLedgerActor here
        const approveRes = await authenticatedKongLedgerActor.icrc2_approve(approveArgs);
        if ("Err" in approveRes) {
          console.error("Approval Error:", approveRes.Err);
          throw new Error(`KONG approval failed: ${JSON.stringify(approveRes.Err)}`);
        }
        toastStore.success("KONG approved successfully!");
      } else {
        toastStore.info("Sufficient allowance, skipping approval.");
      }

      // 2. Call create_token on launchpad
      const ownerOpt = advanced.ownerPrincipal ? [Principal.fromText(advanced.ownerPrincipal)] : ([] as []);
      const logoOpt = identity.logo ? [identity.logo] : ([] as []);
      let chainType: ChainType;
      if (identity.chain === 'ICP') {
          chainType = { ICP: null };
      } else {
          console.warn("Unsupported chain selected, defaulting to ICP");
          chainType = { ICP: null }; // Default or throw error
      }

      // --- Strict candid argument marshalling ---
      // All types must match the candid exact
      // text, text, nat64, opt text, opt nat8, opt nat64, nat64, nat64, nat64, ChainType, opt principal
      const ticker: string = typeof identity.ticker === 'string' ? identity.ticker : String(identity.ticker);
      const name: string = typeof identity.name === 'string' ? identity.name : String(identity.name);
      // Calculate supply in base units
      const supply: bigint = BigInt(identity.totalSupply) * (10n ** BigInt(economics.decimals));
      const logo: [] | [string] = (identity.logo && typeof identity.logo === 'string') ? [identity.logo] : [];
      const decimals: [] | [number] = (typeof economics.decimals === 'number') ? [economics.decimals] : [];
      // Calculate fee in base units (assuming input is also in base units, check TokenEconomics component if needed)
      const fee: [] | [bigint] = (economics.transferFee !== undefined && economics.transferFee !== null) ? [BigInt(economics.transferFee)] : [];
      const block_time_target_seconds: bigint = BigInt(advanced.blockTimeTargetSeconds);
      const halving_interval: bigint = BigInt(advanced.halvingInterval);
      const initial_block_reward: bigint = BigInt(advanced.initialBlockReward);
      const chain: ChainType = chainType;
      const subnet: [] | [Principal] = (advanced.ownerPrincipal && advanced.ownerPrincipal.length > 0) ? [Principal.fromText(advanced.ownerPrincipal)] : [];

      // Debug log types and values
      console.log('create_token args:', {
        ticker, name, supply, logo, decimals, fee,
        block_time_target_seconds, halving_interval, initial_block_reward, chain, subnet
      });

      // Use the launchpad API to create the token
    const newTokenCanisterId = await launchpadAPI.createToken(
      name,
      ticker,
      supply,
      identity.logo,
      economics.decimals,
      economics.transferFee ? BigInt(economics.transferFee) : undefined,
      block_time_target_seconds,
      halving_interval,
      initial_block_reward,
      chain,
      advanced.ownerPrincipal ? Principal.fromText(advanced.ownerPrincipal) : undefined
    );
    
    const tokenId = newTokenCanisterId.toText();
      toastStore.success(`Token created successfully! Canister ID: ${tokenId}`);
      // Redirect to a confirmation or details page
      goto(`/launch/token/${tokenId}`); // Example redirect

    } catch (error: any) {
      console.error("Token creation process failed:", error);
      errorMessage = error.message || "An unexpected error occurred.";
      toastStore.error(`Creation failed: ${errorMessage}`);
    } finally {
      isLoading = false;
      toastStore.dismiss(loadingToastId);
    }
  }

</script>

<div class="grid gap-6 lg:grid-cols-12 max-w-[1200px] mx-auto">
  <!-- Left sidebar with navigation -->
  <div class="lg:col-span-3">
    <div class="sticky flex flex-col gap-5 top-6">
      <!-- Back button -->
      <button 
        class="flex items-center gap-2 px-3 py-2 transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light/10"
        on:click={() => goto('/launch/explore')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>Back to Explore</span>
      </button>
      
      <!-- Form navigation -->
      <div class="transition-all duration-200 rounded-xl bg-kong-bg-secondary/50 backdrop-blur-sm">
        <div class="space-y-3 p-3">
          <button 
            class={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${currentStep === 0 ? 'bg-kong-primary/10 text-kong-primary font-medium' : 'hover:bg-kong-bg-light/10 text-kong-text-primary'}`}
            on:click={() => goToStep(0)}
          >
            <div class={`w-9 h-9 rounded-full flex items-center justify-center ${currentStep >= 0 ? 'bg-kong-primary text-white' : 'bg-kong-bg-light/10 text-kong-text-primary'}`}>
              1
            </div>
            <div class="text-left">
              <span class="block text-sm">Chain Selection</span>
              <span class="text-xs opacity-70">Choose blockchain</span>
            </div>
          </button>

          <button 
            class={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${currentStep === 1 ? 'bg-kong-primary/10 text-kong-primary font-medium' : 'hover:bg-kong-bg-light/10 text-kong-text-primary'}`}
            on:click={() => goToStep(1)}
          >
            <div class={`w-9 h-9 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-kong-primary text-white' : 'bg-kong-bg-light/10 text-kong-text-primary'}`}>
              2
            </div>
            <div class="text-left">
              <span class="block text-sm">Token Basics</span>
              <span class="text-xs opacity-70">Name, symbol, supply</span>
            </div>
          </button>
          
          <button 
            class={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${currentStep === 2 ? 'bg-kong-primary/10 text-kong-primary font-medium' : 'hover:bg-kong-bg-light/10 text-kong-text-primary'}`}
            on:click={() => goToStep(2)}
          >
            <div class={`w-9 h-9 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-kong-primary text-white' : 'bg-kong-bg-light/10 text-kong-text-primary'}`}>
              3
            </div>
            <div class="text-left">
              <span class="block text-sm">Mining Schedule</span>
              <span class="text-xs opacity-70">Block rewards, timing</span>
            </div>
          </button>
          
          <button 
            class={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${currentStep === 3 ? 'bg-kong-primary/10 text-kong-primary font-medium' : 'hover:bg-kong-bg-light/10 text-kong-text-primary'}`}
            on:click={() => goToStep(3)}
          >
            <div class={`w-9 h-9 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-kong-primary text-white' : 'bg-kong-bg-light/10 text-kong-text-primary'}`}>
              4
            </div>
            <div class="text-left">
              <span class="block text-sm">Community</span>
              <span class="text-xs opacity-70">Social links, channels</span>
            </div>
          </button>
          
          <button 
            class={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${currentStep === 4 ? 'bg-kong-primary/10 text-kong-primary font-medium' : 'hover:bg-kong-bg-light/10 text-kong-text-primary'}`}
            on:click={() => goToStep(4)}
          >
            <div class={`w-9 h-9 rounded-full flex items-center justify-center ${currentStep >= 4 ? 'bg-kong-primary text-white' : 'bg-kong-bg-light/10 text-kong-text-primary'}`}>
              5
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
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div>
            <h3 class="mb-1 text-sm font-medium">Need Help?</h3>
            <p class="text-xs text-kong-text-secondary">
              Creating a token with the right parameters is important. Contact support for guidance.
            </p>
            <a href="#" class="inline-flex items-center gap-1 mt-3 text-xs text-kong-primary hover:underline">
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
      <form on:submit|preventDefault={currentStep === steps.length - 1 ? handleCreateToken : undefined} class="space-y-6">
      <!-- Step Content -->
      <div class="min-h-[300px]">
      
        <!-- Step 0: Chain Selection -->
        {#if currentStep === 0}
          <Panel variant="solid" type="main" className="p-6 backdrop-blur-xl border-none">
            <ChainSelector
              bind:selectedValue={identity.chain}
              options={chainOptions}
            />
          </Panel>
          
        <!-- Step 1: Token Basics -->
        {:else if currentStep === 1}
          <Panel variant="solid" type="main" className="p-6 backdrop-blur-xl border-none">
            {#if tokenSubStep === 1}
              <!-- Identity sub-step -->
              <TokenIdentity 
                bind:name={identity.name} 
                bind:ticker={identity.ticker} 
                bind:logo={identity.logo} 
              />
            {:else}
              <!-- Economics sub-step -->
              <TokenEconomics 
                bind:decimals={economics.decimals} 
                bind:transferFee={economics.transferFee} 
                symbol={identity.ticker} 
              />
            {/if}
          </Panel>
          
        <!-- Step 2: Mining Schedule -->
          {:else if currentStep === 2}
            <Panel variant="solid" type="main" className="p-6 backdrop-blur-xl border-none">
              <MiningCalculator
                blockReward={Number(advanced.initialBlockReward)}
                halvingBlocks={Number(advanced.halvingInterval)}
                blockTimeSeconds={Number(advanced.blockTimeTargetSeconds)}
                maxSupply={Number(identity.totalSupply)}
                decimals={Number(economics.decimals)}
                tokenTicker={identity.ticker}
                tokenLogo={identity.logo}
                name={identity.name}
              />
          </Panel>
          
        <!-- Step 3: Social Links -->
        {:else if currentStep === 3}
          <Panel variant="solid" type="main" className="p-6 backdrop-blur-xl border-none">
            <SocialLinks 
              bind:links={socialLinks} 
              tokenName={identity.name} 
              tokenSymbol={identity.ticker} 
            />
          </Panel>
          
        <!-- Step 4: Review -->
        {:else if currentStep === 4}
        <div class="space-y-4 p-4 border rounded-lg bg-kong-bg-light/30 border-kong-border/20">
          <h3 class="text-lg font-semibold text-kong-text-primary">Review Your Token Details</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><span class="font-medium text-kong-text-secondary">Name:</span> {identity.name}</p>
              <p><span class="font-medium text-kong-text-secondary">Ticker:</span> {identity.ticker}</p>
              <p><span class="font-medium text-kong-text-secondary">Total Supply:</span> {identity.totalSupply}</p>
              <p><span class="font-medium text-kong-text-secondary">Logo:</span> {identity.logo ? 'Provided' : 'None'}</p>
               <p><span class="font-medium text-kong-text-secondary">Chain:</span> {identity.chain}</p>
            </div>
            <div>
              <p><span class="font-medium text-kong-text-secondary">Decimals:</span> {economics.decimals}</p>
              <p><span class="font-medium text-kong-text-secondary">Transfer Fee (base):</span> {economics.transferFee}</p>
            </div>
            <div>
              <p><span class="font-medium text-kong-text-secondary">Block Time (s):</span> {advanced.blockTimeTargetSeconds}</p>
              <p><span class="font-medium text-kong-text-secondary">Halving Interval:</span> {advanced.halvingInterval}</p>
              <p><span class="font-medium text-kong-text-secondary">Initial Reward (base):</span> {advanced.initialBlockReward}</p>
              <p><span class="font-medium text-kong-text-secondary">Owner:</span> {advanced.ownerPrincipal || 'You (caller)'}</p>
            </div>
            <div>
                 <p><span class="font-medium text-kong-text-secondary">Social Links:</span> {socialLinks.length}</p>
            </div>
          </div>
           {#if errorMessage}
                <p class="text-sm text-red-500">Error: {errorMessage}</p>
           {/if}
           <p class="text-sm text-kong-text-secondary">Creation Fee: {Number(TOKEN_CREATION_FEE) / (10 ** 8)} KONG (+ network fee)</p>
        </div>
      {/if}
      </div>

      <!-- Navigation Buttons -->
      <div class="flex justify-between items-center pt-4 border-t border-kong-border/20">
        {#if currentStep !== 0}
          <ButtonV2 type="button" on:click={prevStep} disabled={isLoading} variant="outline">
            {#if currentStep === 1 && tokenSubStep === 2}
              Back to Identity
            {:else if currentStep === 1}
              Back to Chain Selection
            {:else if currentStep === 2}
              Back to Economics
            {:else if currentStep === 3}
              Back to Mining
            {:else}
              Back to Community
            {/if}
          </ButtonV2>
        {/if}
        <div class="flex gap-2 ml-auto">
          {#if currentStep !== steps.length - 1}
            <ButtonV2 type="button" on:click={nextStep} disabled={isLoading} variant="solid">
              {#if currentStep === 0}
                Continue to Token Basics
              {:else if currentStep === 1 && tokenSubStep === 1}
                Continue to Economics
              {:else if currentStep === 1}
                Continue to Mining
              {:else if currentStep === 2}
                Continue to Social Links
              {:else}
                Review & Complete
              {/if}
            </ButtonV2>
          {:else}
            <ButtonV2 type="submit" disabled={isLoading || !$auth.isConnected} loading={isLoading} variant="solid">
              Create Token ({Number(TOKEN_CREATION_FEE) / (10 ** 8)} KONG)
            </ButtonV2>
          {/if}
        </div>
      </div>
    </form>
    </div>
  </div>
</div>

<style>
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
</style>
