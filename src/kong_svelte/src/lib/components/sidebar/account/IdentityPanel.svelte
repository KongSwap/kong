<script lang="ts">
  import { onMount } from "svelte";
  import QRCode from 'qrcode';
  import { WalletService } from "$lib/services/wallet/WalletService";
  import { userStore } from "$lib/services/wallet/walletStore";

  let showCopied = false;
  let showAccountCopied = false;
  let principalId = "";
  let accountId = "";
  let principalQR = '';
  let accountQR = '';
  let activeSubTab = 'principal';

  const subTabs = [
    { id: 'principal', label: 'Principal ID' },
    { id: 'account', label: 'Account ID' }
  ];

  onMount(async () => {
    try {
      principalId = $userStore?.principal_id || '';
      accountId = $userStore?.account_id || '';
      
      if (principalId) {
        principalQR = await generateQR(principalId);
      }
      if (accountId) {
        accountQR = await generateQR(accountId);
      }
    } catch (error) {
      console.error('Error loading identity details:', error);
    }
  });

  async function generateQR(text: string) {
    try {
      return await QRCode.toDataURL(text, {
        width: 200,
        margin: 1,
        color: {
          dark: '#ffffff',
          light: '#00000000'
        }
      });
    } catch (error) {
      console.error('QR generation failed:', error);
      return '';
    }
  }

  const handleCopy = async (text: string, setter: (value: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };
</script>

<div class="tab-panel">
  <!-- Sub-tabs Navigation -->
  <div class="sub-tabs">
    {#each subTabs as tab}
      <button
        class="sub-tab-button"
        class:active={activeSubTab === tab.id}
        on:click={() => activeSubTab = tab.id}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Principal ID Section -->
  {#if activeSubTab === 'principal'}
    <div class="detail-section">
      <div class="info-tooltip">
        Used for authentication and canister control
      </div>
      <div class="id-container">
        <div class="id-content">
          <div class="id-details">
            <span class="address">{principalId}</span>
            <button
              class="copy-button group relative"
              class:copied={showCopied}
              on:click={() => handleCopy(principalId, (value) => showCopied = value)}
              aria-label={showCopied ? "Principal ID copied" : "Copy Principal ID"}
            >
              <span class="tooltip">
                {showCopied ? "Copied!" : "Copy"}
              </span>
              {#if showCopied}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              {/if}
            </button>
          </div>
          {#if principalQR}
            <div class="qr-container">
              <img src={principalQR} alt="Principal ID QR Code" />
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Account ID Section -->
  {#if activeSubTab === 'account'}
    <div class="detail-section">
      <div class="info-tooltip">
        Used for ICP token transactions and ledger operations
      </div>
      <div class="id-container">
        <div class="id-content">
          <div class="id-details">
            <span class="address">{accountId}</span>
            <button
              class="copy-button group relative"
              class:copied={showAccountCopied}
              on:click={() => handleCopy(accountId, (value) => showAccountCopied = value)}
              aria-label={showAccountCopied ? "Account ID copied" : "Copy Account ID"}
            >
              <span class="tooltip">
                {showAccountCopied ? "Copied!" : "Copy"}
              </span>
              {#if showAccountCopied}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              {/if}
            </button>
          </div>
          {#if accountQR}
            <div class="qr-container">
              <img src={accountQR} alt="Account ID QR Code" />
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .tab-panel {
    /* animation: fadeIn 0.3s ease; - removed */
  }

  .sub-tabs {
    display: flex;
    gap: 1px;
    background: rgba(255, 255, 255, 0.1);
    padding: 2px;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .sub-tab-button {
    flex: 1;
    padding: 0.5rem;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 4px;
  }

  .sub-tab-button.active {
    background: rgba(255, 255, 255, 0.15);
    color: white;
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

  .info-tooltip {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
    font-style: italic;
  }

  .id-container {
    background: rgba(0, 0, 0, 0.2);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    width: 100%;
  }

  .id-content {
    display: grid;
    gap: 1rem;
    width: 100%;
  }

  .id-details {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.75rem;
    align-items: center;
    width: 100%;
  }

  .address {
    font-family: monospace;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    overflow-wrap: break-word;
    word-break: break-all;
    min-width: 0;
    max-width: 100%;
  }

  .copy-button {
    padding: 0.5rem;
    height: 100%;
    min-width: 40px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    position: relative;
  }

  .copy-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .copy-button.copied {
    background: rgba(76, 175, 80, 0.3);
    border-color: rgba(76, 175, 80, 0.5);
  }

  .tooltip {
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a1a;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .copy-button:hover .tooltip {
    opacity: 1;
  }

  .qr-container {
    width: 100%;
    max-width: 200px;
    aspect-ratio: 1;
    margin: 0 auto;
    background: rgba(0, 0, 0, 0.3);
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .qr-container img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style> 
