<script lang="ts">
  import { auth } from "$lib/services/auth";
  import { onMount } from "svelte";
  import QRCode from 'qrcode';
  import { toastStore } from "$lib/stores/toastStore";
  import Modal from "$lib/components/common/Modal.svelte";
  import { QrCode, Copy, Check } from 'lucide-svelte';
  import { Principal } from '@dfinity/principal';
  import { AccountIdentifier } from '@dfinity/ledger-icp';
  import { SubAccount } from '@dfinity/ledger-icp';

  let qrModal = {
    isOpen: false,
    qrData: '',
    title: ''
  };

  let principalCopied = false;
  let accountCopied = false;
  let copyLoading = false;
  let qrLoading = false;
  let activeTab: 'principal' | 'account' = 'principal';
  let mounted = false;

  interface UserIdentity {
    principalId: string;
    accountId: string;
    principalQR: string;
    accountQR: string;
    defaultAccountId: string;
  }

  let identity: UserIdentity = {
    principalId: '',
    accountId: '',
    principalQR: '',
    accountQR: '',
    defaultAccountId: ''
  };

  let lastPrincipal = '';
  let lastSubaccount: any = null;
  let cachedAccountIds = { withSubaccount: '', default: '' };

  async function generateQR(text: string | undefined): Promise<string> {
    if (!text || typeof text !== 'string' || text.trim() === '') return '';
    
    try {
      qrLoading = true;
      const safeText = text.toString().trim();
      return await QRCode.toDataURL(safeText, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      });
    } catch (err) {
      console.error('QR generation failed:', err);
      return '';
    } finally {
      qrLoading = false;
    }
  }

  async function handleCopy(text: string, type: 'principal' | 'account') {
    try {
      copyLoading = true;
      await navigator.clipboard.writeText(text);
      if (type === 'principal') {
        principalCopied = true;
        setTimeout(() => (principalCopied = false), 2000);
      } else {
        accountCopied = true;
        setTimeout(() => (accountCopied = false), 2000);
      }
      toastStore.success('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      toastStore.error('Failed to copy to clipboard');
    } finally {
      copyLoading = false;
    }
  }

  function convertToSubaccount(raw: any): SubAccount | undefined {
    try {
      if (!raw) return undefined;
      
      // If it's already a SubAccount, return it
      if (raw instanceof SubAccount) return raw;
      
      // Convert to Uint8Array if needed
      let bytes: Uint8Array;
      if (raw instanceof Uint8Array) {
        bytes = raw;
      } else if (Array.isArray(raw)) {
        bytes = new Uint8Array(raw);
      } else if (typeof raw === 'number') {
        bytes = new Uint8Array(32).fill(0);
        bytes[31] = raw;
      } else {
        return undefined;
      }
      
      // Ensure array is 32 bytes
      if (bytes.length !== 32) {
        const paddedBytes = new Uint8Array(32).fill(0);
        paddedBytes.set(bytes.slice(0, 32));
        bytes = paddedBytes;
      }
      
      const subAccountResult = SubAccount.fromBytes(bytes);
      if (subAccountResult instanceof Error) {
        throw subAccountResult;
      }
      return subAccountResult;
    } catch (error) {
      console.error('Error converting subaccount:', error);
      return undefined;
    }
  }

  function createAccountIdentifier(principalStr: string, rawSubaccount: any) {
    // Return cached result if inputs haven't changed
    if (
      principalStr === lastPrincipal &&
      JSON.stringify(rawSubaccount) === JSON.stringify(lastSubaccount)
    ) {
      return cachedAccountIds;
    }

    try {
      const principal = Principal.fromText(principalStr);
      
      // Create account ID with provided subaccount
      const subAccount = convertToSubaccount(rawSubaccount);
      const withSubaccount = AccountIdentifier.fromPrincipal({
        principal,
        subAccount
      }).toHex();
      
      // Create account ID with default (zero) subaccount
      const defaultAccountId = AccountIdentifier.fromPrincipal({
        principal,
        subAccount: undefined  // This will use the default subaccount
      }).toHex();
      
      // Update cache
      lastPrincipal = principalStr;
      lastSubaccount = rawSubaccount;
      cachedAccountIds = {
        withSubaccount,
        default: defaultAccountId
      };
      
      return cachedAccountIds;
    } catch (error) {
      console.error('Error creating account identifier:', error);
      return {
        withSubaccount: '',
        default: ''
      };
    }
  }

  async function updateIdentity() {
    if (!auth.pnp?.account?.owner) return;
    
    const principal = auth.pnp.account.owner;
    const principalStr =
      typeof principal === 'string' ? principal : principal?.toText?.() || '';
    
    const accountIds = createAccountIdentifier(
      principalStr,
      auth.pnp?.account?.subaccount
    );
    
    identity = {
      ...identity,
      principalId: principalStr,
      accountId: accountIds.withSubaccount,
      defaultAccountId: accountIds.default
    };
  }

  async function getQRCode(type: 'principal' | 'account') {
    const text = type === 'principal' ? identity.principalId : identity.defaultAccountId;
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

  async function openQrModal(type: 'principal' | 'account') {
    qrLoading = true;
    try {
      const qrData = await getQRCode(type);
      const title = type === 'principal' ? 'Principal ID' : 'Account ID';
      qrModal = { isOpen: true, qrData, title };
    } finally {
      qrLoading = false;
    }
  }

  function closeQrModal() {
    qrModal.isOpen = false;
  }

  onMount(async () => {
    mounted = true;
    await updateIdentity();
  });

  $: if (
    mounted &&
    auth.pnp?.account?.owner &&
    identity.principalId !== auth.pnp.account.owner.toString()
  ) {
    updateIdentity();
  }
</script>

<!-- Identity Panel -->
<div class="container">
  {#if qrModal.isOpen}
    <Modal
      isOpen={qrModal.isOpen}
      onClose={closeQrModal}
      title={qrModal.title}
      width="min(400px, 75vw)"
      height="auto"
      variant="solid"
    >
      <div class="modal-content">
        <div class="qr-wrapper">
          <img 
            src={qrModal.qrData} 
            alt={qrModal.title} 
            class="qr-code" 
          />
        </div>
        <p class="modal-text">
          Scan this QR code to share your {qrModal.title.toLowerCase()}.
        </p>
      </div>
    </Modal>
  {/if}

  <div class="card">
    <div class="card-header">
      <span>Identity Type</span>
    </div>
    <div class="input-group">
      <div class="input-wrapper">
        <select 
          bind:value={activeTab}
          class="select-input"
        >
          <option value="principal">Principal ID</option>
          <option value="account">Account ID</option>
        </select>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <span>{activeTab === 'principal' ? 'Principal ID' : 'Account ID'}</span>
      <div class="header-actions">
        <button
          class="icon-button"
          on:click={() => handleCopy(activeTab === 'principal' ? identity.principalId : identity.defaultAccountId, activeTab)}
          disabled={copyLoading}
        >
          {#if (activeTab === 'principal' ? principalCopied : accountCopied)}
            <Check class="w-4 h-4 text-kong-success" />
            <span class="button-text">Copied</span>
          {:else}
            <Copy class="w-4 h-4" />
            <span class="button-text">Copy</span>
          {/if}
        </button>
        <button
          class="icon-button"
          on:click={() => openQrModal(activeTab)}
          disabled={qrLoading}
        >
          <QrCode class="w-4 h-4" />
          <span class="button-text">QR Code</span>
        </button>
      </div>
    </div>
    <div class="input-group">
      <div class="input-wrapper">
        <input
          type="text"
          readonly
          value={activeTab === 'principal' ? identity.principalId : identity.defaultAccountId}
          class="text-input"
        />
      </div>

      <div class="info-card">
        <div class="info-content">
          {#if activeTab === 'principal'}
            <p class="info-title">Your <strong>Principal ID</strong> is your unique identity on the Internet Computer.</p>
            <ul class="info-list">
              <li>Acts as your universal username across IC applications</li>
              <li>Controls access to your assets and data</li>
              <li>Is required for interacting with most dApps</li>
            </ul>
          {:else}
            <p class="info-title">Your <strong>Account ID</strong> is used for holding and transferring tokens.</p>
            <ul class="info-list">
              <li>If you don't see your tokens, ensure you're using the correct Account ID</li>
              <li>The Account ID includes a specific subaccount</li>
              <li>The Default Account ID is commonly used for receiving ICP</li>
            </ul>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style scoped lang="postcss">
  .container {
    @apply flex flex-col gap-4 p-4;
  }

  .card {
    @apply bg-kong-bg-light rounded-md px-4 py-3
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

  .input-wrapper {
    @apply relative flex items-center;
  }

  .select-input {
    @apply w-full px-4 py-3 bg-kong-bg-dark rounded-md
           text-kong-text-primary border border-kong-border
           hover:border-kong-border focus:border-kong-primary
           focus:ring-1 focus:ring-kong-primary/20 focus:outline-none
           transition-all duration-200;
  }

  .icon-button {
    @apply flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
           rounded-md bg-kong-bg-dark text-kong-text-secondary
           hover:bg-kong-bg-dark/60 hover:text-kong-text-primary
           disabled:opacity-50 disabled:cursor-not-allowed
           transition-all duration-200;

    .button-text {
      @apply font-medium;
    }
  }

  .qr-wrapper {
    @apply flex justify-center p-4 bg-white rounded-md
           border border-kong-border;
  }

  .qr-code {
    @apply w-48 h-48 object-contain;
  }

  .text-input {
    @apply w-full px-4 py-3 bg-kong-bg-dark rounded-md
           text-kong-text-primary border border-kong-border
           hover:border-kong-border transition-all duration-200
           font-mono text-xs tracking-wider leading-relaxed;
  }

  .info-card {
    @apply p-3 bg-kong-bg-light rounded-md
           border border-kong-border;
  }

  .info-content {
    @apply space-y-2;
  }

  .info-title {
    @apply text-sm text-kong-text-secondary;

    strong {
      @apply text-kong-text-primary font-medium;
    }
  }

  .info-list {
    @apply list-disc pl-4 space-y-1;

    li {
      @apply text-xs text-kong-text-secondary;
    }
  }

  .modal-content {
    @apply p-6 flex flex-col items-center gap-4;
  }

  .modal-text {
    @apply text-center text-sm text-kong-text-secondary;
  }

  .id-header {
    @apply flex justify-between items-center text-kong-text-primary/70 text-sm mb-2;
  }

  .header-actions {
    @apply flex items-center gap-2;
  }

  .action-button {
    @apply h-8 px-3 rounded-lg 
           bg-white/5 backdrop-blur-sm
           border border-white/10
           hover:border-white/20 hover:bg-white/10
           text-kong-text-primary/70 hover:text-kong-text-primary
           transition-all duration-200
           flex items-center justify-center gap-2;
  }

  .button-text {
    @apply hidden md:inline;
  }

  .action-button:active {
    @apply border-indigo-500 bg-indigo-500/10;
  }

  .id-card {
    @apply flex flex-col gap-2 p-4 
           bg-black/20 backdrop-blur-sm
           border border-white/10 
           rounded-lg;
  }

  .input-wrapper input {
    @apply w-full h-11 rounded-lg px-4
           bg-white/5 backdrop-blur-sm
           border border-white/10 
           hover:border-white/20
           text-kong-text-primary/90
           transition-colors;
  }

  .monospace-input {
    @apply font-mono text-sm;
    cursor: default;
    user-select: all;
  }

  .info-tooltip {
    @apply p-4 rounded-lg
           bg-white/5 backdrop-blur-sm
           border border-white/10;
  }

  .info-tooltip p {
    @apply text-kong-text-primary/90 text-sm mb-2;
  }

  .info-tooltip ul {
    @apply list-disc pl-5 text-sm text-kong-text-primary/70;
  }

  .info-tooltip li {
    @apply mb-1;
  }

  .id-header {
    @apply flex justify-between items-center text-kong-text-primary/70 text-sm;
  }

  .header-actions {
    @apply flex items-center gap-2;
  }

  .action-button {
    @apply h-8 px-3 rounded-lg 
           bg-white/5 backdrop-blur-sm
           border border-white/10
           hover:border-white/20 hover:bg-white/10
           text-kong-text-primary/70 hover:text-kong-text-primary
           transition-all duration-200
           flex items-center justify-center gap-2;
  }

  .button-text {
    @apply hidden md:inline;
  }

  .action-button:active {
    @apply border-indigo-500 bg-indigo-500/10;
  }
</style>
