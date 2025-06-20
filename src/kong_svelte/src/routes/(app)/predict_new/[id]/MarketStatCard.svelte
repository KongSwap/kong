<script lang="ts">
  import type { ComponentType } from 'svelte';

  export let icon: ComponentType | null = null;
  export let logoUrl: string | null = null;
  export let label: string;
  export let value: string;
</script>

<div class="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-kong-bg-secondary/50 rounded transition-colors hover:bg-kong-bg-secondary/20">
  <div class="p-2 rounded">
    {#if logoUrl}
      <img src={logoUrl} alt="Token Logo" class="w-8 h-8 object-contain" />
    {:else if icon}
      <svelte:component this={icon} class="w-8 h-8 text-kong-success" />
    {/if}
  </div>
  <div>
    <div class="text-xs sm:text-sm text-kong-text-secondary font-medium">{label}</div>
    <div class="text-sm sm:text-lg font-bold text-kong-text-primary {label === 'Time Left' ? 'font-mono tabular-nums' : ''}">
      {value}
    </div>
  </div>
</div> 