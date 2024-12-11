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

<div class="toast-wrapper">
    {#each $toastStore as toast (toast.id)}
        <div
            class="w-full"
            in:fly={{ x: 150, duration: 300 }}
            out:fade={{ duration: 200 }}
            on:click={() => dismissToast(toast.id)}
        >
            <div class="toast-container {styles[toast.type]}">
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
    .toast-wrapper {
        @apply fixed top-4 right-4 z-[999999] flex flex-col items-end gap-2 max-w-md;
        isolation: isolate;
        transform: translateZ(0);
        will-change: transform;
        pointer-events: none;
    }

    .toast-container {
        @apply cursor-pointer rounded-lg border shadow-lg text-white;
        @apply transition-all duration-200 hover:translate-y-[-2px] hover:shadow-xl;
        @apply flex items-start p-4;
        pointer-events: auto;
        transform: translateZ(1px);
        backface-visibility: hidden;
        -webkit-font-smoothing: antialiased;
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
