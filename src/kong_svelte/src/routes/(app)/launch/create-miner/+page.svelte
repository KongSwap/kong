<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import { Principal } from "@dfinity/principal";
  import { canisterId as launchpadCanisterId } from "$declarations/launchpad";
  import { canisterId as kongLedgerCanisterId } from "$declarations/kong_ledger";
  import type { _SERVICE as LaunchpadService } from "$declarations/launchpad/launchpad.did.js";
  import type { _SERVICE as LedgerService } from "$declarations/kong_ledger/kong_ledger.did.js";
  import { canisterIDLs } from "$lib/config/auth.config";
  import type { ActorSubclass } from "@dfinity/agent";
  import { toastStore } from "$lib/stores/toastStore";

  // --- Constants ---
  const LAUNCHPAD_CANISTER_ID = launchpadCanisterId;
  const KONG_LEDGER_CANISTER_ID = kongLedgerCanisterId || "o7oak-iyaaa-aaaaq-aadzq-cai"; // Fallback
  const MINER_CREATION_FEE = 125n * 10n ** 8n; // 125 KONG (assuming 8 decimals)

  // --- State ---
  let powBackendId = $state("");
  let ownerPrincipal = $state("");

  let isLoading = $state(false);
  let kongTransferFee = $state(0n);
  let launchpadActor = $state<ActorSubclass<LaunchpadService> | null>(null);
  let kongLedgerActor = $state<ActorSubclass<LedgerService> | null>(null);
  let errorMessage = $state<string | null>(null);

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
    if (!$auth.isConnected) return;
    try {
      launchpadActor = await auth.getActor(
        LAUNCHPAD_CANISTER_ID,
        canisterIDLs.launchpad
      );
      kongLedgerActor = await auth.getActor(
        KONG_LEDGER_CANISTER_ID,
        canisterIDLs.icrc2,
        { anon: true } // Use anonymous actor for fetching fee
      );
    } catch (error) {
      console.error("Error initializing actors:", error);
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
  async function handleCreateMiner() {
    errorMessage = null;
    if (!validateForm()) return;
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
    const loadingToastId = toastStore.info("Processing miner creation...", { duration: 0 }); // Use toastStore API

    try {
      const callerPrincipal = $auth.account.owner;
      // Approve miner creation fee plus ICRC transfer fee
      const approvalAmount = MINER_CREATION_FEE + kongTransferFee;

      // 1. Approve KONG spending
      toastStore.info(`Approving ${Number(approvalAmount) / 10**8} KONG...`); // Use toastStore API
      const approveArgs = {
        fee: [] as [], // Explicitly type empty arrays
        memo: [] as [],
        from_subaccount: [] as [],
        created_at_time: [] as [],
        amount: approvalAmount, // Use the corrected approval amount
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
      toastStore.success("KONG approved successfully!"); // Use toastStore API
      toastStore.info("Creating miner on launchpad..."); // Use toastStore API

      // 2. Call create_miner on launchpad (pass arguments directly)
      const createResult = await launchpadActor.create_miner(
        Principal.fromText(powBackendId),
        ownerPrincipal ? [Principal.fromText(ownerPrincipal)] : ([] as []) // Handle optional principal
      );

      if ("Err" in createResult) {
        console.error("Miner Creation Error:", createResult.Err);
        throw new Error(`Miner creation failed: ${createResult.Err}`);
      }

      const newMinerCanisterId = createResult.Ok.toText();
      toastStore.success(`Miner created successfully! Canister ID: ${newMinerCanisterId}`); // Use toastStore API
      // Optionally redirect or clear form
      // goto(`/explore-miners`); // Example redirect
      resetForm();

    } catch (error: any) {
      console.error("Miner creation process failed:", error);
      errorMessage = error.message || "An unexpected error occurred.";
      toastStore.error(`Creation failed: ${errorMessage}`); // Use toastStore API
    } finally {
      isLoading = false;
      toastStore.dismiss(loadingToastId); // Dismiss loading toast using its ID
    }
  }

  // --- Validation ---
  function validateForm(): boolean {
    if (!powBackendId) {
      errorMessage = "Proof of Work Backend Canister ID is required.";
      toastStore.error("Missing required field."); // Use toastStore API
      return false;
    }
    try {
      Principal.fromText(powBackendId);
      if (ownerPrincipal) Principal.fromText(ownerPrincipal);
    } catch (e) {
      errorMessage = "Invalid Principal ID format.";
      toastStore.error("Invalid Principal ID format."); // Use toastStore API
      return false;
    }
    return true;
  }

  // --- Helpers ---
  function resetForm() {
      powBackendId = "";
      ownerPrincipal = "";
      errorMessage = null;
  }

  function handleConnect() {
    walletProviderStore.open();
  }

</script>

<div class="container mx-auto px-4 py-8">
  <Panel>
    <h2 class="text-xl font-semibold mb-4 text-kong-text-primary">Create New Miner</h2>
    <div class="space-y-4">
      {#if !$auth.isConnected}
        <p class="text-kong-text-secondary">Connect your wallet to create a miner.</p>
        <ButtonV2 label="Connect Wallet" on:click={handleConnect} theme="primary" />
      {:else}
        <p class="text-sm text-kong-text-secondary">
          Create a new Miner canister on the launchpad. Cost: 125 KONG + network fee.
          Your Principal: {$auth.account?.owner}
        </p>

        <form onsubmit={handleCreateMiner} class="space-y-4">
          <TextInput id="powBackendId" label="Proof of Work Backend Canister ID *" bind:value={powBackendId} placeholder="Enter the PoW backend canister ID" required />
          <TextInput id="ownerPrincipal" label="Owner Principal (Optional)" bind:value={ownerPrincipal} placeholder="Defaults to your principal" />

          {#if errorMessage}
            <p class="text-red-500 text-sm">{errorMessage}</p>
          {/if}

          <ButtonV2
            label={isLoading ? "Processing..." : `Create Miner (${Number(MINER_CREATION_FEE) / 10**8} KONG)`}
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
</style>
