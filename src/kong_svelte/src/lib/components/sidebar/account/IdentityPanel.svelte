<script lang="ts">
  import QRCode from 'qrcode';
  import { auth } from "$lib/services/auth";
  import { toastStore } from "$lib/stores/toastStore";
  import { onMount } from "svelte";
  import { canisterId as kongBackendId, idlFactory as kongBackendIDL } from "../../../../../../declarations/kong_backend";
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import Modal from '$lib/components/common/Modal.svelte';

  let loading = true;
  let error: string | null = null;
  let showPrincipalCopied = false;
  let showAccountCopied = false;
  let activeId: 'principal' | 'account' = 'principal';
  let showQR = false;
  let copied = false;
  let copyLoading = false;
  let qrLoading = false;
  
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
      throw new Error('Failed to generate QR code');
    } finally {
      qrLoading = false;
    }
  }

  const handleCopy = async (text: string, type: 'principal' | 'account') => {
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

  async function loadIdentityData() {
    try {
      const actor = await auth.getActor(kongBackendId, kongBackendIDL, { anon: false });
      const res = await actor.get_user();
      
      if (!res.Ok) throw new Error('Failed to fetch user data');

      const [principalQR, accountQR] = await Promise.all([
        generateQR(res.Ok.principal_id),
        generateQR(res.Ok.account_id)
      ]);

      identity = {
        principalId: res.Ok.principal_id,
        accountId: res.Ok.account_id,
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

  onMount(loadIdentityData);

  $: currentId = activeId === 'principal' ? identity.principalId : identity.accountId;
  $: currentQR = activeId === 'principal' ? identity.principalQR : identity.accountQR;
</script>

<div class="container">
  {#if loading}
    <div class="status-message loading" transition:fade>
      <div class="spinner"></div>
      <span>Loading identity data...</span>
    </div>
  {:else if error}
    <div class="status-message error" transition:fade>
      <span>❌ {error}</span>
      <button class="retry-btn" on:click={loadIdentityData}>Try Again</button>
    </div>
  {:else}
    <div class="id-selector" transition:scale={{duration: 300, easing: quintOut}}>
      <button 
        class="selector-btn" 
        class:active={activeId === 'principal'}
        on:click={() => activeId = 'principal'}
      >
        <span class="btn-icon">👤</span>
        <div class="btn-text">
          <span class="btn-title">Principal ID</span>
          <span class="btn-desc">For most transfers</span>
        </div>
      </button>
      <button 
        class="selector-btn"
        class:active={activeId === 'account'}
        on:click={() => activeId = 'account'}
      >
        <span class="btn-icon">🏦</span>
        <div class="btn-text">
          <span class="btn-title">Account ID</span>
          <span class="btn-desc">For special cases</span>
        </div>
      </button>
    </div>

    <div class="content" transition:fade={{delay: 150}}>
      <div class="id-card">
        <div class="id-header">
          <span>{activeId === 'principal' ? 'Principal ID' : 'Account ID'}</span>
          <div class="id-actions">
            <button 
              class="action-btn"
              on:click={() => !copyLoading && handleCopy(currentId, activeId)}
              disabled={copyLoading}
            >
              {#if copyLoading}
                <div class="spinner small"></div>
              {:else if copied}
                <span>✓</span>
              {:else}
                <span>📋</span>
              {/if}
              <span class="action-text">Copy</span>
            </button>
            <button 
              class="action-btn"
              on:click={() => showQR = true}
              disabled={qrLoading}
            >
              <span class="qr-icon">📱</span>
              <span class="action-text">{qrLoading ? 'Loading...' : 'Show QR'}</span>
              <span class="mobile-text">{qrLoading ? '...' : 'QR'}</span>
            </button>
          </div>
        </div>
        
        <div class="id-display">
          <code class="selectable">{currentId}</code>
        </div>
      </div>
    </div>

    {#if showQR}
      <Modal 
        isOpen={showQR}
        onClose={() => showQR = false}
        title={`Scan ${activeId === 'principal' ? 'Principal' : 'Account'} ID`}
        width="min(500px, 95vw)"
        height="auto"
      >
        <div class="qr-modal">
          {#if qrLoading}
            <div class="qr-loading">
              <div class="spinner"></div>
              <span>Generating QR Code...</span>
            </div>
          {:else}
            <div class="qr-container">
              <img src={currentQR} alt={`${activeId} QR Code`} class="qr-image" />
              <div class="qr-details">
                <div class="qr-type">
                  {activeId === 'principal' ? 'Principal ID' : 'Account ID'}
                </div>
                <code class="selectable">{currentId}</code>
              </div>
              <button 
                class="qr-copy-btn"
                on:click={() => handleCopy(currentId, activeId)}
                disabled={copyLoading}
              >
                {#if copyLoading}
                  <div class="spinner small"></div>
                {:else if copied}
                  <span>✓ Copied</span>
                {:else}
                  <span>Copy Address</span>
                {/if}
              </button>
            </div>
          {/if}
        </div>
      </Modal>
    {/if}
  {/if}
</div>

<style lang="postcss">
  .container {
    @apply flex flex-col gap-2 py-2 px-2;
  }

  .status-message {
    @apply flex flex-col items-center gap-4 py-12 text-white/70;
  }

  .status-message.error {
    @apply text-red-400;
  }

  .retry-btn {
    @apply px-6 py-3 bg-white/10 hover:bg-white/20 
           rounded-xl transition-all text-white
           hover:transform hover:-translate-y-0.5;
  }

  .id-selector {
    @apply grid grid-cols-2 gap-3 p-1;
  }

  .selector-btn {
    @apply flex items-center gap-3 py-4 px-5 rounded-xl
           transition-all duration-200 bg-white/5
           hover:bg-white/10 text-left;
  }

  .selector-btn.active {
    @apply bg-indigo-500/20 ring-2 ring-indigo-500/30;
  }

  .btn-icon {
    @apply text-2xl;
  }

  .btn-text {
    @apply flex flex-col;
  }

  .btn-title {
    @apply font-medium text-white;
  }

  .btn-desc {
    @apply text-sm text-white/50;
  }

  .id-card {
    @apply bg-white/5 rounded-2xl p-6;
  }

  .id-header {
    @apply flex justify-between items-center mb-4
           text-white/70 text-sm font-medium;
  }

  .id-display {
    @apply bg-black/20 rounded-xl p-6;
  }

  .selectable {
    @apply block text-base text-white/90 break-all text-center font-mono;
    user-select: text;
  }

  .qr-modal {
    @apply p-6;
  }

  .qr-container {
    @apply flex flex-col items-center gap-6;
  }

  .qr-image {
    @apply bg-white/5 p-6 rounded-2xl;
    width: min(400px, 80vw);
    height: auto;
    aspect-ratio: 1;
  }

  .qr-details {
    @apply w-full bg-black/20 p-4 rounded-xl;
  }

  .qr-type {
    @apply text-sm text-white/50 mb-2;
  }

  .qr-copy-btn {
    @apply w-full px-4 py-3 bg-white/10 hover:bg-white/20 
           rounded-lg transition-all text-white 
           disabled:opacity-50 text-base font-medium;
  }

  .spinner {
    @apply w-6 h-6 border-2 border-white/20 border-t-white
           rounded-full animate-spin;
  }

  .spinner.small {
    @apply w-4 h-4;
  }

  .loading {
    @apply opacity-50 cursor-wait;
  }

  .id-actions {
    @apply flex items-center gap-2;
  }

  .action-btn {
    @apply flex items-center gap-2 px-4 py-2
           bg-white/10 rounded-lg hover:bg-white/20
           transition-all text-white disabled:opacity-50;
  }

  .mobile-text {
    @apply hidden;
  }

  @media (max-width: 640px) {
    .container {
      @apply gap-6 py-4;
    }

    .id-selector {
      @apply grid-cols-1;
    }

    .selector-btn {
      @apply py-3;
    }

    .id-card {
      @apply p-4;
    }

    .id-display {
      @apply p-4;
    }

    .action-text {
      @apply hidden;
    }

    .mobile-text {
      @apply block;
    }

    .action-btn {
      @apply px-3;
    }
  }
</style>
