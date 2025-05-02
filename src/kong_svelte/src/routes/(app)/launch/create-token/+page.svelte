<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import Dropdown from "$lib/components/common/Dropdown.svelte"; // Changed Select to Dropdown
  import { Principal } from "@dfinity/principal";
  // Import canisterId using alias (resolves to index.js)
  import { canisterId as launchpadCanisterId } from "$declarations/launchpad";
  import { canisterId as kongLedgerCanisterId } from "$declarations/kong_ledger";
  // Import _SERVICE type directly from the .did.js file
  import type { _SERVICE as LaunchpadService } from "$declarations/launchpad/launchpad.did.js";
  import type { _SERVICE as LedgerService } from "$declarations/kong_ledger/kong_ledger.did.js";
  import { canisterIDLs } from "$lib/config/auth.config"; // Import canisterIDLs map for getActor
  import type { ActorSubclass } from "@dfinity/agent";
  import { toastStore } from "$lib/stores/toastStore"; // Use the project's toast store
  import { goto } from "$app/navigation";
  import { onMount } from "svelte"; // Using onMount temporarily for fee fetching

  // --- Constants ---
  const LAUNCHPAD_CANISTER_ID = launchpadCanisterId;
  const KONG_LEDGER_CANISTER_ID = kongLedgerCanisterId || "o7oak-iyaaa-aaaaq-aadzq-cai"; // Fallback just in case declaration is missing
  const TOKEN_CREATION_FEE = 500n * 10n ** 8n; // 500 KONG (assuming 8 decimals)

  // --- State ---
  let ticker = $state("");
  let name = $state("");
  let totalSupply = $state(""); // Use string for input, convert to bigint later
  let logo = $state(""); // Optional
  let decimals = $state("8"); // Optional, default 8
  let transferFee = $state("10000"); // Optional, default 0.0001 KONG
  let blockTimeTargetSeconds = $state("60"); // Default 1 minute
  let halvingInterval = $state("210000"); // Default Bitcoin-like
  let initialBlockReward = $state("5000000000"); // Default 50 KONG (assuming 8 decimals)
  let chain = $state("ICP"); // Default ICP
  let ownerPrincipal = $state(""); // Optional, defaults to caller

  let isLoading = $state(false);
  let kongTransferFee = $state(0n);
  // Type actors using the imported service types
  let launchpadActor = $state<ActorSubclass<LaunchpadService> | null>(null);
  let kongLedgerActor = $state<ActorSubclass<LedgerService> | null>(null);
  let errorMessage = $state<string | null>(null);
  let isChainDropdownOpen = $state(false); // State for Dropdown

  const chainOptions = [
    { value: "ICP", label: "ICP" },
    { value: "BTC", label: "BTC" },
    { value: "SOL", label: "SOL" },
    { value: "SUI", label: "SUI" },
  ];

  // --- Effects ---
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

  // --- Actor Initialization ---
  async function initializeActors() {
    if (!$auth.isConnected) return; // Ensure connected before getting actors
    try {
      // Get actors without generic types, using imported IDLs/mappings
      launchpadActor = await auth.getActor(
        LAUNCHPAD_CANISTER_ID,
        canisterIDLs.launchpad // Use the IDL map from config
      );
      kongLedgerActor = await auth.getActor(
        KONG_LEDGER_CANISTER_ID,
        canisterIDLs.icrc2, // Use the ICRC2 IDL from config
        { anon: true, host: 'https://icp0.io' } // Use anonymous actor for fetching fee
      );
    } catch (error) {
      console.error("Error initializing actors:", error);
      // Don't reset actors here, let the effect handle disconnect
      errorMessage = "Failed to initialize actors. Please ensure your wallet is connected and refresh.";
      toastStore.error("Actor initialization failed."); // Use toastStore API
    }
  }

  // --- Fee Fetching ---
  async function fetchKongFee() {
    if (!kongLedgerActor) return;
    try {
      const feeResult = await kongLedgerActor.icrc1_fee();
      kongTransferFee = feeResult;
      console.log("KONG Transfer Fee:", kongTransferFee);
    } catch (error) {
      console.error("Error fetching KONG transfer fee:", error);
      errorMessage = "Failed to fetch KONG transfer fee.";
      toastStore.error("Could not fetch KONG fee."); // Use toastStore API
    }
  }

  // --- Form Submission ---
  async function handleCreateToken() {
    errorMessage = null;
    if (!validateForm()) return; // Validation shows its own toast
    if (!$auth.isConnected || !$auth.account?.owner || !launchpadActor || !kongLedgerActor) {
      errorMessage = "Please connect your wallet first.";
      toastStore.error("Wallet not connected."); // Use toastStore API
      return;
    }
    if (kongTransferFee === 0n) {
        await fetchKongFee(); // Try fetching fee again if it wasn't available
        if (kongTransferFee === 0n) {
             errorMessage = "Could not determine KONG transfer fee. Cannot proceed.";
             toastStore.error("KONG fee unknown."); // Use toastStore API
             return;
        }
    }


    isLoading = true;
    // Use info for loading, make it non-dismissible by default (duration 0)
    const loadingToastId = toastStore.info("Processing token creation...", { duration: 0 });

    try {
      const callerPrincipal = $auth.account.owner;
      const totalFee = TOKEN_CREATION_FEE + kongTransferFee;

      // 1. Approve KONG spending
      // Cannot update toast message with current store, just show info
      toastStore.info(`Approving ${Number(totalFee) / 10**8} KONG...`);
      const approveArgs = {
        fee: [] as [], // Explicitly type empty arrays for optional Candid args
        memo: [] as [],
        from_subaccount: [] as [],
        created_at_time: [] as [],
        amount: totalFee,
        expected_allowance: [] as [],
        expires_at: [] as [],
        spender: {
          owner: Principal.fromText(LAUNCHPAD_CANISTER_ID),
          subaccount: [] as [],
        },
      };
      const approveResult = await kongLedgerActor.icrc2_approve(approveArgs);
      if ("Err" in approveResult) {
        console.error("Approval Error:", approveResult.Err);
        throw new Error(`KONG approval failed: ${JSON.stringify(approveResult.Err)}`);
      }
      toastStore.success("KONG approved successfully!");
      toastStore.info("Creating token on launchpad...");

      // 2. Call create_token on launchpad (pass arguments directly)
      const createResult = await launchpadActor.create_token(
        ticker,
        name,
        BigInt(totalSupply),
        logo ? [logo] : ([] as []), // Handle optional text
        decimals ? [parseInt(decimals)] : ([] as []), // Handle optional nat8
        transferFee ? [BigInt(transferFee)] : ([] as []), // Handle optional nat64
        BigInt(blockTimeTargetSeconds),
        BigInt(halvingInterval),
        BigInt(initialBlockReward),
        // Explicitly create the ChainType variant based on the selected chain
        chain === 'BTC' ? { BTC: null } :
        chain === 'SOL' ? { SOL: null } :
        chain === 'SUI' ? { SUI: null } :
        { ICP: null }, // Default to ICP if somehow invalid
        ownerPrincipal ? [Principal.fromText(ownerPrincipal)] : ([] as []) // Handle optional principal
      );

      if ("Err" in createResult) {
        console.error("Token Creation Error:", createResult.Err);
        throw new Error(`Token creation failed: ${createResult.Err}`);
      }

      const newTokenCanisterId = createResult.Ok.toText();
      toastStore.success(`Token created successfully! Canister ID: ${newTokenCanisterId}`);
      // Optionally redirect or clear form
      // goto(`/explore-tokens`); // Example redirect
      resetForm();

    } catch (error: any) {
      console.error("Token creation process failed:", error);
      errorMessage = error.message || "An unexpected error occurred.";
      toastStore.error(`Creation failed: ${errorMessage}`);
    } finally {
      isLoading = false;
      toastStore.dismiss(loadingToastId); // Dismiss loading toast using its ID
    }
  }

  // --- Validation ---
  function validateForm(): boolean {
    if (!ticker || !name || !totalSupply || !blockTimeTargetSeconds || !halvingInterval || !initialBlockReward || !chain) {
      errorMessage = "Please fill in all required fields.";
      toastStore.error("Missing required fields."); // Use toastStore API
      return false;
    }
    try {
      BigInt(totalSupply);
      if (decimals) parseInt(decimals);
      if (transferFee) BigInt(transferFee);
      BigInt(blockTimeTargetSeconds);
      BigInt(halvingInterval);
      BigInt(initialBlockReward);
      if (ownerPrincipal) Principal.fromText(ownerPrincipal);
    } catch (e) {
      errorMessage = "Invalid number or principal format.";
      toastStore.error("Invalid input format."); // Use toastStore API
      return false;
    }
    // Add more specific validation as needed (e.g., range checks)
    return true;
  }

  // --- Helpers ---
  function resetForm() {
      ticker = "";
      name = "";
      totalSupply = "";
      logo = "";
      decimals = "8";
      transferFee = "10000";
      blockTimeTargetSeconds = "60";
      halvingInterval = "210000";
      initialBlockReward = "5000000000";
      chain = "ICP";
      ownerPrincipal = "";
      errorMessage = null;
  }

  function handleConnect() {
    walletProviderStore.open();
  }

</script>

<div class="container mx-auto px-4 py-8">
  <Panel>
    <h2 class="text-xl font-semibold mb-4 text-kong-text-primary">Create New Token</h2>
    <div class="space-y-4">
      {#if !$auth.isConnected}
        <p class="text-kong-text-secondary">Connect your wallet to create a token.</p>
        <ButtonV2 label="Connect Wallet" on:click={handleConnect} theme="primary" />
      {:else}
        <p class="text-sm text-kong-text-secondary">
          Create a new ICRC token on the launchpad. Cost: 500 KONG + network fee.
          Your Principal: {$auth.account?.owner.toText()}
        </p>

        <form onsubmit={handleCreateToken} class="space-y-4">
          <TextInput id="ticker" label="Ticker *" bind:value={ticker} placeholder="e.g., MYTKN" required />
          <TextInput id="name" label="Name *" bind:value={name} placeholder="e.g., My Token" required />
          <TextInput id="totalSupply" label="Total Supply *" type="number" bind:value={totalSupply} placeholder="e.g., 100000000000000 (no decimals)" required />
          <TextInput id="logo" label="Logo URL (Optional)" bind:value={logo} placeholder="e.g., https://example.com/logo.png" />
          <TextInput id="decimals" label="Decimals (Optional)" type="number" bind:value={decimals} placeholder="Default: 8" />
          <TextInput id="transferFee" label="Transfer Fee (Optional)" type="number" bind:value={transferFee} placeholder="Smallest unit, e.g., 10000 for 0.0001" />
          <TextInput id="blockTimeTargetSeconds" label="Block Time Target (seconds) *" type="number" bind:value={blockTimeTargetSeconds} required />
          <TextInput id="halvingInterval" label="Halving Interval (blocks) *" type="number" bind:value={halvingInterval} required />
          <TextInput id="initialBlockReward" label="Initial Block Reward *" type="number" bind:value={initialBlockReward} placeholder="Smallest unit" required />
          
          <!-- Replaced Select with Dropdown -->
          <div class="flex flex-col gap-2 w-full font-play">
            <label for="chain-type-trigger" class="text-sm font-medium text-white/90">
              Chain Type *
              <span class="text-red-500 ml-1">*</span>
            </label>
            <Dropdown bind:open={isChainDropdownOpen} width="w-full" position="bottom-left">
              <div slot="trigger" id="chain-type-trigger" class="w-full border-2 border-white/10 bg-white/5 focus:bg-white/10 rounded-lg px-4 py-3 text-base text-white placeholder-white/50 flex justify-between items-center cursor-pointer hover:border-yellow-400 transition-colors">
                <span>{chain || 'Select Chain'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 transition-transform {isChainDropdownOpen ? 'rotate-180' : ''}">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
              <svelte:fragment slot="default" let:getItemClass>
                {#each chainOptions as option (option.value)}
                  <button
                    type="button"
                    class="{getItemClass()} w-full {chain === option.value ? 'bg-kong-bg-secondary/30 text-kong-primary' : ''}"
                    onclick={() => { // Changed on:click to onclick
                      chain = option.value;
                      isChainDropdownOpen = false;
                    }}
                  >
                    {option.label}
                  </button>
                {/each}
              </svelte:fragment>
            </Dropdown>
          </div>
          <!-- End of Dropdown replacement -->

          <TextInput id="ownerPrincipal" label="Owner Principal (Optional)" bind:value={ownerPrincipal} placeholder="Defaults to your principal" />

          {#if errorMessage}
            <p class="text-red-500 text-sm">{errorMessage}</p>
          {/if}

          <ButtonV2
            label={isLoading ? "Processing..." : `Create Token (${Number(TOKEN_CREATION_FEE + kongTransferFee) / 10**8} KONG)`}
            type="submit"
            theme="primary"
            disabled={isLoading || !$auth.isConnected || !launchpadActor || !kongLedgerActor}
          />
        </form>
      {/if}
    </div>
  </Panel>
</div>

<style>
  /* Add any specific styles if needed */
</style>
