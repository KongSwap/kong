<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import KongInterface from "./KongInterface.svelte";
  
  export let isOpen = false;
  export let onClose: () => void;
  export let canisterId: string;
  export let wasmType: string | null = null;

  function handleClose() {
    onClose();
  }
</script>

<Modal
  {isOpen}
  title={wasmType === 'miner' ? 'Miner Canister' : wasmType === 'token_backend' ? 'Token Canister' : 'Canister Interface'}
  onClose={handleClose}
  width="700px"
  height="auto"
  variant="transparent"
>
  <KongInterface 
    {canisterId} 
    {wasmType} 
    on:close={handleClose}
  />
</Modal> 