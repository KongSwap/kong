<script lang="ts">
  export let id: string;
  export let label: string;
  export let helpText: string = "";
  export let error: string = "";
</script>

<div class="space-y-2">
  <label for={id} class="block text-sm font-medium text-kong-text-primary">
    {label}
  </label>
  {#if helpText}
    <p class="text-xs text-kong-text-secondary">{helpText}</p>
  {/if}
  <div>
    <slot />
  </div>
  {#if error}
    <p class="text-xs text-kong-error mt-1">{error}</p>
  {/if}
</div>