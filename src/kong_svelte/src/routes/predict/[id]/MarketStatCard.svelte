<script lang="ts">
  import type { ComponentType } from 'svelte';

  export let icon: ComponentType;
  export let label: string;
  export let value: string;
</script>

<div class="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-kong-bg-light/10 rounded transition-colors hover:bg-kong-bg-light/20">
  <div class="p-2 sm:p-3 bg-kong-accent-green/10 rounded">
    <svelte:component this={icon} class="w-5 h-5 sm:w-6 sm:h-6 text-kong-accent-green" />
  </div>
  <div>
    <div class="text-xs sm:text-sm text-kong-text-secondary font-medium">{label}</div>
    <div class="text-sm sm:text-lg font-bold text-kong-text-primary {label === 'Time Left' ? 'font-mono tabular-nums' : ''}">
      {value}
    </div>
  </div>
</div> 