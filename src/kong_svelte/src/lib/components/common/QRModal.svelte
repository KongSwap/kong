<script lang="ts">
  import Modal from './Modal.svelte';
  import { qrModalStore } from '$lib/stores/qrModalStore';
</script>

<Modal
  isOpen={$qrModalStore.isOpen}
  onClose={() => qrModalStore.hide()}
  title={$qrModalStore.title}
  width="min(90vw, 500px)"
  height="auto"
  variant="transparent"
>
  <div class="qr-modal-content">
    <div class="qr-display">
      <div class="qr-backdrop">
        <img src={$qrModalStore.qrData} alt={$qrModalStore.title} class="qr-blur" />
      </div>
      <img src={$qrModalStore.qrData} alt={$qrModalStore.title} class="qr-main" />
    </div>
    <div class="qr-description">
      <p>Scan this QR code to quickly share your {$qrModalStore.title.toLowerCase()} with others.</p>
      <p class="text-sm opacity-75">Make sure the person scanning is someone you trust.</p>
    </div>
  </div>
</Modal>

<style>
  /* Copy the QR modal styles from IdentityPanel.svelte */
</style> 