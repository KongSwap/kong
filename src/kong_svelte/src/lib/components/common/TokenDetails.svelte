<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import SendTokens from "$lib/components/sidebar/SendTokens.svelte";
  import TransferConfirmationModal from "$lib/components/wallet/TransferConfirmationModal.svelte";
  import { createEventDispatcher } from "svelte";
  import { formatTokenName } from "$lib/utils/tokenFormatUtils";

  export let token: Kong.Token;

  const dispatch = createEventDispatcher();
  type TokenWithAmount = Kong.Token & { amount?: string };
  let activeTab: "send" | "receive" = "send";
  let showConfirmation = false;
  let transferDetails: {
    amount: string;
    token: Kong.Token;
    tokenFee: bigint;
    isValidating: boolean;
    toPrincipal: string;
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
  title="Send {formatTokenName(token.name, 30)}"
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
    toPrincipal={transferDetails.toPrincipal}
  />
{/if}
