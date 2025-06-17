<script lang="ts">
  import Modal from './Modal.svelte';
  import { qrModalStore } from '$lib/stores/qrModalStore';
  import { Copy, Check } from 'lucide-svelte';
  import { toastStore } from '$lib/stores/toastStore';

  let copied = false;

  function copyAddress(address: string) {
    if (!address) return;
    navigator.clipboard.writeText(address);
    copied = true;
    toastStore.info("Address copied to clipboard");
    setTimeout(() => (copied = false), 2000);
  }

  $: if (!$qrModalStore.isOpen) {
    copied = false;
  }
</script>

{#if $qrModalStore.isOpen}
<Modal
  isOpen={$qrModalStore.isOpen}
  onClose={() => qrModalStore.hide()}
  title={$qrModalStore.title}
  width="min(90vw, 500px)"
  height="auto"
  variant="transparent"
>
  <div class="flex flex-col items-center md:py-4 px-2 gap-4 text-center">
    <div class="relative w-full mx-auto px-4">
      <div class="bg-white rounded-lg shadow-lg p-1">
        <img 
          src={$qrModalStore.qrData} 
          alt={$qrModalStore.title} 
          class="w-full h-auto"
          style="min-width: 280px; min-height: 280px;"
        />
      </div>
    </div>
    
    <div class="w-full p-3 px-4 bg-kong-bg-secondary rounded-lg border border-kong-border">
      <p class="text-xs text-kong-text-secondary mb-2 text-left">Address:</p>
      <div class="flex items-center justify-between gap-3">
        <span class="font-mono text-xs text-kong-text-primary break-all text-left flex-grow">{$qrModalStore.address}</span>
        <button 
          class="p-1 rounded-full bg-transparent border-none cursor-pointer text-kong-text-secondary transition-colors duration-200 flex items-center justify-center flex-shrink-0 hover:text-kong-primary hover:bg-kong-bg-secondary/20"
          title={copied ? "Copied!" : "Copy Address"}
          onclick={() => copyAddress($qrModalStore.address)}
        >
          {#if copied}
            <Check size={16} class="text-kong-success" />
          {:else}
            <Copy size={16} />
          {/if}
        </button>
      </div>
    </div>
    
    <div class="text-sm text-kong-text-secondary leading-relaxed">
      <p class="font-medium text-kong-text-primary mb-2">Scan this QR code to quickly share your <span class="font-bold text-kong-primary">{$qrModalStore.title.toUpperCase()}</span>.</p>
    </div>
  </div>
</Modal>
{/if} 