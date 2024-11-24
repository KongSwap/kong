<script lang="ts">
  import QRCode from 'qrcode';
  import { auth } from "$lib/services/auth";
  import { toastStore } from "$lib/stores/toastStore";
  import { onMount } from "svelte";
  import { canisterId as kongBackendId, idlFactory as kongBackendIDL } from "../../../../../../declarations/kong_backend";

  let loading = true;
  let error: string | null = null;
  let showPrincipalCopied = false;
  let showAccountCopied = false;
  let activeId: 'principal' | 'account' = 'principal';
  
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
      return await QRCode.toDataURL(text, {
        width: 300,
        margin: 1,
        color: {
          dark: '#ffffff',
          light: '#00000000'
        }
      });
    } catch (err) {
      console.error('QR generation failed:', err);
      throw new Error('Failed to generate QR code');
    }
  }

  const handleCopy = async (text: string, type: 'principal' | 'account') => {
    try {
      await navigator.clipboard.writeText(text);
      toastStore.success('Copied to clipboard');
      if (type === 'principal') {
        showPrincipalCopied = true;
        setTimeout(() => showPrincipalCopied = false, 1500);
      } else {
        showAccountCopied = true;
        setTimeout(() => showAccountCopied = false, 1500);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  async function loadIdentityData() {
    try {
      const actor = await auth.getActor(kongBackendId, kongBackendIDL, { anon: false });
      const res = await actor.get_user();
      
      if (!res.Ok) throw new Error('Failed to fetch user data');

      identity = {
        principalId: res.Ok.principal_id,
        accountId: res.Ok.account_id,
        principalQR: await generateQR(res.Ok.principal_id),
        accountQR: await generateQR(res.Ok.account_id)
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

<div class="identity-panel">
  {#if loading}
    <div class="loading-state">Loading identity data...</div>
  {:else if error}
    <div class="error-state">
      {error}
      <button class="retry-button" on:click={loadIdentityData}>Retry</button>
    </div>
  {:else}
    <div class="tabs">
      <button 
        class="tab-button" 
        class:active={activeId === 'principal'}
        on:click={() => activeId = 'principal'}
      >
        Principal ID
      </button>
      <button 
        class="tab-button" 
        class:active={activeId === 'account'}
        on:click={() => activeId = 'account'}
      >
        Account ID
      </button>
    </div>

    <div class="identity-content">
      
      <div class="id-display">
        <div class="id-section">
          <div 
            class="id-text-container"
            on:click={() => handleCopy(currentId, activeId)}
          >
            <span class="id-text">{currentId}</span>
            <div class="id-overlay">
              <span>Click to copy</span>
            </div>
          </div>
        </div>
        
        {#if currentQR}
          <div 
            class="qr-container" 
            on:click={() => {
              const win = window.open();
              if (win) {
                win.document.write(`
                  <style>
                    body { 
                      margin: 0; 
                      display: flex; 
                      justify-content: center; 
                      align-items: center; 
                      background: #000; 
                      min-height: 100vh; 
                    }
                    img { max-width: 100%; padding: 1rem; }
                  </style>
                  <img src="${currentQR}" alt="${activeId} QR Code">
                `);
              }
            }}
          >
            <img src={currentQR} alt={`${activeId} QR Code`} class="qr-image" />
            <div class="qr-overlay">
              <span>Click to enlarge</span>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .identity-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .loading-state, .error-state {
    text-align: center;
    padding: 2rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.25rem;
    background: rgba(255, 255, 255, 0.1);
    padding: 0.25rem;
    border-radius: 0.5rem;
  }

  .tab-button {
    padding: 0.75rem;
    border: none;
    border-radius: 0.25rem;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-button.active {
    background: rgba(0, 0, 0, 0.48);
    color: white;
  }

  .identity-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .description {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
    font-style: italic;
    margin: 0;
  }

  .id-display {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .id-section {
    display: block;
  }

  .id-text-container {
    position: relative;
    cursor: pointer;
    width: 100%;
  }

  .id-text {
    font-family: monospace;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(0, 0, 0, 0.2);
    padding: 0.5rem;
    border-radius: 0.375rem;
    word-break: break-all;
    display: block;
  }

  .id-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    opacity: 0;
    transition: opacity 0.2s;
    border-radius: 0.375rem;
  }

  .id-text-container:hover .id-overlay {
    opacity: 1;
  }

  .id-overlay span {
    color: white;
    font-size: 0.875rem;
  }

  .qr-container {
    position: relative;
    max-width: 300px;
    margin: 0 auto;
    background: transparent;
    padding: 0;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .qr-container:hover {
    transform: scale(1.02);
  }

  .qr-image {
    width: 100%;
    height: auto;
    display: block;
  }

  .qr-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    opacity: 0;
    transition: opacity 0.2s;
    border-radius: 0.5rem;
  }

  .qr-container:hover .qr-overlay {
    opacity: 1;
  }

  .qr-overlay span {
    color: white;
    font-size: 0.875rem;
  }

  .retry-button {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.25rem;
    color: white;
    cursor: pointer;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
