<script lang="ts">
  import { AlertCircle, X } from "lucide-svelte";
  import { fly, fade } from "svelte/transition";
  import { quintOut } from "svelte/easing";

  // Props
  type Props = {
    message: string;
    onDismiss?: () => void;
    variant?: 'error' | 'warning' | 'info';
  };

  let {
    message,
    onDismiss,
    variant = 'error'
  }: Props = $props();

  const variantClasses = {
    error: 'bg-kong-error/10 text-kong-error border-kong-error/20',
    warning: 'bg-kong-accent-yellow/10 text-kong-accent-yellow border-kong-accent-yellow/20',
    info: 'bg-kong-primary/10 text-kong-primary border-kong-primary/20'
  };
</script>

<div
  in:fly={{ y: -20, duration: 300, easing: quintOut }}
  out:fade={{ duration: 200 }}
  class="error-message {variantClasses[variant]}"
  role="alert"
>
  <AlertCircle size={16} class="flex-shrink-0" />
  <span>{message}</span>
  {#if onDismiss}
    <button
      class="dismiss-button"
      onclick={onDismiss}
      aria-label="Dismiss message"
    >
      <X size={14} />
    </button>
  {/if}
</div>

<style lang="postcss">
  .error-message {
    @apply flex items-center gap-2 p-3 rounded-lg border text-sm;
  }

  .dismiss-button {
    @apply ml-auto opacity-80 hover:opacity-100 transition-opacity;
  }
</style>