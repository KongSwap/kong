<script lang="ts">
  import { auth } from "$lib/services/auth";
  import { onMount } from "svelte";
  import QRCode from 'qrcode';
  import { writable } from 'svelte/store';
  import { toastStore } from "$lib/stores/toastStore";
  import { uint8ArrayToHexString } from "@dfinity/utils";
  import Modal from "$lib/components/common/Modal.svelte";
  import { QrCode } from 'lucide-svelte';

  // Create a local store for QR modal state since the global store isn't working
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

  async function generateQR(text: string): Promise<string> {
    if (!text) return '';
    try {
      qrLoading.set(true);
      return await QRCode.toDataURL(text, {
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

  onMount(async () => {
    mounted = true;
    identity = {
      ...identity,
      principalId: auth.pnp?.account?.owner || '',
      accountId: auth.pnp?.account?.subaccount ? uint8ArrayToHexString(auth.pnp.account.subaccount) : ''
    };

    console.log("PNP", auth.pnp);

    const principalQR = await generateQR(identity.principalId.toString());
    const accountQR = await generateQR(identity.accountId);

    identity = {
      ...identity,
      principalQR,
      accountQR
    };
  });

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
                      <span class="value flex items-center">{identity.accountId || '...'}</span>
                      <div class="action-buttons">
                        <button
                          class="action-button"
                          on:click={() => handleCopy(identity.accountId, 'account')}
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
                <div class="info-tooltip">
                  <p>Your Account ID is a legacy address format that:</p>
                  <ul>
                    <li>Is primarily used for ICP token transfers</li>
                    <li>Works with NNS and Internet Identity</li>
                    <li>Is not compatible with most ICRC tokens</li>
                    <li>May be required for some older applications</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
</div>

<style scoped>
  .tab-panel {
    animation: fadeIn 0.3s ease;
    padding-bottom: 4rem;
  }

  .detail-section {
    padding-bottom: 1rem;
  }

  .detail-section h3 {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 0.5rem;
    font-weight: 600;
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

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .info-item {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.75rem;
    height: 100%;
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
    color: rgba(255, 255, 255, 0.9);
    word-break: break-all;
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

  .info-item {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.75rem;
  }

  .value-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .value {
    font-family: monospace;
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.9);
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
    color: rgba(255, 255, 255, 0.9);
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
</style>
