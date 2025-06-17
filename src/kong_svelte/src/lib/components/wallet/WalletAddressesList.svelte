<script lang="ts">
  import { User, ChevronDown, ChevronUp } from 'lucide-svelte';
  import Badge from "$lib/components/common/Badge.svelte";
  import { onMount } from 'svelte';
  import { auth } from "$lib/stores/auth";
  import { toastStore } from '$lib/stores/toastStore';
  import AddressListItem from "./AddressListItem.svelte";
  import QRModal from "$lib/components/common/QRModal.svelte";
  import { qrModalStore } from "$lib/stores/qrModalStore";
  import qrcode from 'qrcode';
  import WalletListHeader from "./WalletListHeader.svelte";
  
  // Props for the component
  let { 
    userAddresses = [], 
    isLoading = false 
  } = $props<{ 
    userAddresses?: Array<{ name: string; address: string; chain: string; isActive?: boolean }>;
    isLoading?: boolean;
  }>();
  
  // Account data
  let principalId = $state('');
  let subaccount = $state('');
  
  // Copy feedback state
  let copiedAddressId: string | null = $state(null);
  
  // Wallet addresses from getAddresses()
  let walletAddresses: Record<string, any> = {};
  
  // Group addresses by chain
  let groupedAddresses: Record<string, Array<{ id: string; name: string; address: string; chain: string; isActive?: boolean; type?: string }>> = $state({});
  
  // UI state
  let expandedChains: Record<string, boolean> = $state({});
  let showFullAddress: Record<string, boolean> = $state({});
  
  // Chain name formatting map
  const CHAIN_FORMATS: Record<string, string> = {
    'sol': 'Solana',
    'solana': 'Solana',
    'icp': 'Internet Computer',
    'internet computer': 'Internet Computer',
  };
  
  // Chain badge variant map
  const CHAIN_VARIANTS: Record<string, "blue" | "green" | "red" | "orange" | "purple" | "gray"> = {
    'Internet Computer': 'purple',
    'Solana': 'blue',
  };
  
  // Update account data and addresses
  function updateAccountData() {
    principalId = auth.pnp.account.owner;
    subaccount = auth.pnp?.account?.subaccount || '';
    updateDisplayAddresses();
  }

  // Initialize component
  onMount(() => {
    updateAccountData();
    const unsubscribe = auth.subscribe(async state => {
      updateAccountData();
      if ($auth.isConnected && auth?.pnp?.adapter?.chain === 'SOL' && auth.pnp?.provider?.getAddresses) {
        walletAddresses = await auth.pnp.provider.getAddresses();
        updateDisplayAddresses();
      }
    });
    return unsubscribe;
  });
  
  // Update the display addresses array
  async function updateDisplayAddresses() {
    const displayAddresses = [];

    const addAddress = (id, name, address, chain, type, isActive) => {
      if (address) displayAddresses.push({ id, name, address, chain: formatChainName(chain), type, isActive });
    };

    addAddress('icp-principal', 'Principal', walletAddresses.icp?.owner || principalId, 'Internet Computer', 'principal', undefined);
    addAddress('icp-subaccount', 'Account ID', walletAddresses.icp?.subaccount || subaccount, 'Internet Computer', 'subaccount', undefined);

    Object.entries(walletAddresses)
      .filter(([chain, address]) => chain !== 'icp' && !!address)
      .forEach(([chain, address]) => addAddress(`${chain}-${address}`, auth.pnp?.provider?.walletName, address, chain, 'address', undefined));

    userAddresses
      .filter(wallet => wallet.address && wallet.address !== principalId)
      .forEach(wallet => addAddress(`user-${wallet.address}`, wallet.name, wallet.address, wallet.chain, 'address', wallet.isActive));

    groupedAddresses = displayAddresses.reduce((acc, addr) => {
      acc[addr.chain] = acc[addr.chain] || [];
      acc[addr.chain].push(addr);
      return acc;
    }, {});

    Object.keys(groupedAddresses).forEach(chain => {
      expandedChains[chain] = expandedChains[chain] ?? true;
    });
  }

  // Copy address to clipboard
  function copyToClipboard(text: string, addressId: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    copiedAddressId = addressId;
    setTimeout(() => copiedAddressId = null, 2000);
    toastStore.info("Address copied to clipboard");
  }

  // Format chain name for display
  function formatChainName(chain: string): string {
    return chain ? CHAIN_FORMATS[chain.toLowerCase()] || chain.toUpperCase() : '';
  }

  // Toggle chain expansion
  function toggleChainExpansion(chain: string) {
    expandedChains[chain] = !expandedChains[chain];
  }

  // Toggle full address display
  function toggleAddressDisplay(id: string) {
    showFullAddress[id] = !showFullAddress[id];
  }

  // Check if we have a wallet connection
  let hasWalletConnection = $derived(
    $auth.isConnected
  );

  // Map chain names to badge variants
  function getChainVariant(chain: string): "blue" | "green" | "red" | "orange" | "purple" | "gray" {
    return CHAIN_VARIANTS[chain] || 'gray';
  }

  // --- QR Code Functionality ---

  async function generateQRCodeDataURL(text: string): Promise<string> {
    try {
      return await qrcode.toDataURL(text, { 
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 10,
        width: 320
      });
    } catch (err) {
      console.error('Error generating QR code:', err);
      toastStore.error('Could not generate QR code');
      return '';
    }
  }

  async function handleShowQR(detail: { address: string; name: string; chain: string }) {
    const { address, name, chain } = detail;
    const qrData = await generateQRCodeDataURL(address);
    if (qrData) {
      qrModalStore.show(qrData, `${name} (${chain}) Address`, address);
    }
  }
  
  // --- End QR Code Functionality ---
</script>

  <WalletListHeader
    title={`Connected with ${auth.pnp?.provider?.walletName || 'Wallet'}`}
    isLoading={isLoading}
  >
    <svelte:fragment slot="actions">
      {#if hasWalletConnection}
        <span class="text-[10px] bg-kong-bg-secondary/30 px-2 rounded-full">
          {Object.values(groupedAddresses).flat().length} Addresses
        </span>
      {/if}
    </svelte:fragment>
  </WalletListHeader>
  
  {#if isLoading}
    <div class="py-6 px-4">
      <div class="animate-pulse space-y-4">
        <div class="h-20 bg-kong-text-primary/5 rounded-lg"></div>
        <div class="h-16 bg-kong-text-primary/5 rounded-lg"></div>
      </div>
    </div>
  {:else if !hasWalletConnection}
    <div class="py-12 text-center">
      <div class="p-6 rounded-full bg-kong-text-primary/5 inline-block mb-4 mx-auto" style="box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.03);">
        <User size={28} class="text-kong-primary/40" />
      </div>
      <p class="text-lg font-medium text-kong-text-primary mb-1">No Connected Wallets</p>
      <p class="text-sm text-kong-text-secondary/70 mt-1 max-w-[280px] mx-auto">
        Connect wallets to manage your assets across multiple chains.
      </p>
    </div>
  {:else}
    <div class="space-y-0">
      {#each Object.entries(groupedAddresses) as [chain, addresses]}
        <div class="overflow-hidden border border-kong-border/50">
          <div 
            class="px-4 py-2.5 flex items-center justify-between cursor-pointer bg-kong-bg-secondary hover:bg-kong-bg-secondary/50 transition-colors border-b border-kong-border/20"
            onclick={() => toggleChainExpansion(chain)}
            role="button"
            tabindex="0"
            aria-expanded={expandedChains[chain]}
            onkeypress={(e) => e.key === 'Enter' && toggleChainExpansion(chain)}
          >
            <div class="font-medium text-kong-text-primary flex items-center gap-2">
                {chain}
              <span class="ml-1">
                <Badge variant={getChainVariant(chain)} size="sm" class="uppercase tracking-wide font-semibold">
                  {addresses.length} {addresses.length === 1 ? 'Address' : 'Addresses'}
                </Badge>
              </span>
            </div>
            <div class="text-kong-text-secondary">
              {#if expandedChains[chain]}
                <ChevronUp size={18} />
              {:else}
                <ChevronDown size={18} />
              {/if}
            </div>
          </div>

          {#if expandedChains[chain]}
            <div class="animate-fade-in bg-kong-bg-primary border-t border-kong-border/50">
              {#each addresses as address (address.id)}
                <AddressListItem 
                  {address}
                  showFullAddress={showFullAddress[address.id] || false}
                  copiedAddressId={copiedAddressId}
                  onCopy={copyToClipboard}
                  onToggleDisplay={toggleAddressDisplay}
                  onViewExplorer={() => window.open(`https://example-explorer.com/${address.chain}/${address.address}`, '_blank')}
                  onShowQR={handleShowQR}
                />
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

<QRModal />

<style>
  /* Additional animations */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .animate-fade-in {
    animation: fadeIn 0.2s ease-out;
  }
</style> 