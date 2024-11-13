<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { walletStore, selectedWalletId, userStore, availableWallets, disconnectWallet } from "$lib/services/wallet/walletStore";
  import { WalletService } from "$lib/services/wallet/WalletService";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onMount } from "svelte";
  import QRCode from 'qrcode';

  export let show = false;
  export let onClose: () => void;

  let showCopied = false;
  let principalId = "";
  let networkType = process.env.DFX_NETWORK === 'local' ? 'Local' : 'Mainnet';
  let networkHost = process.env.DFX_NETWORK === 'local' ? 'http://localhost:4943' : 'https://ic0.app';
  let accountId = "";
  let showAccountCopied = false;
  let connectionTime = '';
  let lastActivity = '';
  let connectionType = '';
  let principalQR = '';
  let accountQR = '';
  let showPrincipalQR = false;
  let showAccountQR = false;
  let showUserDetails = false;
  
  onMount(async () => {
    principalId = await WalletService.principalId();
    accountId = $userStore?.account_id || '';
    if ($walletStore.isConnected) {
      connectionTime = new Date().toLocaleString();
    }
  });

  $: accountId = $userStore?.account_id || accountId;

  const handleCopy = async () => {
    if (!showCopied && principalId) {
      await navigator.clipboard.writeText(principalId);
      showCopied = true;
      setTimeout(() => {
        showCopied = false;
      }, 1500);
    }
  };

  const handleAccountCopy = async () => {
    if (!showAccountCopied && accountId) {
      await navigator.clipboard.writeText(accountId);
      showAccountCopied = true;
      setTimeout(() => {
        showAccountCopied = false;
      }, 1500);
    }
  };

  $: walletProvider = availableWallets.find(w => w.id === $selectedWalletId)?.name || 'Unknown';
  $: connectionStatus = $walletStore.isConnected ? 'Connected' : 'Disconnected';
  $: userDetails = $userStore ? JSON.stringify($userStore, null, 2) : 'No user data';

  $: {
    if ($walletStore.isConnected) {
      lastActivity = new Date().toLocaleString();
    }
    
    if (principalId) {
      QRCode.toDataURL(principalId, {
        width: 128,
        margin: 0,
        color: {
          dark: '#ffffff',
          light: '#00000000'
        }
      }).then(url => principalQR = url);
    }
    
    if (accountId) {
      QRCode.toDataURL(accountId, {
        width: 128,
        margin: 0,
        color: {
          dark: '#ffffff',
          light: '#00000000'
        }
      }).then(url => accountQR = url);
    }
  }

  const handleLogout = async () => {
    await disconnectWallet();
    onClose();
  };
</script>

<Modal {show} title="Account Details" {onClose} variant="green">
  <div class="account-details" in:fly={{ y: 20, duration: 300, easing: cubicOut }}>
    <div class="detail-section">
      <h3>Principal ID</h3>
      <div class="info-tooltip">
        Used for authentication and canister control
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="address">{principalId}</span>
          <div class="button-group">
            <button
              class="qr-button"
              on:click={() => showPrincipalQR = !showPrincipalQR}
              aria-label="Toggle Principal ID QR Code"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              class="copy-button group relative"
              class:copied={showCopied}
              on:click={handleCopy}
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
        </div>
        {#if showPrincipalQR && principalQR}
          <div class="qr-popup" transition:fly={{ y: 20 }}>
            <img src={principalQR} alt="Principal ID QR Code" />
          </div>
        {/if}
      </div>
    </div>

    <div class="detail-section">
      <h3>Account ID</h3>
      <div class="info-tooltip">
        Used for ICP token transactions and ledger operations
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="address">{accountId}</span>
          <div class="button-group">
            <button
              class="qr-button"
              on:click={() => showAccountQR = !showAccountQR}
              aria-label="Toggle Account ID QR Code"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              class="copy-button group relative"
              class:copied={showAccountCopied}
              on:click={handleAccountCopy}
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
        </div>
        {#if showAccountQR && accountQR}
          <div class="qr-popup" transition:fly={{ y: 20 }}>
            <img src={accountQR} alt="Account ID QR Code" />
          </div>
        {/if}
      </div>
    </div>

    <div class="detail-section">
      <h3>Wallet Information</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Provider:</span>
          <span class="value">{walletProvider}</span>
        </div>
        <div class="info-item">
          <span class="label">Network:</span>
          <span class="value">{networkType}</span>
        </div>
        <div class="info-item">
          <span class="label">Host:</span>
          <span class="value">{networkHost}</span>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h3>Connection Status</h3>
      <div class="status-container">
        <div class="status-item">
          <span class="status-label">Status:</span>
          <p class="status">
            <span class="status-dot" class:connected={$walletStore.isConnected}></span>
            {connectionStatus}
          </p>
        </div>

        {#if $walletStore.error}
          <p class="error-message">Error: {$walletStore.error.message}</p>
        {/if}
      </div>
    </div>

    {#if $userStore}
      <div class="detail-section user-details-section">
        <button 
          class="collapsible-header"
          on:click={() => showUserDetails = !showUserDetails}
        >
          <h3>User Details</h3>
          <svg
            class="arrow"
            class:open={showUserDetails}
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {#if showUserDetails}
          <div class="user-details-container" transition:fly={{ y: 20 }}>
            <div class="user-details-wrapper">
              <pre class="user-details">{userDetails}</pre>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <button 
      class="logout-button"
      on:click={handleLogout}
      aria-label="Logout"
    >
      <span>Logout</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  </div>
</Modal>

<style>
  .account-details {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem;
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

  .info-grid {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .address {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 1rem;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.9);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 68, 68, 0.7);
  }

  .status-dot.connected {
    background: rgba(76, 175, 80, 0.7);
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

  .copy-button {
    padding: 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    transition: all 0.2s ease;
    position: relative;
  }

  .copy-button.copied {
    background: rgba(76, 175, 80, 0.3);
    border-color: rgba(76, 175, 80, 0.5);
  }

  .info-grid {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }

  .value {
    color: rgba(255, 255, 255, 0.9);
    font-family: monospace;
    font-size: 0.875rem;
  }

  .status-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .error-message {
    color: #ff4444;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  .user-details-section {
    width: 100%;
    max-width: 100%;
  }

  .user-details-container {
    width: 100%;
    max-width: 100%;
    margin-top: 0.5rem;
  }

  .user-details-wrapper {
    margin-top: 0.5rem;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    &::-webkit-scrollbar {
      height: 8px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
    }
  }

  .user-details {
    padding: 0.75rem;
    margin: 0;
    background: none;
    border: none;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: monospace;
    font-size: 0.75rem;
    line-height: 1.4;
    width: 100%;
  }

  .info-tooltip {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
    font-style: italic;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .status-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
  }

  .button-group {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .qr-button {
    padding: 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    transition: all 0.2s ease;
  }

  .qr-button:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .qr-popup {
    position: relative;
    right: auto;
    top: auto;
    transform: none;
    margin-top: 12px;
    width: 100%;
    display: flex;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    padding: 12px;
  }

  .qr-popup img {
    display: block;
    width: 128px;
    height: 128px;
  }

  .logout-button {
    width: 100%;
    height: 45px;
    margin-top: 1rem;
    background: rgba(186, 49, 49, 0.4);
    border: 1px solid rgba(255, 68, 68, 0.3);
    border-radius: 6px;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .logout-button:hover {
    background: rgba(255, 68, 68, 0.5);
    transform: translateY(-1px);
  }

  .collapsible-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    cursor: pointer;
  }

  .arrow {
    transition: transform 0.2s ease;
  }

  .arrow.open {
    transform: rotate(180deg);
  }
</style>
