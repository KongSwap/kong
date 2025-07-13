<script lang="ts">
  import { modalManager, type QRModalProps } from '$lib/stores/modalManager';
  import Modal from '../Modal.svelte';
  import { Copy, Check, QrCode } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let {
    id,
    qrData,
    address = '',
    ...modalProps
  }: QRModalProps & { id: string } = $props();

  let isOpen = $state(true);
  let qrCodeElement: HTMLDivElement;
  let copied = $state(false);

  // Dynamically import QR code library
  let QRCodeLib: any = null;

  onMount(async () => {
    try {
      // You might want to use a specific QR code library like 'qrcode' or 'qr-code-generator'
      // For now, this is a placeholder that would need the actual library
      const qrModule = await import('qrcode');
      QRCodeLib = qrModule.default;
      generateQRCode();
    } catch (error) {
      console.error('Failed to load QR code library:', error);
    }
  });

  async function generateQRCode() {
    if (QRCodeLib && qrCodeElement && qrData) {
      try {
        await QRCodeLib.toCanvas(qrCodeElement, qrData, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      } catch (error) {
        console.error('QR Code generation failed:', error);
      }
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      fallbackCopyTextToClipboard(text);
    }
  }

  function fallbackCopyTextToClipboard(text: string) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (error) {
      console.error('Fallback copy failed:', error);
    }
    
    document.body.removeChild(textArea);
  }

  function handleClose() {
    modalManager.close(id);
  }

  function truncateAddress(addr: string, start = 6, end = 4): string {
    if (!addr || addr.length <= start + end) return addr;
    return `${addr.slice(0, start)}...${addr.slice(-end)}`;
  }
</script>

<Modal
  bind:isOpen
  onClose={handleClose}
  width="400px"
  className="qr-modal"
  {...modalProps}
>
  <div class="flex flex-col gap-6 p-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <div class="flex-shrink-0 p-3 rounded-full bg-kong-accent-primary/10">
        <QrCode size={24} class="text-kong-accent-primary" />
      </div>
      <div class="flex-1">
        <h3 class="text-lg font-semibold text-kong-text-primary">
          QR Code
        </h3>
        <p class="text-sm text-kong-text-tertiary">
          Scan to view or copy address
        </p>
      </div>
    </div>

    <!-- QR Code Display -->
    <div class="flex flex-col items-center gap-4">
      <div class="p-4 bg-white rounded-lg border-2 border-kong-border-primary">
        {#if QRCodeLib}
          <canvas bind:this={qrCodeElement} class="max-w-full h-auto"></canvas>
        {:else}
          <div class="w-64 h-64 flex items-center justify-center bg-gray-100 rounded-lg">
            <div class="text-center">
              <QrCode size={48} class="text-gray-400 mx-auto mb-2" />
              <div class="text-sm text-gray-500">Loading QR code...</div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Address Display and Copy -->
      {#if address}
        <div class="w-full">
          <div class="flex items-center justify-between p-3 bg-kong-bg-secondary rounded-lg border border-kong-border-primary">
            <div class="flex-1 min-w-0">
              <div class="text-xs text-kong-text-tertiary mb-1">Address</div>
              <div class="font-mono text-sm text-kong-text-primary break-all">
                {address}
              </div>
            </div>
            
            <button
              type="button"
              onclick={() => copyToClipboard(address)}
              class="ml-3 p-2 rounded-lg hover:bg-kong-bg-tertiary transition-colors duration-200 text-kong-text-secondary hover:text-kong-text-primary flex items-center gap-2"
              title="Copy address"
            >
              {#if copied}
                <Check size={16} class="text-green-500" />
              {:else}
                <Copy size={16} />
              {/if}
            </button>
          </div>
          
          {#if copied}
            <div class="text-xs text-green-600 mt-2 text-center">
              Address copied to clipboard!
            </div>
          {/if}
        </div>
      {:else if qrData !== address}
        <!-- Show QR data if different from address -->
        <div class="w-full">
          <div class="flex items-center justify-between p-3 bg-kong-bg-secondary rounded-lg border border-kong-border-primary">
            <div class="flex-1 min-w-0">
              <div class="text-xs text-kong-text-tertiary mb-1">Data</div>
              <div class="font-mono text-sm text-kong-text-primary break-all">
                {qrData.length > 50 ? truncateAddress(qrData, 20, 10) : qrData}
              </div>
            </div>
            
            <button
              type="button"
              onclick={() => copyToClipboard(qrData)}
              class="ml-3 p-2 rounded-lg hover:bg-kong-bg-tertiary transition-colors duration-200 text-kong-text-secondary hover:text-kong-text-primary"
              title="Copy data"
            >
              {#if copied}
                <Check size={16} class="text-green-500" />
              {:else}
                <Copy size={16} />
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Close Button -->
    <div class="flex justify-end">
      <button
        type="button"
        onclick={handleClose}
        class="px-4 py-2 rounded-lg font-medium transition-colors duration-200 bg-kong-accent-primary hover:bg-kong-accent-secondary text-white"
      >
        Close
      </button>
    </div>
  </div>
</Modal>

<style>
  :global(.qr-modal .modal-content) {
    border-radius: 12px;
  }
</style>