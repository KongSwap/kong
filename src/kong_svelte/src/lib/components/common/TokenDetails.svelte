<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import SendTokens from "$lib/components/sidebar/SendTokens.svelte";
  import TransferConfirmationModal from "$lib/components/sidebar/TransferConfirmationModal.svelte";
  import { createEventDispatcher } from "svelte";

  export let token: FE.Token;

  const dispatch = createEventDispatcher();
  type TokenWithAmount = FE.Token & { amount?: string };
  let activeTab: "send" | "receive" = "send";
  let showConfirmation = false;
  let transferDetails: {
    amount: string;
    token: FE.Token;
    tokenFee: bigint;
    isValidating: boolean;
  } | null = null;

  function handleClose() {
    dispatch("close");
  }

  function handleTransferConfirm(event: CustomEvent) {
    transferDetails = event.detail;
    showConfirmation = true;
  }

  function handleConfirmationClose() {
    showConfirmation = false;
    transferDetails = null;
  }

  function handleConfirmationConfirm() {
    if (transferDetails) {
      const event = new CustomEvent('confirmTransfer');
      document.dispatchEvent(event);
    }
    showConfirmation = false;
  }
</script>

<Modal
  isOpen={true}
  onClose={handleClose}
  title="Send {token.name}"
  width="500px"
  variant="transparent"
  height="auto"
>
  <div class="tab-content">
    <SendTokens {token} on:close={handleClose} on:confirmTransfer={handleTransferConfirm} />
  </div>
</Modal>

{#if showConfirmation && transferDetails}
  <TransferConfirmationModal
    isOpen={showConfirmation}
    onClose={handleConfirmationClose}
    onConfirm={handleConfirmationConfirm}
    amount={transferDetails.amount}
    token={transferDetails.token}
    tokenFee={transferDetails.tokenFee}
    isValidating={transferDetails.isValidating}
  />
{/if}
