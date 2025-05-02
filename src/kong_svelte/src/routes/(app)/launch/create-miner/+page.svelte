<script lang="ts">
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import { Principal } from "@dfinity/principal";
  import { canisterId as launchpadCanisterId } from "$declarations/launchpad";
  import type { _SERVICE as LaunchpadService } from "$declarations/launchpad/launchpad.did.js";
  import type { _SERVICE as LedgerService } from "$declarations/kong_ledger/kong_ledger.did.js";
  import { canisterIDLs } from "$lib/config/auth.config";
  import type { ActorSubclass } from "@dfinity/agent";
  import { toastStore } from "$lib/stores/toastStore";

  /* ------------------------------------------------------------------
     CHEAP PUBLIC 13-NODE SUBNETS (research baked in – 2025-05-02 snapshot)
       verified == true  → “Verified Application” subnet
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
  const LAUNCHPAD_CANISTER_ID = launchpadCanisterId;
  const KONG_LEDGER_CANISTER_ID = "o7oak-iyaaa-aaaaq-aadzq-cai";
  const MINER_CREATION_FEE = 12_500_000_000n; // 125 KONG (8 dp)

  /* ------------------------------------------------------------------
                                STATE
  ------------------------------------------------------------------ */
  let powBackendId = $state("");
  let ownerPrincipal = $state("");        // optional owner of the new miner
  let selectedSubnetId = $state("");      // chosen subnet (blank => let backend pick)

  let isLoading = $state(false);
  let kongTransferFee = $state(0n);
  let launchpadActor = $state<ActorSubclass<LaunchpadService> | null>(null);
  let kongLedgerActor = $state<ActorSubclass<LedgerService> | null>(null);
  let errorMessage = $state<string | null>(null);

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

  /* ------------------------------------------------------------------
                          ACTOR INITIALIZATION
  ------------------------------------------------------------------ */
  async function initializeActors() {
    if (!$auth.isConnected) return;
    try {
      launchpadActor = await auth.getActor(
        LAUNCHPAD_CANISTER_ID,
        canisterIDLs.launchpad
      );
      kongLedgerActor = await auth.getActor(
        KONG_LEDGER_CANISTER_ID,
        canisterIDLs.icrc2
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
  async function handleCreateMiner() {
    errorMessage = null;
    if (!validateForm()) return;
    if (
      !$auth.isConnected ||
      !$auth.account?.owner ||
      !launchpadActor ||
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

    isLoading = true;
    const loadingToastId = toastStore.info("Processing miner creation...", { duration: 0 });

    try {
      /* -------- 1. APPROVE SPENDING -------- */
      const approvalAmount = MINER_CREATION_FEE + kongTransferFee;
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
      const createResult = await launchpadActor.create_miner(
        Principal.fromText(powBackendId),
        ownerPrincipal ? [Principal.fromText(ownerPrincipal)] : ([] as [])
        // NOTE: Launchpad’s API currently ignores subnet choice.
        // If/when they add a subnet arg, pass `[selectedSubnetId]` here.
      );

      if ("Err" in createResult) {
        console.error("Creation error:", createResult.Err);
        throw new Error(`Miner creation failed: ${safeStringify(createResult.Err)}`);
      }

      const newMinerCanisterId = createResult.Ok.toText();
      toastStore.success(`Miner created! Canister: ${newMinerCanisterId}`);
      resetForm();
    } catch (error: any) {
      console.error("Miner creation failed:", error);
      errorMessage = error.message || "Unexpected error.";
      toastStore.error(`Creation failed: ${errorMessage}`);
    } finally {
      isLoading = false;
      toastStore.dismiss(loadingToastId);
    }
  }

  /* ------------------------------------------------------------------
                               VALIDATION
  ------------------------------------------------------------------ */
  function validateForm(): boolean {
    if (!powBackendId) {
      errorMessage = "PoW backend Canister ID required.";
      toastStore.error("Missing PoW backend ID.");
      return false;
    }
    try {
      Principal.fromText(powBackendId);
      if (ownerPrincipal) Principal.fromText(ownerPrincipal);
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
    powBackendId = "";
    ownerPrincipal = "";
    selectedSubnetId = "";
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
<div class="container mx-auto px-4 py-8">
  <Panel>
    <h2 class="text-xl font-semibold mb-4 text-kong-text-primary">Create New Miner</h2>

    <div class="space-y-4">
      {#if !$auth.isConnected}
        <p class="text-kong-text-secondary">
          Connect your wallet to create a miner.
        </p>
        <ButtonV2 label="Connect Wallet" on:click={handleConnect} theme="primary" />
      {:else}
        <p class="text-sm text-kong-text-secondary">
          Cost: 125 KONG + network fee. Principal: {$auth.account?.owner}
        </p>

        <form on:submit|preventDefault={handleCreateMiner} class="space-y-4">
          <TextInput
            id="powBackendId"
            label="Proof-of-Work Backend Canister ID *"
            bind:value={powBackendId}
            placeholder="PoW backend canister"
            required
          />

          <!-- Optional custom owner -->
          <TextInput
            id="ownerPrincipal"
            label="Owner Principal (optional)"
            bind:value={ownerPrincipal}
            placeholder="Leave blank to own it yourself"
          />

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

          {#if errorMessage}
            <p class="text-red-500 text-sm">{errorMessage}</p>
          {/if}

          <ButtonV2
            label={isLoading
              ? "Processing..."
              : `Create Miner (${(Number(MINER_CREATION_FEE) / 10 ** 8).toFixed(2)} KONG)`
            }
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
