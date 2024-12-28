<script lang="ts">
  import { auth } from "$lib/services/auth";
  import { onMount, afterUpdate } from "svelte";
  import QRCode from 'qrcode';
  import { writable } from 'svelte/store';
  import { toastStore } from "$lib/stores/toastStore";
  import Modal from "$lib/components/common/Modal.svelte";
  import { QrCode } from 'lucide-svelte';
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
    defaultAccountId: string;
  }

  let identity: UserIdentity = {
    principalId: '',
    accountId: '',
    principalQR: '',
    accountQR: '',
    defaultAccountId: ''
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
      toastStore.success('Copied to clipboard!');
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

  // Replace afterUpdate with a subscription to auth changes
  $: if (mounted && auth.pnp?.account?.owner) {
    updateIdentity();
  }

  function openQrModal(qr: string, type: 'principal' | 'account') {
    const title = type === 'principal' ? 'Principal ID' : 'Account ID';
    qrModalStore.update(state => ({ isOpen: true, qrData: qr, title }));
  }

  function closeQrModal() {
    qrModalStore.update(state => ({ ...state, isOpen: false }));
  }
</script>

{#if $qrModalStore.isOpen}
  <Modal
    isOpen={$qrModalStore.isOpen}
    onClose={closeQrModal}
    title={$qrModalStore.title}
    width="min(90vw, 500px)"
    height="auto"
    variant="solid"
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
          <div class="info-section">
            <div class="identity-container">
              <div class="identity-details">
                <div class="info-item">
                  <div class="value-container">
                    <div class="id-row">
                      <span class="value">{identity.principalId || '...'}</span>
                      <div class="action-buttons">
                        <button
                          class="action-button"
                          on:click={() => handleCopy(identity.principalId, 'principal')}
                          disabled={$copyLoading}
                        >
                          {#if $principalCopied}
                            <span>Copied!</span>
                          {:else}
                            <span>Copy</span>
                          {/if}
                        </button>
                        <button
                          class="action-button"
                          on:click={() => identity.principalQR && openQrModal(identity.principalQR, 'principal')}
                          title="Show QR Code"
                        >
                          <QrCode size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="info-tooltip">
                <p>Your Principal ID is your unique digital identity that:</p>
                <ul>
                  <li>Is used for ICRC token transfers and DeFi operations</li>
                  <li>Acts as your universal username across IC applications</li>
                  <li>Controls access to your assets and data</li>
                  <li>Is required for interacting with most dapps</li>
                </ul>
              </div>
            </div>
          </div>
        {/if}
        {#if (activeTab === 'account' || display === 'account') && (display !== 'principal')}
          <div class="info-section">
            <div class="identity-container">
              <div class="identity-details">
                <div class="info-item">
                  <div class="value-container">
                    <div class="id-row flex items-center">
                      <div class="flex flex-col gap-4 w-full">
                        <div class="flex flex-col">
                          <span class="text-xs text-kong-text-secondary">Principal ID:</span>
                          <div class="flex items-center justify-between">
                            <span class="value flex items-center">
                              {identity.principalId || '...'}
                            </span>
                            <div class="action-buttons">
                              <button
                                class="action-button"
                                on:click={() => handleCopy(identity.principalId, 'principal')}
                                disabled={$copyLoading}
                              >
                                {#if $principalCopied}
                                  <span>Copied!</span>
                                {:else}
                                  <span>Copy</span>
                                {/if}
                              </button>
                              <button
                                class="action-button"
                                on:click={() => identity.principalQR && openQrModal(identity.principalQR, 'principal')}
                                title="Show QR Code"
                              >
                                <QrCode size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div class="flex flex-col">
                          <span class="text-xs text-kong-text-secondary">Account ID:</span>
                          <div class="flex items-center justify-between">
                            <span class="value flex items-center">
                              {identity.defaultAccountId || '...'}
                            </span>
                            <div class="action-buttons">
                              <button
                                class="action-button"
                                on:click={() => handleCopy(identity.defaultAccountId, 'account')}
                                disabled={$copyLoading}
                              >
                                {#if $accountCopied}
                                  <span>Copied!</span>
                                {:else}
                                  <span>Copy</span>
                                {/if}
                              </button>
                              <button
                                class="action-button"
                                on:click={() => identity.accountQR && openQrModal(identity.accountQR, 'account')}
                                title="Show QR Code"
                              >
                                <QrCode size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="info-tooltip">
                  <p>Important Account ID Information:</p>
                  <ul>
                    <li>If you don't see your ICP in the current Account ID, try the Default Account ID</li>
                    <li>The Current Account ID includes a specific subaccount</li>
                    <li>The Default Account ID is the most commonly used for receiving ICP</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
</div>

<style scoped lang="postcss">
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
    @apply bg-kong-bg-dark;
    border-radius: 0.5rem;
  }

  .tab-button {
    flex: 1;
    padding: 0.5rem;
    font-size: 0.875rem;
    @apply text-kong-text-secondary;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .tab-button.active {
    @apply bg-kong-primary;
    @apply text-white;
  }

  .info-grid {
    display: grid;
    gap: 1rem;
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .info-item {
    @apply bg-kong-bg-dark hover:bg-kong-primary hover:text-white !important;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.75rem;
    height: 100%;
  }

  .info-item:hover {
    @apply bg-kong-primary text-white !important;
    color: white !important;
  }


  .value-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: 100%;
    justify-content: center;
  }

  .value {
    font-family: monospace;
    font-size: 0.82rem;
    word-break: break-all;
    color: inherit !important;
    user-select: text;
    flex: 1;
    min-width: 200px;
    min-height: 28px;
    display: flex;
    align-items: center;
  }

  .action-button {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    @apply text-kong-text-primary;
    @apply bg-kong-primary;
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
    @apply bg-kong-primary text-white;
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
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
    @apply bg-kong-bg-dark;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .info-tooltip p {
    @apply text-kong-text-primary;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .info-tooltip ul {
    list-style-type: disc;
    padding-left: 1.5rem;
    @apply text-kong-text-primary/70;
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
    @apply text-kong-text-primary;
    font-size: 0.95rem;
    width: 88%;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .identity-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .identity-details {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .value-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .value {
    font-family: monospace;
    font-size: 0.82rem;
    @apply text-kong-text-primary;
    word-break: break-all;
    user-select: text;
    width: 100%;
  }

  .info-tooltip {
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .value-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .action-button {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    @apply text-kong-text-primary;
    @apply bg-kong-bg-dark;
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
    @apply bg-kong-bg-dark/20;
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .id-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .value {
    font-family: monospace;
    font-size: 0.82rem;
    @apply text-kong-text-primary;
    word-break: break-all;
    user-select: text;
    flex: 1;
    min-width: 200px;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-shrink: 0;
  }

  .action-button {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    @apply text-kong-text-primary;
    @apply bg-kong-bg-dark;
    border-radius: 0.375rem;
    transition: all 0.2s;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 28px;
  }
</style>
