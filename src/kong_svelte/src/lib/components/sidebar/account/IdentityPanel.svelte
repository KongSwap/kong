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

  export let display: 'both' | 'principal' | 'account' = 'both';
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
    const text = type === 'principal' ? identity.principalId : identity.accountId;
    if (!identity[`${type}QR`]) {
      identity[`${type}QR`] = await generateQR(text);
    }
    return identity[`${type}QR`];
  }

  async function openQrModal(type: 'principal' | 'account') {
    qrLoading = true;
    const qrData = await getQRCode(type);
    const title = type === 'principal' ? 'Principal ID' : 'Account ID';
    qrModal = { isOpen: true, qrData, title };
    qrLoading = false;
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
<div class="">
  <!-- QR Code Modal -->
  {#if qrModal.isOpen}
    <Modal
      isOpen={qrModal.isOpen}
      onClose={closeQrModal}
      title={qrModal.title}
      width="min(90vw, 400px)"
      height="auto"
      variant="solid"
    >
      <div class="qr-modal-content flex flex-col items-center gap-4 p-4">
        <div class="qr-code-wrapper relative w-full max-w-xs aspect-square bg-kong-bg-light rounded-lg shadow-md">
          <img src={qrModal.qrData} alt={qrModal.title} class="w-full h-full object-contain p-4" />
        </div>
        <p class="text-center text-kong-text-secondary text-sm">
          Scan this QR code to share your {qrModal.title.toLowerCase()}.
        </p>
      </div>
    </Modal>
  {/if}

  <div class=" px-4">
    {#if display === 'both'}
      <div class="tabs mb-4 flex justify-center">
        <nav class="inline-flex overflow-hidden bg-kong-bg-light/50 rounded-md">
          <button
            class="tab-button px-3 py-1.5 text-xs font-medium text-kong-text-secondary hover:bg-kong-bg-dark transition-colors rounded-l-md"
            class:active-tab={activeTab === 'principal'}
            on:click={() => (activeTab = 'principal')}
          >
            Principal ID
          </button>
          <button
            class="tab-button px-3 py-1.5 text-xs font-medium text-kong-text-secondary hover:bg-kong-bg-dark transition-colors rounded-r-md"
            class:active-tab={activeTab === 'account'}
            on:click={() => (activeTab = 'account')}
          >
            Account ID
          </button>
        </nav>
      </div>
    {/if}

    <div class="grid gap-6">
      <!-- Principal ID Section -->
      {#if (activeTab === 'principal' || display === 'principal')}
        <div class="id-section flex flex-col gap-4">
          <div class="id-card bg-kong-bg-light/50 rounded-lg border border-kong-border p-4">
            <h2 class="text-sm font-medium text-kong-text-secondary mb-3">Your Principal ID</h2>
            <div class="flex flex-col gap-2">
              <div class="id-display bg-kong-bg-dark/50 rounded-md p-3 border border-kong-border">
                <span class="font-mono text-xs text-kong-text-secondary break-all select-text tracking-wider leading-relaxed">
                  {identity.principalId || '...'}
                </span>
              </div>
              <div class="actions flex justify-end gap-2">
                <button
                  class="action-button flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
                         bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-secondary transition-colors border border-kong-border"
                  on:click={() => handleCopy(identity.principalId, 'principal')}
                  disabled={copyLoading}
                >
                  {#if principalCopied}
                    <Check size={14} class="text-kong-accent-green" />
                    Copied
                  {:else}
                    <Copy size={14} />
                    Copy
                  {/if}
                </button>
                <button
                  class="action-button flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
                         bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-secondary transition-colors border border-kong-border"
                  on:click={() => openQrModal('principal')}
                >
                  <QrCode size={14} />
                  QR Code
                </button>
              </div>
            </div>
          </div>
          <div class="info-card mt-4 p-3 bg-kong-bg-light/50 rounded-lg border border-kong-border">
            <p class="text-xs text-kong-text-secondary">
              Your <strong>Principal ID</strong> is your unique identity on the Internet Computer. It:
            </p>
            <ul class="list-disc pl-4 text-kong-text-secondary text-xs mt-2 space-y-1">
              <li>Acts as your universal username across IC applications</li>
              <li>Controls access to your assets and data</li>
              <li>Is required for interacting with most dApps</li>
            </ul>
          </div>
        </div>
      {/if}

      <!-- Account ID Section -->
      {#if (activeTab === 'account' || display === 'account')}
        <div class="id-section flex flex-col gap-4">
          <div class="id-card bg-kong-bg-light/50 rounded-lg border border-kong-border p-4">
            <h2 class="text-sm font-medium text-kong-text-secondary mb-3">Your Account ID</h2>
            <div class="flex flex-col gap-2">
              <div class="id-display bg-kong-bg-dark/50 rounded-md p-3 border border-kong-border">
                <span class="font-mono text-xs text-kong-text-secondary break-all select-text tracking-wider leading-relaxed">
                  {identity.defaultAccountId || '...'}
                </span>
              </div>
              <div class="actions flex justify-end gap-2">
                <button
                  class="action-button flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
                         bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-secondary transition-colors border border-kong-border"
                  on:click={() => handleCopy(identity.defaultAccountId, 'account')}
                  disabled={copyLoading}
                >
                  {#if accountCopied}
                    <Check size={14} class="text-kong-accent-green" />
                    Copied
                  {:else}
                    <Copy size={14} />
                    Copy
                  {/if}
                </button>
                <button
                  class="action-button flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
                         bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-secondary transition-colors border border-kong-border"
                  on:click={() => openQrModal('account')}
                >
                  <QrCode size={14} />
                  QR Code
                </button>
              </div>
            </div>
          </div>
          <div class="info-card mt-4 p-3 bg-kong-bg-light/50 rounded-lg border border-kong-border">
            <p class="text-xs text-kong-text-secondary">
              Your <strong>Account ID</strong> is used for holding and transferring tokens. Important notes:
            </p>
            <ul class="list-disc pl-4 text-kong-text-secondary text-xs mt-2 space-y-1">
              <li>If you don't see your tokens, ensure you're using the correct Account ID</li>
              <li>The Account ID includes a specific subaccount</li>
              <li>The Default Account ID is commonly used for receiving ICP</li>
            </ul>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style scoped lang="postcss">
  .qr-modal-content {
    position: relative;
    z-index: 1;
  }

  .qr-code-wrapper {
    background-color: #fff;
  }

  .tabs {
    display: flex;
    justify-content: center;
  }

  .tab-button {
    @apply text-sm text-kong-text-secondary;
    background-color: transparent;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
    border: 1px solid transparent;
  }

  .tab-button:hover {
    @apply bg-kong-bg-dark text-kong-text-secondary;
  }

  .tab-button.active-tab {
    @apply bg-kong-primary text-white border-kong-primary border-b-2 border-b-white/50;
  }

  /* ID Sections */
  .id-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .id-card {
    @apply bg-kong-bg-dark text-kong-text-secondary;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .id-card h2 {
    margin-bottom: 0.5rem;
    @apply text-kong-text-secondary;
  }

  .info-card {
    @apply bg-kong-bg-dark text-kong-text-secondary;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  /* Actions */
  .actions {
    display: flex;
    align-items: center;
  }

  .action-button {
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .action-button:hover:not(:disabled) {
    @apply transform scale-[1.02] transition-transform;
  }

  .id-display {
    @apply relative;
    word-break: break-all;
    line-height: 1.4;
  }

  .tracking-wider {
    letter-spacing: 0.075em;
  }

  .leading-relaxed {
    line-height: 1.625;
  }
</style>
