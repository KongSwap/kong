<script lang="ts">
  import { AlertCircle } from "lucide-svelte";
  import Dialog from "../common/Dialog.svelte";
    import ButtonV2 from "../common/ButtonV2.svelte";
    import { auth } from "$lib/stores/auth";

  // Props
  let {
    isOpen = false,
    onClose = () => {},
    onSignatureComplete = () => {},
    message = "",
    error = "",
  } = $props<{
    isOpen?: boolean;
    onClose?: () => void;
    onSignatureComplete?: () => void;
    message?: string;
    error?: string;
  }>();

  // State
  let isSigning = $state(false);
  let signatureError = $state(error);

  // Handle close
  function handleClose() {
    auth.disconnect();
    onClose();
  }

  // Handle signature complete
  function handleSignatureComplete() {
    isSigning = false;
    onSignatureComplete();
  }

  // Watch for error changes
  $effect(() => {
    signatureError = error;
  });
</script>

<Dialog
  open={isOpen}
  onClose={handleClose}
  title="Sign Message"
  showClose={false}
>
  <div class="flex flex-col gap-4">
    {#if signatureError}
      <div
        class="flex items-center gap-2 p-3 rounded-lg bg-kong-error/10 text-kong-error border border-kong-error/20 text-sm"
        role="alert"
      >
        <AlertCircle size={16} class="flex-shrink-0" />
        <span>{signatureError}</span>
      </div>
    {/if}

    <div class="bg-kong-bg-secondary/10 rounded-lg border gap-8 flex flex-col justify-center items-center border-kong-border/30 p-4">
      <img src={message.logo} class="w-20 h-20 rounded-full mr-2" />
      <h3 class="text-base font-medium text-kong-text-primary mb-2">
        Please check your wallet for the signature request.
      </h3>
      <p class="text-sm text-kong-text-secondary">
        <ButtonV2 variant="outline" theme="error" size="md" onclick={handleClose}>Disconnect</ButtonV2>
      </p>
    </div>
  </div>
</Dialog>

<style>
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style> 