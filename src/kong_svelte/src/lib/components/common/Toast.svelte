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
  
  // Replace Timeout import with direct type definition
  type TimeoutId = ReturnType<typeof setTimeout>;

  // Memoize the icon and class mappings
  const ICONS = {
    success: IconSuccess,
    error: IconError,
    warning: IconWarning,
    info: IconInfo,
  } as const;

  const TYPE_CLASSES = {
    success: "toast-success",
    error: "toast-error",
    warning: "toast-warning",
    info: "toast-info",
  } as const;

  const ICON_COLORS = {
    success: "text-kong-success",
    error: "text-kong-error",
    warning: "text-kong-accent-yellow",
    info: "text-kong-accent-blue",
  } as const;

  const DEFAULT_DURATION = 5000;
  const DEFAULT_TITLE = "Notification";

  // Use a Set to track active timeouts
  const activeTimeouts = new Set<TimeoutId>();

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
      onmouseenter={handleMouseEnter(toast)}
      onmouseleave={handleMouseLeave(toast)}
    >
      <div
        class="toast-container flex flex-row items-start gap-3 p-4 rounded-lg relative w-full
          transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg cursor-pointer
          {TYPE_CLASSES[toast.type] || ''}"
        onclick={() => dismissToast(toast.id)}
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
              <div class="font-medium text-sm text-kong-text-primary sm:text-xs">
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
                  onclick={(e) => e.stopPropagation && dismissToast(toast.id)}
                >
                  <IconClose class="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                </button>
              </div>
            </div>

            <!-- Message -->
            {#if toast.message}
              <div class="message text-xs leading-relaxed text-kong-text-secondary sm:text-xs">
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
    @apply fixed bottom-4 right-4 flex flex-col items-end gap-2 max-w-md z-[999999];
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
    @apply w-full pointer-events-auto backdrop-blur-md bg-kong-bg-primary/95;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1);
    @apply rounded-md border border-kong-border/20;
    animation: toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* Success Toast */
  .toast-success {
    @apply border-l-2 border-l-kong-success;
    background-image: linear-gradient(to right, rgba(163, 190, 140, 0.08), transparent 30%);
  }

  /* Error Toast */
  .toast-error {
    @apply border-l-2 border-l-kong-error;
    background-image: linear-gradient(to right, rgba(191, 97, 106, 0.08), transparent 30%);
  }

  /* Warning Toast */
  .toast-warning {
    @apply border-l-2 border-l-kong-accent-yellow; 
    background-image: linear-gradient(to right, rgba(235, 203, 139, 0.08), transparent 30%);
  }

  /* Info Toast */
  .toast-info {
    @apply border-l-2 border-l-kong-accent-blue;
    background-image: linear-gradient(to right, rgba(129, 161, 193, 0.08), transparent 30%);
  }

  .close-button {
    @apply -mr-1 flex items-center justify-center w-5 h-5 rounded-full
      hover:bg-kong-bg-secondary/30
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

  @keyframes toast-in {
    0% {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 640px) {
    .toast-wrapper {
      @apply fixed bottom-4 right-0 left-0 px-4;
      max-width: none;
    }

    .toast-outer {
      min-width: 0;
      max-width: none;
      @apply w-full;
    }

    .toast-container {
      @apply rounded-md p-3 shadow-lg;
      background: theme('colors.kong.bg-dark/98');
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
