<script lang="ts">
    import { fly, fade } from 'svelte/transition';
    import { toastStore, type Toast } from '$lib/stores/toastStore';

    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500', 
        warning: 'bg-amber-500',
        info: 'bg-blue-500'
    };

    const textColors = {
        success: 'text-white',
        error: 'text-white',
        warning: 'text-gray-900',
        info: 'text-white'
    };

    function dismissToast(id: string) {
        toastStore.dismiss(id);
    }
</script>

<div class="fixed top-20 right-4 z-[9999] flex flex-col items-end gap-3 max-w-lg">
    {#each $toastStore as toast (toast.id)}
        <div
            class="toast-container cursor-pointer"
            in:fly={{ x: 50, duration: 400 }}
            out:fade={{ duration: 300 }}
            on:click={() => dismissToast(toast.id)}
        >
            <div class="toast {colors[toast.type]}">
                <div class="content">
                    {#if toast.title}
                        <div class="title {textColors[toast.type]}">{toast.title}</div>
                    {/if}
                    <div class="message {textColors[toast.type]}">{toast.message}</div>
                </div>
            </div>
        </div>
    {/each}
</div>

<style>
    .toast-container {
        @apply pointer-events-auto overflow-hidden shadow-lg;
        border: 2px solid #000;
        border-radius: 0;
        box-shadow: 3px 3px 0 #000;
    }

    .toast {
        @apply flex items-start;
        padding: 12px;
    }

    .content {
        @apply flex-1;
        padding: 4px;
    }

    .title {
        @apply text-sm font-bold uppercase tracking-wider;
        margin-bottom: 4px;
    }

    .message {
        @apply text-sm;
        line-height: 1.4;
    }

    .close-button {
        @apply ml-4 flex-shrink-0 inline-flex;
        padding: 4px;
        border: 1px solid currentColor;
    }
</style>
