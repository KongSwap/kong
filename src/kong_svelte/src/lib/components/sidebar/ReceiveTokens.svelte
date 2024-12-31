<script lang="ts">
  import { auth } from "$lib/services/auth";
  import QRCode from "qrcode";
  import { onMount } from "svelte";
  import { Copy, Check } from "lucide-svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { getPrincipalString } from "$lib/utils/accountUtils";
  import { AccountIdentifier } from "@dfinity/ledger-icp";
  import { Principal } from "@dfinity/principal";

  let qrCodeDataUrl = "";
  let copied = false;
  let loading = false;
  let activeTab: "principal" | "account" = "principal";

  let identity = {
    principalId: "",
    accountId: "",
  };

  async function generateQR(text: string) {
    try {
      return await QRCode.toDataURL(text, {
        width: 200,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    } catch (err) {
      console.error("QR generation failed:", err);
      return "";
    }
  }

  async function handleCopy() {
    try {
      loading = true;
      const textToCopy = activeTab === "principal" ? identity.principalId : identity.accountId;
      await navigator.clipboard.writeText(textToCopy);
      copied = true;
      setTimeout(() => (copied = false), 2000);
      toastStore.success("Copied to clipboard!");
    } catch (err) {
      toastStore.error("Failed to copy to clipboard");
    } finally {
      loading = false;
    }
  }

  async function updateIdentity() {
    if (!auth.pnp?.account?.owner) return;

    const principal = auth.pnp.account.owner;
    const principalStr = getPrincipalString(principal);
    const accountId = AccountIdentifier.fromPrincipal({
      principal: Principal.fromText(principalStr),
    }).toHex();

    identity = {
      principalId: principalStr,
      accountId: accountId,
    };

    qrCodeDataUrl = await generateQR(
      activeTab === "principal" ? principalStr : accountId
    );
  }

  $: if (activeTab) {
    updateIdentity();
  }

  onMount(() => {
    updateIdentity();
  });
</script>

<div class="container">
  <div class="card">
    <div class="card-header">
      <span>Receive Method</span>
    </div>
    <div class="input-group">
      <select 
        bind:value={activeTab} 
        class="select-input"
      >
        <option value="principal">Principal ID</option>
        <option value="account">Account ID</option>
      </select>
    </div>
  </div>

  <div class="card !bg-kong-bg-light">
    <div class="card-header">
      <span>QR Code</span>
      <div class="header-actions">
        <button
          class="icon-button"
          on:click={handleCopy}
          disabled={loading}
        >
          {#if copied}
            <Check class="w-4 h-4 text-kong-success" />
            <span class="button-text">Copied</span>
          {:else}
            <Copy class="w-4 h-4" />
            <span class="button-text">Copy</span>
          {/if}
        </button>
      </div>
    </div>
    <div class="input-group">
      <div class="qr-wrapper">
        {#if qrCodeDataUrl}
          <img
            src={qrCodeDataUrl}
            alt="QR Code"
            class="qr-code"
          />
        {/if}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <span>{activeTab === "principal" ? "Principal ID" : "Account ID"}</span>
    </div>
    <div class="input-group">
      <div class="input-wrapper">
        <input
          type="text"
          readonly
          value={activeTab === "principal" ? identity.principalId : identity.accountId}
          class="text-input"
        />
      </div>

      <div class="info-card">
        <p class="info-text">
          {#if activeTab === "principal"}
            Your <strong>Principal ID</strong> is your unique identity on the Internet Computer.
            Share it with others to receive tokens or interact with dApps.
          {:else}
            Your <strong>Account ID</strong> is used specifically for receiving ICP tokens.
            Make sure senders use the correct ID type for the token they're sending.
          {/if}
        </p>
      </div>
    </div>
  </div>
</div>

<style scoped lang="postcss">
  .container {
    @apply flex flex-col gap-4 p-4;
  }

  .card {
    @apply bg-kong-bg-light rounded-xl p-4 mt-4
           border border-kong-border hover:border-kong-border
           transition-all duration-200;

    &:first-child {
      @apply mt-0;
    }
  }

  .card-header {
    @apply flex justify-between items-center mb-3 
           text-kong-text-primary font-medium;
  }

  .header-actions {
    @apply flex items-center gap-2;
  }

  .input-group {
    @apply flex flex-col gap-2;
  }

  .select-input {
    @apply w-full px-4 py-3 bg-kong-bg-dark rounded-lg
           text-kong-text-primary border border-kong-border
           hover:border-kong-border focus:border-kong-primary
           focus:ring-1 focus:ring-kong-primary/20 focus:outline-none
           transition-all duration-200;
  }

  .icon-button {
    @apply flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
           rounded-lg bg-kong-bg-dark text-kong-text-secondary
           hover:bg-kong-bg-dark/60 hover:text-kong-text-primary
           disabled:opacity-50 disabled:cursor-not-allowed
           transition-all duration-200;

    .button-text {
      @apply font-medium;
    }
  }

  .qr-wrapper {
    @apply flex justify-center p-4 bg-white rounded-lg
           border border-kong-border;
  }

  .qr-code {
    @apply w-48 h-48 object-contain;
  }

  .input-wrapper {
    @apply relative flex items-center;
  }

  .text-input {
    @apply w-full px-4 py-3 bg-kong-bg-dark rounded-lg
           text-kong-text-primary border border-kong-border
           hover:border-kong-border transition-all duration-200
           font-mono text-xs tracking-wider leading-relaxed;
  }

  .info-card {
    @apply p-3 bg-kong-bg-light rounded-lg
           border border-kong-border;
  }

  .info-text {
    @apply text-sm text-kong-text-secondary leading-relaxed;

    strong {
      @apply text-kong-text-primary font-medium;
    }
  }
</style>
