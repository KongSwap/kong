<script lang="ts">
  import { auth } from "$lib/services/auth";
  import { onMount, afterUpdate } from "svelte";
  import QRCode from 'qrcode';
  import { writable } from 'svelte/store';
  import { toastStore } from "$lib/stores/toastStore";
  import Modal from "$lib/components/common/Modal.svelte";
  import { QrCode, Clipboard } from 'lucide-svelte';
  import { Principal } from '@dfinity/principal';
  import { AccountIdentifier } from '@dfinity/ledger-icp';
  import { SubAccount } from '@dfinity/ledger-icp';

  const qrModalStore = writable({
    isOpen: false,
    qrData: '',
    title: ''
  });

  export let display: 'both' | 'principal' | 'account' = 'both';
  let principalCopied = writable(false);
  let accountCopied = writable(false);
  let copyLoading = writable(false);
  let qrLoading = writable(false);
  let activeTab: 'principal' | 'account' = 'principal';
  let mounted = false;

  interface UserIdentity {
    principalId: string;
    accountId: string;
    principalQR: string;
    accountQR: string;
  }

  let identity: UserIdentity = {
    principalId: '',
    accountId: '',
    principalQR: '',
    accountQR: ''
  };

  async function generateQR(text: string | undefined): Promise<string> {
    if (!text || typeof text !== 'string' || text.trim() === '') return '';
    
    try {
      qrLoading.set(true);
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
      qrLoading.set(false);
    }
  }

  const handleCopy = async (text: string, type: 'principal' | 'account') => {
    try {
      copyLoading.set(true);
      await navigator.clipboard.writeText(text);
      if (type === 'principal') {
        principalCopied.set(true);
        setTimeout(() => principalCopied.set(false), 2000);
      } else {
        accountCopied.set(true);
        setTimeout(() => accountCopied.set(false), 2000);
      }
      toastStore.success('Copied to clipboard!', 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toastStore.error('Failed to copy to clipboard');
    } finally {
      copyLoading.set(false);
    }
  };

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

  function createAccountIdentifier(principalStr: string, rawSubaccount: any): { withSubaccount: string, default: string } {
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
      
      return {
        withSubaccount,
        default: defaultAccountId
      };
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
    const principalStr = typeof principal === 'string' ? principal : principal?.toText?.() || '';
    
    // Log debug information
    console.log('Account Debug:', {
      principal: principalStr,
      rawSubaccount: auth.pnp?.account?.subaccount,
      subaccountArray: Array.from(auth.pnp?.account?.subaccount || [])
    });
    
    const accountIds = createAccountIdentifier(principalStr, auth.pnp?.account?.subaccount);
    
    console.log('Generated Account IDs:', {
      withSubaccount: accountIds.withSubaccount,
      default: accountIds.default
    });

    identity = {
      ...identity,
      principalId: principalStr,
      accountId: accountIds.withSubaccount,
      defaultAccountId: accountIds.default
    };

    // Generate QR codes
    if (identity.principalId && identity.accountId) {
      const [principalQR, accountQR] = await Promise.all([
        generateQR(identity.principalId),
        generateQR(identity.accountId)
      ]);

      identity = {
        ...identity,
        principalQR,
        accountQR
      };
    }
  }

  onMount(async () => {
    mounted = true;
    await updateIdentity();
  });

  $: if (mounted && auth.pnp?.account?.owner) {
    updateIdentity();
  }

  function openQrModal(qr: string, type: 'principal' | 'account') {
    const title = type === 'principal' ? 'Principal ID' : 'Account ID';
    qrModalStore.update(state => ({ isOpen: true, qrData: qr, title }));
  }
</script>

{#if $qrModalStore.isOpen}
  <Modal
    isOpen={$qrModalStore.isOpen}
    onClose={() => qrModalStore.update(state => ({ ...state, isOpen: false }))}
    title={$qrModalStore.title}
    width="min(90vw, 500px)"
    height="auto"
    variant="green"
  >
    <div class="qr-modal-content">
      <div class="qr-display">
        <div class="qr-backdrop">
          <img src={$qrModalStore.qrData} alt={$qrModalStore.title} class="qr-blur" />
        </div>
        <img src={$qrModalStore.qrData} alt={$qrModalStore.title} class="qr-main" />
      </div>
      <div class="qr-description ">
        <p class="text-sm opacity-75">Scan this QR code to quickly share your {$qrModalStore.title.toLowerCase()} with others.</p>
      </div>
    </div>
  </Modal>
{/if}

<div class="tab-panel">
    <div class="detail-section">
      {#if display === 'both'}
        <div class="tabs">
          <button
            class="tab-button {activeTab === 'principal' ? 'active' : ''}"
            on:click={() => activeTab = 'principal'}
          >
            Principal ID
          </button>
          <button
            class="tab-button {activeTab === 'account' ? 'active' : ''}"
            on:click={() => activeTab = 'account'}
          >
            Account ID
          </button>
        </div>
      {/if}

      <div class="info-grid mt-4">
        {#if (activeTab === 'principal' || display === 'principal') && (display !== 'account')}
          <div class="id-card">
            <div class="id-header">
              <span>Principal ID</span>
              <div class="header-actions">
                <button 
                  type="button"
                  class="action-button"
                  on:click={() => identity.principalQR && openQrModal(identity.principalQR, 'principal')}
                  title="Show QR Code"
                >
                  <QrCode class="w-4 h-4" />
                  <span class="button-text">Show QR</span>
                </button>
                <button 
                  type="button"
                  class="action-button"
                  on:click={() => handleCopy(identity.principalId, 'principal')}
                >
                  <Clipboard class="w-4 h-4" />
                  <span class="button-text">Copy</span>
                </button>
              </div>
            </div>

            <div class="input-group">
              <div class="input-wrapper">
                <input
                  type="text"
                  readonly
                  value={identity.principalId || '...'}
                  class="monospace-input"
                />
              </div>
            </div>

            <div class="info-tooltip mt-4">
              <p>Your Principal ID is your unique digital identity that:</p>
              <ul>
                <li>Is used for ICRC token transfers and DeFi operations</li>
                <li>Acts as your universal username across IC applications</li>
                <li>Controls access to your assets and data</li>
              </ul>
            </div>
          </div>
        {/if}

        {#if (activeTab === 'account' || display === 'account') && (display !== 'principal')}
          <div class="id-card">
            <div class="id-header">
              <span>Default Account ID</span>
              <div class="header-actions">
                <button 
                  type="button"
                  class="action-button"
                  on:click={() => identity.accountQR && openQrModal(identity.accountQR, 'account')}
                  title="Show QR Code"
                >
                  <QrCode class="w-4 h-4" />
                  <span class="button-text">Show QR</span>
                </button>
                <button 
                  type="button"
                  class="action-button"
                  on:click={() => handleCopy(identity.defaultAccountId, 'account')}
                >
                  <Clipboard class="w-4 h-4" />
                  <span class="button-text">Copy</span>
                </button>
              </div>
            </div>

            <div class="input-group">
              <div class="input-wrapper">
                <input
                  type="text"
                  readonly
                  value={identity.defaultAccountId || '...'}
                  class="monospace-input"
                />
              </div>
            </div>

            {#if identity.accountId !== identity.defaultAccountId}
              <div class="id-header mt-6">
                <span>Subaccount ID</span>
                <div class="header-actions">
                  <button 
                    type="button"
                    class="action-button"
                    on:click={() => handleCopy(identity.accountId, 'subaccount')}
                  >
                    <Clipboard class="w-4 h-4" />
                    <span class="button-text">Copy</span>
                  </button>
                </div>
              </div>

              <div class="input-group">
                <div class="input-wrapper">
                  <input
                    type="text"
                    readonly
                    value={identity.accountId || '...'}
                    class="monospace-input"
                  />
                </div>
              </div>
            {/if}

            <div class="info-tooltip mt-4">
              <p>Important Account ID Information:</p>
              <ul>
                <li>The Default Account ID is commonly used for receiving ICP</li>
                <li>Your Subaccount ID is a separate account under your control</li>
                <li>Always verify which account ID you're using for transactions</li>
              </ul>
            </div>
          </div>
        {/if}
      </div>
    </div>
</div>

<style lang="postcss">
  .tab-panel {
    animation: fadeIn 0.3s ease;
    padding-bottom: 4rem;
  }

  .detail-section {
    padding-bottom: 1rem;
  }

  .tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 1rem;
    padding: 0.25rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 0.5rem;
  }

  .tab-button {
    flex: 1;
    padding: 0.5rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .tab-button.active {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .info-grid {
    display: grid;
    gap: 1rem;
  }

  .action-button {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0.375rem;
    transition: all 0.2s;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 28px;
  }

  .action-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .info-tooltip {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .info-tooltip p {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .info-tooltip ul {
    list-style-type: disc;
    padding-left: 1.5rem;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }

  .info-tooltip li {
    margin: 0.25rem 0;
  }

  .qr-modal-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    padding: 2rem;
    position: relative;
    z-index: 1;
  }

  .qr-display {
    position: relative;
    width: min(100%, 300px);
    aspect-ratio: 1;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 1rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .qr-backdrop {
    position: absolute;
    inset: -20px;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    border-radius: 1rem;
    z-index: -1;
    opacity: 0.6;
  }

  .qr-blur {
    width: 120%;
    height: 120%;
    object-fit: cover;
    filter: blur(20px) brightness(0.3);
    transform: scale(1.2);
  }

  .qr-main {
    position: relative;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: white;
    padding: 1rem;
    border-radius: 0.5rem;
  }

  .qr-description {
    text-align: center;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.95rem;
    width: 88%;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .info-tooltip {
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .action-button {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0.375rem;
    transition: all 0.2s;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 28px;
  }

  .action-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-button {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0.375rem;
    transition: all 0.2s;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 28px;
  }

  .id-header {
    @apply flex justify-between items-center text-white/70 text-sm mb-2;
  }

  .header-actions {
    @apply flex items-center gap-2;
  }

  .action-button {
    @apply h-8 px-3 rounded-lg 
           bg-white/5 backdrop-blur-sm
           border border-white/10
           hover:border-white/20 hover:bg-white/10
           text-white/70 hover:text-white
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
           text-white/90
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
    @apply text-white/90 text-sm mb-2;
  }

  .info-tooltip ul {
    @apply list-disc pl-5 text-sm text-white/70;
  }

  .info-tooltip li {
    @apply mb-1;
  }

  .id-header {
    @apply flex justify-between items-center text-white/70 text-sm;
  }

  .header-actions {
    @apply flex items-center gap-2;
  }

  .action-button {
    @apply h-8 px-3 rounded-lg 
           bg-white/5 backdrop-blur-sm
           border border-white/10
           hover:border-white/20 hover:bg-white/10
           text-white/70 hover:text-white
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
