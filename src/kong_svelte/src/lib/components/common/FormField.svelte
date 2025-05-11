<script lang="ts">
  import { AlertTriangle, HelpCircle } from "lucide-svelte";
  export let id = '';
  export let label = '';
  export let helpText: string | null = null;
  export let error: string | null = null;
</script>

<div class="space-y-2">
  <div class="flex items-center gap-2">
    <label for={id} class="block text-xs uppercase font-medium text-kong-text-primary">{label}</label>
    {#if helpText}
      <div class="group relative">
        <HelpCircle size={16} class="text-kong-text-secondary cursor-help" />
        <div class="absolute left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-kong-bg-dark border border-kong-border rounded-lg text-sm text-kong-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {helpText}
          <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-kong-bg-dark border-t border-l border-kong-border transform rotate-45"></div>
        </div>
      </div>
    {/if}
  </div>

  <slot />

  {#if error}
    <p class="text-sm text-kong-text-accent-red flex items-center gap-2 mt-2">
      <AlertTriangle size={16} />
      {error}
    </p>
  {/if}
</div> 