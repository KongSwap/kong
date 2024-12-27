<script lang="ts">
    import Modal from '$lib/components/common/Modal.svelte';
    import SendTokens from '$lib/components/sidebar/SendTokens.svelte';
    import { createEventDispatcher } from 'svelte';

    export let token: FE.Token;
    
    const dispatch = createEventDispatcher();

    function handleClose() {
        dispatch('close');
    }
</script>

<Modal
    isOpen={true}
    onClose={handleClose}
    title="Send {token.name}"
    width="min(700px, 95vw)"
    height="min(420px, 95vh)"
>
        <div class="tab-content">
            <SendTokens token={token} />
        </div>
</Modal>
