<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { toastStore, type Toast } from "$lib/stores/toastStore";
  import {
    X as IconClose,
    CheckCircle2 as IconSuccess,
    AlertCircle as IconError,
    AlertTriangle as IconWarning,
    Info as IconInfo,
  } from "lucide-svelte";

  // Memoize the icon and class mappings
  const ICONS = {
    success: IconSuccess,
    error: IconError,
    warning: IconWarning,
    info: IconInfo,
  } as const;

  const TYPE_CLASSES = {
    success: "border-l-[3px] border-l-kong-success bg-gradient-to-r from-kong-success/[0.07] to-transparent",
    error: "border-l-[3px] border-l-kong-error bg-gradient-to-r from-kong-error/[0.07] to-transparent",
    warning: "border-l-[3px] border-l-kong-warning bg-gradient-to-r from-kong-warning/[0.07] to-transparent",
    info: "border-l-[3px] border-l-kong-primary bg-gradient-to-r from-kong-primary/[0.07] to-transparent",
  } as const;

  const ICON_COLORS = {
    success: "text-kong-success",
    error: "text-kong-error",
    warning: "text-kong-warning",
    info: "text-kong-primary",
  } as const;

  const DEFAULT_DURATION = 5000;
  const DEFAULT_TITLE = "Notification";

  // Use a Set to track active timeouts
  const activeTimeouts = new Set<number>();

  function dismissToast(id: string) {
    toastStore.dismiss(id);
  }

  function startToastTimer(toast: Toast) {
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
      activeTimeouts.delete(toast.timeoutId);
    }
    const duration = toast.duration || DEFAULT_DURATION;
    const timeoutId = setTimeout(() => {
      dismissToast(toast.id);
      activeTimeouts.delete(timeoutId);
    }, duration);
    
    toast.timeoutId = timeoutId;
    activeTimeouts.add(timeoutId);
  }

  // Cleanup timeouts on component destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    activeTimeouts.forEach(clearTimeout);
    activeTimeouts.clear();
  });

  // Initialize timers for new toasts - use more efficient reactive statement
  $: $toastStore.forEach(toast => {
    if (!toast.timestamp) toast.timestamp = Date.now();
    if (!toast.timeoutId) startToastTimer(toast);
  });

  // Memoize event handlers
  const handleMouseEnter = (toast: Toast) => () => {
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
      activeTimeouts.delete(toast.timeoutId);
      toast.timeoutId = undefined;
    }
  };

  const handleMouseLeave = (toast: Toast) => () => {
    startToastTimer(toast);
  };

  // Memoize time formatter
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  };
</script>

<div class="toast-wrapper" aria-live="polite">
  {#each $toastStore as toast (toast.id)}
    <div
      class="toast-outer"
      in:fly|local={{ x: 150, duration: 300, easing: (t) => t * t }}
      out:fade|local={{ duration: 200 }}
      on:mouseenter={handleMouseEnter(toast)}
      on:mouseleave={handleMouseLeave(toast)}
    >
      <div
        class="toast-container flex flex-row items-start gap-3 p-4 rounded-lg relative w-full
          transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg cursor-default
          bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-lg {TYPE_CLASSES[toast.type] || ''}"
      >
        <!-- Toast Type Icon -->
        {#if ICONS[toast.type]}
          <div class="shrink-0 flex items-center pt-0.5">
            <svelte:component
              this={ICONS[toast.type]}
              class="w-5 h-5 {ICON_COLORS[toast.type]} sm:w-4 sm:h-4"
            />
          </div>
        {/if}

        <!-- Main Content -->
        <div class="flex-1 min-w-0">
          <div class="flex flex-col gap-1">
            <!-- Title -->
            <div class="flex items-center justify-between">
              <div class="font-medium text-sm text-kong-text-primary sm:text-sm">
                {toast.title || DEFAULT_TITLE}
              </div>
              <div class="flex items-center gap-2">
                <!-- Timestamp -->
                <div class="text-xs text-kong-text-secondary opacity-75">
                  {formatTime(toast.timestamp)}
                </div>
                <!-- Close Button -->
                <button
                  class="close-button"
                  on:click={() => dismissToast(toast.id)}
                >
                  <IconClose class="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                </button>
              </div>
            </div>

            <!-- Message -->
            {#if toast.message}
              <div class="message text-sm leading-relaxed text-kong-text-secondary sm:text-base">
                {toast.message}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/each}
</div>

<style lang="postcss">
  .toast-wrapper {
    @apply fixed top-20 right-4 flex flex-col items-end gap-3 max-w-md z-[999999];
    isolation: isolate;
    transform: translateZ(0);
    pointer-events: none;
  }

  .toast-outer {
    @apply w-full flex pointer-events-auto;
    min-width: 20rem;
    max-width: min(calc(100vw - 2rem), 28rem);
  }

  .toast-container {
    @apply w-full pointer-events-auto;
    animation: slide-up 0.15s ease-out;
  }

  .close-button {
    @apply -mr-1 flex items-center justify-center w-5 h-5 rounded-full
      hover:bg-black/5 dark:hover:bg-white/5
      text-kong-text-secondary hover:text-kong-text-primary
      transition-colors sm:w-4 sm:h-4;
  }

  .message {
    @apply break-words;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 640px) {
    .toast-wrapper {
      @apply fixed top-4 right-0 left-0 p-2;
      max-width: none;
    }

    .toast-outer {
      min-width: 0;
      max-width: none;
      @apply px-2;
    }

    .toast-container {
      @apply rounded-xl p-3;
    }
  }

  @supports (padding-bottom: env(safe-area-inset-bottom)) {
    @media (max-width: 640px) {
      .toast-wrapper {
        padding-bottom: calc(env(safe-area-inset-bottom) + 0.5rem);
      }
    }
  }
</style>
