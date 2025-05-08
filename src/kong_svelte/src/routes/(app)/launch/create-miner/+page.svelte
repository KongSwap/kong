<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import { Principal } from "@dfinity/principal";
  import { canisters } from "$lib/config/auth.config";
  import type { ActorSubclass } from "@dfinity/agent";
  import { toastStore } from "$lib/stores/toastStore";
  import * as launchpadAPI from "$lib/api/launchpad";
  import * as minerAPI from "$lib/api/miner";
  import type { _SERVICE as LedgerService } from "../../../../declarations/kong_ledger/kong_ledger.did.js";

  /* ------------------------------------------------------------------
     CHEAP PUBLIC 13-NODE SUBNETS (research baked in – 2025-05-02 snapshot)
       verified == true  → "Verified Application" subnet
       load       → quick-and-dirty headroom hint you can tweak/refresh
  ------------------------------------------------------------------ */
  interface SubnetOption { id: string; verified: boolean; load: "low" | "med" | "high"; }

  const SUBNET_OPTIONS: SubnetOption[] = [
    { id: "4ecnw-byqwz-dtgss-ua2mh-pfvs7-c3lct-gtf4e-hnu75-j7eek-iifqm-sqe", verified: false, load: "med" },
    { id: "4zbus-z2bmt-ilreg-xakz4-6tyre-hsqj4-slb4g-zjwqo-snjcc-iqphi-3qe", verified: true,  load: "low" },
    { id: "5kdm2-62fc6-fwnja-hutkz-ycsnm-4z33i-woh43-4cenu-ev7mi-gii6t-4ae", verified: true,  load: "med" },
    { id: "brlsh-zidhj-3yy3e-6vqbz-7xnih-xeq2l-as5oc-g32c4-i5pdn-2wwof-oae", verified: false, load: "high" },
    { id: "csyj4-zmann-ys6ge-3kzi6-onexi-obayx-2fvak-zersm-euci4-6pslt-lae", verified: true,  load: "low" },
    { id: "cv73p-6v7zi-u67oy-7jc3h-qspsz-g5lrj-4fn7k-xrax3-thek2-sl46v-jae", verified: false, load: "low" },
    { id: "e66qm-3cydn-nkf4i-ml4rb-4ro6o-srm5s-x5hwq-hnprz-3meqp-s7vks-5qe", verified: false, load: "high" },
    { id: "ejbmu-grnam-gk6ol-6irwa-htwoj-7ihfl-goimw-hlnvh-abms4-47v2e-zqe", verified: true,  load: "med" },
    { id: "fuqsr-in2lc-zbcjj-ydmcw-pzq7h-4xm2z-pto4i-dcyee-5z4rz-x63ji-nae", verified: false, load: "high" },
    { id: "gmq5v-hbozq-uui6y-o55wc-ihop3-562wb-3qspg-nnijg-npqp5-he3cj-3ae", verified: false, load: "med" },
    { id: "io67a-2jmkw-zup3h-snbwi-g6a5n-rm5dn-b6png-lvdpl-nqnto-yih6l-gqe", verified: true,  load: "low" },
    { id: "jtdsg-3h6gi-hs7o5-z2soi-43w3z-soyl3-ajnp3-ekni5-sw553-5kw67-nqe", verified: false, load: "low" },
    { id: "lspz2-jx4pu-k3e7p-znm7j-q4yum-ork6e-6w4q6-pijwq-znehu-4jabe-kqe", verified: false, load: "high" },
    { id: "mpubz-g52jc-grhjo-5oze5-qcj74-sex34-omprz-ivnsm-qvvhr-rfzpv-vae", verified: false, load: "med" },
    { id: "nl6hn-ja4yw-wvmpy-3z2jx-ymc34-pisx3-3cp5z-3oj4a-qzzny-jbsv3-4qe", verified: false, load: "high" },
    { id: "o3ow2-2ipam-6fcjo-3j5vt-fzbge-2g7my-5fz2m-p4o2t-dwlc4-gt2q7-5ae", verified: false, load: "low" },
    { id: "opn46-zyspe-hhmyp-4zu6u-7sbrh-dok77-m7dch-im62f-vyimr-a3n2c-4ae", verified: false, load: "med" },
    { id: "pjljw-kztyl-46ud4-ofrj6-nzkhm-3n4nt-wi3jt-ypmav-ijqkt-gjf66-uae", verified: false, load: "med" },
    { id: "qdvhd-os4o2-zzrdw-xrcv4-gljou-eztdp-bj326-e6jgr-tkhuc-ql6v2-yqe", verified: false, load: "low" },
    { id: "snjp4-xlbw4-mnbog-ddwy6-6ckfd-2w5a2-eipqo-7l436-pxqkh-l6fuv-vae", verified: true,  load: "low" },
    { id: "w4asl-4nmyj-qnr7c-6cqq4-tkwmt-o26di-iupkq-vx4kt-asbrx-jzuxh-4ae", verified: true,  load: "low" },  // brand-new / almost empty
    { id: "yinp6-35cfo-wgcd2-oc4ty-2kqpf-t4dul-rfk33-fsq3r-mfmua-m2ngh-jqe", verified: false, load: "med" }
  ];

  /* ------------------------------------------------------------------
                               CONSTANTS
  ------------------------------------------------------------------ */
  const LAUNCHPAD_CANISTER_ID = canisters.launchpad.canisterId!;
  const KONG_LEDGER_CANISTER_ID = "o7oak-iyaaa-aaaaq-aadzq-cai";
  const MINER_CREATION_FEE = 12_500_000_000n; // 125 KONG (8 dp)
  const EMBEDDED_UI_FEE = 5_000_000_000n; // 50 KONG (8 dp)
  const LIFETIME_UPDATES_FEE = 25_000_000_000n; // 250 KONG (8 dp)
  const FREE_HASHES = 10_000_000; // 10 million free hashes at deploy time

  /* ------------------------------------------------------------------
                                STATE
  ------------------------------------------------------------------ */
  let tokenCanisterId = $state("");
  let selectedSubnetId = $state("");      // chosen subnet (blank => let backend pick)
  let includeEmbeddedUI = $state(false);  // +50 KONG for embedded web UI
  let includeLifetimeUpdates = $state(false); // +250 KONG for lifetime updates

  let isLoading = $state(false);
  let kongTransferFee = $state(0n);
  let launchpadActor = $state<ActorSubclass<LaunchpadService> | null>(null);
  let kongLedgerActor = $state<ActorSubclass<LedgerService> | null>(null);
  let errorMessage = $state<string | null>(null);
  let tokens = $state<any[]>([]);

  /* ------------------------------------------------------------------
                                EFFECTS
  ------------------------------------------------------------------ */
  $effect(() => {
    if ($auth.isConnected && $auth.account?.owner) {
      initializeActors();
      fetchKongFee();
    } else {
      launchpadActor = null;
      kongLedgerActor = null;
      kongTransferFee = 0n;
    }
  });

  $effect(() => {
    if ($auth.isConnected) {
      launchpadAPI.listTokens()
        .then(res => tokens = res)
        .catch(e => console.error("Error fetching tokens:", e));
    }
  });

  /* ------------------------------------------------------------------
                          ACTOR INITIALIZATION
  ------------------------------------------------------------------ */
  async function initializeActors() {
    if (!$auth.isConnected) return;
    try {
      // We only need to initialize the kong ledger actor directly
      // since we'll use the API utilities for launchpad and miner
      kongLedgerActor = await auth.getActor(
        KONG_LEDGER_CANISTER_ID,
        canisters.icrc2.idl
      );
    } catch (error) {
      console.error("Actor init error:", error);
      errorMessage = "Failed to initialize actors (wallet?).";
      toastStore.error("Actor initialization failed.");
    }
  }

  /* ------------------------------------------------------------------
                                 FEES
  ------------------------------------------------------------------ */
  async function fetchKongFee() {
    if (!kongLedgerActor) return;
    try {
      const feeResult = await kongLedgerActor.icrc1_fee();
      kongTransferFee = feeResult;
      console.log("KONG transfer fee:", kongTransferFee);
    } catch (error) {
      console.error("Fee fetch error:", error);
      errorMessage = "Failed to fetch KONG fee.";
      toastStore.error("Could not fetch KONG fee.");
    }
  }

  /* ------------------------------------------------------------------
                           FORM SUBMISSION
  ------------------------------------------------------------------ */
  // Track active deployments to show multiple toasts
  let activeDeployments = $state(0);
  
  async function handleCreateMiner() {
    errorMessage = null;
    if (!validateForm()) return;
    if (
      !$auth.isConnected ||
      !$auth.account?.owner ||
      !kongLedgerActor
    ) {
      errorMessage = "Please connect your wallet first.";
      toastStore.error("Wallet not connected.");
      return;
    }

    if (kongTransferFee === 0n) {
      await fetchKongFee();
      if (kongTransferFee === 0n) {
        errorMessage = "KONG fee unknown, cannot proceed.";
        toastStore.error("KONG fee unknown.");
        return;
      }
    }
    
    // Track this deployment and show toast that stays for 30 seconds
    activeDeployments++;
    const deploymentCount = activeDeployments;
    const deploymentId = Math.random().toString(36).substring(2, 9);
    const loadingToastId = toastStore.info(
      `🚀 Miner deployment #${deploymentCount} in progress! Creating canister...`, 
      { duration: 30000 }
    );

    // We don't set isLoading=true, allowing multiple simultaneous deployments
    try {
      /* -------- 1. APPROVE SPENDING -------- */
      // In demo mode, we keep the approval amount the same regardless of premium options selected
      const approvalAmount = MINER_CREATION_FEE + kongTransferFee;
      
      // For UI display purposes only - we would add these in production
      const displayAmount = approvalAmount + 
                            (includeEmbeddedUI ? EMBEDDED_UI_FEE : 0n) + 
                            (includeLifetimeUpdates ? LIFETIME_UPDATES_FEE : 0n);
      
      // Log for demo purposes
      if (includeEmbeddedUI || includeLifetimeUpdates) {
        console.log("Demo mode - actual approval:", Number(approvalAmount) / 10 ** 8);
        console.log("Demo mode - display amount:", Number(displayAmount) / 10 ** 8);
      }
      
      toastStore.info(`Approving ${(Number(approvalAmount) / 10 ** 8).toFixed(2)} KONG...`);
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
      const approveResult = await kongLedgerActor.icrc2_approve(approveArgs);
      if ("Err" in approveResult) {
        console.error("Approval error:", approveResult.Err);
        throw new Error(`KONG approval failed: ${safeStringify(approveResult.Err)}`);
      }
      toastStore.success("KONG approved!");

      /* -------- 2. CREATE MINER -------- */
      toastStore.info("Calling launchpad...");
      
      // For demo/staging, we'll show premium options in UI but use standard creation method
      // In production, we would implement specialized methods for premium features
      
      // Log selected options for demo purposes
      if (includeEmbeddedUI || includeLifetimeUpdates) {
        console.log("Premium options selected (demo):", {
          embedded_ui: includeEmbeddedUI,
          lifetime_updates: includeLifetimeUpdates,
          free_hashes: FREE_HASHES
        });
        
        // Show toast to indicate premium features (staging/demo only)
        toastStore.info("Premium features selected (demo mode)");
      }
      
      // Standard miner creation - same for all options in demo mode
      const createResult = await launchpadAPI.createMiner(
        Principal.fromText(tokenCanisterId)
      );

      const newMinerCanisterId = createResult.toText();

      /* -------- 3. CONNECT TOKEN -------- */
      await minerAPI.connectToken(newMinerCanisterId, tokenCanisterId);

      // Update toast with success message but keep it visible for a while
      toastStore.success(
        `✨ Miner #${deploymentCount} successfully deployed! Canister: ${newMinerCanisterId}`, 
        { duration: 5000 }
      );
      toastStore.dismiss(loadingToastId);
      
      // Only reset form if this was the last deployment in queue
      if (activeDeployments === deploymentCount) {
        resetForm();
      }
    } catch (error: any) {
      console.error("Miner creation failed:", error);
      errorMessage = error.message || "Unexpected error.";
      toastStore.error(`Deployment #${deploymentCount} failed: ${errorMessage}`, { duration: 5000 });
      toastStore.dismiss(loadingToastId);
    } finally {
      // Each deployment decrements its own counter when done
      if (activeDeployments === deploymentCount) {
        activeDeployments = 0;
      }
    }
  }

  /* ------------------------------------------------------------------
                               VALIDATION
  ------------------------------------------------------------------ */
  function validateForm(): boolean {
    if (!tokenCanisterId) {
      errorMessage = "Token Canister ID required.";
      toastStore.error("Missing Token Canister ID.");
      return false;
    }
    try {
      Principal.fromText(tokenCanisterId);
    } catch {
      errorMessage = "Invalid Principal format.";
      toastStore.error("Invalid Principal format.");
      return false;
    }
    // No validation for selectedSubnetId – empty is fine (auto-select).
    return true;
  }

  /* ------------------------------------------------------------------
                                HELPERS
  ------------------------------------------------------------------ */
  function resetForm() {
    tokenCanisterId = "";
    selectedSubnetId = "";
    includeEmbeddedUI = false;
    includeLifetimeUpdates = false;
    errorMessage = null;
  }

  function handleConnect() {
    walletProviderStore.open();
  }

  // BigInt-safe stringify
  function safeStringify(obj: any): string {
    try {
      return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    } catch {
      return String(obj);
    }
  }
</script>

<!-- -------------------------------------------------------------------
                                 MARKUP
-------------------------------------------------------------------- -->
<div class="grid gap-6 lg:grid-cols-12 max-w-[1200px] mx-auto px-4 py-8">
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
      
      <!-- Help card -->
      <div class="p-5 transition-all duration-200 border rounded-xl bg-kong-surface-dark/30 border-kong-border/30 backdrop-blur-sm">
        <div class="flex items-start gap-3">
          <div class="p-2 rounded-lg bg-kong-bg-light/10 text-kong-accent-blue">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div>
            <h3 class="mb-1 text-sm font-medium">Need Help?</h3>
            <p class="text-xs text-kong-text-secondary">
              Creating a miner requires you to have KONG tokens. Learn more about the process in our documentation.
            </p>
            <a href="#" class="inline-flex items-center gap-1 mt-3 text-xs text-kong-accent-blue hover:underline">
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
  <div class="lg:col-span-9">
    <Panel variant="solid" type="main" className="p-6 backdrop-blur-xl border-none">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-semibold text-kong-text-primary">Create New Miner</h2>
        <div class="px-3 py-1 rounded-full bg-gradient-to-r from-kong-primary to-kong-accent-red text-white text-xs font-medium">
          Includes 10M Free Hashes
        </div>
      </div>

      <div class="space-y-4">
        {#if !$auth.isConnected}
          <p class="text-kong-text-secondary">
            Connect your wallet to create a miner.
          </p>
          <ButtonV2 label="Connect Wallet" on:click={handleConnect} theme="primary" />
        {:else}

          <form on:submit|preventDefault={handleCreateMiner} class="space-y-4">
          {#if tokens.length > 0}
            <div>
              <label class="block text-sm font-medium text-kong-text-secondary mb-1">Select token to mine *</label>
              <select bind:value={tokenCanisterId} class="w-full border rounded px-3 py-2 bg-kong-bg-primary text-kong-text-primary" required>
                <option value="" disabled selected>Select a token...</option>
                {#each tokens as token}
                  <option value={token.canister_id.toText()}>{token.name} ({token.ticker})</option>
                {/each}
              </select>
            </div>
          {:else}
            <TextInput
              id="tokenCanisterId"
              label="Token Canister ID *"
              bind:value={tokenCanisterId}
              placeholder="Token canister"
              required
            />
          {/if}

          <!-- Subnet selection -->
          <div>
            <label class="block text-sm font-medium text-kong-text-secondary mb-1">
              Target Subnet (optional – all 13-node, cheapest)
            </label>
            <select
              class="w-full border rounded px-3 py-2 bg-kong-bg-primary text-kong-text-primary"
              bind:value={selectedSubnetId}
            >
              <option value="">Auto / let launchpad decide</option>
              {#each SUBNET_OPTIONS as s}
                <option value={s.id}>
                  {s.id.slice(0, 8)}… {s.verified ? "(Verified)" : "(Standard)"} –
                  {s.load === "low" ? "🟢 Low load" : s.load === "med" ? "🟠 Medium" : "🔴 High"}
                </option>
              {/each}
            </select>
            <p class="text-xs text-kong-text-secondary mt-1">
              All listed subnets have the same cycles cost; picking a low-load one can shave
              a few hundred ms off latency.
            </p>
          </div>
          
          <!-- Premium options (DEMO/STAGING) -->
          <div class="space-y-4 p-4 rounded-lg border border-kong-border/30 bg-kong-surface-dark/20">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-kong-text-primary">Premium Options</h3>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-medium text-kong-text-primary">Coming Soon:</span>
                <span class="px-2 py-0.5 text-[10px] bg-kong-accent-purple/20 text-kong-accent-purple rounded-full">MULTICHAIN MINER</span>
              </div>
            </div>
            
            <!-- Embedded Web UI option -->
            <label class="flex items-start gap-3 cursor-pointer">
              <div class="relative flex items-center">
                <input type="checkbox" bind:checked={includeEmbeddedUI} class="sr-only peer" />
                <div class="w-11 h-6 bg-kong-bg-light/20 rounded-full peer peer-checked:bg-gradient-to-r from-kong-accent-blue to-kong-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-kong-accent-blue/30"></div>
                <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:left-6 transition-all duration-300"></div>
              </div>
              <div>
                <p class="text-sm font-medium text-kong-text-primary">Embedded Web Interface <span class="text-kong-accent-blue font-bold">+50 KONG</span></p>
                <p class="text-xs text-kong-text-secondary">Includes easy management UI with support for OISY PLUG, PHANTOM, SOLFLARE and more wallets.</p>
              </div>
            </label>
            
            <!-- Lifetime Updates option -->
            <label class="flex items-start gap-3 cursor-pointer">
              <div class="relative flex items-center">
                <input type="checkbox" bind:checked={includeLifetimeUpdates} class="sr-only peer" />
                <div class="w-11 h-6 bg-kong-bg-light/20 rounded-full peer peer-checked:bg-gradient-to-r from-kong-accent-blue to-kong-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-kong-accent-blue/30"></div>
                <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:left-6 transition-all duration-300"></div>
              </div>
              <div>
                <p class="text-sm font-medium text-kong-text-primary">Lifetime Updates <span class="text-kong-accent-blue font-bold">+250 KONG</span></p>
                <p class="text-xs text-kong-text-secondary">Get all future miner updates for free (regular price: 100 KONG per update).</p>
                <p class="text-[10px] italic text-kong-text-secondary mt-1">Demo only - no actual price impact</p>
              </div>
            </label>

          {#if errorMessage}
            <p class="text-red-500 text-sm">{errorMessage}</p>
          {/if}

          <button
            type="submit"
            class="create-miner-btn relative w-full flex items-center justify-center py-3 px-6 rounded-lg font-medium text-white overflow-visible group transition-all duration-300 disabled:opacity-50"
            disabled={!$auth.isConnected || !launchpadActor || !kongLedgerActor}
          >
            <!-- Animated background effect -->
            <div class="absolute inset-0 bg-gradient-to-r from-kong-accent-blue via-kong-primary to-kong-accent-red group-hover:via-kong-primary transition-all duration-500 bg-size-200 bg-pos-0 group-hover:bg-pos-100"></div>
            
            <!-- Text content with icon -->
            <div class="relative flex items-center gap-2 transform group-hover:scale-105 group-active:scale-95 transition-all duration-200">
              <svg class="w-5 h-5 animate-pulse-slow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.5 9.5L14.5 14.5M14.5 9.5L9.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="tracking-wider relative group">
                Deploy Miner ({Math.floor(Number(MINER_CREATION_FEE) / 10 ** 8)} KONG)
                {#if includeEmbeddedUI || includeLifetimeUpdates}
                  <span class="absolute bottom-full left-1/2 transform -translate-x-1/2 px-2 py-1 bg-kong-surface-dark text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    Demo options selected: 
                    {#if includeEmbeddedUI}Embedded UI (+{Math.floor(Number(EMBEDDED_UI_FEE) / 10 ** 8)} KONG){/if}{#if includeEmbeddedUI && includeLifetimeUpdates}, {/if}{#if includeLifetimeUpdates}Lifetime Updates (+{Math.floor(Number(LIFETIME_UPDATES_FEE) / 10 ** 8)} KONG){/if}
                    (no extra cost)
                  </span>
                {/if}
              </span>
              
              <!-- Particle effects on hover -->
              <span class="absolute -top-2 -right-2 w-12 h-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span class="particle-1"></span>
                <span class="particle-2"></span>
                <span class="particle-3"></span>
              </span>
            </div>
          </button>
        </form>
      {/if}
    </div>
  </Panel>
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
  
  /* Create miner button animations */
  .create-miner-btn {
    box-shadow: 0 10px 20px -10px rgba(var(--accent-blue), 0.6);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  
  .create-miner-btn:hover {
    box-shadow: 0 14px 28px -10px rgba(var(--accent-blue), 0.8);
  }
  
  .bg-size-200 {
    background-size: 200% 200%;
  }
  
  .bg-pos-0 {
    background-position: 0% 0%;
  }
  
  .bg-pos-100 {
    background-position: 100% 100%;
  }
  
  .animate-pulse-slow {
    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(0.95); }
  }
  
  /* Particle animations */
  .particle-1, .particle-2, .particle-3 {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgb(var(--accent-yellow));
    box-shadow: 0 0 10px 2px rgba(var(--accent-yellow), 0.8);
  }
  
  .particle-1 {
    top: 5px;
    left: 2px;
    animation: particle-move-1 2s ease-out infinite;
  }
  
  .particle-2 {
    top: 2px;
    left: 12px;
    animation: particle-move-2 2.2s ease-out infinite;
  }
  
  .particle-3 {
    top: 8px;
    left: 18px;
    animation: particle-move-3 1.8s ease-out infinite;
  }
  
  @keyframes particle-move-1 {
    0% { transform: translate(0, 0); opacity: 1; }
    100% { transform: translate(-10px, -20px); opacity: 0; }
  }
  
  @keyframes particle-move-2 {
    0% { transform: translate(0, 0); opacity: 1; }
    100% { transform: translate(5px, -25px); opacity: 0; }
  }
  
  @keyframes particle-move-3 {
    0% { transform: translate(0, 0); opacity: 1; }
    100% { transform: translate(15px, -15px); opacity: 0; }
  }
</style>
