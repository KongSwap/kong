<script lang="ts">
  import { auth, availableWallets, selectedWalletId } from "$lib/services/auth";

  let networkType = process.env.DFX_NETWORK === 'local' ? 'Local' : 'Mainnet';
  let networkHost = process.env.DFX_NETWORK === 'local' ? 'http://localhost:4943' : 'https://ic0.app';
  
  $: walletProvider = availableWallets.find(w => w.id === $selectedWalletId)?.name || 'Unknown';
  let principal = '';
  
  $: if (auth.pnp?.account?.owner) {
    principal = typeof auth.pnp.account.owner === 'string' 
      ? auth.pnp.account.owner 
      : auth.pnp.account.owner?.toText?.() || '';
  }

  function copyPrincipalId() {
    navigator.clipboard.writeText(principal);
  }

  // Format principal to show all groups with proper spacing
  function formatPrincipal(principal: string): string {
    if (!principal) return '';
    return principal.replace(/(.{5})/g, '$1-').slice(0, -1);
  }

  // Format shorter version for display
  function formatShortPrincipal(principal: string): string {
    if (!principal) return '';
    const parts = principal.split('-');
    if (parts.length <= 2) return principal;
    return `${parts[0]}-${parts[1]}...${parts[parts.length - 1]}`;
  }
</script>

<div class="animate-[fadeIn_0.2s_ease-in]">
  <div class="pb-3">
    <h3 class="text-xs font-medium text-kong-text-secondary mb-2">Wallet Information</h3>
    <div class="grid gap-2 mt-2">
      <div class="flex justify-between p-2.5 bg-kong-bg-light/50 rounded-md border border-kong-border overflow-hidden">
        <span class="text-kong-text-secondary text-xs">Principal ID:</span>
        <div class="flex items-center gap-2">
          <span 
            class="text-kong-text-primary font-mono text-xs tracking-wider cursor-help"
            title={formatPrincipal(principal)}
          >
            {formatShortPrincipal(principal)}
          </span>
          <button 
            class="text-kong-text-secondary hover:text-kong-text-primary transition-colors"
            on:click={copyPrincipalId}
            title="Copy Full Principal ID"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>
      <div class="flex justify-between p-2.5 bg-kong-bg-light/50 rounded-md border border-kong-border overflow-hidden">
        <span class="text-kong-text-secondary text-xs">Connection:</span>
        <span class="text-kong-text-primary font-mono text-xs flex items-center">
          <span 
            class="w-2 h-2 rounded-full mr-1.5" 
            style="background-color: {$auth.isConnected ? 'green' : 'red'};"
          ></span>
          {$auth.isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div class="flex justify-between p-2.5 bg-kong-bg-light/50 rounded-md border border-kong-border overflow-hidden">
        <span class="text-kong-text-secondary text-xs">Provider:</span>
        <span class="text-kong-text-primary font-mono text-xs">{walletProvider}</span>
      </div>
      <div class="flex justify-between p-2.5 bg-kong-bg-light/50 rounded-md border border-kong-border overflow-hidden">
        <span class="text-kong-text-secondary text-xs">Network:</span>
        <span class="text-kong-text-primary font-mono text-xs">{networkType}</span>
      </div>
      <div class="flex justify-between p-2.5 bg-kong-bg-light/50 rounded-md border border-kong-border overflow-hidden">
        <span class="text-kong-text-secondary text-xs">Host:</span>
        <span class="text-kong-text-primary font-mono text-xs">{networkHost}</span>
      </div>
    </div>
  </div>
</div>

<nav class="inline-flex rounded-none overflow-hidden bg-kong-bg-light/50 border border-kong-border">
  <button
    class="tab-button first:rounded-l-md last:rounded-r-md px-3 py-1.5 text-xs font-medium text-kong-text-secondary hover:bg-gray-700 transition-colors"
    class:active-tab={activeTab === 'info'}
    on:click={() => (activeTab = 'info')}
  >
    Wallet Info
  </button>
  <button
    class="tab-button first:rounded-l-md last:rounded-r-md px-3 py-1.5 text-xs font-medium text-kong-text-secondary hover:bg-gray-700 transition-colors"
    class:active-tab={activeTab === 'network'}
    on:click={() => (activeTab = 'network')}
  >
    Network
  </button>
</nav>

<style>
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .tab-button {
    background-color: transparent;
    color: #a1a1aa;
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s, color 0.2s;
  }

  .tab-button:hover {
    background-color: #374151;
    color: #f3f4f6;
  }

  .tab-button.active-tab {
    @apply bg-kong-primary text-white;
  }
</style> 
