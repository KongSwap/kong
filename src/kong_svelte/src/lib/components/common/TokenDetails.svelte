<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import SendTokens from "$lib/components/sidebar/SendTokens.svelte";
  import { createEventDispatcher } from "svelte";

  export let token: FE.Token;

  const dispatch = createEventDispatcher();
  type TokenWithAmount = FE.Token & { amount?: string };
  let activeTab: "send" | "receive" = "send";

  function handleClose() {
    dispatch("close");
  }
</script>

<Modal
  isOpen={true}
  onClose={handleClose}
  title="Send {token.name}"
  width="500px"
  height="min(420px, 95vh)"
>
  <div class="tab-content">
    <SendTokens {token} />
  </div>
</Modal>
