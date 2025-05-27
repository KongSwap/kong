<script lang="ts">
  import { Copy, ExternalLink, Check, HelpCircle, Eye, EyeOff, QrCode } from 'lucide-svelte';
  import Badge from "$lib/components/common/Badge.svelte";
  import { tooltip } from "$lib/actions/tooltip";
  import { toastStore } from '$lib/stores/toastStore';

  // Define props
  export let address: {
    id: string;
    name: string;
    address: string;
    chain: string;
    isActive?: boolean;
    type?: string;
  };

  export let showFullAddress = false;
  export let copiedAddressId: string | null = null;
  
  // Events this component can dispatch
  export let onCopy: (address: string, id: string) => void = () => {};
  export let onToggleDisplay: (id: string) => void = () => {};
  export let onViewExplorer: () => void = () => {}; // Placeholder for future implementation
  export let onShowQR: (detail: { address: string; name: string; chain: string }) => void = () => {};

  // Truncate address for display
  function truncateAddress(addr: string): string {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  }
</script>

<div
  class="px-4 py-3.5 bg-kong-bg-primary border-t border-kong-border/50 group hover:bg-kong-bg-secondary group transition-all duration-200 relative cursor-pointer"
  on:click={() => onCopy(address.address, address.id)} 
  role="button"
  tabindex="0"
  aria-label="Copy address"
  on:keypress={(e) => e.key === 'Enter' && onCopy(address.address, address.id)}
>
  {#if address.isActive}
    <!-- Active indicator (handled by border now, but could be a separate element if needed) -->
  {/if}

  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-2">
      <div class="font-medium text-kong-text-primary text-sm">{address.name}</div>
      {#if address.type === 'subaccount'}
        <div class="cursor-help" use:tooltip={{ text: "This account ID is specifically used for receiving ICP from exchanges.", direction: "top" }}>
          <HelpCircle size={14} class="text-kong-text-secondary hover:text-kong-primary transition-colors" />
        </div>
      {/if}
      {#if address.isActive}
        <Badge variant="green" size="xs" class="text-[10px] uppercase tracking-wide font-semibold">
          Active
        </Badge>
      {/if}
    </div>
    
    <div class="flex items-center gap-1">
      <button 
        class="p-1.5 rounded-full text-kong-text-secondary hover:text-kong-primary transition-colors hover:bg-kong-bg-secondary/20 z-10"
        title={showFullAddress ? "Show shortened address" : "Show full address"}
        on:click|stopPropagation={() => onToggleDisplay(address.id)}
      >
        {#if showFullAddress}
          <EyeOff size={14} />
        {:else}
          <Eye size={14} />
        {/if}
      </button>
    </div>
  </div>

  <div class="flex items-center justify-between gap-2">
    <div class="text-kong-text-secondary font-mono max-w-[70%] overflow-hidden text-ellipsis bg-kong-bg-secondary group-hover:bg-kong-bg-primary group transition-all duration-200 rounded-md px-2.5 py-1.5 text-xs">
      {#if showFullAddress}
        <div class="break-all transition-all duration-200">{address.address}</div>
      {:else}
        <div class="transition-all duration-200">{truncateAddress(address.address)}</div>
      {/if}
    </div>
    <div class="flex items-center gap-1">
      <button 
        class="p-1.5 rounded-full text-kong-text-secondary hover:text-kong-primary transition-colors hover:bg-kong-bg-secondary/20 z-10"
        title={copiedAddressId === address.id ? "Copied!" : "Copy Address"}
        on:click|stopPropagation={() => onCopy(address.address, address.id)}
      >
        {#if copiedAddressId === address.id}
          <Check size={14} class="text-kong-success" />
        {:else}
          <Copy size={14} />
        {/if}
      </button>
      <button 
        class="p-1.5 rounded-full text-kong-text-secondary hover:text-kong-primary transition-colors hover:bg-kong-bg-secondary/20 z-10"
        title="Show QR Code"
        on:click|stopPropagation={() => onShowQR({ address: address.address, name: address.name, chain: address.chain })}
      >
        <QrCode size={14} />
      </button>
      <button 
        class="p-1.5 rounded-full text-kong-text-secondary hover:text-kong-primary transition-colors hover:bg-kong-bg-secondary/20 z-10"
        title="View on Explorer"
        on:click|stopPropagation={onViewExplorer}
      >
        <ExternalLink size={14} />
      </button>
    </div>
  </div>

  {#if copiedAddressId === address.id}
    <div class="mt-2 text-xs text-kong-success animate-fade-in flex items-center gap-1.5">
      <Check size={12} />
      <span>Address copied</span>
    </div>
  {/if}
</div> 