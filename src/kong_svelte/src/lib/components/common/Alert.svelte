<script lang="ts">
  import { X, Info, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-svelte";
  
  interface Props {
    type?: "info" | "success" | "warning" | "error";
    title: string;
    message?: string;
    dismissible?: boolean;
    onDismiss?: () => void;
  }
  
  let { 
    type = "info",
    title,
    message = "",
    dismissible = false,
    onDismiss
  }: Props = $props();
  
  const icons = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    error: AlertCircle,
  };
  
  const typeClasses = {
    info: "alert-info",
    success: "alert-success",
    warning: "alert-warning",
    error: "alert-error",
  };
  
  const iconColors = {
    info: "text-kong-info",
    success: "text-kong-success",
    warning: "text-kong-warning",
    error: "text-kong-error",
  };
</script>

<div class="alert-container {typeClasses[type]}">
  <div class="flex items-start gap-3">
    <!-- Icon -->
    <div class="shrink-0 pt-0.5">
      <svelte:component 
        this={icons[type]} 
        class="w-5 h-5 {iconColors[type]}"
      />
    </div>
    
    <!-- Content -->
    <div class="flex-1 min-w-0">
      <h3 class="font-medium text-sm text-kong-text-primary mb-1">
        {title}
      </h3>
      {#if message}
        <p class="text-xs text-kong-text-secondary leading-relaxed">
          {message}
        </p>
      {/if}
    </div>
    
    <!-- Dismiss button -->
    {#if dismissible && onDismiss}
      <button
        onclick={onDismiss}
        class="shrink-0 p-1 rounded-full hover:bg-kong-bg-secondary/30 
               text-kong-text-secondary hover:text-kong-text-primary 
               transition-colors"
        aria-label="Dismiss alert"
      >
        <X class="w-4 h-4" />
      </button>
    {/if}
  </div>
</div>

<style lang="postcss">
  .alert-container {
    @apply w-full p-4 rounded-kong-roundness border;
    @apply bg-kong-bg-secondary;
  }
  
  .alert-info {
    @apply border-kong-info/20 bg-kong-info/5;
  }
  
  .alert-success {
    @apply border-kong-success/20 bg-kong-success/5;
  }
  
  .alert-warning {
    @apply border-kong-warning/20 bg-kong-warning/15;
  }
  
  .alert-error {
    @apply border-kong-error/20 bg-kong-error/5;
  }
</style>
