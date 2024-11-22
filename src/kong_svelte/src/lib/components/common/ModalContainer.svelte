<script lang="ts">
    import { modalStore, type ModalConfig } from '$lib/stores/modalStore';
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';

    let modals: ModalConfig[] = [];
    
    modalStore.subscribe(value => {
        modals = value;
    });

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && modals.length > 0) {
            const lastModal = modals[modals.length - 1];
            if (lastModal.closeOnEscape) {
                modalStore.remove(lastModal.id);
            }
        }
    }

    onMount(() => {
        window.addEventListener('keydown', handleKeydown);
        return () => {
            window.removeEventListener('keydown', handleKeydown);
        };
    });

    function handleBackdropClick(modal: ModalConfig) {
        if (modal.closeOnClickOutside) {
            modalStore.remove(modal.id);
        }
    }
</script>

{#each modals as modal (modal.id)}
    <div
        class="modal-backdrop"
        on:click|self={() => handleBackdropClick(modal)}
        transition:fade={{ duration: 200 }}
    >
        <div class="modal-content" transition:fade={{ duration: 150 }}>
            <svelte:component this={modal.component} {...modal.props} />
        </div>
    </div>
{/each}

<style lang="postcss">
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .modal-content {
        background: var(--background-color, white);
        border-radius: 8px;
        padding: 1rem;
        max-width: 90vw;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
    }
</style>
