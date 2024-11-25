<script lang="ts">
    import { fly, fade } from 'svelte/transition';
    import { toastStore, type Toast } from '$lib/stores/toastStore';

    const styles = {
        success: 'bg-emerald-500/90 border-emerald-400',
        error: 'bg-rose-500/90 border-rose-400',
        warning: 'bg-amber-500/90 border-amber-400',
        info: 'bg-blue-500/90 border-blue-400'
    };

    function dismissToast(id: string) {
        toastStore.dismiss(id);
    }
</script>

<div class="fixed top-4 right-4 z-[10000] flex flex-col items-end gap-2 max-w-md">
    {#each $toastStore as toast (toast.id)}
        <div
            class="w-full"
            in:fly={{ x: 150, duration: 300 }}
            out:fade={{ duration: 200 }}
            on:click={() => dismissToast(toast.id)}
        >
            <div class="toast-container backdrop-blur-sm {styles[toast.type]}">
                <div class="content">
                    {#if toast.title}
                        <div class="title">{toast.title}</div>
                    {/if}
                    <div class="message">{toast.message}</div>
                </div>
            </div>
        </div>
    {/each}
</div>

<style lang="postcss">
    .toast-container {
        @apply cursor-pointer rounded-lg border shadow-lg text-white;
        @apply transition-all duration-200 hover:translate-y-[-2px] hover:shadow-xl;
        @apply flex items-start p-4;
    }

    .content {
        @apply flex-1;
    }

    .title {
        @apply font-medium text-sm mb-1;
    }

    .message {
        @apply text-sm opacity-90;
        line-height: 1.4;
    }

    /* Mobile responsiveness */
    @media (max-width: 640px) {
        .toast-container {
            @apply mx-2 p-3;
        }
    }
</style>
