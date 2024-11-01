<script lang="ts">
    import { fly, fade } from 'svelte/transition';
    import { toastStore, type Toast } from '$lib/stores/toastStore';

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
</script>

<div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
    {#each $toastStore as toast (toast.id)}
        <div
            class="toast-container"
            in:fly={{ x: 200, duration: 300 }}
            out:fade={{ duration: 200 }}
        >
            <div class="toast {colors[toast.type]}">
                <div class="icon">{icons[toast.type]}</div>
                <div class="content">
                    {#if toast.title}
                        <div class="title">{toast.title}</div>
                    {/if}
                    <div class="message">{toast.message}</div>
                </div>
                <button
                    class="close-button"
                    on:click={() => toastStore.remove(toast.id)}
                >
                    ✕
                </button>
            </div>
        </div>
    {/each}
</div>

<style>
    .toast-container {
        @apply pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5;
    }

    .toast {
        @apply p-4 flex items-start;
    }

    .icon {
        @apply flex-shrink-0 w-6 h-6 text-white flex items-center justify-center rounded-full mr-3;
    }

    .content {
        @apply flex-1 pt-0.5;
    }

    .title {
        @apply text-sm font-medium text-gray-900;
    }

    .message {
        @apply mt-1 text-sm text-gray-500;
    }

    .close-button {
        @apply ml-4 flex-shrink-0 rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500;
    }
</style>
