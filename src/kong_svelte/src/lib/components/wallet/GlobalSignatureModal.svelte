<script lang="ts">
  import SignatureModal from "./SignatureModal.svelte";
  import { signatureModalStore } from "$lib/stores/signatureModalStore";

  // Derive store state
  const isOpen = $derived($signatureModalStore.isOpen);
  const message = $derived($signatureModalStore.message);
  const error = $derived($signatureModalStore.error);
  const onSignatureComplete = $derived($signatureModalStore.onSignatureComplete);

  // Handle close
  function handleClose() {
    signatureModalStore.hide();
  }

  // Handle signature complete
  function handleSignatureComplete() {
    if (onSignatureComplete) {
      onSignatureComplete();
    }
    signatureModalStore.hide();
  }
</script>

<SignatureModal
  {isOpen}
  {message}
  {error}
  onClose={handleClose}
  onSignatureComplete={handleSignatureComplete}
/> 