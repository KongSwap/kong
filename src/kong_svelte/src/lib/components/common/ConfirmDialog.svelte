<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";

  // Props
  type Props = {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
  };

  let {
    isOpen = false,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = 'danger',
    onConfirm,
    onCancel
  }: Props = $props();

  const variantClasses = {
    danger: 'bg-kong-error hover:bg-kong-error-hover',
    warning: 'bg-kong-accent-yellow hover:bg-kong-accent-yellow/90',
    info: 'bg-kong-primary hover:bg-kong-primary-hover'
  };
</script>

{#if isOpen}
  <div
    class="confirm-dialog-backdrop"
    in:fade={{ duration: 200 }}
    onclick={onCancel}
  >
    <div
      class="confirm-dialog-content"
      in:fly={{ y: 20, duration: 300, easing: quintOut }}
      onclick={(e) => e.stopPropagation()}
    >
      <h3 class="dialog-title">{title}</h3>
      <p class="dialog-message">{message}</p>

      <div class="dialog-actions">
        <button
          class="cancel-button"
          onclick={onCancel}
        >
          {cancelText}
        </button>
        <button
          class="confirm-button {variantClasses[variant]}"
          onclick={onConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .confirm-dialog-backdrop {
    @apply fixed inset-0 flex items-center justify-center z-50;
    @apply bg-black/50 backdrop-blur-sm;
  }

  .confirm-dialog-content {
    @apply p-5 bg-kong-bg-primary rounded-xl border border-kong-border;
    @apply shadow-lg max-w-md w-full mx-4;
  }

  .dialog-title {
    @apply text-xl font-bold text-kong-text-primary mb-3;
  }

  .dialog-message {
    @apply text-kong-text-secondary mb-5;
  }

  .dialog-actions {
    @apply flex justify-end gap-3;
  }

  .cancel-button {
    @apply px-4 py-2 rounded-lg border border-kong-border;
    @apply text-kong-text-secondary hover:bg-kong-bg-secondary/10;
    @apply transition-colors;
  }

  .confirm-button {
    @apply px-4 py-2 rounded-lg text-white transition-colors;
  }
</style>