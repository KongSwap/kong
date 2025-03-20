<script lang="ts">
  import { User, Copy, ExternalLink, Check, Plus } from 'lucide-svelte';
  import Badge from "$lib/components/common/Badge.svelte";
  import { onMount, afterUpdate } from 'svelte';
  import { auth } from "$lib/stores/auth";
    import { uint8ArrayToHexString } from '@dfinity/utils';
    import { toastStore } from '$lib/stores/toastStore';
  
  // Props for the component
  export let userAddresses: Array<{
    name: string;
    address: string;
    chain: string;
    isActive?: boolean;
  }> = [];
  
  export let isLoading: boolean = false;
  
  // Account data
  let principalId = '';
  let subaccount = '';
  let isConnected = false;
  
  // Copy feedback state
  let hasCopiedPrincipal = false;
  let hasCopiedSubaccount = false;
  let copiedAddressId: string | null = null;
  
  // Watch for auth changes
  let lastAuthState = null;
  
  afterUpdate(() => {
    // Check if auth.pnp has changed
    if (auth.pnp !== lastAuthState) {
      lastAuthState = auth.pnp;
      updateAccountData();
      console.log('Auth.pnp changed, updating account data');
    }
  });
  
  // Update principal ID from auth on mount and when auth changes
  onMount(() => {
    // Force initial check
    updateAccountData();
    
    const unsubscribe = auth.subscribe(state => {
      console.log('Auth state changed:', state);
      isConnected = state.isConnected;
      updateAccountData();
    });
    
    return unsubscribe;
  });
  
  // Update account data from auth
  function updateAccountData() {
    if (auth.pnp?.account?.owner) {
      const principal = auth.pnp.account.owner;
      principalId = typeof principal === 'string' ? principal : principal.toString();
      console.log('Principal ID updated:', principalId);
      
      // Get subaccount if available
      if (auth.pnp.account.subaccount) {
        const sub = auth.pnp.account.subaccount;
        subaccount = uint8ArrayToHexString(sub);
        console.log('Subaccount updated:', subaccount);
      } else {
        subaccount = '';
        console.log('No subaccount found');
      }
    } else {
      principalId = '';
      subaccount = '';
      console.log('No principal ID found in auth.pnp.account.owner');
      console.log('Auth state:', auth);
    }
  }
  
  // Copy address to clipboard
  function copyToClipboard(text: string, type: 'principal' | 'subaccount' | 'address' = 'address') {
    if (!text) return;
    
    navigator.clipboard.writeText(text);
    
    // Handle copy feedback based on type
    if (type === 'principal') {
      hasCopiedPrincipal = true;
      setTimeout(() => {
        hasCopiedPrincipal = false;
      }, 2000);
    } else if (type === 'subaccount') {
      hasCopiedSubaccount = true;
      setTimeout(() => {
        hasCopiedSubaccount = false;
      }, 2000);
    } else {
      // For other addresses
      copiedAddressId = text;
      setTimeout(() => {
        copiedAddressId = null;
      }, 2000);
    }
    toastStore.info("Address copied to clipboard");
  }
  
  // Truncate address for display
  function truncateAddress(address: string): string {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  // Handle add wallet button click
  function handleAddWalletClick() {
    // This functionality would be implemented later or dispatched to parent
    console.log("Add wallet clicked");
  }
  
  // Check if we have a wallet connection
  $: hasWalletConnection = isConnected || !!principalId || userAddresses.some(addr => !!addr.address);
  
  // Format subaccount for display if needed
  $: formattedSubaccount = subaccount
  
  // Debug output for troubleshooting
  $: console.log('WalletAddressesList state:', { 
    principalId, 
    subaccount,
    isConnected, 
    hasWalletConnection,
    userAddressesCount: userAddresses.length,
    authPnp: !!auth.pnp
  });
</script>

<div class="py-3">
  <div class="px-4 mb-3 text-xs font-medium text-kong-text-secondary uppercase tracking-wide">Connected Addresses</div>
  
  {#if isLoading}
    <div class="py-6 px-4">
      <div class="animate-pulse space-y-4">
        <div class="h-20 bg-kong-text-primary/5 rounded-md"></div>
        <div class="h-16 bg-kong-text-primary/5 rounded-md"></div>
      </div>
    </div>
  {:else if !hasWalletConnection}
    <div class="py-10 text-center">
      <div class="p-5 rounded-full bg-kong-text-primary/5 inline-block mb-3 mx-auto" style="box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.03);">
        <User size={24} class="text-kong-primary/40" />
      </div>
      <p class="text-base font-medium text-kong-text-primary">No Connected Wallets</p>
      <p class="text-sm text-kong-text-secondary/70 mt-1 max-w-[280px] mx-auto">
        Connect wallets to manage your assets across multiple chains.
      </p>
    </div>
  {:else}
    <!-- Principal ID Display -->
    {#if principalId}
      <div class="px-4 py-3 mb-3 rounded-md bg-kong-bg-light/10 mx-4 border border-kong-primary/20">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs text-kong-text-secondary">Principal ID</div>
          <Badge variant="blue" size="xs" class="text-[10px] uppercase tracking-wide font-semibold">
            Internet Computer
          </Badge>
        </div>
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-kong-text-primary font-mono break-all pr-2">
            {principalId}
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button 
              class="text-kong-text-secondary hover:text-kong-primary transition-colors p-1 bg-kong-text-primary/5 rounded-md hover:bg-kong-text-primary/10" 
              title={hasCopiedPrincipal ? "Copied!" : "Copy Principal ID"}
              on:click={() => copyToClipboard(principalId, 'principal')}
            >
              {#if hasCopiedPrincipal}
                <Check size={14} class="text-kong-accent-green" />
              {:else}
                <Copy size={14} />
              {/if}
            </button>
          </div>
        </div>
        
        <!-- Subaccount Display -->
        {#if subaccount}
          <div class="mt-3 pt-3 border-t border-kong-border/20">
            <div class="flex items-center justify-between mb-2">
              <div class="text-xs text-kong-text-secondary">Subaccount (For exchanges)</div>
            </div>
            <div class="flex items-center justify-between">
              <div class="text-sm font-medium text-kong-text-primary font-mono break-all pr-2">
                {formattedSubaccount}
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button 
                  class="text-kong-text-secondary hover:text-kong-primary transition-colors p-1 bg-kong-text-primary/5 rounded-md hover:bg-kong-text-primary/10" 
                  title={hasCopiedSubaccount ? "Copied!" : "Copy Subaccount"}
                  on:click={() => copyToClipboard(subaccount, 'subaccount')}
                >
                  {#if hasCopiedSubaccount}
                    <Check size={14} class="text-kong-accent-green" />
                  {:else}
                    <Copy size={14} />
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Additional Addresses -->
    {#if userAddresses.length > 0}
      <div class="space-y-0">
        {#each userAddresses.filter(wallet => wallet.address && wallet.address !== principalId) as wallet}
          <div class="px-4 py-3.5 bg-kong-bg-light/5 border-b border-kong-border/30 hover:bg-kong-bg-light/10 transition-colors cursor-pointer {wallet.isActive ? 'border-l-2 border-l-kong-primary' : ''}">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <div class="font-medium text-kong-text-primary text-sm">{wallet.name}</div>
                {#if wallet.isActive}
                  <Badge variant="green" size="xs" class="text-[10px] uppercase tracking-wide font-semibold">
                    Active
                  </Badge>
                {/if}
              </div>
              
              <Badge variant="blue" size="xs" class="text-[10px] uppercase tracking-wide font-semibold">
                {wallet.chain}
              </Badge>
            </div>
            
            <div class="flex items-center justify-between text-xs">
              <div class="text-kong-text-secondary font-mono">
                {truncateAddress(wallet.address)}
              </div>
              <div class="flex items-center gap-2">
                <button 
                  class="text-kong-text-secondary hover:text-kong-primary transition-colors p-1" 
                  title={copiedAddressId === wallet.address ? "Copied!" : "Copy Address"}
                  on:click={() => copyToClipboard(wallet.address)}
                >
                  {#if copiedAddressId === wallet.address}
                    <Check size={14} class="text-kong-accent-green" />
                  {:else}
                    <Copy size={14} />
                  {/if}
                </button>
                <button class="text-kong-text-secondary hover:text-kong-primary transition-colors p-1" title="View on Explorer">
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div> 