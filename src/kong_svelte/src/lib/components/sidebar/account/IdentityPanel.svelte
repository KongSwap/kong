<script lang="ts">
  import { auth } from "$lib/services/auth";
  import { onMount } from "svelte";
  import { canisterId as kongBackendId, idlFactory as kongBackendIDL } from "../../../../../../declarations/kong_backend";
  import QRCode from 'qrcode';
  import { writable } from 'svelte/store';
  import { toastStore } from "$lib/stores/toastStore";

  export let display: 'both' | 'principal' | 'account' = 'both';

  let loading = writable(true);
  let error = writable<string | null>(null);
  let copied = writable(false);
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
        width: 400,
        margin: 2,
        color: {
          dark: '#ffffff',
          light: '#00000000'
        },
        errorCorrectionLevel: 'H',
        scale: 10
      });
    } catch (err) {
      console.error('QR generation failed:', err);
      return '';
    } finally {
      qrLoading.set(false);
    }
  }

  const handleCopy = async (text: string) => {
    try {
      copyLoading.set(true);
      await navigator.clipboard.writeText(text);
      copied.set(true);
      toastStore.success('Copied to clipboard!', 2000);
      setTimeout(() => copied.set(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toastStore.error('Failed to copy to clipboard');
    } finally {
      copyLoading.set(false);
    }
  };

  export async function loadIdentityData() {
    if (!mounted) return;
    try {
      loading.set(true);
      error.set(null);
      const actor = await auth.getActor(kongBackendId, kongBackendIDL, { anon: false, requiresSigning: false });
      const res = await actor.get_user();
      
      if (!res.Ok) throw new Error('Failed to fetch user data');

      identity = {
        ...identity,
        principalId: res.Ok.principal_id,
        accountId: res.Ok.account_id
      };

      const [principalQR, accountQR] = await Promise.all([
        generateQR(res.Ok.principal_id),
        generateQR(res.Ok.account_id)
      ]);

      identity = {
        ...identity,
        principalQR,
        accountQR
      };
    } catch (err) {
      error.set('Failed to load identity data');
      console.error(err);
    } finally {
      loading.set(false);
    }
  }

  onMount(() => {
    mounted = true;
    loadIdentityData();
  });
</script>

<div class="tab-panel">
  {#if $loading && !identity.principalId}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading identity data...</p>
    </div>
  {:else if $error}
    <div class="error-state">
      <p class="error-message">{$error}</p>
      <button class="retry-button" on:click={loadIdentityData}>Retry</button>
    </div>
  {:else}
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
            <div class="info-item">
              <div class="value-container">
                <span class="value">{identity.principalId || '...'}</span>
                <button
                  class="copy-button"
                  on:click={() => handleCopy(identity.principalId)}
                  disabled={$copyLoading}
                >
                  {#if $copied}
                    <span class="copy-text">Copied!</span>
                  {:else}
                    <span class="copy-text">Copy</span>
                  {/if}
                </button>
              </div>
            </div>
            <div class="qr-container">
              {#if $qrLoading || !identity.principalQR}
                <div class="qr-placeholder">
                  <div class="loading-spinner"></div>
                </div>
              {:else}
                <img src={identity.principalQR} alt="Principal ID QR Code" class="qr-code" />
              {/if}
            </div>
          </div>
        {/if}
        {#if (activeTab === 'account' || display === 'account') && (display !== 'principal')}
          <div class="info-section">
            <div class="info-item">
              <div class="value-container">
                <span class="value">{identity.accountId || '...'}</span>
                <button
                  class="copy-button"
                  on:click={() => handleCopy(identity.accountId)}
                  disabled={$copyLoading}
                >
                  {#if $copied}
                    <span class="copy-text">Copied!</span>
                  {:else}
                    <span class="copy-text">Copy</span>
                  {/if}
                </button>
              </div>
            </div>
            <div class="qr-container">
              {#if $qrLoading || !identity.accountQR}
                <div class="qr-placeholder">
                  <div class="loading-spinner"></div>
                </div>
              {:else}
                <img src={identity.accountQR} alt="Account ID QR Code" class="qr-code" />
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .tab-panel {
    animation: fadeIn 0.3s ease;
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

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .error-state {
    color: rgb(248, 113, 113);
  }

  .retry-button {
    padding: 0.5rem 1rem;
    background: rgba(248, 113, 113, 0.2);
    border: 1px solid rgba(248, 113, 113, 0.3);
    border-radius: 4px;
    color: rgb(248, 113, 113);
    font-size: 0.875rem;
    cursor: pointer;
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
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }

  .value-container {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.5rem;
  }

  .value {
    font-family: monospace;
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.9);
    word-break: break-all;
    user-select: text;
  }

  .copy-button {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0.375rem;
    transition: background 0.2s;
    align-self: start;
    white-space: nowrap;
  }

  .copy-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  .copy-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .qr-container {
    display: flex;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 0.5rem;
  }

  .qr-placeholder {
    width: 200px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
  }

  .qr-code {
    width: 200px;
    height: 200px;
  }

  .loading-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>