<script lang="ts">
  import { onMount } from "svelte";
  import QRCode from 'qrcode';
  import { userStore } from "$lib/services/wallet/walletStore";
    import { toastStore } from "$lib/stores/toastStore";

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
        width: 300,
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
      toastStore.success('Copied to clipboard');
      setter(true);
      setTimeout(() => setter(false), 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };
</script>

<div class="tab-panel">
  <!-- Sub-tabs Navigation -->
  <div class="flex gap-1 bg-white/10 rounded-md mb-4">
    {#each subTabs as tab}
      <button
        class="flex-1 p-3 bg-transparent border-none text-white/70 text-sm cursor-pointer transition-all duration-200 ease-in-out rounded-md"
        class:active={activeSubTab === tab.id}
        on:click={() => activeSubTab = tab.id}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Principal ID Section -->
  {#if activeSubTab === 'principal'}
    <div class="pb-4">
      <div class="text-white/70 text-xs mb-2 italic">
        Used for authentication and canister control
      </div>
      <div class="bg-black/20 p-4 rounded-lg border border-white/10 w-full">
        <div class="grid gap-4 w-full">
          <div class="grid grid-cols-[1fr_auto] gap-3 items-center w-full">
            <span class="font-mono text-sm text-white/90 p-2 bg-black/20 rounded-md break-words min-w-0 max-w-full">
              {principalId}
            </span>
            <button
              class="p-2 h-full min-w-[40px] bg-white/10 border border-white/20 rounded-md text-white flex items-center justify-center transition-all duration-200 ease-in-out relative"
              class:copied={showCopied}
              on:click={() => handleCopy(principalId, (value) => showCopied = value)}
              aria-label={showCopied ? "Principal ID copied" : "Copy Principal ID"}
            >
              <span class="absolute top-[-30px] left-1/2 transform -translate-x-1/2 bg-[#1a1a1a] p-1 rounded-md text-xs opacity-0 pointer-events-none transition-opacity duration-200 ease-in-out">
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
            <div class="w-full max-w-[300px] aspect-square mx-auto bg-black/30 p-3 rounded-md border border-white/10">
              <img src={principalQR} alt="Principal ID QR Code" class="w-full h-full object-contain" />
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Account ID Section -->
  {#if activeSubTab === 'account'}
    <div class="pb-4">
      <div class="text-white/70 text-xs mb-2 italic">
        Used for ICP token transactions and ledger operations
      </div>
      <div class="bg-black/20 p-4 rounded-lg border border-white/10 w-full">
        <div class="grid gap-4 w-full">
          <div class="grid grid-cols-[1fr_auto] gap-3 items-center w-full">
            <span class="font-mono text-sm text-white/90 p-2 bg-black/20 rounded-md break-words min-w-0 max-w-full">
              {accountId}
            </span>
            <button
              class="p-2 h-full min-w-[40px] bg-white/10 border border-white/20 rounded-md text-white flex items-center justify-center transition-all duration-200 ease-in-out relative"
              class:copied={showAccountCopied}
              on:click={() => handleCopy(accountId, (value) => showAccountCopied = value)}
              aria-label={showAccountCopied ? "Account ID copied" : "Copy Account ID"}
            >
              <span class="absolute top-[-30px] left-1/2 transform -translate-x-1/2 bg-[#1a1a1a] p-1 rounded-md text-xs opacity-0 pointer-events-none transition-opacity duration-200 ease-in-out">
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
            <div class="w-full max-w-[300px] aspect-square mx-auto bg-black/30 p-3 rounded-md border border-white/10">
              <img src={accountQR} alt="Account ID QR Code" class="w-full h-full object-contain" />
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div> 

<style scoped>
  .active {
    background-color: rgba(0, 0, 0, 0.48);
  }
</style>