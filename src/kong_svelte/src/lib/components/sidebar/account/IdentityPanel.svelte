<script lang="ts">
  import { auth } from "$lib/services/auth";
  import { onMount } from "svelte";
  import { canisterId as kongBackendId, idlFactory as kongBackendIDL } from "../../../../../../declarations/kong_backend";
  import QRCode from 'qrcode';

  let loading = true;
  let error: string | null = null;
  let copied = false;
  let copyLoading = false;
  let qrLoading = false;
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
      qrLoading = true;
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
      qrLoading = false;
    }
  }

  const handleCopy = async (text: string) => {
    try {
      copyLoading = true;
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    } finally {
      copyLoading = false;
    }
  };

  export async function loadIdentityData() {
    if (!mounted) return;
    try {
      loading = true;
      error = null;
      const actor = await auth.getActor(kongBackendId, kongBackendIDL, { anon: false });
      const res = await actor.get_user();
      
      if (!res.Ok) throw new Error('Failed to fetch user data');

      // First update the IDs immediately to prevent empty state
      identity = {
        ...identity,
        principalId: res.Ok.principal_id,
        accountId: res.Ok.account_id
      };

      // Then generate QR codes asynchronously
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
      error = 'Failed to load identity data';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    mounted = true;
    loadIdentityData();
  });
</script>

<div class="identity-panel min-h-[400px]">
  {#if loading && !identity.principalId}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading identity data...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error-message">{error}</p>
      <button class="retry-button" on:click={loadIdentityData}>Retry</button>
    </div>
  {:else}
    <div class="identity-container">
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

      <div class="tab-content">
        {#if activeTab === 'principal'}
          <div class="id-section">
            <div class="qr-container">
              {#if qrLoading || !identity.principalQR}
                <div class="qr-placeholder">
                  <div class="loading-spinner"></div>
                </div>
              {:else}
                <img src={identity.principalQR} alt="Principal ID QR Code" class="qr-image" />
              {/if}
            </div>
            <div class="id-text">
              <p class="id-label">Principal ID:</p>
              <p class="id-value">{identity.principalId || '...'}</p>
              <button 
                class="copy-button" 
                on:click={() => handleCopy(identity.principalId)}
                disabled={copyLoading || !identity.principalId}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        {:else}
          <div class="id-section">
            <div class="qr-container">
              {#if qrLoading || !identity.accountQR}
                <div class="qr-placeholder">
                  <div class="loading-spinner"></div>
                </div>
              {:else}
                <img src={identity.accountQR} alt="Account ID QR Code" class="qr-image" />
              {/if}
            </div>
            <div class="id-text">
              <p class="id-label">Account ID:</p>
              <p class="id-value">{identity.accountId || '...'}</p>
              <button 
                class="copy-button" 
                on:click={() => handleCopy(identity.accountId)}
                disabled={copyLoading || !identity.accountId}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .identity-panel {
    @apply p-4 flex flex-col;
  }

  .loading-state,
  .error-state {
    @apply flex-1 flex flex-col items-center justify-center gap-4 text-white/70;
  }

  .error-state {
    @apply text-red-400;
  }

  .tabs {
    @apply flex gap-2 mb-6 p-1 
           bg-black/20 rounded-lg;
  }

  .tab-button {
    @apply flex-1 px-4 py-2 
           text-white/70 text-sm font-medium
           rounded-md transition-all;
  }

  .tab-button.active {
    @apply bg-white/10 text-white;
  }

  .id-section {
    @apply grid grid-cols-1 gap-6;
  }

  .id-text {
    @apply flex flex-col gap-4 p-4 
           bg-black/20 rounded-xl;
  }

  .id-label {
    @apply text-white/90 font-medium;
  }

  .id-value {
    @apply block w-full bg-black/20 p-3 rounded-lg
           font-mono text-sm text-white/90 break-all;
    user-select: text;
  }

  .copy-button {
    @apply w-full px-3 py-2 bg-white/10 rounded-lg 
           hover:bg-white/20 transition-all 
           disabled:opacity-50 text-sm text-white;
  }

  .qr-container {
    @apply flex items-center justify-center p-4
           bg-black/20 rounded-xl;
  }

  .qr-placeholder {
    @apply w-full aspect-square max-w-[240px]
           flex items-center justify-center
           bg-white/5 rounded-xl;
  }

  .qr-image {
    @apply bg-white/5 p-4 rounded-xl;
    width: 100%;
    max-width: 240px;
    height: auto;
    aspect-ratio: 1;
  }

  .loading-spinner {
    @apply w-6 h-6 border-2 border-white/20 border-t-white
           rounded-full animate-spin;
  }

  .tab-content {
    @apply mt-4;
  }
</style>
